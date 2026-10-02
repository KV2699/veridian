#!/usr/bin/env node
// A/B: does maxResults 20 earn its extraction cost once junk domains are
// excluded at the search?
//
// The claim under test is that excluding noise domains gets the same quality
// lift as doubling maxResults, far cheaper — because every extra result has to
// be read by a model before it can be discarded.
//
// Measured on one real collector, both configs, same queries, same window.
import 'dotenv/config';
import { searchMany } from '../server/lib/tavily.js';
import { runCollector } from '../server/agents/collector-base.js';
import profile from '../server/profiles/nvidia.js';

const collector = profile.collectors.find((c) => c.key === 'capital');
const common = {
  ...collector, category: collector.key,
  polarity: profile.polarity, practiceAreas: profile.practiceAreas,
  valueFactor: profile.scoring?.valueFactor, excludeDomains: profile.excludeDomains,
};

async function run(label, maxResults) {
  process.env.MAX_RESULTS = String(maxResults);
  const t = Date.now();
  const out = await runCollector(common, { knownUrlKeys: new Set() });
  const secs = (Date.now() - t) / 1000;
  const searches = collector.queries.length;
  const credits = searches * 2;                      // advanced search = 2 credits
  const domains = new Set(out.signals.map((s) => { try { return new URL(s.url).host.replace(/^www\./, ''); } catch { return s.url; } }));
  return {
    label, maxResults, searches, credits,
    hits: out.telemetry.hits,
    extracted: out.signals.length,
    batches: out.telemetry.batches,
    domains: domains.size,
    secs: secs.toFixed(0),
    companies: new Set(out.signals.map((s) => s.company)).size,
  };
}

const a = await run('maxResults 10', 10);
const b = await run('maxResults 20', 20);

console.log('\n' + 'config'.padEnd(16) + 'hits'.padEnd(7) + 'signals'.padEnd(9) + 'orgs'.padEnd(7) + 'domains'.padEnd(9) + 'batches'.padEnd(9) + 'time'.padEnd(7) + 'credits');
console.log('─'.repeat(78));
for (const r of [a, b]) {
  console.log(r.label.padEnd(16) + String(r.hits).padEnd(7) + String(r.extracted).padEnd(9)
    + String(r.companies).padEnd(7) + String(r.domains).padEnd(9) + String(r.batches).padEnd(9)
    + `${r.secs}s`.padEnd(7) + r.credits);
}
const extraSignals = b.extracted - a.extracted;
const extraBatches = b.batches - a.batches;
console.log(`\nDoubling maxResults: +${extraSignals} signals, +${b.companies - a.companies} organisations, `
  + `for +${extraBatches} extraction batches (+${(b.secs / Math.max(a.secs, 1)).toFixed(1)}x time), same Tavily credits.`);
console.log(extraSignals <= 0
  ? 'VERDICT: 20 is not earning its cost — stay at 10.'
  : `VERDICT: ${(extraSignals / Math.max(extraBatches, 1)).toFixed(1)} extra signals per extra batch.`);
