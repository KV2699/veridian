#!/usr/bin/env node
// Where the money is going.
//
// Two meters, very different shapes. Tavily is a hard monthly allowance that
// stops the system dead when it runs out. Nebius is metered spend that grows
// with how much the collectors find — which means a GOOD week costs more than
// a quiet one.
//
//   node tools/cost.mjs
import 'dotenv/config';
import { getRuns } from '../server/lib/store.js';

const T = process.env.TAVILY_API_KEY;

const res = await fetch('https://api.tavily.com/usage', {
  headers: { Authorization: `Bearer ${T}` }, signal: AbortSignal.timeout(20000),
}).catch(() => null);

if (res?.ok) {
  const { account } = await res.json();
  const used = account.plan_usage;
  const limit = account.plan_limit;
  const left = limit - used;
  const bar = '█'.repeat(Math.round((used / limit) * 40)).padEnd(40, '░');
  console.log(`\nTAVILY — ${account.current_plan} plan`);
  console.log(`  ${bar}  ${used}/${limit}`);
  console.log(`  ${left} remaining this period\n`);

  // What that actually buys, at the current configuration.
  const perRunAdvanced = 50 * 2;   // ~50 searches, advanced = 2 credits each
  const perRunBasic = 50 * 1;
  console.log(`  a full pipeline run costs ~${perRunAdvanced} credits on advanced depth, ~${perRunBasic} on basic`);
  console.log(`  remaining allowance = ${Math.floor(left / perRunAdvanced)} advanced run(s), or ${Math.floor(left / perRunBasic)} on basic\n`);
} else {
  console.log('\nTAVILY — usage endpoint unavailable\n');
}

// Nebius has no usage endpoint on the inference key, so this is reconstructed
// from what each run recorded. Runs before token logging existed show blank.
const runs = await getRuns();
console.log('NEBIUS — per run');
if (!runs.length) console.log('  no runs recorded');
for (const r of runs.slice(0, 10)) {
  const tok = r.tokens;
  console.log(`  ${(r.started_at ?? '?').slice(0, 16)}  ${String(r.status).padEnd(8)}`
    + `${String(Math.round((r.duration_ms ?? 0) / 1000) + 's').padEnd(7)}`
    + (tok ? `in ${tok.prompt ?? '?'} · out ${tok.completion ?? '?'} · ${tok.calls ?? '?'} calls` : 'not recorded'));
}
console.log('\n  Nebius does not expose usage on an inference key — check the console at');
console.log('  studio.nebius.com for actual spend. Token counts above are what this');
console.log('  system observed, which is the denominator for that figure.\n');
