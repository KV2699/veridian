// The register is the actual deliverable — a growing, deduplicated prospect
// list the system sources for itself. These check it accumulates correctly
// across weeks rather than restating one week's signals.
import { keyFor } from '../server/lib/register.js';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

console.log('\nOrganisation register\n');

check('legal suffixes collapse to one organisation',
  keyFor('CoreWeave Inc.') === keyFor('CoreWeave') && keyFor('Nebius Group N.V.') === keyFor('Nebius'));
check('punctuation and case ignored', keyFor('Hewlett-Packard Enterprise') === keyFor('hewlett packard enterprise'));
check('ampersands normalised', keyFor('Samsung & Co') === keyFor('Samsung and'));
check('genuinely different companies stay separate', keyFor('Oracle') !== keyFor('Orange'));
check('empty names rejected', keyFor('') === '' && keyFor(null) === '');

// Registers are per profile, so these run against a throwaway profile key of
// their own. The earlier version read, blanked and restored the LIVE register
// — which worked, but one interrupted run between the blank and the restore
// would have destroyed the real prospect list.
const { updateRegister, listRegister, registerStats, registerFile } = await import('../server/lib/register.js');
const { writeJSON } = await import('../server/lib/store.js');
const fs = await import('node:fs/promises');

const P = '__test__';
const FILE = registerFile(P);
await writeJSON(FILE, {});

const sig = (company, extra = {}) => ({
  company, category: 'capital', summary: `${company} did a thing`, url: `https://x.com/${company}`,
  practice_areas: ['compute'], priority_score: 60, priority_band: 'High', ...extra,
});

let r = await updateRegister([sig('CoreWeave'), sig('Nebius'), sig('CoreWeave Inc.')], { week: '2026-W40', roster: ['Nebius'], profile: P });
check('three signals across two organisations register as two', r.total === 2, `${r.total} orgs`);
check('a roster name is marked as an account, not a prospect',
  (await listRegister({ status: 'account', profile: P })).length === 1);

r = await updateRegister([sig('CoreWeave', { priority_score: 90, priority_band: 'Critical', practice_areas: ['software'] })], { week: '2026-W41', profile: P });
const rows = await listRegister({ profile: P });
const cw = rows.find((x) => x.name.includes('CoreWeave'));
check('a returning organisation is not duplicated', r.total === 2);
check('weeks tracked accumulates', cw.weeks_tracked === 2, `${cw.weeks_tracked} weeks`);
check('best score rises to the highest ever seen', cw.best_score === 90 && cw.best_band === 'Critical');
check('practice areas union across weeks reveals a cross-sell',
  cw.practice_areas.includes('compute') && cw.practice_areas.includes('software') && cw.multi_service === true);
check('signal history kept per organisation', cw.signals.length === 3);

// The business running this is never its own prospect, and a joint
// announcement is not one organisation.
await writeJSON(FILE, {});
r = await updateRegister(
  [sig('NVIDIA'), sig('OpenAI / SB Energy / NVIDIA'), sig('AWS'), sig('Amazon Web Services'), sig('CoreWeave')],
  { week: '2026-W40', exclusions: ['NVIDIA'], aliases: { AWS: 'Amazon Web Services' }, profile: P },
);
const names = (await listRegister({ profile: P })).map((x) => x.name);
check('the excluded organisation never enters the register', !names.includes('NVIDIA'), names.join(', '));
check('a joint announcement is skipped rather than merged', !names.some((n) => n.includes('/')));
check('an acronym registers under its parent, not twice',
  names.filter((n) => /amazon/i.test(n)).length === 1 && !names.includes('AWS'));
check('skipped entries are reported', r.skipped === 2, `${r.skipped} skipped`);

await writeJSON(FILE, {});
await updateRegister([sig('CoreWeave'), sig('Nebius'), sig('CoreWeave Inc.')], { week: '2026-W40', roster: ['Nebius'], profile: P });
await updateRegister([sig('CoreWeave', { priority_score: 90, priority_band: 'Critical', practice_areas: ['software'] })], { week: '2026-W41', profile: P });

// "Checked and quiet" is a different fact from "never looked at", and only the
// first is useful — an account quiet several weeks running is a BD signal.
const { recordQuiet } = await import('../server/lib/register.js');
await writeJSON(FILE, {});
await updateRegister([sig('CoreWeave'), sig('Nebius')], { week: '2026-W40', profile: P });
await recordQuiet(['CoreWeave', 'Nebius'], { week: '2026-W40', profile: P });
let q = (await listRegister({ profile: P })).find((x) => x.name === 'CoreWeave');
check('an organisation seen this week is never marked quiet', q.quiet_streak === 0);

await recordQuiet(['CoreWeave'], { week: '2026-W41', profile: P });
await recordQuiet(['CoreWeave'], { week: '2026-W42', profile: P });
q = (await listRegister({ profile: P })).find((x) => x.name === 'CoreWeave');
check('consecutive quiet weeks accumulate into a streak', q.quiet_streak === 2, `streak ${q.quiet_streak}`);
check('quiet organisations are filterable', (await listRegister({ quietFor: 2, profile: P })).length === 1);

await updateRegister([sig('CoreWeave')], { week: '2026-W43', profile: P });
await recordQuiet(['Nebius'], { week: '2026-W43', profile: P });
q = (await listRegister({ profile: P })).find((x) => x.name === 'CoreWeave');
check('a fresh signal resets the streak', q.quiet_streak === 0 || q.last_seen === '2026-W43');

await writeJSON(FILE, {});
await updateRegister([sig('CoreWeave'), sig('Nebius'), sig('CoreWeave Inc.')], { week: '2026-W40', roster: ['Nebius'], profile: P });
await updateRegister([sig('CoreWeave', { priority_score: 90, priority_band: 'Critical', practice_areas: ['software'] })], { week: '2026-W41', profile: P });

const stats = await registerStats(P);
check('stats report returning organisations', stats.returning === 1 && stats.total === 2, JSON.stringify(stats.bands));
check('ranked best first', (await listRegister({ profile: P }))[0].best_score === 90);

await fs.rm(FILE, { force: true });

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
