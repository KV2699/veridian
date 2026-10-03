// The retrieval half of the assistant. This is the part that must never guess:
// a model picking "the top 5" from 169 records produces five plausible names,
// some of them wrong. Code cannot do that — so these check it selects, sorts
// and counts exactly, and ignores anything the spec does not define.
import { runQuery, forNarration } from '../server/lib/query-register.js';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

const today = new Date('2026-10-03T12:00:00Z');
const org = (name, o = {}) => ({
  name, status: 'prospect', best_score: 50, best_band: 'High', practice_areas: ['compute'],
  multi_service: false, weeks_tracked: 1, signal_count: 1, quiet_streak: 0, signals: [], categories: { capital: 1 }, ...o,
});

const organisations = [
  org('Alpha', { best_score: 90, best_band: 'Critical', multi_service: true, practice_areas: ['compute', 'software'] }),
  org('Bravo', { best_score: 80, best_band: 'Critical', status: 'account' }),
  org('Charlie', { best_score: 60, quiet_streak: 3 }),
  org('Delta', { best_score: 40, best_band: 'Medium', practice_areas: ['automotive'] }),
  org('Echo', { best_score: 55, signals: [{ deadline: '2026-10-10', summary: 'tender', url: 'https://x.com/1', date: '2026-10-01' }] }),
  org('Foxtrot', { best_score: 70, signals: [{ deadline: '2026-12-01', summary: 'far off', url: 'https://x.com/2' }] }),
];
const signals = [
  { company: 'Echo', priority_score: 80, priority_band: 'Critical', deadline: '2026-10-10', date: '2026-10-01', category: 'tender', needs_review: false, summary: 's1', url: 'https://x.com/1' },
  { company: 'Golf', priority_score: 30, priority_band: 'Medium', date: '2026-09-01', category: 'feed', needs_review: true, summary: 's2', url: 'https://x.com/3' },
];

console.log('\nQuery engine — deterministic retrieval\n');

let r = runQuery({ entity: 'organisations', filters: { band: ['Critical'] }, limit: 10 }, { organisations, signals, today });
check('filters by band', r.rows.length === 2 && r.rows.every((x) => x.best_band === 'Critical'));
check('explains what it applied', r.applied.some((a) => a.includes('Critical')), r.applied.join('; '));

r = runQuery({ entity: 'organisations', filters: {}, sort: 'score', limit: 3 }, { organisations, signals, today });
check('"top 3" returns exactly 3, highest first', r.rows.length === 3 && r.rows[0].name === 'Alpha');
check('reports the true total behind a limit', r.total === 6 && r.truncated === true);

r = runQuery({ entity: 'organisations', filters: { multiService: true } }, { organisations, signals, today });
check('multi-service filter', r.rows.length === 1 && r.rows[0].name === 'Alpha');

r = runQuery({ entity: 'organisations', filters: { status: 'account' } }, { organisations, signals, today });
check('held accounts separated from prospects', r.rows.length === 1 && r.rows[0].name === 'Bravo');

r = runQuery({ entity: 'organisations', filters: { quietForWeeks: 2 } }, { organisations, signals, today });
check('"gone quiet" finds the quiet streak', r.rows.length === 1 && r.rows[0].name === 'Charlie');

r = runQuery({ entity: 'organisations', filters: { practiceAreas: ['automotive'] } }, { organisations, signals, today });
check('practice-area filter', r.rows.length === 1 && r.rows[0].name === 'Delta');

// Deadlines: an organisation's deadline lives on its signals.
r = runQuery({ entity: 'organisations', filters: { deadlineWithinDays: 14 } }, { organisations, signals, today });
check('"closing in 14 days" reaches into signals', r.rows.length === 1 && r.rows[0].name === 'Echo', r.rows.map((x) => x.name).join(','));
check('and excludes one closing in December', !r.rows.some((x) => x.name === 'Foxtrot'));
check('deadline queries sort by deadline automatically', r.sortedBy === 'deadline');

r = runQuery({ entity: 'signals', filters: { needsReview: true } }, { organisations, signals, today });
check('flagged signals can be asked for', r.rows.length === 1 && r.rows[0].company === 'Golf');

// The guard: a filter the spec does not define must narrow nothing.
r = runQuery({ entity: 'organisations', filters: { revenue: '>1bn', ceoName: 'Jane' } }, { organisations, signals, today });
check('an invented filter is ignored, not obeyed', r.total === 6, `${r.total} rows`);
check('and the explanation admits no filter was applied', r.applied[0].includes('no filters'));

r = runQuery({ entity: 'nonsense', filters: {} }, { organisations, signals, today });
check('an unknown entity falls back to organisations', r.entity === 'organisations');

r = runQuery({ entity: 'organisations', filters: {}, limit: 9999 }, { organisations, signals, today });
check('limit is capped so one question cannot dump the register', r.rows.length <= 50);

r = runQuery({ entity: 'organisations', filters: { band: ['Critical'], minScore: 85 } }, { organisations, signals, today });
check('filters combine', r.rows.length === 1 && r.rows[0].name === 'Alpha');

const n = forNarration(organisations[4], 'organisations');
check('narration payload carries the source link', n.url === 'https://x.com/1' && n.name === 'Echo');
check('narration payload stays small', Object.keys(n).length <= 14, `${Object.keys(n).length} fields`);

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
