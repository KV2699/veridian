// Shared harness for Agents 1-4.
//
// Every collector does the same three things and differs only in its queries
// and its brief: (1) run its Tavily query set, (2) drop URLs already collected
// in a previous week, (3) ask the FAST Nemotron tier to turn raw search hits
// into structured signals. Keeping that shape in one place means a fix to the
// extraction contract lands in all four collectors at once.

import { searchMany, canonicalUrl } from '../lib/tavily.js';
import { checkGrounding } from '../lib/grounding.js';
import { completeJSON } from '../lib/nebius.js';
import { log } from '../lib/log.js';

const SYSTEM = `You are a business development signal extractor for the AI infrastructure market.

You receive raw web search results. You convert them into structured BD signals.

HARD RULES:
- Use ONLY the supplied search results. Never add a company, fact, figure or date from your own knowledge.
- Every signal needs the exact url from the result it came from. Never invent or alter a url.
- date must be the published date of the source. If the result has no date, use null — never guess a date.
- One signal per distinct event. If two results describe the same event, emit one signal.
- The summary must describe what THIS result reports. If a company is only mentioned in passing, or the fact comes from your own knowledge rather than the text in front of you, do not emit a signal for it. The organisation you name must be the organisation the result is actually about.
- A result that is not a dated, specific, named-company event is not a signal. Skip it. Returning three real signals is better than ten padded ones.
- Skip opinion pieces, listicles, roundups, pure stock commentary and vendor marketing with no announced event.
- summary must be one factual sentence naming the company and what happened. No adjectives, no speculation.

OUTPUT FORMAT — this is strict:
Your entire reply must be a single JSON object. Do not reason out loud, do not explain your thinking, do not write a preamble, do not use a code fence. The first character you output must be {.

Reply with JSON only, in this exact shape:
{"signals":[{"company":"string","signal_type":"string","summary":"string","url":"string","date":"YYYY-MM-DD or null","relevance_score":0,"practice_areas":["key"],"org_scale":"large|mid|small|unknown","value_level":"string"}]}

relevance_score is 0-10 for how directly this matters to the stated BD focus. Be strict: 8+ means a named buying, building or partnering event.

practice_areas: the keys of every offering this signal opens a genuine conversation for. Use ONLY the keys listed under PRACTICE AREAS below. Include an area only if the signal gives a real reason to discuss it — do not pad the list, and do not include an area just because the company could theoretically buy it one day. An empty list is correct when the signal opens nothing specific.

value_level: how much commercial value this signal implies, using ONLY the levels defined under COMMERCIAL VALUE below. Base it strictly on figures the source actually states. If the source gives no size, use the unknown level — never estimate.

org_scale: the size of the organisation named — "large" (major enterprise, hyperscaler, government, or household name), "mid", "small" (startup, small institution), or "unknown" when the source does not say. Never guess "large" to inflate a signal.
If nothing in the results qualifies, return {"signals":[]}.`;

// Hits are summarised in small batches for three reasons: one oversized prompt
// cannot blow the context window, a single bad batch cannot lose the whole
// collection, and — measured on real web content — a reasoning-tuned model
// needs the per-call output to stay small or it exhausts its token budget
// thinking and never answers.
const BATCH = Number(process.env.EXTRACTION_BATCH) || 4;

