#!/usr/bin/env node
// QUERY LAB — iterate a search query against live Tavily, with no model in the loop.
//
// Nemotron only ever sees Tavily's snippet. If the snippet is off-topic or
// thin, nothing downstream can rescue it — so the cheapest place to fix yield
// is here, before a single token is spent reading.
//
// This runs the search and shows exactly what a collector would be handed:
// domain, date, and the snippet itself. It marks each result against the shape
// a BD signal has to have, so "is this query returning garble?" is a question
// you answer by looking, not by guessing.
//
//   npm run query -- "GPU cloud funding round raised" --days 90
//   npm run query -- "data centre power agreement" --include datacenterdynamics.com,hpcwire.com
//   npm run query -- --file tools/queries.txt --days 90
//
// Costs Tavily credits only. No Nebius calls, no extraction, no scoring.

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { search } from '../server/lib/tavily.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const queriesFromArgs = args.filter((a, i) => !a.startsWith('--') && !String(args[i - 1] ?? '').startsWith('--'));

const days = Number(flag('days', 90));
const maxResults = Number(flag('max', 10));
const depth = flag('depth', 'advanced');
const include = (flag('include', '') || '').split(',').filter(Boolean);
const exclude = (flag('exclude', '') || '').split(',').filter(Boolean);
const file = flag('file', null);
const verbose = args.includes('--verbose');

const queries = file
  ? (await readFile(file, 'utf8')).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  : queriesFromArgs;

if (!queries.length) {
  console.log(`
QUERY LAB — see what a query actually returns, before any model reads it.

  npm run query -- "your query here" [--days 90] [--max 10] [--include a.com,b.com] [--verbose]
  npm run query -- --file tools/queries.txt --days 90

  --days     search window in days (default 90). Costs nothing to widen.
  --max      results per query (default 10). Cheap here, EXPENSIVE downstream:
             every extra result is another one Nemotron has to read.
  --depth    basic | advanced (default advanced; basic costs half the credits)
  --include  comma-separated domains to restrict to
  --exclude  comma-separated domains to suppress
  --verbose  print the full snippet each model would see
`);
  process.exit(0);
}

// What a usable BD signal looks like in a snippet. Crude on purpose — this is
// a smell test for the query, not a scoring engine.
const EVENT_WORDS = /\b(announced|announces|raised|secured|signed|awarded|appointed|launched|acquired|invests?|committed|unveiled|selected|partnership|deploys?|opens?|breaks? ground|tender|procurement|rfp)\b/i;
const NOISE = /\b(top \d+|best |guide to|what is|how to|explained|opinion|analysis:|here's why|should you|review:|roundup|listicle|predictions|forecast)\b/i;
const FIGURE = /[$£€]\s?\d|\b\d+(\.\d+)?\s?(bn|billion|m|million|MW|GW)\b/i;

console.log(`\nwindow ${days}d · max ${maxResults} · depth ${depth}`
  + (include.length ? ` · only ${include.join(', ')}` : '')
  + (exclude.length ? ` · not ${exclude.join(', ')}` : ''));

let totalHits = 0, totalGood = 0;

for (const query of queries) {
  console.log(`\n${'─'.repeat(78)}\n▶ ${query}\n`);
  let results = [];
  try {
    results = await search(query, { days, maxResults, depth, includeDomains: include, excludeDomains: exclude });
  } catch (err) {
    console.log(`  ERROR — ${err.message}\n`);
    continue;
  }
  if (!results.length) { console.log('  no results — this wording finds nothing in this window\n'); continue; }

  let good = 0, undated = 0;
  for (const r of results) {
    const text = `${r.title} ${r.content}`;
    const usable = EVENT_WORDS.test(text) && !NOISE.test(r.title);
    if (usable) good++;
    if (!r.published_date) undated++;

    const mark = usable ? (FIGURE.test(text) ? '++' : '+ ') : NOISE.test(r.title) ? '-N' : '- ';
    let host = '?';
    try { host = new URL(r.url).host.replace(/^www\./, ''); } catch { /* keep ? */ }
    console.log(`  ${mark} ${(r.published_date ?? 'undated').padEnd(11)} ${host.padEnd(26).slice(0, 26)} ${r.title.slice(0, 68)}`);
    if (verbose) console.log(`       ${(r.content || '').slice(0, 260).replace(/\s+/g, ' ')}\n`);
  }

  totalHits += results.length;
  totalGood += good;
  const pct = Math.round((good / results.length) * 100);
  const verdict = pct >= 70 ? 'GOOD' : pct >= 40 ? 'MIXED — tighten the wording' : 'POOR — rewrite this query';
  console.log(`\n  ${good}/${results.length} look like dated events (${pct}%) · ${undated} undated · ${verdict}`);
}

if (queries.length > 1) {
  console.log(`\n${'═'.repeat(78)}`);
  console.log(`OVERALL: ${totalGood}/${totalHits} usable (${Math.round((totalGood / totalHits) * 100)}%) across ${queries.length} queries`);
  console.log(`Tavily cost: ${queries.length} searches x ${depth === 'advanced' ? 2 : 1} credits = ${queries.length * (depth === 'advanced' ? 2 : 1)}\n`);
}

console.log('\nKey: ++ dated event with a figure · + dated event · -N listicle/opinion · - no event language\n');
