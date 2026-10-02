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

import { readJSON, writeJSON, DATA_DIR } from './store.js';
import { join } from 'node:path';

export const REGISTER_FILE = join(DATA_DIR, 'organisations.json');

export const getRegister = () => readJSON(REGISTER_FILE, {});

/**
 * Fold a week's verified signals into the register.
 * @returns {{total:number, added:number, updated:number, newNames:string[]}}
 */
export async function updateRegister(signals, { week, roster = [] } = {}) {
  const register = await getRegister();
  const rosterKeys = new Set(roster.map(keyFor));
  const newNames = [];
  let updated = 0;

  for (const s of signals) {
    const key = keyFor(s.company);
    if (!key) continue;

    const existing = register[key];
    const entry = existing ?? {
      key,
      name: s.company,
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
    if (s.company.length > entry.name.length) {
      if (!entry.aliases.includes(entry.name)) entry.aliases.push(entry.name);
      entry.name = s.company;
    } else if (s.company !== entry.name && !entry.aliases.includes(s.company)) {
      entry.aliases.push(s.company);
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

  await writeJSON(REGISTER_FILE, register);
  return { total: Object.keys(register).length, added: newNames.length, updated, newNames };
}

/** The register as a sorted list, best prospects first. */
export async function listRegister({ status, band, minScore = 0, limit } = {}) {
  const register = await getRegister();
  let rows = Object.values(register);
  if (status) rows = rows.filter((r) => r.status === status);
  if (band) rows = rows.filter((r) => r.best_band === band);
  if (minScore) rows = rows.filter((r) => r.best_score >= minScore);
  rows.sort((a, b) => b.best_score - a.best_score || b.weeks_tracked - a.weeks_tracked || a.name.localeCompare(b.name));
  return limit ? rows.slice(0, Number(limit)) : rows;
}

/** Headline counts for the dashboard. */
export async function registerStats() {
  const rows = Object.values(await getRegister());
  const bands = rows.reduce((a, r) => { a[r.best_band] = (a[r.best_band] ?? 0) + 1; return a; }, {});
  return {
    total: rows.length,
    prospects: rows.filter((r) => r.status === 'prospect').length,
    accounts: rows.filter((r) => r.status === 'account').length,
    multi_service: rows.filter((r) => r.multi_service).length,
    returning: rows.filter((r) => r.weeks_tracked > 1).length,
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
    .replace(/\s+/g, '')
    .trim();
}
