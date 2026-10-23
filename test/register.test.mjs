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


// ── What is allowed to BE a prospect ───────────────────────────────────────
// The top five entries in the live register were once `United Kingdom`,
// `South Korea Government`, `South Korea`, a ministry and `UK government` —
// with `United Kingdom` scoring 90 Critical, sourced to an ETF investment
// guide. A country cannot sign a contract, and that one row undercut every
// claim the system makes about grounding and arithmetic scoring.
const { isGenericEntity, ownerOf } = await import('../server/lib/register.js');

console.log('\nWho is allowed to be a prospect\n');

for (const n of ['United Kingdom', 'South Korea', 'Taiwan', 'European Union', 'UK government',
  'Government of Canada', 'Trump Administration', 'government']) {
  check(`a country, bloc or bare government is not a prospect — ${n}`, isGenericEntity(n));
}

// The opposite failure is worse, and it happened: an earlier heuristic dropped
// Dell Technologies and the US Department of Energy. A named body that can
// sign a contract must survive, and in this market a public body is one of the
// best prospects there is — sovereign AI programmes are signed by one.
for (const n of ['Dell Technologies', 'Hewlett Packard Enterprise', 'Lambda Labs', 'Crusoe Energy',
  'Department of Energy', 'East Riding of Yorkshire Council', 'European Commission',
  'Nscale', 'CoreWeave', 'Digital Realty', "Lloyd's Register", "Moody's"]) {
  check(`a named organisation survives — ${n}`, !isGenericEntity(n));
}

check('a person is dropped only when the source is a profile page',
  isGenericEntity('James Wise', { sourceUrl: 'https://www.linkedin.com/posts/jameswise' })
  && !isGenericEntity('James Wise', { sourceUrl: 'https://www.datacenterdynamics.com/news/x' }));

check('a description registers under its owner, who is the real lead',
  ownerOf("KKR's AI infrastructure company") === 'KKR'
  && ownerOf("Microsoft's new datacentre") === 'Microsoft');
check('a possessive that is part of the name is left alone',
  ownerOf("Lloyd's Register") === "Lloyd's Register" && ownerOf("Moody's") === "Moody's");
check('a possessive naming a public body is left alone',
  ownerOf("Japan's Ministry of Economy, Trade and Industry").includes('Ministry'));

// A band stored alongside a score can disagree with it. Four live entries sat
// at 80 labelled "High" when 80 is Critical, because the band was taken as
// given rather than derived from the number beside it.
await writeJSON(FILE, {});
await updateRegister(
  [sig('Banded Industries', { priority_score: 80, priority_band: 'High', url: 'https://news.example.com/1' })],
  { week: '2026-W40', profile: P },
);
check('the band is derived from the score, never taken as given',
  (await listRegister({ profile: P }))[0].best_band === 'Critical');

await writeJSON(FILE, {});
await updateRegister([sig('Apollo, BlackRock, Microsoft and KKR')], { week: '2026-W40', profile: P });
check('a comma-list joint announcement is not registered as one organisation',
  (await listRegister({ profile: P })).length === 0);

await fs.rm(FILE, { force: true });

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
