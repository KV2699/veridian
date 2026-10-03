#!/usr/bin/env node
// Ask the register a question from the command line.
//   node tools/ask.mjs "top 5 multi-service prospects"
import 'dotenv/config';
import ask from '../server/agents/analyst.js';

const questions = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!questions.length) {
  console.log('\n  node tools/ask.mjs "what is closing in the next 14 days?"\n');
  process.exit(0);
}

for (const q of questions) {
  console.log(`\n${'─'.repeat(76)}\n❯ ${q}\n`);
  const t = Date.now();
  try {
    const r = await ask(q);
    console.log(r.answer);
    console.log(`\n  ${'·'.repeat(3)} ${r.entity ?? '—'} · ${(r.applied ?? []).join(' · ')}`);
    console.log(`  ${r.total ?? 0} matched${r.truncated ? `, showing ${r.rows.length}` : ''} · ${((Date.now() - t) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.log(`  ERROR — ${err.message}`);
  }
}
console.log('');
