// AGENT — Roster Sweep (enumerated target list)
//
// The difference between searching and sweeping.
//
// A topic search fires a query and registers whatever comes back. It has no
// idea what it did not look at, so a quiet organisation and an unchecked one
// are indistinguishable — and the result is biased towards whatever is most
// written about, which is exactly the set a BD person already knows.
//
// A sweep walks a NAMED list and reports a result for every organisation on it,
// including "no signal found". That makes completeness auditable: you know all
// 100 were checked, you know which 94 were quiet, and a name going quiet for
// several weeks is itself a BD fact.
//
// The list is the register — the organisations this system has already found.
// So each run refreshes everything known while the topic collectors keep
// hunting what is not: the loop that turns a weekly digest into a tracker.

import { searchMany, canonicalUrl } from '../lib/tavily.js';
import { completeJSON } from '../lib/nebius.js';
import { checkGrounding } from '../lib/grounding.js';
import { listRegister } from '../lib/register.js';
import { log } from '../lib/log.js';

const SYSTEM = `You sweep a named list of organisations for business development signals.

You are given a BATCH OF ORGANISATIONS and a set of SEARCH RESULTS. For EVERY organisation in the batch you must return a row — either a signal, or an explicit "no signal found". A missing row is a failure: the point of this sweep is that the caller knows every name was checked.

FOR EACH ORGANISATION:
- If the search results contain a dated, specific event involving that organisation, return it.
- If they do not, return found: false. This is a normal and correct answer. Most organisations are quiet in any given week. Do NOT stretch a weak result into a signal to avoid an empty row.

HARD RULES:
- Use ONLY the supplied search results. Never add an event from your own knowledge.
- url must be copied exactly from the result it came from. Never invent one.
- The result must be ABOUT that organisation. A company mentioned in passing inside an article about something else is not a signal for that company.
- date must be the source's published date, or null. Never guess.
- Never state a figure that is not in the source.
- contact_role: the job title a seller should approach for this signal — infer the ROLE ONLY from the nature of the event. Never name a person.

OUTPUT FORMAT — strict: your entire reply must be a single JSON object. Do not reason out loud, do not explain, do not use a code fence. The first character must be {.

{"results":[{"organisation":"exactly as given","found":true,"signal_type":"string","summary":"one factual sentence","url":"string","date":"YYYY-MM-DD or null","practice_areas":["key"],"value_level":"string","contact_role":"string"}]}

For a quiet organisation return only: {"organisation":"exactly as given","found":false}`;

export default async function rosterSweep({ profile, week }, ctx = {}, deps = {}) {
  const find = deps.searchMany ?? searchMany;
  const ask = deps.completeJSON ?? completeJSON;
  const load = deps.listRegister ?? listRegister;

  const cfg = profile?.rosterSweep ?? {};
  const { batchSize = 8, windowDays = 14, maxOrganisations = 120 } = cfg;

  // The target list is everything already known, plus any seed roster — so the
  // sweep covers held accounts and discovered prospects alike.
  const known = await load({ limit: maxOrganisations, profile: profile?.key });
  const seeds = (profile?.roster ?? []).map((name) => ({ name, status: 'account' }));
  const targets = dedupeByName([...seeds, ...known]).slice(0, maxOrganisations);

  if (!targets.length) {
    log.warn('register is empty — nothing to sweep. Run a discovery pass first.');
    return { signals: [], telemetry: null, checked: 0, summary: 'nothing to sweep' };
  }

  const practiceAreas = profile?.practiceAreas ?? [];
  const valueFactor = profile?.scoring?.valueFactor;
  const seenUrls = ctx.knownUrlKeys ?? new Set();

  const batches = chunk(targets, batchSize);
  log.step(`sweeping ${targets.length} named organisations in ${batches.length} batches (${windowDays}-day window)`);

  const signals = [];
  const quiet = [];
  const stats = [];
  let checked = 0;

  for (const [i, batch] of batches.entries()) {
    const names = batch.map((t) => t.name);
    // The suffix comes from the profile: a list of names with no topic
    // attached returns the organisations' own homepages, and the right topic
    // for a search firm ("leadership hiring departure") is nothing like the
    // right one for a vendor ("AI infrastructure announcement").
    const query = `${names.map((n) => `"${n}"`).join(' OR ')} ${profile?.sweepTerms ?? 'announcement'}`;

    let results = [];
    try {
      const out = await find([query], { days: windowDays, maxResults: 10 });
      results = out.results;
      stats.push(...out.stats.map((s) => ({ ...s, fresh: out.results.length })));
    } catch (err) {
      log.warn(`batch ${i + 1}/${batches.length} search failed — ${err.message}`);
      stats.push({ query, hits: 0, unique: 0, fresh: 0, failed: true });
      continue;
    }

    const fresh = results.filter((r) => !seenUrls.has(canonicalUrl(r.url)));

    // No new material for this batch: every organisation in it is quiet, and
    // that is recorded rather than left unknown.
    if (!fresh.length) {
      checked += names.length;
      quiet.push(...names);
      log.step(`batch ${i + 1}/${batches.length} — running total: ${signals.length} signals found (${checked} organisations checked)`);
      continue;
    }

    try {
      const { data } = await ask({
        tier: 'fast', temperature: 0, maxTokens: 4000, expectKey: 'results',
        system: SYSTEM,
        user: buildPrompt({ names, results: fresh, practiceAreas, valueFactor, polarity: profile?.polarity ?? [] }),
      });
      const rows = Array.isArray(data?.results) ? data.results : [];
      const byName = new Map(rows.filter((r) => r?.organisation).map((r) => [norm(r.organisation), r]));

      for (const name of names) {
        checked++;
        const row = byName.get(norm(name));
        if (!row || row.found === false) { quiet.push(name); continue; }

        const signal = toSignal({ name, row, results: fresh, practiceAreas, valueFactor, week });
        if (signal) signals.push(signal); else quiet.push(name);
      }
    } catch (err) {
      // A failed batch is NOT silently treated as quiet — those names were
      // never actually checked, and saying otherwise would be a lie the
      // register then carries forward.
      log.warn(`batch ${i + 1}/${batches.length} classification failed — ${names.length} organisations left unchecked`);
      stats[stats.length - 1] = { ...stats[stats.length - 1], failed: true };
    }

    log.step(`batch ${i + 1}/${batches.length} — running total: ${signals.length} signals found (${checked} organisations checked)`);
  }

  log.ok(`GRAND TOTAL: ${signals.length} signals across ${checked} organisations checked · ${quiet.length} quiet this week`);

  return {
    signals,
    quiet,
    checked,
    telemetry: {
      key: 'roster', name: 'Roster Sweep', queries: stats,
      hits: stats.reduce((n, s) => n + s.hits, 0),
      fresh: stats.reduce((n, s) => n + (s.fresh ?? 0), 0),
      extracted: signals.length, parseFailures: 0, batches: batches.length, ungrounded: 0,
    },
    summary: `${signals.length} signals from ${checked} organisations checked`,
  };
}

