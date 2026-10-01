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
import { log } from '../lib/log.js';

const SCORE_FLOOR = 6;

const SYSTEM = `You are the quality assurance layer of a BD intelligence pipeline for the AI infrastructure market.

You receive signals collected by four independent agents. Your job is to decide what a busy BD professional should actually see, and to be honest about what you cannot verify.

For every signal, judge:
1. RELEVANCE (0-10) for someone doing business development in AI infrastructure — GPU cloud, enterprise ML, AI tooling, NVIDIA ecosystem.
   8-10 = a named organisation took a dated action that creates a concrete reason to make contact now.
   6-7  = real and relevant market intelligence, but not directly actionable this week.
   0-5  = vague, undated, sector-level, pure commentary, or no clear BD implication.
2. DUPLICATION — the same underlying event may have been collected by more than one agent under different wording. Group those together and keep the single best-sourced version.
3. REVIEW FLAG — set needs_review true when the claim is high-stakes but thinly sourced, a figure or date looks implausible, the company attribution is ambiguous, or the signal is an inference rather than a stated fact. Say why in review_reason.

SCORING DISCIPLINE — this matters more than coverage:
- Do not inflate. If most signals in a batch score 8+, you are scoring the batch's internal ranking rather than real BD value. A normal week has a handful of 8s and a long tail of 6s and below.
- A sector trend is not an organisation-level trigger. "The GPU market is tight" scores low; "Company X signed a 50MW capacity deal on [date]" scores high.
- An undated signal cannot be urgent. Cap anything with date null at 7.
- Judge only what the summary and source actually state. Never upgrade a signal using your own knowledge of the company, and never add facts.

Then identify CONNECTIONS: non-obvious links across categories where two or more signals together mean more than they do apart (a funding round plus a competitor's capacity constraint; a model release plus a stated procurement). Only real links present in the signals. If there are none, return an empty array.

Reply with JSON only:
{"verified":[{"id":"the id given","relevance_score":0,"needs_review":false,"review_reason":"","duplicate_of":null}],
 "connections":[{"observation":"one sentence","signal_ids":["id","id"]}],
 "assessment":"one sentence on the overall quality of this week's collection"}

Include every input id exactly once in "verified". For a duplicate, set duplicate_of to the id of the version you kept.`;

// `deps` exists so the verification logic can be tested against a scripted
// model response without reaching Nebius. Production callers omit it.
export default async function qaVerify({ signals }, deps = {}) {
  const ask = deps.completeJSON ?? completeJSON;
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
  const { data, model, usage } = await ask({
    tier: 'ultra',
    temperature: 0.2,
    maxTokens: 4000,
    system: SYSTEM,
    user: buildPrompt(unique),
  });

  const verdicts = new Map(
    (Array.isArray(data?.verified) ? data.verified : [])
      .filter((v) => v && typeof v.id === 'string')
      .map((v) => [v.id, v]),
  );
  log.step(`Ultra returned verdicts for ${verdicts.size}/${unique.length} signals`);

  const kept = [];
  let dropped = 0, dupes = 0, flagged = 0, unjudged = 0;

  for (const s of unique) {
    const v = verdicts.get(s.id);
    // A signal the model skipped keeps its collector score rather than being
    // silently dropped — but it is flagged, because it was never verified.
    if (!v) {
      unjudged++;
      if ((s.relevance_score ?? 0) >= SCORE_FLOOR) {
        kept.push({ ...s, needs_review: true, review_reason: 'Not returned by the verification pass — unverified', verified: false });
        flagged++;
      } else dropped++;
      continue;
    }
    if (v.duplicate_of && v.duplicate_of !== s.id) { dupes++; continue; }

    const score = clamp(v.relevance_score, s.relevance_score);
    if (score < SCORE_FLOOR) { dropped++; continue; }

    const needsReview = Boolean(v.needs_review) || !s.date;
    if (needsReview) flagged++;
    kept.push({
      ...s,
      relevance_score: score,
      collector_score: s.relevance_score,
      needs_review: needsReview,
      review_reason: String(v.review_reason || (!s.date ? 'No published date on source' : '')).trim(),
      verified: true,
    });
  }

  kept.sort((a, b) => b.relevance_score - a.relevance_score || (b.date ?? '').localeCompare(a.date ?? ''));

  const connections = (Array.isArray(data?.connections) ? data.connections : [])
    .filter((c) => c && typeof c.observation === 'string' && c.observation.trim())
    .map((c) => ({
      observation: c.observation.trim(),
      signal_ids: Array.isArray(c.signal_ids) ? c.signal_ids.filter((id) => kept.some((s) => s.id === id)) : [],
    }))
    .slice(0, 5);

  log.ok(`${kept.length} verified · ${dupes} cross-category duplicates · ${dropped} below score ${SCORE_FLOOR} · ${flagged} flagged for review`);
  if (unjudged) log.warn(`${unjudged} signals were not judged by the model and are flagged as unverified`);
  if (connections.length) log.ok(`${connections.length} cross-category connections identified`);

  return {
    signals: kept,
    connections,
    assessment: String(data?.assessment || '').trim(),
    model,
    usage,
    stats: { input: signals.length, unique: unique.length, kept: kept.length, duplicates: dupes, dropped, flagged, unjudged },
    summary: `${kept.length} verified from ${signals.length} (${dropped} dropped, ${dupes} deduped, ${flagged} flagged)`,
  };
}

function buildPrompt(signals) {
  const blocks = signals.map((s) => [
    `ID: ${s.id}`,
    `CATEGORY: ${s.category}`,
    `COMPANY: ${s.company}`,
    `SIGNAL TYPE: ${s.signal_type}`,
    `DATE: ${s.date ?? 'NONE — no published date'}`,
    `SUMMARY: ${s.summary}`,
    `SOURCE: ${s.url}`,
    `COLLECTOR SCORE: ${s.relevance_score}`,
  ].join('\n')).join('\n\n');

  return `${signals.length} signals were collected this week across four categories.

${blocks}

Verify, score, deduplicate and connect them. Return JSON for all ${signals.length} ids.`;
}

function clamp(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return clamp(fallback, 0);
  return Math.max(0, Math.min(10, Math.round(n)));
}
