// Flat-file JSON persistence, SCOPED PER PROFILE. No database by design: the
// whole system is meant to be clonable, inspectable and diffable, and a week
// of signals is kilobytes.
//
//   briefings.json      — every briefing ever produced, newest first
//   signal_log.json     — every raw signal ever collected, append-only
//   runs.json           — per-run agent status and timings
//   organisations.json  — the accumulating organisation register
//   rejections.json     — what the verifier threw away, and why
//
// WHY THE PATHS ARE PER PROFILE
//
// Two profiles ship, and they describe different businesses in different
// markets. Sharing one data directory between them is not a tidiness problem,
// it is a correctness problem: the organisation register would accumulate GPU
// clouds and sustainability employers in one list, the cross-week URL
// exclusion list would suppress a signal for one business because the OTHER
// business had already seen it, and "165 organisations tracked" would be a
// number describing nobody.
//
// So every path is resolved under data/<profile>/. The profile key is an
// argument, not module state — this repo has already lost 45 organisations to
// two runs sharing one mutable view of the same file, and a module-level
// "current profile" would be the same mistake in a new place.

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PROFILE } from '../profiles/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_ROOT = join(ROOT, 'data');

/**
 * Where one profile's data lives.
 *
 * A dry run writes to its own tree. It used to share the live store, and its
 * fixtures accumulated there alongside real signals — seven of them, one
 * carrying a deadline, which made it the system's answer to "what is closing
 * in the next 14 days?". A demo artefact presented as a real tender is the
 * worst kind of wrong, because it is confidently specific.
 */
export function dataDir(profile = DEFAULT_PROFILE) {
  const key = String(profile || DEFAULT_PROFILE);
  return process.env.DRY_RUN === 'true'
    ? join(DATA_ROOT, 'dry-run', key)
    : join(DATA_ROOT, key);
}

export function filesFor(profile = DEFAULT_PROFILE) {
  const dir = dataDir(profile);
  return {
    briefings: join(dir, 'briefings.json'),
    signals: join(dir, 'signal_log.json'),
    runs: join(dir, 'runs.json'),
    register: join(dir, 'organisations.json'),
    rejections: join(dir, 'rejections.json'),
    // Collection checkpoint. Searching is the slow, metered half of a run, so
    // raw signals are written the moment collection finishes — a failure in
    // verification or synthesis then costs seconds to retry instead of minutes
    // and a fresh set of search credits.
    raw: join(dir, 'last_collection.json'),
  };
}

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

export const getBriefings = (profile) => readJSON(filesFor(profile).briefings, []);
export const getSignals = (profile) => readJSON(filesFor(profile).signals, []);
export const getRuns = (profile) => readJSON(filesFor(profile).runs, []);

export const saveCollection = (payload, profile) => writeJSON(filesFor(profile).raw, payload);
export const getCollection = (profile) => readJSON(filesFor(profile).raw, null);

/** Store a briefing, replacing any existing briefing for the same week. */
export async function saveBriefing(briefing, profile) {
  const all = await getBriefings(profile);
  const kept = all.filter((b) => b.week !== briefing.week);
  kept.unshift(briefing);
  await writeJSON(filesFor(profile).briefings, kept);
  return kept.length;
}

/** Append raw signals, skipping any URL already in the log (cross-week dedup). */
export async function appendSignals(signals, profile) {
  const all = await getSignals(profile);
  const seen = new Set(all.map((s) => s.url_key).filter(Boolean));
  const added = signals.filter((s) => s.url_key && !seen.has(s.url_key));
  await writeJSON(filesFor(profile).signals, [...all, ...added]);
  return { added: added.length, skipped: signals.length - added.length, total: all.length + added.length };
}

/** Keep the 50 most recent runs — enough for the status panel and trend checks. */
export async function saveRun(run, profile) {
  const all = await getRuns(profile);
  all.unshift(run);
  await writeJSON(filesFor(profile).runs, all.slice(0, 50));
}

/**
 * URLs already collected in a prior week — the accumulating exclusion list.
 *
 * Scoped per profile for a reason that is easy to miss: a shared log would
 * mean the second business never sees a story the first business already
 * collected, even though it reads that story completely differently.
 */
export async function knownUrlKeys(profile) {
  return new Set((await getSignals(profile)).map((s) => s.url_key).filter(Boolean));
}

/**
 * The rejection log — every signal the verifier threw away, with the reason.
 *
 * Ported from the operator's most developed tracker, where the Rejection Log
 * is described as "the proof the method holds". Two things make it worth
 * persisting rather than discarding:
 *
 *   1. Without it a rejected organisation returns next week and is re-judged
 *      from scratch, at full cost, with the same outcome.
 *   2. Some rejection reasons are DEFECT REPORTS, not suppressions. "The event
 *      is real but the practice match was wrong" is a bug in the mapping
 *      rules, and it is invisible if the row is simply dropped.
 *
 * Capped, newest first — this is a diagnostic record, not an archive.
 */
export async function appendRejections(rows, profile) {
  if (!rows?.length) return { added: 0, total: (await getRejections(profile)).length };
  const all = await getRejections(profile);
  const seen = new Set(all.map((r) => `${r.url_key ?? ''}|${r.company ?? ''}`));
  const added = rows.filter((r) => !seen.has(`${r.url_key ?? ''}|${r.company ?? ''}`));
  const kept = [...added, ...all].slice(0, 1000);
  await writeJSON(filesFor(profile).rejections, kept);
  return { added: added.length, total: kept.length };
}

export const getRejections = (profile) => readJSON(filesFor(profile).rejections, []);