function toSignal({ name, row, results, practiceAreas, valueFactor, week }) {
  const url = String(row.url ?? '').trim();
  if (!url) return null;
  const source = results.find((r) => canonicalUrl(r.url) === canonicalUrl(url));
  if (!source) return null;                       // a url the search never returned

  const summary = String(row.summary ?? '').trim();
  if (!summary) return null;

  const grounding = checkGrounding({ company: name, summary, url: source.url }, source);
  if (!grounding.ok) return null;

  const validAreas = new Set(practiceAreas.map((a) => a.key));
  const areas = Array.isArray(row.practice_areas)
    ? [...new Set(row.practice_areas.map((a) => String(a).toLowerCase()).filter((a) => validAreas.has(a)))]
    : [];

  const validLevels = new Set(Object.keys(valueFactor?.points ?? {}));
  return {
    company: name,
    signal_type: String(row.signal_type ?? '').trim() || 'Update',
    summary,
    url: source.url,
    url_key: canonicalUrl(source.url),
    date: isoDate(row.date) ?? isoDate(source.published_date),
    relevance_score: 7,
    practice_areas: areas,
    org_scale: 'unknown',
    ...(valueFactor
      ? { [valueFactor.key]: validLevels.has(String(row.value_level ?? '').toLowerCase()) ? String(row.value_level).toLowerCase() : 'unknown' }
      : {}),
    contact_role: String(row.contact_role ?? '').trim() || null,
    category: 'roster',
    source_title: source.title,
    found_via: 'roster sweep',
    collected_at: new Date().toISOString(),
    grounding_note: grounding.reason || null,
    weak_source: grounding.weakSource,
    source_is_about_company: grounding.subject !== false,
    swept_week: week,
  };
}

function buildPrompt({ names, results, practiceAreas, valueFactor, polarity }) {
  const orgs = names.map((n) => `- ${n}`).join('\n');
  const blocks = results.map((r, i) => [
    `--- RESULT ${i + 1} ---`,
    `TITLE: ${r.title}`,
    `URL: ${r.url}`,
    `PUBLISHED: ${r.published_date ?? 'unknown'}`,
    `CONTENT: ${(r.content || '').slice(0, 1200)}`,
  ].join('\n')).join('\n\n');

  const areas = practiceAreas.length
    ? `\nOFFERINGS (use these keys for practice_areas):\n${practiceAreas.map((a) => `- ${a.key}: ${a.name}`).join('\n')}\n`
    : '';
  const levels = valueFactor
    ? `\nVALUE LEVELS — use one of: ${Object.keys(valueFactor.points ?? {}).join(' | ')}\n${(valueFactor.guidance ?? []).map((g) => `- ${g}`).join('\n')}\n`
    : '';
  const pol = polarity.length
    ? `\nHOW TO READ THESE EVENTS:\n${polarity.map((p) => `- ${p}`).join('\n')}\n`
    : '';

  return `BATCH OF ORGANISATIONS — return exactly one row for each of these ${names.length}:
${orgs}
${areas}${levels}${pol}
SEARCH RESULTS:

${blocks}

Return one row per organisation as JSON. Organisations with nothing in the results get found: false.`;
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function dedupeByName(rows) {
  const seen = new Set();
  return rows.filter((r) => {
    const k = norm(r.name);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function isoDate(v) {
  if (typeof v !== 'string') return null;
  const m = v.match(/\d{4}-\d{2}-\d{2}/);
  if (!m) return null;
  const d = new Date(m[0]);
  if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 864e5) return null;
  return m[0];
}
