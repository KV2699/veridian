// Cross-process run lock.
//
// The in-process guard in pipeline.js stops one Node process starting a second
// concurrent run. It does nothing about TWO processes — `npm run pipeline` in
// one terminal while a scheduled run fires in another, or a run left alive by a
// closed session.
//
// That is not a theoretical problem. Two overlapping runs both read the
// organisation register, both merged their own signals into what they read, and
// both wrote it back: last write won and the other run's organisations were
// silently lost. The register went backwards from 123 to 78 and nothing
// reported an error, because from each process's point of view nothing had
// gone wrong.

import { writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LOCK_FILE = join(ROOT, 'data', '.pipeline.lock');

// A crashed run must not block the next one forever.
const STALE_MS = Number(process.env.LOCK_STALE_MS) || 60 * 60 * 1000;

/**
 * Take the run lock.
 * @returns {Promise<{release: () => Promise<void>}>}
 * @throws if another live process holds it
 */
export async function acquire({ trigger = 'manual' } = {}) {
  await mkdir(dirname(LOCK_FILE), { recursive: true });

  const existing = await readLock();
  if (existing && !isStale(existing) && isAlive(existing.pid)) {
    throw Object.assign(
      new Error(
        `Another pipeline run is already in progress (pid ${existing.pid}, started ${existing.started_at}, trigger ${existing.trigger}). `
        + 'Wait for it to finish, or stop it — running two at once loses register entries.',
      ),
      { code: 'LOCKED' },
    );
  }
  if (existing) {
    // Held by a process that is gone, or held far too long to be real.
    console.warn(`  ! clearing a stale run lock from pid ${existing.pid} (${existing.started_at})`);
  }

  // Exclusive create would be stronger, but the staleness check above has to be
  // able to take over an abandoned lock, so the file is written plainly and the
  // pid is what actually proves ownership.
  await writeFile(LOCK_FILE, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString(), trigger }, null, 2));

  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    const held = await readLock();
    // Never delete a lock another process has since taken.
    if (held?.pid === process.pid) await rm(LOCK_FILE, { force: true });
  };

  // A run killed with Ctrl-C should not leave the lock behind.
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.once(sig, () => { release().finally(() => process.exit(130)); });
  }

  return { release };
}

async function readLock() {
  try { return JSON.parse(await readFile(LOCK_FILE, 'utf8')); }
  catch { return null; }
}

const isStale = (lock) => Date.now() - new Date(lock.started_at).getTime() > STALE_MS;

function isAlive(pid) {
  if (!pid || pid === process.pid) return false;
  // Signal 0 tests for existence without touching the process.
  try { process.kill(pid, 0); return true; }
  catch (err) { return err.code === 'EPERM'; }
}
