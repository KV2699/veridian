// ORGANISATION REGISTER — the prospect list the system builds for itself.
//
// The signal log records events. This records ORGANISATIONS, and it is the
// actual deliverable: a deduplicated, scored, growing list of named bodies
// worth approaching, assembled week by week from everything the collectors
// find. Nobody hands it a roster; it sources its own.
//
// It is also where the system's memory becomes visible. An organisation
// carries how many weeks it has been tracked, every signal ever seen about it,
// its best score and the offerings it has opened — so a name appearing for the
// third week running reads as a pattern, not as a fresh discovery.
//
// This is the equivalent of Tab 2 in the predecessor tracker, including its
// Quarters Tracked column.

import { readJSON, writeJSON, filesFor } from './store.js';

// The register is per profile. Two businesses in two markets accumulate two
// prospect lists; merged, neither list describes anybody. The profile key is
// threaded in as an argument rather than read from module state — see the note
// at the top of store.js.
export const registerFile = (profile) => filesFor(profile).register;

export const getRegister = (profile) => readJSON(registerFile(profile), {});

/**
 * Fold a week's verified signals into the register.
 * @returns {{total:number, added:number, updated:number, newNames:string[]}}
 */
export async function updateRegister(signals, { week, roster = [], exclusions = [], aliases = {}, profile } = {}) {
  const register = await getRegister(profile);
  const rosterKeys = new Set(roster.map(keyFor));
  // The business running this is never its own prospect. The profile has
  // always declared exclusions; nothing was enforcing them, so NVIDIA appeared
  // in its own prospect list.
  const excluded = new Set(exclusions.map(keyFor));
  // Acronyms a key cannot resolve on its own: "AWS" and "Amazon Web Services"
  // normalise differently but are one organisation.
  const aliasMap = new Map(Object.entries(aliases).map(([from, to]) => [keyFor(from), keyFor(to)]));
  const canonical = new Map(Object.entries(aliases).map(([from, to]) => [keyFor(from), to]));

  const newNames = [];
  let updated = 0, skipped = 0;

  for (const s of signals) {
    const raw = String(s.company ?? '').trim();
    // A joint announcement is not one organisation. Splitting it reliably is
    // guesswork, so it is skipped rather than registered under a merged name.
    if (/\s[/&]\s|\sand\s.+\sand\s/.test(raw)) { skipped++; continue; }

    let key = keyFor(raw);
    if (!key) continue;
    if (aliasMap.has(key)) key = aliasMap.get(key);
    if (excluded.has(key)) { skipped++; continue; }

    const existing = register[key];
    const name = canonical.get(keyFor(raw)) ?? raw;
    const entry = existing ?? {
      key,
      name,
      aliases: [],
      first_seen: week,
      weeks_seen: [],
      signal_count: 0,
      signals: [],
      practice_areas: [],
      categories: {},
      best_score: 0,
      best_band: 'Low',
      status: rosterKeys.has(key) ? 'account' : 'prospect',
    };

    if (!existing) newNames.push(s.company); else updated++;

    // Keep the longest spelling seen — "Microsoft" and "Microsoft Azure"
    // collapse to one organisation, and the fuller name is the useful one.
    if (name.length > entry.name.length) {
      if (!entry.aliases.includes(entry.name)) entry.aliases.push(entry.name);
      entry.name = name;
    } else if (name !== entry.name && !entry.aliases.includes(name)) {
      entry.aliases.push(name);
    }

    entry.last_seen = week;
    if (!entry.weeks_seen.includes(week)) entry.weeks_seen.push(week);
    entry.signal_count += 1;
    entry.categories[s.category] = (entry.categories[s.category] ?? 0) + 1;

    for (const a of s.practice_areas ?? []) {
      if (!entry.practice_areas.includes(a)) entry.practice_areas.push(a);
    }

    if ((s.priority_score ?? 0) > entry.best_score) {
      entry.best_score = s.priority_score ?? 0;
      entry.best_band = s.priority_band ?? 'Low';
    }

    // Signals are kept newest-first and capped: the register is a directory of
    // organisations, not a second copy of the signal log.
    entry.signals.unshift({
      week, date: s.date, category: s.category, summary: s.summary, url: s.url,
      score: s.priority_score ?? null, band: s.priority_band ?? null,
      deadline: s.deadline ?? null, needs_review: Boolean(s.needs_review),
    });
    entry.signals = entry.signals.slice(0, 10);

    // An organisation that opened two different offerings across DIFFERENT
    // weeks is a cross-sell the weekly score could never see.
    entry.multi_service = entry.practice_areas.length >= 2;
    entry.weeks_tracked = entry.weeks_seen.length;

    register[key] = entry;
  }

  await writeJSON(registerFile(profile), register);
  return { total: Object.keys(register).length, added: newNames.length, updated, skipped, newNames };
}

