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

// The register module writes to the project data dir, so the accumulation
// logic is checked through a temporary copy rather than the live file.
const { updateRegister, listRegister, registerStats, REGISTER_FILE } = await import('../server/lib/register.js');
const { writeJSON } = await import('../server/lib/store.js');
const fs = await import('node:fs/promises');

const backup = await fs.readFile(REGISTER_FILE, 'utf8').catch(() => null);
await writeJSON(REGISTER_FILE, {});

const sig = (company, extra = {}) => ({
  company, category: 'capital', summary: `${company} did a thing`, url: `https://x.com/${company}`,
  practice_areas: ['compute'], priority_score: 60, priority_band: 'High', ...extra,
});

let r = await updateRegister([sig('CoreWeave'), sig('Nebius'), sig('CoreWeave Inc.')], { week: '2026-W40', roster: ['Nebius'] });
check('three signals across two organisations register as two', r.total === 2, `${r.total} orgs`);
check('a roster name is marked as an account, not a prospect',
  (await listRegister({ status: 'account' })).length === 1);

r = await updateRegister([sig('CoreWeave', { priority_score: 90, priority_band: 'Critical', practice_areas: ['software'] })], { week: '2026-W41' });
const rows = await listRegister();
const cw = rows.find((x) => x.name.includes('CoreWeave'));
check('a returning organisation is not duplicated', r.total === 2);
check('weeks tracked accumulates', cw.weeks_tracked === 2, `${cw.weeks_tracked} weeks`);
check('best score rises to the highest ever seen', cw.best_score === 90 && cw.best_band === 'Critical');
check('practice areas union across weeks reveals a cross-sell',
  cw.practice_areas.includes('compute') && cw.practice_areas.includes('software') && cw.multi_service === true);
check('signal history kept per organisation', cw.signals.length === 3);

const stats = await registerStats();
check('stats report returning organisations', stats.returning === 1 && stats.total === 2, JSON.stringify(stats.bands));
check('ranked best first', (await listRegister())[0].best_score === 90);

if (backup !== null) await fs.writeFile(REGISTER_FILE, backup); else await fs.rm(REGISTER_FILE, { force: true });

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
