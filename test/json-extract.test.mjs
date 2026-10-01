// Reasoning-tuned models narrate before answering. These are the exact shapes
// that broke the first live run — every one must now parse.
import { extractJSON } from '../server/lib/nebius.js';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

console.log('\nJSON extraction from reasoning-model replies\n');

const cases = [
  ['clean object', '{"signals":[{"company":"A"}]}', 1],
  ['fenced', '```json\n{"signals":[{"company":"A"}]}\n```', 1],
  ['reasoning preamble then JSON',
   'Let me analyze the search results to extract qualifying BD signals.\n\n{"signals":[{"company":"A"}]}', 1],
  ['prose with decoy brackets before the payload',
   'Here is a thinking process: [News] and [watched orgs] are relevant.\nFinal answer:\n{"signals":[{"company":"A"},{"company":"B"}]}', 2],
  ['think tags',
   '<think>I should check each result.</think>{"signals":[{"company":"A"}]}', 1],
  ['bare array without the wrapper', '[{"company":"A"}]', 1],
  ['empty but valid', 'After review, nothing qualifies.\n{"signals":[]}', 0],
  ['trailing commentary after JSON',
   '{"signals":[{"company":"A"}]}\n\nThese were the only qualifying signals.', 1],
  ['brace inside a string value',
   '{"signals":[{"company":"A","summary":"uses { and } chars"}]}', 1],
];

for (const [label, input, expected] of cases) {
  try {
    const r = extractJSON(input, 'signals');
    const n = Array.isArray(r?.signals) ? r.signals.length : -1;
    check(label, n === expected, `${n} signal(s)`);
  } catch (err) {
    check(label, false, err.message.slice(0, 60));
  }
}

// Decoy must never beat the real payload.
const decoy = extractJSON('Consider [News] first.\n{"signals":[{"company":"Real"}]}', 'signals');
check('real payload wins over an earlier decoy array', decoy.signals?.[0]?.company === 'Real');

// Pure prose with no JSON at all must throw, so the repair pass is triggered.
try { extractJSON('I was unable to find any qualifying signals in these results.', 'signals'); check('pure prose throws (triggers repair)', false); }
catch { check('pure prose throws (triggers repair)', true); }

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
