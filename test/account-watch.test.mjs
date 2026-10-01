// Account Watch must never let a held account be presented as a new prospect,
// and must never attribute a signal to an organisation that is not on the
// roster — a competitor named in passing is not news about your account.
import accountWatch from '../server/agents/account-watch.js';

const profile = {
  roster: ['CoreWeave', 'Microsoft Azure', 'Equinix'],
  polarity: ['A new appointment is a lead.'],
  accountWatch: { focus: 'f', signalTypes: ['t'], batchSize: 2, windowDays: 14 },
};

const results = [
  { title: 'CoreWeave expands', url: 'https://news.com/coreweave', content: '', published_date: '2026-09-29', found_via: 'q1' },
  { title: 'Microsoft news', url: 'https://news.com/msft', content: '', published_date: '2026-09-29', found_via: 'q1' },
  { title: 'Unrelated firm', url: 'https://news.com/other', content: '', published_date: '2026-09-29', found_via: 'q2' },
];

const searchMany = async (queries) => ({
  results,
  stats: queries.map((q) => ({ query: q, hits: 2, unique: 2, failed: false })),
});

// The model returns one on-roster signal under a shortened name, one valid,
// and one about a company that is not an account at all.
const completeJSON = async () => ({
  data: { signals: [
    { company: 'Microsoft', signal_type: 'Expansion', summary: 'Microsoft announced new AI capacity.', url: 'https://news.com/msft', date: '2026-09-29', relevance_score: 8 },
    { company: 'CoreWeave', signal_type: 'Expansion', summary: 'CoreWeave opened a new site.', url: 'https://news.com/coreweave', date: '2026-09-29', relevance_score: 9 },
    { company: 'Some Other Corp', signal_type: 'Funding', summary: 'Some Other Corp raised money.', url: 'https://news.com/other', date: '2026-09-29', relevance_score: 9 },
  ] },
});

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

console.log('\nAgent 5 — Account Watch\n');

const r = await accountWatch({ profile }, { knownUrlKeys: new Set() }, { searchMany, completeJSON });
const names = r.signals.map((s) => s.company);

check('signal about a non-roster company is discarded', !names.includes('Some Other Corp'), `kept: ${names.join(', ')}`);
check('"Microsoft" matches roster entry "Microsoft Azure"', names.includes('Microsoft'));
check('exact roster match kept', names.includes('CoreWeave'));
check('every signal tagged as an account, not a prospect', r.signals.every((s) => s.category === 'account' && s.is_account === true));
check('telemetry reported for diagnostics', r.telemetry?.hits === 3 && r.telemetry?.key === 'account');

// Roster batching keeps cost flat as the roster grows.
let queryCount = 0;
await accountWatch(
  { profile: { ...profile, roster: Array.from({ length: 20 }, (_, i) => `Account ${i}`) } },
  { knownUrlKeys: new Set() },
  { searchMany: async (q) => { queryCount = q.length; return { results: [], stats: [] }; }, completeJSON },
);
check('20 accounts batched into 10 searches, not 20', queryCount === 10, `${queryCount} searches`);

// An empty roster must not crash the pipeline.
const empty = await accountWatch({ profile: { ...profile, roster: [] } }, {}, { searchMany, completeJSON });
check('empty roster handled without error', empty.signals.length === 0);

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
