// AGENT 5 — QA Verifier  ·  NVIDIA Nemotron Ultra (deep reasoning tier)
//
// This is the stage that makes the pipeline trustworthy. Collectors are tuned
// to find things; this agent is tuned to be right about them. It is the only
// place in the system where signals are allowed to be removed.
//
// Nemotron Ultra does the judgement work — relevance scoring, cross-category
// deduplication, human-review flagging and connection-finding. Deterministic
// checks that do not need a model (exact URL dedup, the score-6 floor, schema
// validation) are applied in code around it, so a model slip cannot let a
// malformed or sub-threshold signal through.

import { completeJSON, MODELS } from '../lib/nebius.js';
import { scoreAll, valueFactorFor } from '../lib/score.js';
import { log } from '../lib/log.js';

const DEFAULT_FLOOR = 6;

// One verdict is roughly 50 output tokens, so a busy week of 70 signals needs
// ~3,500 before the model has written a single connection — and a reasoning
// model needs headroom on top of that or it thinks until the budget is gone.
const VERIFY_MAX_TOKENS = Number(process.env.VERIFY_MAX_TOKENS) || 16000;

// Above this, signals are verified in chunks. Cross-category deduplication is
// strongest in a single pass, so the chunk size is kept generous and only a
// genuinely large week is split.
const VERIFY_CHUNK = Number(process.env.VERIFY_CHUNK) || 20;

const SYSTEM = `You are the quality assurance layer of a BD intelligence pipeline for the AI infrastructure market.

You receive signals collected by four independent agents. Your job is to decide what a busy BD professional should actually see, and to be honest about what you cannot verify.

For every signal, judge:
1. RELEVANCE (0-10) for someone doing business development in AI infrastructure — GPU cloud, enterprise ML, AI tooling, NVIDIA ecosystem.
   8-10 = a named organisation took a dated action that creates a concrete reason to make contact now.
   6-7  = real and relevant market intelligence, but not directly actionable this week.
   0-5  = vague, undated, sector-level, pure commentary, or no clear BD implication.
2. DUPLICATION — the same underlying event may have been collected by more than one agent under different wording. Group those together and keep the single best-sourced version.
3. PRACTICE AREA MAPPING — the collector proposed which offerings each signal opens a conversation for. Correct it, and correct it DOWNWARDS by default.

   The test is not "could this organisation conceivably buy that offering." Almost every organisation in this market could conceivably buy almost everything. The test is: does THIS SPECIFIC DATED EVENT give a concrete, statable reason to open a conversation about that offering this week?

   - MOST SIGNALS OPEN EXACTLY ONE AREA. A funding round is capital, not a networking conversation. A model release is software, not a compute conversation.
   - Two areas require the event itself to implicate both — for example an announced buildout that names both hardware and the platform running on it.
   - Three or more should be rare and should only happen when the source explicitly describes a programme spanning them.
   - If you cannot write the sentence "this event means they need to talk to us about X" for an area, remove it.

   GROUNDING NOTES: some signals arrive with a note saying the organisation is only mentioned in passing, that a figure could not be found in the source, or that the source is a social-media post rather than reporting. Treat every one of these as a reason to set needs_review, and never score such a signal in the top band. A claim attached to an article that is not about that organisation is the most common way a wrong fact reaches a briefing.

   Padding this list is the single easiest way to corrupt this briefing, because a second area moves a signal a whole priority band. When in doubt, drop the area.
4. COMMERCIAL VALUE — confirm or correct value_level using ONLY figures the source actually states. The unknown level is the correct answer whenever no size is given; do not estimate from the company's reputation or the sector's size. Overstating this is the fastest way to make every signal look urgent.

5. ORGANISATION SCALE — confirm or correct the size of the named organisation. "large" means a major enterprise, hyperscaler, government or household name. Use "unknown" when the source does not establish it. Never guess "large" because the sector is large — the organisation must be.
6. REVIEW FLAG — set needs_review true when the claim is high-stakes but thinly sourced, a figure or date looks implausible, the company attribution is ambiguous, or the signal is an inference rather than a stated fact. Say why in review_reason.

SCORING DISCIPLINE — this matters more than coverage:
- Do not inflate. If most signals in a batch score 8+, you are scoring the batch's internal ranking rather than real BD value. A normal week has a handful of 8s and a long tail of 6s and below.
- A sector trend is not an organisation-level trigger. "The GPU market is tight" scores low; "Company X signed a 50MW capacity deal on [date]" scores high.
- An undated signal cannot be urgent. Cap anything with date null at 7.
- Judge only what the summary and source actually state. Never upgrade a signal using your own knowledge of the company, and never add facts.

Then identify CONNECTIONS: non-obvious links across categories where two or more signals together mean more than they do apart (a funding round plus a competitor's capacity constraint; a model release plus a stated procurement). Only real links present in the signals. If there are none, return an empty array.

Reply with JSON only:
{"verified":[{"id":"the id given","relevance_score":0,"practice_areas":["key"],"org_scale":"large|mid|small|unknown","value_level":"string","needs_review":false,"review_reason":"","duplicate_of":null}],
 "connections":[{"observation":"one sentence","signal_ids":["id","id"]}],
 "assessment":"one sentence on the overall quality of this week's collection"}

Include every input id exactly once in "verified". For a duplicate, set duplicate_of to the id of the version you kept.`;

