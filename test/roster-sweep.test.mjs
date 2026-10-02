// A sweep's whole value is that coverage is auditable: every name on the list
// gets a result. These check the distinctions that makes possible — quiet vs
// unchecked, and a signal that is genuinely about the organisation swept.
import rosterSweep from '../server/agents/roster-sweep.js';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

const profile = {
  practiceAreas: [{ key: 'compute', name: 'Compute' }],
  scoring: { valueFactor: { key: 'deal_scale', points: { mega: 25, unknown: 0 } } },
  rosterSweep: { batchSize: 4, windowDays: 14, maxOrganisations: 20 },
  roster: [],
};

const register = [
  { name: 'CoreWeave' }, { name: 'Nscale' }, { name: 'Quiet Corp' }, { name: 'Missing Co' },
];
const listRegister = async () => register;

const results = [
  { title: 'CoreWeave expands capacity', url: 'https://news.com/cw', published_date: '2026-09-29',
    content: 'CoreWeave announced a new 200MW site this week, expanding its GPU capacity.' },
  { title: 'Nscale raises financing', url: 'https://news.com/ns', published_date: '2026-09-28',
    content: 'Nscale secured financing for its Norway data centre buildout.' },
];
const searchMany = async (queries) => ({ results, stats: queries.map((q) => ({ query: q, hits: 2, unique: 2, failed: false })) });

// The model answers for three of four names, and invents a url for one.
const completeJSON = async () => ({
  data: { results: [
    { organisation: 'CoreWeave', found: true, signal_type: 'Expansion', summary: 'CoreWeave announced a new 200MW site.', url: 'https://news.com/cw', date: '2026-09-29', practice_areas: ['compute'], value_level: 'mega', contact_role: 'VP Infrastructure' },
    { organisation: 'Nscale', found: true, signal_type: 'Funding', summary: 'Nscale secured financing for Norway.', url: 'https://invented.com/x', date: '2026-09-28', practice_areas: ['compute'], value_level: 'unknown' },
    { organisation: 'Quiet Corp', found: false },
    // 'Missing Co' omitted entirely — must be treated as quiet, not dropped.
  ] },
});

console.log('\nAgent — Roster Sweep (enumerated coverage)\n');

const r = await rosterSweep({ profile, week: '2026-W40' }, { knownUrlKeys: new Set() }, { searchMany, completeJSON, listRegister });

check('every name on the list is accounted for', r.checked === 4, `${r.checked} checked of 4`);
check('signals + quiet equals the list', r.signals.length + r.quiet.length === 4,
  `${r.signals.length} signals + ${r.quiet.length} quiet`);
check('a genuine signal is captured', r.signals.some((s) => s.company === 'CoreWeave'));
check('an organisation explicitly reported as having nothing is quiet', r.quiet.includes('Quiet Corp'));
check('an organisation the model omitted is quiet, not silently lost', r.quiet.includes('Missing Co'));
check('a signal with an invented url is discarded', !r.signals.some((s) => s.company === 'Nscale'),
  r.signals.map((s) => s.company).join(', '));
check('contact role captured as a role, never a person', r.signals[0]?.contact_role === 'VP Infrastructure');
check('signals tagged to the sweep, not to a topic collector', r.signals.every((s) => s.category === 'roster'));

// A failed batch must never be recorded as quiet — those names were not checked.
const failing = await rosterSweep(
  { profile, week: '2026-W40' }, { knownUrlKeys: new Set() },
  { searchMany, completeJSON: async () => { throw new Error('model unavailable'); }, listRegister },
);
check('a failed batch is not passed off as quiet', failing.quiet.length === 0,
  `${failing.quiet.length} wrongly marked quiet`);

// An empty register cannot be swept, and must say so rather than crash.
const empty = await rosterSweep({ profile, week: '2026-W40' }, {}, { searchMany, completeJSON, listRegister: async () => [] });
check('an empty register is reported, not crashed on', empty.checked === 0 && empty.signals.length === 0);

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