export async function runCollector(
  { key, name, category, focus, signalTypes, queries, windowDays = 7, polarity = [], practiceAreas = [], valueFactor = null },
  ctx = {},
  deps = {},
) {
  const known = ctx.knownUrlKeys ?? new Set();
  const find = deps.searchMany ?? searchMany;
  const ask = deps.completeJSON ?? completeJSON;

  // A tracker has to be populated before it can be maintained. BACKFILL widens
  // every window for one run, so the first sweep builds a register rather than
  // reporting a single quiet week.
  const backfillX = Number(process.env.BACKFILL_MULTIPLIER) || 6;
  const days = process.env.BACKFILL === 'true' ? windowDays * backfillX : windowDays;
  const maxResults = process.env.BACKFILL === 'true' ? 20 : 10;

  log.step(`Running ${queries.length} Tavily searches (${days}-day window${days !== windowDays ? ', backfill' : ''})`);
  const { results, stats } = await find(queries, { days, maxResults });

  const fresh = results.filter((h) => !known.has(canonicalUrl(h.url)));
  log.step(`${results.length} unique results, ${fresh.length} not seen in a previous week`);

  // Per-query telemetry is attributed to this collector for the diagnostics
  // pass, whether or not anything was found.
  let parseFailures = 0;
  let batches = 0;
  let ungrounded = 0;
  const telemetry = (extracted) => ({
    key: key ?? category,
    name,
    queries: stats.map((s) => ({ ...s, fresh: freshPerQuery(fresh, s.query) })),
    hits: results.length,
    fresh: fresh.length,
    extracted,
    parseFailures,
    batches,
    ungrounded,
  });

  if (!fresh.length) {
    return { category, signals: [], telemetry: telemetry(0), summary: '0 signals (no new results)' };
  }

  const signals = [];
  for (let i = 0; i < fresh.length; i += BATCH) {
    batches++;
    const batch = fresh.slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    const of = Math.ceil(fresh.length / BATCH);
    log.step(`Nemotron FAST extraction, batch ${n}/${of} (${batch.length} results)`);
    try {
      const { data } = await ask({
        tier: 'fast',
        temperature: 0,
        maxTokens: 4000,
        expectKey: 'signals',
        system: SYSTEM,
        user: buildPrompt({ focus, signalTypes, batch, polarity, practiceAreas, valueFactor }),
      });
      signals.push(...normalise(data?.signals, {
        batch, category, practiceAreas, valueFactor,
        onDrop: ({ company, reason }) => { ungrounded++; log.warn(`dropped "${company}" — ${reason}`); },
      }));
    } catch (err) {
      // Counted separately from "found nothing": a batch that failed to parse
      // is a model-output problem, not evidence the market is quiet.
      parseFailures++;
      log.warn(`batch ${n}/${of} extraction failed, continuing — ${err.message}`);
    }
  }

  log.ok(`${signals.length} signals extracted from ${fresh.length} results${ungrounded ? ` (${ungrounded} dropped as ungrounded)` : ''}`);
  return {
    category,
    signals,
    telemetry: telemetry(signals.length),
    summary: `${signals.length} signals from ${results.length} results`,
  };
}

const freshPerQuery = (fresh, query) => fresh.filter((h) => h.found_via === query).length;

function buildPrompt({ focus, signalTypes, batch, polarity = [], practiceAreas = [], valueFactor = null }) {
  const results = batch.map((h, i) => [
    `--- RESULT ${i + 1} ---`,
    `TITLE: ${h.title}`,
    `URL: ${h.url}`,
    `PUBLISHED: ${h.published_date ?? 'unknown'}`,
    `CONTENT: ${(h.content || '').slice(0, 1500)}`,
  ].join('\n')).join('\n\n');

  // Polarity rules travel with the prompt because the same event means
  // opposite things to different businesses — an appointment is a lead for one
  // and a lost mandate for another. This cannot be inferred, only stated.
  const polarityBlock = polarity.length
    ? `\nHOW TO READ THESE EVENTS (this business specifically):\n${polarity.map((p) => `- ${p}`).join('\n')}\n`
    : '';

  const areasBlock = practiceAreas.length
    ? `\nPRACTICE AREAS (the offerings this business sells — map each signal to the ones it opens):\n${practiceAreas.map((a) => `- ${a.key}: ${a.name} — ${a.description}`).join('\n')}\n`
    : '';

  const valueBlock = valueFactor?.guidance?.length
    ? `\nCOMMERCIAL VALUE — set value_level to one of: ${Object.keys(valueFactor.points ?? {}).join(' | ')}\n${valueFactor.guidance.map((g) => `- ${g}`).join('\n')}\n`
    : '';

  return `BD FOCUS: ${focus}${areasBlock}${valueBlock}

SIGNAL TYPES TO LOOK FOR:
${signalTypes.map((t) => `- ${t}`).join('\n')}
${polarityBlock}

SEARCH RESULTS:

${results}

Extract the qualifying signals as JSON.`;
}

