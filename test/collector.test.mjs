// The collector's single most important property: a signal whose URL was not
// returned by Tavily is discarded. Nemotron is allowed to summarise what the
// search found and nothing else — this is what stops fabricated sources
// reaching a briefing.
import { normalise } from '../server/agents/collector-base.js';

const batch = [
  { title: 'Real article', url: 'https://real.com/story?utm_source=rss', content: '', published_date: '2026-09-29', found_via: 'q1' },
  { title: 'Other article', url: 'https://other.com/news', content: '', published_date: null, found_via: 'q2' },
  { title: 'Third article', url: 'https://third.com/post', content: '', published_date: null, found_via: 'q3' },
];

const modelOutput = [
  { company: 'Good Co',    signal_type: 'Funding', summary: 'raised £10m', url: 'https://real.com/story',  date: '2026-09-29', relevance_score: 8 },
  { company: 'Ghost Co',   signal_type: 'Funding', summary: 'raised £50m', url: 'https://invented.com/x',  date: '2026-09-29', relevance_score: 9 },
  { company: 'Dup Co',     signal_type: 'Funding', summary: 'same story',  url: 'https://real.com/story/',  date: '2026-09-29', relevance_score: 7 },
  { company: '',           signal_type: 'Funding', summary: 'no company',  url: 'https://other.com/news',  date: '2026-09-29', relevance_score: 8 },
  { company: 'Future Co',  signal_type: 'Launch',  summary: 'launched',    url: 'https://other.com/news',  date: '2099-01-01', relevance_score: 8 },
  { company: 'Score Co',   signal_type: 'Launch',  summary: 'launched',    url: 'https://third.com/post',  date: 'not a date',  relevance_score: 'high' },
  'not an object',
  null,
];

const out = normalise(modelOutput, { batch, category: 'funding' });
const by = Object.fromEntries(out.map((s) => [s.company, s]));

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

console.log('\nAgents 1-4 — collector extraction guards\n');
check('signal with a URL Tavily never returned is discarded', !by['Ghost Co']);
check('real signal is kept with the source URL, not the model\'s version', by['Good Co']?.url === 'https://real.com/story?utm_source=rss');
check('same URL emitted twice is kept once', !by['Dup Co'], `${out.length} signals from ${modelOutput.length} rows`);
check('signal with no company is discarded', !by['']);
check('future date rejected, falls back to source date', by['Future Co'] && by['Future Co'].date === null);
check('unparseable date and non-numeric score handled', by['Score Co']?.date === null && by['Score Co']?.relevance_score === 5);
check('malformed rows (string, null) skipped without throwing', out.length === 3);
check('url_key set on every signal for cross-week dedup', out.every((s) => Boolean(s.url_key)));
check('category stamped from the collector, not the model', out.every((s) => s.category === 'funding'));
check('non-array input returns empty rather than throwing', normalise(undefined, { batch, category: 'x' }).length === 0);

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
