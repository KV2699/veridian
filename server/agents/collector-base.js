// Shared harness for Agents 1-4.
//
// Every collector does the same three things and differs only in its queries
// and its brief: (1) run its Tavily query set, (2) drop URLs already collected
// in a previous week, (3) ask the FAST Nemotron tier to turn raw search hits
// into structured signals. Keeping that shape in one place means a fix to the
// extraction contract lands in all four collectors at once.

import { searchMany, canonicalUrl } from '../lib/tavily.js';
import { completeJSON } from '../lib/nebius.js';
import { log } from '../lib/log.js';

const SYSTEM = `You are a business development signal extractor for the AI infrastructure market.

You receive raw web search results. You convert them into structured BD signals.

HARD RULES:
- Use ONLY the supplied search results. Never add a company, fact, figure or date from your own knowledge.
- Every signal needs the exact url from the result it came from. Never invent or alter a url.
- date must be the published date of the source. If the result has no date, use null — never guess a date.
- One signal per distinct event. If two results describe the same event, emit one signal.
- A result that is not a dated, specific, named-company event is not a signal. Skip it. Returning three real signals is better than ten padded ones.
- Skip opinion pieces, listicles, roundups, pure stock commentary and vendor marketing with no announced event.
- summary must be one factual sentence naming the company and what happened. No adjectives, no speculation.

Reply with JSON only, in this exact shape:
{"signals":[{"company":"string","signal_type":"string","summary":"string","url":"string","date":"YYYY-MM-DD or null","relevance_score":0}]}

relevance_score is 0-10 for how directly this matters to the stated BD focus. Be strict: 8+ means a named buying, building or partnering event.
If nothing in the results qualifies, return {"signals":[]}.`;

// Hits are summarised in batches so one oversized prompt cannot blow the
// context window, and a single bad batch cannot lose the whole collection.
const BATCH = 8;

export async function runCollector({ number, name, category, focus, signalTypes, queries }, ctx = {}, deps = {}) {
  const known = ctx.knownUrlKeys ?? new Set();
  const find = deps.searchMany ?? searchMany;
  const ask = deps.completeJSON ?? completeJSON;

  log.step(`Running ${queries.length} Tavily searches (7-day window)`);
  const hits = await find(queries, { days: 7, maxResults: 10, depth: 'advanced' });

  const fresh = hits.filter((h) => !known.has(canonicalUrl(h.url)));
  log.step(`${hits.length} unique results, ${fresh.length} not seen in a previous week`);
  if (!fresh.length) {
    return { category, signals: [], searches: queries.length, hits: hits.length, summary: '0 signals (no new results)' };
  }

  const signals = [];
  for (let i = 0; i < fresh.length; i += BATCH) {
    const batch = fresh.slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    const of = Math.ceil(fresh.length / BATCH);
    log.step(`Nemotron FAST extraction, batch ${n}/${of} (${batch.length} results)`);
    try {
      const { data } = await ask({
        tier: 'fast',
        temperature: 0.1,
        maxTokens: 2000,
        system: SYSTEM,
        user: buildPrompt({ focus, signalTypes, batch }),
      });
      signals.push(...normalise(data?.signals, { batch, category }));
    } catch (err) {
      log.warn(`batch ${n}/${of} extraction failed, continuing — ${err.message}`);
    }
  }

  log.ok(`${signals.length} signals extracted from ${fresh.length} results`);
  return {
    category,
    signals,
    searches: queries.length,
    hits: hits.length,
    summary: `${signals.length} signals from ${hits.length} results`,
  };
}

function buildPrompt({ focus, signalTypes, batch }) {
  const results = batch.map((h, i) => [
    `--- RESULT ${i + 1} ---`,
    `TITLE: ${h.title}`,
    `URL: ${h.url}`,
    `PUBLISHED: ${h.published_date ?? 'unknown'}`,
    `CONTENT: ${(h.content || '').slice(0, 1500)}`,
  ].join('\n')).join('\n\n');

  return `BD FOCUS: ${focus}

SIGNAL TYPES TO LOOK FOR:
${signalTypes.map((t) => `- ${t}`).join('\n')}

SEARCH RESULTS:

${results}

Extract the qualifying signals as JSON.`;
}

// The model's output is never trusted as-is: urls must match a supplied result,
// dates must be real and in-window-shaped, scores must be numbers 0-10.
export function normalise(raw, { batch, category }) {
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
      category,
      source_title: source.title,
      found_via: source.found_via,
      collected_at: new Date().toISOString(),
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

function clamp(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 5;
  return Math.max(0, Math.min(10, Math.round(n)));
}
