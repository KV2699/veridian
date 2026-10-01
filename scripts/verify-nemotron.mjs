#!/usr/bin/env node
// Live check that your Nebius key and both Nemotron tiers actually work.
// Costs a few cents of inference and makes NO Tavily calls — use it to prove
// the AI half of the pipeline independently of search.
//
//   npm run verify
import 'dotenv/config';
import qaVerify from '../server/agents/qa-verifier.js';
import writeBriefing from '../server/agents/briefing-writer.js';

// Three realistic signals, one deliberately weak (sector-level, no named action)
// to see whether Nemotron Ultra actually applies the scoring discipline.
const signals = [
  { company:'CoreWeave', signal_type:'Funding Round', summary:'CoreWeave announced a $1.1bn funding round to expand GPU capacity.', url:'https://example-news.com/coreweave-round', url_key:'example-news.com/coreweave-round', date:'2026-09-29', relevance_score:8, category:'funding' },
  { company:'Mistral AI', signal_type:'Model Release', summary:'Mistral AI released a new open-weights model under Apache 2.0.', url:'https://example-news.com/mistral-release', url_key:'example-news.com/mistral-release', date:'2026-09-30', relevance_score:7, category:'product' },
  { company:'The GPU market', signal_type:'Trend', summary:'Analysts say the GPU market remains tight heading into 2027.', url:'https://example-news.com/gpu-trend', url_key:'example-news.com/gpu-trend', date:'2026-09-28', relevance_score:8, category:'competitive' },
];

console.log('\n── AGENT 5 · Nemotron Ultra verification ──');
const t5 = Date.now();
const qa = await qaVerify({ signals });
console.log(`\nmodel: ${qa.model}   ${((Date.now()-t5)/1000).toFixed(1)}s`);
console.log('stats:', JSON.stringify(qa.stats));
for (const s of qa.signals) console.log(`  ${s.relevance_score}/10  ${s.company}${s.needs_review ? '  [REVIEW: '+s.review_reason+']' : ''}`);
console.log('dropped:', signals.filter(x => !qa.signals.some(k => k.url_key === x.url_key)).map(x => x.company).join(', ') || 'none');
console.log('assessment:', qa.assessment);

console.log('\n── AGENT 6 · Nemotron Ultra synthesis ──');
const t6 = Date.now();
const b = await writeBriefing({ signals: qa.signals, connections: qa.connections, assessment: qa.assessment, week:'2026-W40', weekLabel:'28 September 2026' });
console.log(`model: ${b.model}   ${((Date.now()-t6)/1000).toFixed(1)}s\n`);
console.log(b.markdown);