// `deps` exists so the verification logic can be tested against a scripted
// model response without reaching Nebius. Production callers omit it.
export default async function qaVerify({ signals, profile }, deps = {}) {
  const ask = deps.completeJSON ?? completeJSON;
  const floor = profile?.scoring?.floor ?? DEFAULT_FLOOR;
  const factor = valueFactorFor(profile);
  const validLevels = new Set(Object.keys(factor.points ?? {}));
  if (!signals?.length) {
    log.warn('no signals to verify');
    return { signals: [], connections: [], assessment: 'No signals collected this week.', summary: '0 verified' };
  }

  // Exact-URL duplicates are a code problem, not a judgement problem.
  const byUrl = new Map();
  for (const s of signals) {
    const existing = byUrl.get(s.url_key);
    if (!existing || (s.relevance_score ?? 0) > (existing.relevance_score ?? 0)) byUrl.set(s.url_key, s);
  }
  const unique = [...byUrl.values()].map((s, i) => ({ ...s, id: `S${i + 1}` }));
  log.step(`${signals.length} collected → ${unique.length} after exact-URL dedup`);

  log.step(`Nemotron Ultra verification pass (${MODELS.ultra})`);

  const chunks = unique.length > VERIFY_CHUNK ? chunk(unique, VERIFY_CHUNK) : [unique];
  if (chunks.length > 1) {
    log.warn(`${unique.length} signals split into ${chunks.length} verification passes — cross-chunk duplicates are caught by URL only`);
  }

  const verdicts = new Map();
  const rawConnections = [];
  const assessments = [];
  let model = MODELS.ultra;
  let usage = null;

  // A truncated pass is retried on halves rather than accepted partially.
  async function verifyGroup(group, depth = 0) {
    try {
      const res = await ask({
        tier: 'ultra',
        temperature: 0.2,
        maxTokens: VERIFY_MAX_TOKENS,
        expectKey: 'verified',
        system: SYSTEM,
        user: buildPrompt(group, profile),
      });
      model = res.model;
      usage = res.usage;
      for (const v of Array.isArray(res.data?.verified) ? res.data.verified : []) {
        if (v && typeof v.id === 'string') verdicts.set(v.id, v);
      }
      if (Array.isArray(res.data?.connections)) rawConnections.push(...res.data.connections);
      if (res.data?.assessment) assessments.push(String(res.data.assessment).trim());
    } catch (err) {
      if (err.truncated && group.length > 4 && depth < 3) {
        const half = Math.ceil(group.length / 2);
        log.warn(`verification truncated on ${group.length} signals — retrying as ${half} + ${group.length - half}`);
        await verifyGroup(group.slice(0, half), depth + 1);
        await verifyGroup(group.slice(half), depth + 1);
        return;
      }
      throw err;
    }
  }

  for (const [i, group] of chunks.entries()) {
    if (chunks.length > 1) log.step(`verification pass ${i + 1}/${chunks.length} (${group.length} signals)`);
    await verifyGroup(group);
  }

  const data = {
    verified: [...verdicts.values()],
    connections: rawConnections,
    assessment: assessments.join(' '),
  };

  const coverage = verdicts.size / unique.length;
  (coverage < 0.9 ? log.warn : log.step)(
    `Ultra returned verdicts for ${verdicts.size}/${unique.length} signals (${Math.round(coverage * 100)}%)`,
  );

  const kept = [];
  let dropped = 0, dupes = 0, flagged = 0, unjudged = 0;

  for (const s of unique) {
    const v = verdicts.get(s.id);
    // A signal the model skipped keeps its collector score rather than being
    // silently dropped — but it is flagged, because it was never verified.
    if (!v) {
      unjudged++;
      if ((s.relevance_score ?? 0) >= floor) {
        kept.push({ ...s, needs_review: true, review_reason: 'Not returned by the verification pass — unverified', verified: false });
        flagged++;
      } else dropped++;
      continue;
    }
    if (v.duplicate_of && v.duplicate_of !== s.id) { dupes++; continue; }

    const score = clamp(v.relevance_score, s.relevance_score);
    if (score < floor) { dropped++; continue; }

    const needsReview = Boolean(v.needs_review) || !s.date
      || Boolean(s.grounding_note) || Boolean(s.weak_source)
      || s.source_is_about_company === false || Boolean(s.out_of_window);
    if (needsReview) flagged++;

    // The verifier's corrected mapping wins over the collector's proposal, but
    // only ever within the areas this profile actually sells.
    const valid = new Set((profile?.practiceAreas ?? []).map((a) => a.key));
    const areas = Array.isArray(v.practice_areas)
      ? [...new Set(v.practice_areas.map((a) => String(a ?? '').trim().toLowerCase()).filter((a) => valid.has(a)))]
      : s.practice_areas ?? [];

    kept.push({
      ...s,
      practice_areas: areas,
      org_scale: ['large', 'mid', 'small'].includes(String(v.org_scale ?? '').toLowerCase())
        ? String(v.org_scale).toLowerCase()
        : s.org_scale ?? 'unknown',
      [factor.key]: validLevels.has(String(v.value_level ?? '').toLowerCase())
        ? String(v.value_level).toLowerCase()
        : s[factor.key] ?? 'unknown',
      relevance_score: score,
      collector_score: s.relevance_score,
      needs_review: needsReview,
      review_reason: String(
        v.review_reason
        || s.grounding_note
        || s.window_note
        || (s.weak_source ? 'Source is a social media post, not reporting' : '')
        || (!s.date ? 'No published date on source' : ''),
      ).trim(),
      verified: true,
    });
  }

  // Priority score is arithmetic over the four factors, computed here — never
  // taken from the model. Ranking is by that score, not by the model's own
  // relevance view, which is kept alongside it for audit.
  const scored = scoreAll(kept, { valueFactor: factor });
  scored.sort((a, b) => b.priority_score - a.priority_score || (b.date ?? '').localeCompare(a.date ?? ''));

  const multi = scored.filter((s) => s.multi_service).length;
  const bands = scored.reduce((a, s) => { a[s.priority_band] = (a[s.priority_band] ?? 0) + 1; return a; }, {});
  const critical = scored.filter((s) => s.priority_band === 'Critical').length;

  const connections = (Array.isArray(data?.connections) ? data.connections : [])
    .filter((c) => c && typeof c.observation === 'string' && c.observation.trim())
    .map((c) => ({
      observation: c.observation.trim(),
      signal_ids: Array.isArray(c.signal_ids) ? c.signal_ids.filter((id) => scored.some((s) => s.id === id)) : [],
    }))
    .slice(0, 5);

  log.ok(`${scored.length} verified · ${dupes} cross-category duplicates · ${dropped} below score ${floor} · ${flagged} flagged for review`);
  log.ok(`bands: ${Object.entries(bands).map(([b, n]) => `${n} ${b}`).join(' · ')} · ${multi} multi-service`);
  if (unjudged) log.warn(`${unjudged} signals were not judged by the model and are flagged as unverified`);
  if (connections.length) log.ok(`${connections.length} cross-category connections identified`);

  return {
    signals: scored,
    connections,
    assessment: String(data?.assessment || '').trim(),
    model,
    usage,
    stats: {
      input: signals.length, unique: unique.length, kept: scored.length,
      duplicates: dupes, dropped, flagged, unjudged,
      multi_service: multi, critical,
    },
    summary: `${scored.length} verified, ${critical} Critical, ${multi} multi-service`,
  };
}