/**
 * Record that an organisation was swept and had nothing this week.
 *
 * "Checked and quiet" is a different fact from "not looked at", and only the
 * first is useful: an account quiet for several consecutive sweeps is a BD
 * signal in its own right. A topic search can never produce this, because it
 * does not know what it failed to find.
 */
export async function recordQuiet(names, { week, profile } = {}) {
  if (!names?.length) return { quiet: 0 };
  const register = await getRegister(profile);
  let touched = 0;

  for (const name of names) {
    const entry = register[keyFor(name)];
    if (!entry) continue;
    entry.last_checked = week;
    if (!Array.isArray(entry.quiet_weeks)) entry.quiet_weeks = [];

    // An organisation another collector found this week is not quiet, however
    // little the sweep's own batch turned up.
    if (entry.last_seen === week) { entry.quiet_streak = 0; touched++; continue; }

    if (!entry.quiet_weeks.includes(week)) entry.quiet_weeks.push(week);
    // Consecutive quiet weeks since the last one that produced a signal.
    entry.quiet_streak = entry.quiet_weeks.filter((w) => w > (entry.last_seen ?? '')).length;
    touched++;
  }

  await writeJSON(registerFile(profile), register);
  return { quiet: touched };
}

/** The register as a sorted list, best prospects first. */
export async function listRegister({ status, band, minScore = 0, limit, quietFor, profile } = {}) {
  const register = await getRegister(profile);
  let rows = Object.values(register);
  if (status) rows = rows.filter((r) => r.status === status);
  if (band) rows = rows.filter((r) => r.best_band === band);
  if (minScore) rows = rows.filter((r) => r.best_score >= minScore);
  if (quietFor) rows = rows.filter((r) => (r.quiet_streak ?? 0) >= Number(quietFor));
  rows.sort((a, b) => b.best_score - a.best_score || b.weeks_tracked - a.weeks_tracked || a.name.localeCompare(b.name));
  return limit ? rows.slice(0, Number(limit)) : rows;
}

/** Headline counts for the dashboard. */
export async function registerStats(profile) {
  const rows = Object.values(await getRegister(profile));
  const bands = rows.reduce((a, r) => { a[r.best_band] = (a[r.best_band] ?? 0) + 1; return a; }, {});
  return {
    total: rows.length,
    prospects: rows.filter((r) => r.status === 'prospect').length,
    accounts: rows.filter((r) => r.status === 'account').length,
    multi_service: rows.filter((r) => r.multi_service).length,
    returning: rows.filter((r) => r.weeks_tracked > 1).length,
    quiet_2plus: rows.filter((r) => (r.quiet_streak ?? 0) >= 2).length,
    bands,
  };
}

// Normalised key so "Microsoft Azure", "Microsoft Corp." and "microsoft"
// are one organisation rather than three.
export function keyFor(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    // Punctuation becomes spaces FIRST, so a dotted suffix like "N.V." is a
    // word by the time the suffix list runs. Stripping suffixes before this
    // left "Nebius Group N.V." and "Nebius" as two separate organisations.
    .replace(/[^a-z0-9]+/g, ' ')
    // "N.V." has become "n v" by now — rejoin runs of single letters so the
    // suffix list below sees "nv" as one word.
    .replace(/\b([a-z])\s+(?=[a-z]\b)/g, '$1')
    .replace(/\b(inc|incorporated|ltd|limited|llc|plc|corp|corporation|company|co|group|holdings|technologies|technology|gmbh|sa|nv|bv|ag|ab|as|oyj|pte|pty|sarl|spa)\b/g, ' ')
    // A trailing "AI" is a branding suffix in this market, not an identity:
    // "Mistral AI" and "Mistral" are one company, as are "PaleBlueDot AI" and
    // "PaleBlueDot". Only stripped at the end, so "AI21" or "Open AI" survive.
    .replace(/\s+ai\s*$/, ' ')
    .replace(/\s+/g, '')
    .trim();
}
