// Agent 5 defensive behaviour, tested against a scripted Nemotron response.
// These are the protections that cannot be seen in a demo but decide whether
// the briefing can be trusted: score floor, dedup, clamping, skipped rows.
import qaVerify from '../server/agents/qa-verifier.js';

const signals = [
  { company:'Real Co',  signal_type:'Funding', summary:'raised', url:'https://a.com/1', url_key:'a.com/1', date:'2026-09-29', relevance_score:9, category:'funding' },
  { company:'Dup Co',   signal_type:'Funding', summary:'raised', url:'https://a.com/1', url_key:'a.com/1', date:'2026-09-29', relevance_score:4, category:'product' },
  { company:'Low Co',   signal_type:'Trend',   summary:'market tight', url:'https://b.com/2', url_key:'b.com/2', date:'2026-09-28', relevance_score:9, category:'competitive' },
  { company:'Undated',  signal_type:'Launch',  summary:'launched', url:'https://c.com/3', url_key:'c.com/3', date:null, relevance_score:8, category:'product' },
  { company:'Skipped',  signal_type:'RFP',     summary:'tender open', url:'https://d.com/4', url_key:'d.com/4', date:'2026-09-30', relevance_score:9, category:'opportunity' },
  { company:'CrossDup', signal_type:'Launch',  summary:'same event', url:'https://e.com/5', url_key:'e.com/5', date:'2026-09-30', relevance_score:7, category:'competitive' },
];

// IDs are assigned AFTER exact-URL dedup, so the surviving five signals are:
//   S1 Real Co · S2 Low Co · S3 Undated · S4 Skipped · S5 CrossDup
//
// A deliberately badly-behaved model: scores one signal below the floor,
// returns an out-of-range score, omits a row entirely, marks a cross-category
// duplicate, and cites a signal id that does not exist.
const completeJSON = async () => ({
  model: 'mock', usage: null, raw: '',
  data: {
    verified: [
      { id: 'S1', relevance_score: 9, needs_review: false, practice_areas: ['compute', 'networking', 'invented-area'], org_scale: 'large' },
      { id: 'S2', relevance_score: 3,   needs_review: false },
      { id: 'S3', relevance_score: 999, needs_review: false, practice_areas: ['compute'], org_scale: 'not-a-scale' },
      // S4 deliberately omitted — tests the unjudged path.
      { id: 'S5', relevance_score: 8,   needs_review: false, duplicate_of: 'S1' },
      { id: 'S99', relevance_score: 10, needs_review: false },
    ],
    connections: [{ observation: 'real link', signal_ids: ['S1', 'S99'] }, { observation: '' }],
    assessment: 'ok',
  },
});

const profile = { practiceAreas: [{ key: 'compute' }, { key: 'networking' }, { key: 'software' }] };
const r = await qaVerify({ signals, profile }, { completeJSON });
const by = Object.fromEntries(r.signals.map((s) => [s.company, s]));

let failed = 0;
const check = (label, pass, extra = '') => {
  if (!pass) failed++;
  console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`);
};

console.log('\nAgent 5 — QA Verifier defensive behaviour\n');
check('exact-URL duplicate collapsed before the model sees it', r.stats.unique === 5, `${r.stats.input} in → ${r.stats.unique} unique`);
check('score below floor 6 is dropped', !by['Low Co']);
check('cross-category duplicate removed', r.stats.duplicates === 1);
check('out-of-range score clamped to 10', by['Undated']?.relevance_score === 10);
check('undated signal force-flagged for review', by['Undated']?.needs_review === true);
check('row the model skipped is kept but marked unverified', by['Skipped']?.verified === false && by['Skipped']?.needs_review === true);
check('connection citing a non-existent id has it stripped', r.connections[0]?.signal_ids.length === 1);
check('empty-observation connection discarded', r.connections.length === 1);
check('output ranked by computed priority score, not the model\'s relevance',
  r.signals.every((s, i, a) => i === 0 || a[i - 1].priority_score >= s.priority_score));
check('every signal carries an auditable score breakdown',
  r.signals.every((s) => s.score_breakdown && typeof s.priority_score === 'number' && s.priority_band));

const s1 = r.signals.find((s) => s.company === 'Real Co');
check('practice area the profile does not sell is stripped',
  s1 && !s1.practice_areas.includes('invented-area'), `areas: ${s1?.practice_areas.join(', ')}`);
check('two valid areas sets multi_service true', s1?.multi_service === true);
check('multi-service worth 25 points', s1?.score_breakdown.multi_service === 25);
check('2 areas scores 20 for practice area fit', s1?.score_breakdown.practice_area_fit === 20);
check('invalid org_scale falls back to unknown, not large',
  r.signals.find((s) => s.company === 'Undated')?.org_scale === 'unknown');
check('stats report multi-service and Critical counts',
  typeof r.stats.multi_service === 'number' && typeof r.stats.critical === 'number');

console.log(`\n  stats: ${JSON.stringify(r.stats)}`);
console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
