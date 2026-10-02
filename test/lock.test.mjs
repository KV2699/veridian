// Two pipeline runs at once silently lost 45 organisations from the register:
// both merged into the copy they read, and the last write won. Nothing errored,
// because from each process's view nothing was wrong.
import { acquire, LOCK_FILE } from '../server/lib/lock.js';
import { writeFile, rm, readFile } from 'node:fs/promises';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

console.log('\nCross-process run lock\n');
await rm(LOCK_FILE, { force: true });

const first = await acquire({ trigger: 'test-1' });
check('a run can take the lock', Boolean(first.release));

// A live foreign holder must block.
await writeFile(LOCK_FILE, JSON.stringify({ pid: process.pid === 1 ? 2 : 1, started_at: new Date().toISOString(), trigger: 'other' }));
let blocked = null;
try { await acquire({ trigger: 'test-2' }); } catch (err) { blocked = err; }
check('a second run is refused while one is live', blocked?.code === 'LOCKED');
check('the refusal names the risk', /loses register entries/.test(blocked?.message ?? ''));

// A lock older than the staleness window must be reclaimable, or one crash
// blocks every future run.
await writeFile(LOCK_FILE, JSON.stringify({ pid: 1, started_at: new Date(Date.now() - 3 * 3600_000).toISOString(), trigger: 'crashed' }));
const afterStale = await acquire({ trigger: 'test-3' });
check('a stale lock is reclaimed rather than blocking forever', Boolean(afterStale.release));

// A lock from a process that no longer exists must be reclaimable too.
await writeFile(LOCK_FILE, JSON.stringify({ pid: 999999, started_at: new Date().toISOString(), trigger: 'dead' }));
const afterDead = await acquire({ trigger: 'test-4' });
check('a lock held by a dead process is reclaimed', Boolean(afterDead.release));

// Releasing must not delete a lock someone else now holds.
await writeFile(LOCK_FILE, JSON.stringify({ pid: 424242, started_at: new Date().toISOString(), trigger: 'someone-else' }));
await afterDead.release();
const still = JSON.parse(await readFile(LOCK_FILE, 'utf8'));
check('release never deletes another run\'s lock', still.pid === 424242);

await rm(LOCK_FILE, { force: true });
const clean = await acquire({ trigger: 'test-5' });
await clean.release();
let gone = false;
try { await readFile(LOCK_FILE, 'utf8'); } catch { gone = true; }
check('release clears its own lock', gone);

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
