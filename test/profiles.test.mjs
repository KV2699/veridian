// THE TWO-CONFIGURATION CONTRACT.
//
// Two profiles ship, and the whole claim of the architecture is that they are
// opposites served by identical code. These checks are the ones that would
// catch that claim quietly becoming false:
//
//   - a market string hardcoded back into an agent, which would make the
//     engine single-market again while both profiles still "load fine"
//   - the two profiles sharing a data directory, which would merge two
//     unrelated prospect registers into one list describing nobody
//   - the polarity inversion being lost, which is invisible in any output
//     until a whole week of leads points the wrong way
import { loadProfile, listProfiles, profileKeys } from '../server/profiles/index.js';
import { dataDir, filesFor } from '../server/lib/store.js';
import { valueFactorFor, MULTI_SERVICE_FACTOR, scoreSignal } from '../server/lib/score.js';
import { registerFile } from '../server/lib/register.js';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

console.log('\nProfiles — two configurations, one engine\n');

check('both configurations are registered',
  profileKeys().includes('nvidia') && profileKeys().includes('exec-search'),
  profileKeys().join(', '));

const nvidia = loadProfile('nvidia');
const search = loadProfile('exec-search');

// ── Every field an agent reads must be present in BOTH profiles ────────────
// A missing field does not throw: it falls back to a default, and the run
// looks successful while being wrong. These are checked structurally for that
// reason.
for (const p of [nvidia, search]) {
  const label = p.key;
  check(`${label}: declares the market and reader the prompts need`,
    Boolean(p.market) && Boolean(p.reader) && Boolean(p.sweepTerms));
  check(`${label}: has practice areas with unique keys`,
    p.practiceAreas.length >= 2
    && new Set(p.practiceAreas.map((a) => a.key)).size === p.practiceAreas.length);
  check(`${label}: every practice area has a name and a description`,
    p.practiceAreas.every((a) => a.key && a.name && a.description));
  check(`${label}: declares signal polarity`, (p.polarity ?? []).length >= 3);
  check(`${label}: every collector names queries, signal types and its own window`,
    p.collectors.length > 0 && p.collectors.every((c) =>
      c.key && c.name && c.focus && c.queries?.length && c.signalTypes?.length && Number.isFinite(c.windowDays)));
  check(`${label}: scoring declares a floor and written guidance`,
    Number.isFinite(p.scoring?.floor) && (p.scoring?.guidance ?? []).length >= 3);
  check(`${label}: excludes itself and its competitors from its own prospect list`,
    (p.exclusions ?? []).length > 0);
}

// ── The windows are per collector, not per profile ─────────────────────────
// A vacancy is contested in days; a restructure plays out over months. The
// predecessor pack used one 90-day window for everything and produced a
// pipeline of leads that were already gone.
check('exec-search sets a different window per collector, not one for all',
  new Set(search.collectors.map((c) => c.windowDays)).size > 1,
  search.collectors.map((c) => `${c.key}=${c.windowDays}d`).join(' '));
check('the job-posting window is the tightest of them',
  Math.min(...search.collectors.map((c) => c.windowDays)) === search.collectors.find((c) => c.key === 'posting').windowDays);

// ── THE INVERSION ──────────────────────────────────────────────────────────
// Read as text, because that is how it reaches the model. The point is not
// that both profiles mention appointments — it is that they tell the pipeline
// to score them in opposite directions.
const nvidiaPolarity = nvidia.polarity.join(' ').toLowerCase();
const searchPolarity = search.polarity.join(' ').toLowerCase();

check('nvidia reads a new appointment as a LEAD',
  /new appointment into an ai\/infrastructure leadership role is a lead/.test(nvidiaPolarity));
check('exec-search reads the same appointment as a DEAD LEAD',
  /appointment into a sustainability or esg leadership role is a dead lead/.test(searchPolarity));
check('exec-search reads a departure with no successor as its STRONGEST signal',
  /departure with no named successor is the strongest lead/.test(searchPolarity));
check('nvidia reads the same departure as a STALL on an existing account',
  /departure with no named successor is a stall signal/.test(nvidiaPolarity));

// ── The value factor differs, and that is the point ────────────────────────
check('nvidia measures commercial value as deal scale',
  valueFactorFor(nvidia).key === 'deal_scale');
check('exec-search keeps the engine default — multi-service breadth',
  valueFactorFor(search).key === MULTI_SERVICE_FACTOR.key);

// Same signal shape, two profiles, two legitimate scores. A gigawatt deal is
// worth 25 points of value to the vendor; two practice areas are worth 25 to
// the search firm. Neither is a bug.
const base = { date: new Date().toISOString().slice(0, 10), org_scale: 'large', practice_areas: ['a'], deal_scale: 'mega' };
const asVendor = scoreSignal(base, { valueFactor: valueFactorFor(nvidia) });
const asSearch = scoreSignal(base, { valueFactor: valueFactorFor(search) });
check('a one-area mega-scale signal scores higher for the vendor than the search firm',
  asVendor.priority_score > asSearch.priority_score,
  `${asVendor.priority_score} vs ${asSearch.priority_score}`);
check('and the breakdown says which question each profile asked',
  'deal_scale' in asVendor.score_breakdown && 'multi_service' in asSearch.score_breakdown);

// ── Data isolation ─────────────────────────────────────────────────────────
// This repo has already lost 45 organisations to two runs sharing one view of
// one file. Two profiles sharing a register would be the same failure, except
// permanent and invisible.
check('each profile resolves to its own data directory',
  dataDir('nvidia') !== dataDir('exec-search'));
check('no store file is shared between the two profiles', (() => {
  const a = Object.values(filesFor('nvidia'));
  const b = Object.values(filesFor('exec-search'));
  return a.every((f) => !b.includes(f)) && a.length === b.length;
})(), `${Object.keys(filesFor('nvidia')).join(', ')}`);
check('the organisation register is per profile',
  registerFile('nvidia') !== registerFile('exec-search'));
check('a profile key appears in its own paths, so a directory is identifiable',
  dataDir('exec-search').includes('exec-search'));

// ── The loader refuses what it cannot serve ────────────────────────────────
check('an unknown profile throws rather than silently defaulting', (() => {
  try { loadProfile('does-not-exist'); return false; } catch { return true; }
})());
check('the listing exposes what each configuration measures', (() => {
  const l = listProfiles();
  return l.length === profileKeys().length
    && l.every((p) => p.key && p.name && p.value_factor)
    && new Set(l.map((p) => p.value_factor)).size === 2;
})(), listProfiles().map((p) => `${p.key}:${p.value_factor}`).join(' · '));

// ── Feeds and queries are event-shaped, not state-shaped ───────────────────
// Root cause 1 of the predecessor pack's failure: a query that asks a search
// engine to prove a negative can never be satisfied.
check('no collector query asks a search engine to prove a negative',
  [...nvidia.collectors, ...search.collectors].every((c) =>
    c.queries.every((q) => !/\b(lacks?|without a|no existing|does not have|missing)\b/i.test(q))));
// Uniqueness is checked WITHIN a profile, not across them: two businesses can
// legitimately read the same publication, and an outlet covering data-centre
// energy serves both of these.
check('every feed url is https, and no profile lists one twice', (() => {
  for (const p of [nvidia, search]) {
    const urls = (p.feeds?.sources ?? []).map((f) => f.url);
    if (!urls.every((u) => u.startsWith('https://'))) return false;
    if (new Set(urls).size !== urls.length) return false;
  }
  return true;
})());

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
