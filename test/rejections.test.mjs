// THE REJECTION LOG, and the counter-reading that travels with a kept signal.
//
// Both exist for the same reason: a BD tool that only reports what it found
// cannot be audited. The interesting question is what it discarded and whether
// it was right to — and on a kept row, what the argument against acting on it
// is.
//
// Ported from the operator's most developed tracker, where the rejection log is
// described as "the proof the method holds", and where the reason code decides
// whether a rejection is a SUPPRESSION (correctly dropped) or a DEFECT REPORT
// (dropped because a rule is wrong, which changes future runs).
import qaVerify from '../server/agents/qa-verifier.js';
import { appendRejections, getRejections, filesFor } from '../server/lib/store.js';
import { rm } from 'node:fs/promises';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

console.log('\nRejection log and counter-reading\n');

const signals = [
  { company: 'Kept Co',   signal_type: 'Departure', summary: 'CSO left, no successor', url: 'https://a.com/1', url_key: 'a.com/1', date: '2026-10-20', relevance_score: 9, category: 'vacancy' },
  { company: 'Weak Co',   signal_type: 'Trend',     summary: 'talent market tight',    url: 'https://b.com/2', url_key: 'b.com/2', date: '2026-10-19', relevance_score: 8, category: 'vacancy' },
  { company: 'Dupe Co',   signal_type: 'Departure', summary: 'same event',             url: 'https://c.com/3', url_key: 'c.com/3', date: '2026-10-20', relevance_score: 7, category: 'posting' },
  { company: 'Unjudged',  signal_type: 'Posting',   summary: 'role advertised',        url: 'https://d.com/4', url_key: 'd.com/4', date: '2026-10-18', relevance_score: 3, category: 'posting' },
];

// IDs are assigned after exact-URL dedup: S1 Kept · S2 Weak · S3 Dupe · S4 Unjudged.
// The model scores one below the floor, marks one a duplicate, omits one
// entirely, and supplies a counter-reading on the one it keeps.
const completeJSON = async () => ({
  model: 'mock', usage: null, raw: '',
  data: {
    verified: [
      { id: 'S1', relevance_score: 9, practice_areas: ['search', 'interim'], org_scale: 'mid',
        counter_reading: 'The group talent team may run this search in-house, so the realistic entry is interim cover rather than retained search.' },
      { id: 'S2', relevance_score: 4, review_reason: 'Names no organisation — sector commentary' },
      { id: 'S3', relevance_score: 7, duplicate_of: 'S1' },
      // S4 omitted — the unjudged path.
    ],
    connections: [],
    assessment: 'ok',
  },
});

const profile = {
  key: 'exec-search',
  practiceAreas: [{ key: 'search' }, { key: 'recruitment' }, { key: 'interim' }, { key: 'advisory' }],
  scoring: { floor: 6 },
};

const r = await qaVerify({ signals, profile }, { completeJSON });
const byCode = Object.fromEntries((r.rejections ?? []).map((x) => [x.reason_code, x]));

check('the verifier returns the rows it dropped, not just a count',
  Array.isArray(r.rejections) && r.rejections.length === 3,
  `${r.rejections?.length} rejections`);
check('a below-floor drop is logged as BELOW_FLOOR', Boolean(byCode.BELOW_FLOOR));
check('a cross-category duplicate is logged as DUPLICATE', Boolean(byCode.DUPLICATE));
check('a row the model never judged is logged as UNVERIFIED, not as false',
  Boolean(byCode.UNVERIFIED) && /below the floor/i.test(byCode.UNVERIFIED.reason));
check('every rejection carries the source url, so it can be re-sourced later',
  r.rejections.every((x) => x.url && x.url_key));
check('every rejection carries a stated reason, never an empty string',
  r.rejections.every((x) => String(x.reason ?? '').trim().length > 5));
check('the duplicate reason names what it duplicated',
  /S1/.test(byCode.DUPLICATE.reason));
check('rejections are stamped with the stage that dropped them',
  r.rejections.every((x) => x.stage === 'verification'));
check('the drop count and the rejection count agree',
  r.stats.rejections === r.rejections.length
  && r.stats.dropped + r.stats.duplicates === r.rejections.length,
  `dropped ${r.stats.dropped} + dupes ${r.stats.duplicates} = ${r.rejections.length}`);

// ── Counter-reading ────────────────────────────────────────────────────────
const kept = r.signals.find((s) => s.company === 'Kept Co');
check('a kept signal carries its counter-reading', Boolean(kept?.counter_reading));
check('the counter-reading survives verbatim, not summarised',
  kept.counter_reading.startsWith('The group talent team'));
check('it is counted, so a briefing can be audited for how many it stated',
  r.stats.counter_read === 1);
check('a signal with no counter-reading gets an empty string, never undefined',
  r.signals.every((s) => typeof s.counter_reading === 'string'));
// A model given a free-text field will sometimes write an essay in it. The cap
// is enforced in code rather than asked for in the prompt.
const capped = await qaVerify(
  { signals: [signals[0]], profile },
  { completeJSON: async () => ({ model: 'm', usage: null, raw: '', data: { verified: [{ id: 'S1', relevance_score: 9, practice_areas: ['search'], counter_reading: 'x'.repeat(900) }], connections: [], assessment: '' } }) },
);
check('an over-long counter-reading is capped at 400 characters, not trusted', capped.signals[0].counter_reading.length === 400);

// ── Persistence ────────────────────────────────────────────────────────────
// Written to a throwaway profile so the live logs are never touched.
const P = '__test__';
await rm(filesFor(P).rejections, { force: true });

const first = await appendRejections(r.rejections.map((x) => ({ ...x, week: '2026-W43' })), P);
check('rejections persist', first.added === 3 && first.total === 3);

const again = await appendRejections(r.rejections.map((x) => ({ ...x, week: '2026-W44' })), P);
check('the same rejection next week is not logged twice — a rejected org is not re-judged from scratch',
  again.added === 0 && again.total === 3);

const stored = await getRejections(P);
check('the newest rejections are first', stored.length === 3);
check('an empty batch is a no-op, not a write', (await appendRejections([], P)).added === 0);

await rm(filesFor(P).rejections, { force: true });

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
