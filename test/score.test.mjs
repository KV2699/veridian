// The four-factor algorithm, verified against the worked rules it implements.
// This is the part that must never drift: a score is only trustworthy if it is
// reproducible from its inputs, which is why no model supplies the number.
import { scoreSignal, practiceAreaPoints, urgencyPoints, scalePoints, bandFor, valueFactorFor, MULTI_SERVICE_FACTOR } from '../server/lib/score.js';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

console.log('\nPriority scoring — four factors, computed in code\n');

check('3+ practice areas = 30', practiceAreaPoints(4) === 30 && practiceAreaPoints(3) === 30);
check('2 areas = 20, 1 area = 10, 0 areas = 0',
  practiceAreaPoints(2) === 20 && practiceAreaPoints(1) === 10 && practiceAreaPoints(0) === 0);

const now = new Date('2026-10-01T12:00:00Z');
check('this week = 25', urgencyPoints('2026-09-28', now) === 25);
check('this month = 15', urgencyPoints('2026-09-10', now) === 15);
check('this quarter = 5', urgencyPoints('2026-08-01', now) === 5);
check('older = 0', urgencyPoints('2026-01-01', now) === 0);
check('undated = 0 (an undated signal cannot be urgent)', urgencyPoints(null, now) === 0);
check('future-dated = 0 (extraction error, never rewarded)', urgencyPoints('2027-01-01', now) === 0);

check('large = 20, mid = 12, small = 5', scalePoints('large') === 20 && scalePoints('mid') === 12 && scalePoints('small') === 5);
check('unknown scores as small, never as large', scalePoints('unknown') === 5 && scalePoints(undefined) === 5);

check('bands: 75+ Critical, 50+ High, 25+ Medium, else Low',
  bandFor(100).band === 'Critical' && bandFor(75).band === 'Critical' &&
  bandFor(74).band === 'High' && bandFor(50).band === 'High' &&
  bandFor(49).band === 'Medium' && bandFor(24).band === 'Low');

// A maximal signal: 3 areas + multi-service + this week + large = 100
const best = scoreSignal({ practice_areas: ['a', 'b', 'c'], date: '2026-09-28', org_scale: 'large' }, { now });
check('maximal signal totals 100 and bands Critical', best.priority_score === 100 && best.priority_band === 'Critical',
  JSON.stringify(best.score_breakdown));

// Single area, undated, unknown scale = 10 + 0 + 0 + 5 = 15 → Low
const worst = scoreSignal({ practice_areas: ['a'], date: null }, { now });
check('weak signal totals 15 and bands Low', worst.priority_score === 15 && worst.priority_band === 'Low');

// The multi-service cliff — the thing the whole feature exists for.
const one = scoreSignal({ practice_areas: ['a'], date: '2026-09-28', org_scale: 'large' }, { now });
const two = scoreSignal({ practice_areas: ['a', 'b'], date: '2026-09-28', org_scale: 'large' }, { now });
check('a second practice area is worth 35 points (10→20 fit, plus 25 multi-service)',
  two.priority_score - one.priority_score === 35, `${one.priority_score} → ${two.priority_score}`);
check('one area is not multi-service, two areas is',
  one.multi_service === false && two.multi_service === true);
check('one-area signal is High, two-area signal is Critical — a whole band',
  one.priority_band === 'High' && two.priority_band === 'Critical');

check('breakdown always sums to the total',
  [best, worst, one, two].every((s) => Object.values(s.score_breakdown).reduce((a, b) => a + b, 0) === s.priority_score));
check('non-array practice_areas handled', scoreSignal({ practice_areas: 'compute' }).priority_score === 5);

// ── The profile-defined value factor ──────────────────────────────────────
// Breadth is the right measure for a business selling many services to one
// client. It measures nothing for a vendor whose revenue sits in one line —
// there, deal scale is what separates a big opportunity from a small one.
const dealScale = {
  key: 'deal_scale', name: 'Deal Scale',
  points: { mega: 25, large: 15, standard: 5, unknown: 0 },
};

const mega = scoreSignal(
  { practice_areas: ['compute'], date: '2026-09-28', org_scale: 'large', deal_scale: 'mega' },
  { now, valueFactor: dealScale },
);
const small = scoreSignal(
  { practice_areas: ['compute'], date: '2026-09-28', org_scale: 'large', deal_scale: 'standard' },
  { now, valueFactor: dealScale },
);
check('a gigawatt-scale deal outranks a small one on identical breadth',
  mega.priority_score === 80 && small.priority_score === 60, `${small.priority_score} vs ${mega.priority_score}`);
check('and they land in different bands', mega.priority_band === 'Critical' && small.priority_band === 'High');
check('the breakdown is named for what it measured', 'deal_scale' in mega.score_breakdown);
check('an unstated deal size scores nothing, never a guess',
  scoreSignal({ practice_areas: ['compute'], date: '2026-09-28', org_scale: 'large', deal_scale: 'unknown' },
    { now, valueFactor: dealScale }).score_breakdown.deal_scale === 0);
check('an undefined level is treated as unknown, not as an error',
  scoreSignal({ practice_areas: ['compute'], deal_scale: 'enormous' }, { now, valueFactor: dealScale }).score_breakdown.deal_scale === 0);

check('a profile with no valueFactor keeps the original multi-service measure',
  valueFactorFor({}).key === MULTI_SERVICE_FACTOR.key && valueFactorFor(undefined).key === 'multi_service');
check('a profile that declares one gets it',
  valueFactorFor({ scoring: { valueFactor: dealScale } }).key === 'deal_scale');

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
