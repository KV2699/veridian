// CONFIGURATIONS BUILT AT RUNTIME, FROM THE INTERFACE.
//
// A judge should be able to point Veridian at a business it has never seen and
// watch it configure itself. That means a profile can arrive from an HTTP
// request body — which makes it untrusted input that the pipeline will then
// execute. These check the boundary.
import { safeKey, toProfile } from '../server/lib/profile-write.js';
import { validateDraft } from '../server/lib/profile-builder.js';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

console.log('\nRuntime configurations — built from the interface\n');

// ── The key becomes a directory name ───────────────────────────────────────
check('a key is reduced to letters, numbers and hyphens',
  safeKey('Acme Search Ltd!') === 'acme-search-ltd');
check('path traversal cannot survive a key', safeKey('../../etc/passwd') === 'etc-passwd');
check('an empty or symbol-only key is refused',
  safeKey('') === null && safeKey('///') === null && safeKey('  ') === null);
check('the shipped configurations cannot be overwritten by a built one',
  safeKey('nvidia') === null && safeKey('exec-search') === null && safeKey('consultancy') === null);
check('the data directories themselves cannot be targeted',
  safeKey('profiles') === null && safeKey('dry-run') === null);
check('a long key is truncated rather than rejected', safeKey('x'.repeat(200)).length <= 40);

// ── The draft becomes something the pipeline executes ──────────────────────
const hostile = {
  name: 'A'.repeat(5000),
  market: 'widgets',
  practice_areas: [
    { key: 'Not A Key!!', name: 'Fine', description: 'd' },
    { key: 'ok', name: 'Also fine', description: 'd' },
    ...Array.from({ length: 20 }, (_, i) => ({ key: `extra${i}`, name: `E${i}`, description: 'd' })),
  ],
  clients: Array.from({ length: 500 }, (_, i) => `Client ${i}`),
  competitors: ['Rival'],
  polarity: ['A THING is a LEAD — because.'],
  collector_queries: Array.from({ length: 50 }, (_, i) => `query ${i}`),
  feed_terms: ['appoints'],
  winnable_universe: 'mid-market',
  too_big: 'mega-caps with panels',
};
const p = toProfile('acme', hostile, {
  feeds: [{ name: 'good.com', url: 'https://good.com/feed/' }],
  regulators: [{ name: 'Body', domain: 'body.gov.uk', terms: 'decision' }],
});

check('an over-long name is truncated, not stored whole', p.name.length <= 80);
check('practice area keys are normalised to safe identifiers',
  p.practiceAreas.every((a) => /^[a-z0-9_]+$/.test(a.key)), p.practiceAreas.map((a) => a.key).slice(0, 3).join(','));
check('practice areas are capped at eight — more means the scoring inflates',
  p.practiceAreas.length <= 8, `${p.practiceAreas.length}`);
check('the roster is capped', p.roster.length <= 60);
check('queries are capped', p.collectors[0].queries.length <= 8);
check('the business itself is excluded from its own prospect list',
  p.exclusions.some((e) => e.startsWith('A')));
check('competitors are excluded too', p.exclusions.includes('Rival'));
check('verified feeds and regulators are carried through',
  p.feeds.sources[0].url === 'https://good.com/feed/' && p.regulators.bodies[0].domain === 'body.gov.uk');
check('it is marked as generated, with a timestamp',
  p.generated === true && typeof p.generated_at === 'string');
check('a signal type is written for every practice area it kept',
  p.collectors[0].signalTypes.length === p.practiceAreas.length);
check('scoring guidance carries the winnable universe and what to score down',
  p.scoring.guidance.join(' ').includes('mid-market') && p.scoring.guidance.join(' ').includes('mega-caps'));

// ── The refusal travels into the stored profile ────────────────────────────
const unanswered = toProfile('acme2', { ...hostile, polarity: [], polarity_questions: ['Is an appointment a lead?'] });
check('a profile with no polarity still builds — it is a draft, not an error',
  unanswered.polarity.length === 0 && unanswered.polarityQuestions.length === 1);
check('and the unanswered questions are kept so the dashboard can show them',
  unanswered.polarityQuestions[0].includes('appointment'));
check('the validator agrees it needs a human first',
  validateDraft({ ...hostile, polarity: [], polarity_questions: ['Q'] }).needsPolarity);

// ── The shape the pipeline actually reads ──────────────────────────────────
for (const field of ['key', 'name', 'market', 'sweepTerms', 'practiceAreas', 'collectors', 'feeds', 'accountWatch', 'scoring']) {
  check(`a built profile has the ${field} the pipeline reads`, p[field] !== undefined);
}
check('every collector carries its own window', p.collectors.every((c) => Number.isFinite(c.windowDays)));
check('the scoring floor is set', Number.isFinite(p.scoring.floor));
check('no value factor is declared, so it keeps multi-service breadth',
  p.scoring.valueFactor === undefined);

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
