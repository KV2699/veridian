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

// The market is supplied by the profile, never hardcoded. This string used to
// name the AI infrastructure market outright, which quietly made the whole
// engine single-market: a second profile could declare whatever practice areas
// it liked and still be extracted by a model told it was reading GPU news.
const systemFor = (market) => `You are a business development signal extractor for ${market ? `the ${market} market` : 'the market described below'}.

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
  {
    key, name, category, focus, signalTypes, queries, windowDays = 7,
    polarity = [], practiceAreas = [], valueFactor = null, excludeDomains = [],
    // Supplied by the profile. `market` tells the extractor which market it is
    // reading; `topic` and `includeDomains` are per-collector search levers —
    // a job advert is not a news article, so the postings collector needs the
    // general index rather than Tavily's news topic.
    market = '', topic = 'news', includeDomains = [],
  },
  ctx = {},
  deps = {},
) {
  const known = ctx.knownUrlKeys ?? new Set();
  const find = deps.searchMany ?? searchMany;
  const ask = deps.completeJSON ?? completeJSON;

  // Window and result cap are both levers, and they do different things.
  //
  // Widening the window alone does less than expected: maxResults caps each
  // query, so a 30-day window returns the 30 most RELEVANT results rather than
  // adding older ones to the recent set — it can crowd recent items out. Volume
  // comes from raising both.
  //
  // Thirty days is the default because discovery and urgency are separate
  // questions. A funding round from three weeks ago is still a live lead; the
  // scoring already decays it (25 points inside a week, 15 inside a month,
  // 5 inside a quarter), so excluding it from search as well penalises it
  // twice and loses the lead entirely. A wide window also self-heals: a failed
  // run no longer means a permanently missing week.
  //
  // Thirty is also the practical ceiling, not just a preference. Tavily holds
  // the window at 30 but leaks badly beyond it: an 84-day run produced signals
  // dated a full year back, and a separate test of a 90-day request returned
  // items from seven months earlier. Past 30 days the window stops widening
  // coverage and starts contaminating it. Do not raise this.
  //
  // maxResults is a separate lever with its own economics. Measured on one
  // collector with the noise domains already excluded:
  //
  //   10 results/query → 33 signals, 27 organisations, 19 extraction batches
  //   20 results/query → 41 signals, 33 organisations, 32 extraction batches
  //
  // The second ten are about half as productive as the first (0.9 signals per
  // extra batch against 1.7) for 47% more extraction and 40% more runtime, at
  // identical Tavily cost. Worth paying when the job is BUILDING the register
  // and every extra organisation counts; not worth it on a weekly refresh,
  // where the register already exists and speed matters more. So: 10 normally,
  // 30 on a backfill.
  const backfillX = Number(process.env.BACKFILL_MULTIPLIER) || 3;
  const backfill = process.env.BACKFILL === 'true';
  const days = backfill ? windowDays * backfillX : windowDays;
  const maxResults = Number(process.env.MAX_RESULTS) || (backfill ? 30 : 10);

  log.step(`Running ${queries.length} Tavily searches (${days}-day window${days !== windowDays ? ', backfill' : ''})`);
  const { results, stats } = await find(queries, { days, maxResults, excludeDomains, topic, includeDomains });

  const fresh = results.filter((h) => !known.has(canonicalUrl(h.url)));
  log.step(`${results.length} unique results, ${fresh.length} not seen in a previous week`);

  // Per-query telemetry is attributed to this collector for the diagnostics
  // pass, whether or not anything was found.
  let parseFailures = 0;
  let batches = 0;
  let ungrounded = 0;
  // The grounding drops themselves, not just the count. A claim attached to an
  // article that is not about that organisation is the single most instructive
  // thing this pipeline throws away, and until now it existed only as a line
  // of console output that scrolled past.
  const rejections = [];
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
    return { category, signals: [], rejections, telemetry: telemetry(0), summary: '0 signals (no new results)' };
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
        system: systemFor(market),
        user: buildPrompt({ focus, signalTypes, batch, polarity, practiceAreas, valueFactor }),
      });
      signals.push(...normalise(data?.signals, {
        batch, category, practiceAreas, valueFactor, windowDays: days,
        onDrop: ({ company, summary, url, reason }) => {
          ungrounded++;
          rejections.push({
            company, summary, url, url_key: canonicalUrl(url), category,
            // UNGROUNDED is a suppression, not a defect report: the pipeline
            // worked. The organisation can return next week on a source that
            // is actually about it.
            reason_code: 'UNGROUNDED', reason, stage: 'extraction',
          });
          log.warn(`dropped "${company}" — ${reason}`);
        },
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
    rejections,
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
export function normalise(raw, { batch, category, practiceAreas = [], valueFactor = null, windowDays = null, onDrop } = {}) {
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
      // Measured: Tavily honours its `days` filter at narrow windows and leaks
      // badly at wide ones — a 90-day request returned items seven months old.
      // So the window is re-checked here rather than trusted, and an
      // out-of-window signal is flagged rather than scored as current.
      ...(() => {
        const dt = isoDate(s.date) ?? isoDate(source.published_date);
        if (!windowDays || !dt) return {};
        const age = Math.floor((Date.now() - new Date(dt).getTime()) / 864e5);
        return age > windowDays
          ? { out_of_window: true, window_note: `${age} days old, outside the ${windowDays}-day search window` }
          : {};
      })(),
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

// Accepts both shapes a date arrives in, which is the whole point.
//
// The model supplies YYYY-MM-DD. TAVILY SUPPLIES RFC-2822 —
// "Fri, 02 Oct 2026 18:24:26 GMT" — and the original matched YYYY-MM-DD only,
// so Tavily's own date returned null. Mostly invisible, because the model
// usually supplies a date of its own; the damage happened exactly when it did
// NOT, which is when the fallback was the only thing left. The signal became
// undated, scored ZERO urgency points out of 25, dropped a band, and was
// auto-flagged for review. 8 of 117 signals in the log at the time.
function isoDate(v) {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!trimmed) return null;

  // Prefer an explicit YYYY-MM-DD anywhere in the string: it is unambiguous,
  // and it avoids Date's timezone shifting a bare date back by a day.
  const m = trimmed.match(/\d{4}-\d{2}-\d{2}/);
  const d = m ? new Date(m[0]) : new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;

  // Reject anything in the future or absurdly old — both are extraction errors.
  const now = Date.now();
  if (d.getTime() > now + 864e5 || d.getTime() < now - 365 * 864e5) return null;
  return m ? m[0] : d.toISOString().slice(0, 10);
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
