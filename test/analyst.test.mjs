// The conversational layer. The risk here is not a wrong filter — it is a
// confident answer that was never in the data. These check the model is kept
// away from the selecting, and that an unanswerable question is refused rather
// than guessed at.
import ask from '../server/agents/analyst.js';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

const organisations = [
  { name: 'Alpha', best_score: 90, best_band: 'Critical', status: 'prospect', practice_areas: ['compute', 'software'], multi_service: true, weeks_tracked: 2, signal_count: 3, quiet_streak: 0, signals: [{ summary: 'raised money', url: 'https://a.com/1', date: '2026-10-01' }], categories: { capital: 3 } },
  { name: 'Bravo', best_score: 40, best_band: 'Medium', status: 'prospect', practice_areas: ['compute'], multi_service: false, weeks_tracked: 1, signal_count: 1, quiet_streak: 4, signals: [], categories: { feed: 1 } },
];
const listRegister = async () => organisations;
const getSignals = async () => [];

console.log('\nAnalyst — the conversational layer\n');

// What the model was asked to translate, captured for inspection.
let seenNarratePrompt = '';
const makeDeps = (spec) => ({
  listRegister, getSignals,
  completeJSON: async () => ({ data: spec }),
  complete: async ({ user }) => { seenNarratePrompt = user; return { text: 'Alpha leads on 90.' }; },
});

let r = await ask('top 5 multi-service prospects', makeDeps({ entity: 'organisations', filters: { multiService: true, status: 'prospect' }, sort: 'score', limit: 5 }));
check('answers a normal question', r.answer.includes('Alpha'));
check('retrieval ran in code, not the model', r.total === 1 && r.rows[0].name === 'Alpha');
check('the narrator is handed only the matching rows', seenNarratePrompt.includes('Alpha') && !seenNarratePrompt.includes('Bravo'),
  'Bravo must not be in the narration prompt');
check('the applied filters are reported back', r.applied.some((a) => a.includes('two or more')));

// The important one: an unanswerable question must be refused, not filled in.
r = await ask("which of these is most likely to sign first?", makeDeps({ entity: 'organisations', filters: {}, unanswerable: 'the register records events and scores, not conversion likelihood' }));
check('an unanswerable question is declined', r.declined === true);
check('and the refusal explains why', /conversion likelihood/.test(r.answer), r.answer.slice(0, 80));
check('and no rows are invented to pad it', r.rows.length === 0);

// A hallucinated filter must narrow nothing rather than silently mislead.
r = await ask('which companies have revenue over £1bn?', makeDeps({ entity: 'organisations', filters: { revenue: '>1bn' }, limit: 5 }));
check('an invented filter is ignored by retrieval', r.total === 2, `${r.total} rows`);

// Empty results must stay empty.
r = await ask('anything in automotive?', makeDeps({ entity: 'organisations', filters: { practiceAreas: ['automotive'] } }));
check('no matches returns no rows', r.total === 0 && r.rows.length === 0);
check('and the narrator is told plainly that nothing matched', seenNarratePrompt.includes('(none matched)'));

r = await ask('   ', makeDeps({ entity: 'organisations', filters: {} }));
check('an empty question is handled without calling the model', r.rows.length === 0);

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
