// Flat-file JSON persistence. No database by design: the whole system is meant
// to be clonable, inspectable and diffable, and a week of signals is kilobytes.
//
//   briefings.json  — every briefing ever produced, newest first
//   signal_log.json — every raw signal ever collected, append-only, for trends
//   runs.json       — per-run agent status and timings, powers the status panel

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// A dry run writes to its own directory. It used to share the live store, and
// its fixtures accumulated there alongside real signals — seven of them, one
// carrying a deadline, which made it the system's answer to "what is closing in
// the next 14 days?". A demo artefact presented as a real tender is the worst
// kind of wrong, because it is confidently specific.
export const DATA_DIR = process.env.DRY_RUN === 'true'
  ? join(ROOT, 'data', 'dry-run')
  : join(ROOT, 'data');

export const FILES = {
  briefings: join(DATA_DIR, 'briefings.json'),
  signals: join(DATA_DIR, 'signal_log.json'),
  runs: join(DATA_DIR, 'runs.json'),
  // Collection checkpoint. Searching is the slow, metered half of a run, so
  // raw signals are written the moment collection finishes — a failure in
  // verification or synthesis then costs seconds to retry instead of minutes
  // and a fresh set of search credits.
  raw: join(DATA_DIR, 'last_collection.json'),
};

export async function readJSON(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    // A corrupt file must not silently become an empty one.
    throw new Error(`${file} is not readable JSON — ${err.message}`);
  }
}

// Write to a temp file then rename, so a crash mid-write cannot truncate the log.
export async function writeJSON(file, value) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tmp, file);
}

export const getBriefings = () => readJSON(FILES.briefings, []);
export const getSignals = () => readJSON(FILES.signals, []);
export const getRuns = () => readJSON(FILES.runs, []);

export const saveCollection = (payload) => writeJSON(FILES.raw, payload);
export const getCollection = () => readJSON(FILES.raw, null);

/** Store a briefing, replacing any existing briefing for the same week. */
export async function saveBriefing(briefing) {
  const all = await getBriefings();
  const kept = all.filter((b) => b.week !== briefing.week);
  kept.unshift(briefing);
  await writeJSON(FILES.briefings, kept);
  return kept.length;
}

/** Append raw signals, skipping any URL already in the log (cross-week dedup). */
export async function appendSignals(signals) {
  const all = await getSignals();
  const seen = new Set(all.map((s) => s.url_key).filter(Boolean));
  const added = signals.filter((s) => s.url_key && !seen.has(s.url_key));
  await writeJSON(FILES.signals, [...all, ...added]);
  return { added: added.length, skipped: signals.length - added.length, total: all.length + added.length };
}

/** Keep the 50 most recent runs — enough for the status panel and trend checks. */
export async function saveRun(run) {
  const all = await getRuns();
  all.unshift(run);
  await writeJSON(FILES.runs, all.slice(0, 50));
}

/** URLs already collected in a prior week — the accumulating exclusion list. */
export async function knownUrlKeys() {
  return new Set((await getSignals()).map((s) => s.url_key).filter(Boolean));
}
