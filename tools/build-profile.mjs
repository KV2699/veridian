// ONBOARD A NEW BUSINESS — write a profile from evidence, not from a guess.
//
//   node tools/build-profile.mjs --site https://example.com --key example
//   node tools/build-profile.mjs --brief research.md --key example
//   node tools/build-profile.mjs --site https://example.com --wins wins.md --key example
//
// Costs NO Tavily credits. It reads the company's own website over plain HTTP
// and uses the FAST Nemotron tier to structure what it finds — a few pence of
// inference, no search.
//
// --wins is the one that matters. Polarity — which way each kind of event
// points for this business — cannot be derived from a description of the
// business, and the system refuses to invent it. It CAN be derived from the
// business's own past wins: "what was the published event that started this
// deal?" Answer that five times and the polarity falls out.
//
// Without --wins the profile is still written, with the polarity block left as
// explicit unanswered questions. It will run, and it will score badly, and the
// file says so at the top.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { readCompanySite, draftProfile, validateDraft, findFeeds } from '../server/lib/profile-builder.js';
import { log } from '../server/lib/log.js';

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };

const site = arg('site');
const briefPath = arg('brief');
const winsPath = arg('wins');
const key = arg('key');
const out = arg('out');

if (!key || (!site && !briefPath)) {
  console.log(`
Onboard a new business — writes server/profiles/<key>.js

  --key <key>      required. The profile key, lowercase, e.g. acme-search
  --site <url>     the company's own website. Free to read.
  --brief <file>   a research brief (e.g. the output of the Perplexity prompt
                   in tools/PERPLEXITY-PROFILE-PROMPT.md)
  --wins <file>    past wins, one per line: "what published event started this
                   deal?". THE ONLY valid basis for polarity.
  --out <file>     where to write. Defaults to server/profiles/<key>.js

At least one of --site or --brief is required. Costs no search credits.
`);
  process.exit(1);
}

log.banner(`PROFILE BUILDER — ${key}`);

const brief = briefPath ? await readFile(briefPath, 'utf8') : '';
const wins = winsPath ? await readFile(winsPath, 'utf8') : '';
if (brief) log.step(`brief: ${briefPath} (${brief.length} characters)`);
if (wins) log.ok(`past wins supplied — polarity will be DERIVED from them, not guessed`);
else log.warn('no --wins supplied — polarity will be left as unanswered questions');

const pages = site ? await readCompanySite(site) : [];
if (site) log.ok(`${pages.length} page(s) read from the company's own site — 0 search credits`);

log.step('drafting with Nemotron (fast tier)');
const draft = await draftProfile({ pages, brief, wins });

// Verify every publication the research named, before it reaches the file.
log.step('probing for live RSS feeds — free, and a dead feed is a silent failure');
const feeds = await findFeeds(draft.publications ?? []);
log.ok(`${feeds.live.length} live feed(s), ${feeds.dead.length} not found`);

const { ok, problems, needsPolarity } = validateDraft(draft);
for (const p of problems) log.warn(`validation: ${p}`);
if (!ok) log.warn('the draft is incomplete — it is still written, but read it before running it');

const file = out ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'profiles', `${key}.js`);
await writeFile(file, render(key, draft, { needsPolarity, site, briefPath, winsPath, feeds }));

log.ok(`written: ${file}`);
console.log(`
NEXT:
  1. Open the file and read the polarity block. ${needsPolarity ? 'IT IS UNANSWERED — the profile will not score correctly until you answer it.' : 'It was derived from the wins you supplied — check each line.'}
  2. Register it:  server/profiles/index.js  →  import it and add it to PROFILES
  3. Test it free: PROFILE=${key} npm run pipeline:free
`);

function q(s) { return `'${String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ')}'`; }
function list(arr, indent = '    ') {
  if (!arr?.length) return '[]';
  return `[\n${arr.map((x) => `${indent}${q(x)},`).join('\n')}\n${indent.slice(2)}]`;
}