// The model's output is never trusted as-is: urls must match a supplied result,
// dates must be real and in-window-shaped, scores must be numbers 0-10.
export function normalise(raw, { batch, category, practiceAreas = [], valueFactor = null, onDrop } = {}) {
  const validAreas = new Set(practiceAreas.map((a) => a.key));
  const validLevels = new Set(Object.keys(valueFactor?.points ?? {}));
  if (!Array.isArray(raw)) return [];
  const allowed = new Map(batch.map((h) => [canonicalUrl(h.url), h]));
  const out = [];
  const seen = new Set();

  for (const s of raw) {
    if (!s || typeof s !== 'object') continue;
    const url = typeof s.url === 'string' ? s.url.trim() : '';
    const key = url && canonicalUrl(url);
    const source = key && allowed.get(key);

    // A url the search did not return means the model invented or mangled it.
    if (!source) continue;
    if (seen.has(key)) continue;

    const company = str(s.company);
    const summary = str(s.summary);
    if (!company || !summary) continue;

    // A url that came back from the search still has to SAY this. A claim
    // attached to a source that never mentions the organisation is a
    // misattribution, and it is dropped rather than flagged.
    const grounding = checkGrounding({ company, summary, url: source.url }, source);
    if (!grounding.ok) {
      onDrop?.({ company, summary, url: source.url, reason: grounding.reason });
      continue;
    }

    // Marked seen only once the row is known good, so a malformed row cannot
    // claim a url and suppress a valid signal for the same source.
    seen.add(key);
    out.push({
      company,
      signal_type: str(s.signal_type) || 'Unclassified',
      summary,
      url: source.url,
      url_key: key,
      date: isoDate(s.date) ?? isoDate(source.published_date),
      relevance_score: clamp(s.relevance_score),
      // Only practice areas this profile actually sells survive — a model that
      // invents an offering must not be able to inflate the multi-service score.
      practice_areas: validAreas.size
        ? [...new Set((Array.isArray(s.practice_areas) ? s.practice_areas : [])
            .map((a) => String(a ?? '').trim().toLowerCase())
            .filter((a) => validAreas.has(a)))]
        : [],
      org_scale: orgScale(s.org_scale),
      // A level the profile does not define cannot score — unknown is the
      // safe default, and unknown is worth nothing.
      ...(valueFactor
        ? { [valueFactor.key]: validLevels.has(String(s.value_level ?? '').toLowerCase())
            ? String(s.value_level).toLowerCase() : 'unknown' }
        : {}),
      category,
      source_title: source.title,
      found_via: source.found_via,
      collected_at: new Date().toISOString(),
      // Carried forward so the verifier and the briefing can mark a claim the
      // source only partly supports, rather than presenting it as settled.
      grounding_note: grounding.reason || null,
      weak_source: grounding.weakSource,
      // False when the organisation is only mentioned in passing — the single
      // most common way a plausible-looking claim gets attached to the wrong
      // article.
      source_is_about_company: grounding.subject !== false,
    });
  }
  return out;
}

const str = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

function isoDate(v) {
  if (typeof v !== 'string') return null;
  const m = v.match(/\d{4}-\d{2}-\d{2}/);
  if (!m) return null;
  const d = new Date(m[0]);
  if (Number.isNaN(d.getTime())) return null;
  // Reject anything in the future or absurdly old — both are extraction errors.
  const now = Date.now();
  if (d.getTime() > now + 864e5 || d.getTime() < now - 365 * 864e5) return null;
  return m[0];
}

// Unknown is the safe default: scale points treat unknown as small, so a
// missing value can never inflate a score.
function orgScale(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'large') return 'large';
  if (s === 'mid' || s === 'medium') return 'mid';
  if (s === 'small') return 'small';
  return 'unknown';
}

function clamp(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 5;
  return Math.max(0, Math.min(10, Math.round(n)));
}