function buildPrompt(signals, profile) {
  const factor = valueFactorFor(profile);
  const factorKey = factor.key;
  const factorName = factor.name ?? factor.key;
  const blocks = signals.map((s) => [
    `ID: ${s.id}`,
    `CATEGORY: ${s.category}${s.is_account ? ' (EXISTING ACCOUNT)' : ''}`,
    `COMPANY: ${s.company}`,
    `SIGNAL TYPE: ${s.signal_type}`,
    `DATE: ${s.date ?? 'NONE — no published date'}`,
    `SUMMARY: ${s.summary}`,
    `SOURCE: ${s.url}`,
    `COLLECTOR SCORE: ${s.relevance_score}`,
    `PRACTICE AREAS PROPOSED: ${(s.practice_areas ?? []).join(', ') || 'none'}`,
    s.grounding_note ? `GROUNDING CONCERN: ${s.grounding_note}` : null,
    s.weak_source ? 'SOURCE TYPE: social media post, not reporting' : null,
    s.source_is_about_company === false ? 'SOURCE SUBJECT: this article is not about that organisation' : null,
    s.out_of_window ? `AGE: ${s.window_note}` : null,
    `ORG SCALE PROPOSED: ${s.org_scale ?? 'unknown'}`,
    `${factorName.toUpperCase()} PROPOSED: ${s[factorKey] ?? 'unknown'}`,
  ].join('\n')).join('\n\n');

  // Scoring guidance and polarity travel with the prompt: what counts as
  // valuable, and which way each event points, are properties of the business
  // being served, not of the pipeline.
  const guidance = profile?.scoring?.guidance?.length
    ? `\nWHAT IS VALUABLE TO THIS BUSINESS (apply when scoring):\n${profile.scoring.guidance.map((g) => `- ${g}`).join('\n')}\n`
    : '';
  const polarity = profile?.polarity?.length
    ? `\nHOW TO READ THESE EVENTS (this business specifically):\n${profile.polarity.map((p) => `- ${p}`).join('\n')}\n`
    : '';

  const areas = profile?.practiceAreas?.length
    ? `\nPRACTICE AREAS THIS BUSINESS SELLS (use ONLY these keys):\n${profile.practiceAreas.map((a) => `- ${a.key}: ${a.name} — ${a.description}`).join('\n')}\n`
    : '';

  const valueBlock = factor.guidance?.length
    ? `\nCOMMERCIAL VALUE — ${factorName}. Set value_level to one of: ${Object.keys(factor.points ?? {}).join(' | ')}\n${factor.guidance.map((g) => `- ${g}`).join('\n')}\n`
    : '';

  return `${signals.length} signals were collected this week.

MARKET: ${profile?.name ?? 'AI infrastructure'}
${areas}${valueBlock}
${guidance}${polarity}
Signals in the "account" category are organisations this business ALREADY holds a relationship with. Score them on how strong a reason they are to get back in touch. Never mark one as a duplicate of a new prospect — they belong in a separate section of the briefing.

${blocks}

Verify, score, deduplicate and connect them. Return JSON for all ${signals.length} ids.`;
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

function clamp(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return clamp(fallback, 0);
  return Math.max(0, Math.min(10, Math.round(n)));
}