function render(key, d, { needsPolarity, site, briefPath, winsPath, feeds = { live: [], dead: [] } }) {
  const areas = (d.practice_areas ?? []).map((a) => `    {
      key: ${q(a.key)},
      name: ${q(a.name)},
      description: ${q(a.description)},
    },`).join('\n');

  const polarityBlock = needsPolarity
    ? `  // ⚠️  UNANSWERED — THIS PROFILE WILL NOT SCORE CORRECTLY UNTIL IT IS FILLED IN.
  //
  // Polarity is which way an event points for THIS business, and it is the
  // single highest-leverage field in the system. It was not supplied, and the
  // builder refuses to guess it: a confident wrong answer here produces an
  // empty pipeline that looks exactly like a quiet market, and nobody finds
  // out for months.
  //
  // Answer these, then replace this block with plain-English statements:
${(d.polarity_questions ?? []).map((x) => `  //   - ${x}`).join('\n') || '  //   - When a company appoints a leader in your area, is that a reason to call them or a sign you have lost the opportunity?\n  //   - What about a departure? A funding round? A competitor win?'}
  //
  // The fastest way to answer them is NOT to think about it. It is to look at
  // five deals you have already won and ask, for each one: what published
  // event started this? Then re-run the builder with --wins.
  polarity: [],`
    : `  // Derived from the past wins supplied to the builder — each line traces
  // back to a deal this business actually won, which is the only evidence that
  // can establish polarity. Check every line before relying on it.
${(d.polarity_evidence ?? []).map((x) => `  //   · ${x}`).join('\n')}
  polarity: ${list(d.polarity ?? [], '    ')},`;

  const sources = [site && `the company's own website (${site})`, briefPath && `a research brief (${briefPath})`, winsPath && `past wins (${winsPath})`].filter(Boolean);

  return `// PROFILE — ${d.name ?? key}
//
// GENERATED by tools/build-profile.mjs on ${new Date().toISOString().slice(0, 10)}
// from ${sources.join(', ')}.
//
// This is a DRAFT. Everything below was derived from evidence, but a profile is
// a statement of strategy and it should be read by someone who knows the
// business before it is trusted. The questions it must answer are in
// server/profiles/README.md.
//
// What the builder could establish automatically: what this business sells,
// who it can win, who its competitors are. What it could not, and would not
// guess: polarity — see the block below.

export default {
  key: ${q(key)},
  name: ${q(d.name ?? key)},
  description: ${q(d.description ?? '')},

  // Short noun phrase for the agent prompts. The pipeline is generic, so every
  // prompt has to be told which market it is reading.
  market: ${q(d.market ?? '')},
  reader: ${q(d.reader ?? '')},
  sweepTerms: ${q(d.market ?? '')},

  // ── What this business sells ────────────────────────────────────────────
  // The scoring engine counts how many of these a single event opens. Each one
  // must be a separate budget signed by a different person — if two are always
  // bought together they are one area, and splitting them inflates every score
  // that touches them.
  practiceAreas: [
${areas}
  ],

  // ── Signal polarity ──────────────────────────────────────────────────────
${polarityBlock}

  // ⚠️  Accounts already held. Swept weekly for a reason to make contact, and
  // never returned as new prospects. Replace with the real client list.
  roster: ${list(d.clients ?? [], '    ')},

  // Never returned at all. Competitors are intelligence, not opportunities.
  exclusions: ${list([d.name, ...(d.competitors ?? [])].filter(Boolean), '    ')},

  aliases: {},

  // ── Collectors ───────────────────────────────────────────────────────────
  // ⚠️  THE QUERIES BELOW ARE A STARTING POINT, NOT A TESTED SET.
  //
  // Every query must hunt an event that gets PUBLISHED ON A DATE. A query that
  // asks a search engine to prove a negative — "companies that lack X" — can
  // never be satisfied, and the model will either return nothing or invent.
  //
  // Test them before trusting them:  node tools/query-lab.mjs
  collectors: [
    {
      key: 'primary',
      name: 'Primary Collector',
      focus: ${q(`Dated, published events that create demand for what this business sells. Winnable universe: ${d.winnable_universe ?? 'to be defined'}`)},
      signalTypes: [
${(d.practice_areas ?? []).map((a) => `        ${q(`A named organisation taking a dated, published action that creates a concrete reason to discuss ${a.name}`)},`).join('\n')}
      ],
      queries: [
${(d.practice_areas ?? []).slice(0, 6).map((a) => `        ${q(`${a.name} announced appointed awarded contract`)},`).join('\n')}
      ],
      windowDays: 30,
    },
  ],

  // ── Free collection layer — costs no search credits ─────────────────────
  // ⚠️  FETCH EVERY URL BEFORE TRUSTING IT. Publications get renamed and feeds
  // go dead: of 14 candidates tested for the exec-search profile, 3 were dead.
  // These are names the research found, not verified feed urls.
  // Each url below returned HTTP 200 WITH ITEMS when this profile was built.
${feeds.dead.length ? `  // Not found, needs a human: ${feeds.dead.map((d2) => d2.name).join(', ')}` : '  // Every candidate resolved.'}
  feeds: {
    days: 30,
    sources: [
${feeds.live.map((f) => `      { name: ${q(f.name)}, url: ${q(f.url)} },`).join('\n')}
    ],
    // Weighted to EVENT words rather than topic words: a feed full of relevant
    // subject matter is useless unless something is actually happening. An
    // empty list here reads EVERY item in EVERY feed, which is both expensive
    // and noisy — 144 of 178 items passed the first profile's filter.
    terms: ${list(d.feed_terms ?? [], '      ')},
  },

  tenders: { days: 60, maxPages: 10 },

  rosterSweep: { batchSize: 8, windowDays: 30, maxOrganisations: 48 },

  accountWatch: {
    focus: 'A fresh, dated reason to contact an organisation already held.',
    signalTypes: [
      'A leadership change, restructure or growth announcement at this organisation',
      'A new obligation or commitment stated to apply to this organisation',
    ],
    batchSize: 4,
    windowDays: 30,
  },

  // ── Scoring ──────────────────────────────────────────────────────────────
  // ${d.value_factor === 'deal_scale' ? 'Deal scale' : 'Multi-service breadth (the engine default)'} — ${d.value_factor_reason ?? ''}
  scoring: {
    floor: 6,
    guidance: [
      ${q(`The winnable universe is: ${d.winnable_universe ?? 'to be defined'}. Score inside it higher.`)},
      ${q(`${d.too_big ?? 'A prospect with a mature in-house function and an incumbent supplier'} scores down, even on a real signal.`)},
      'A named organisation taking a dated action always outranks a market trend, however well sourced the trend is.',
      'A signal that opens a conversation across two or more practice areas is worth more than a larger signal confined to one.',
      'Never score an inferred need. If the source does not state the event, there is no signal.',
    ],
  },
};
`;
}
