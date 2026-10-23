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
import { bandFor } from './score.js';

// The register is per profile. Two businesses in two markets accumulate two
// prospect lists; merged, neither list describes anybody. The profile key is
// threaded in as an argument rather than read from module state — see the note
// at the top of store.js.
export const registerFile = (profile) => filesFor(profile).register;

export const getRegister = (profile) => readJSON(registerFile(profile), {});


// ── Things that are not prospects ──────────────────────────────────────────
//
// A country cannot buy anything. Neither can a continent, a trade bloc, or the
// abstract noun "government". They appear in this market's reporting constantly
// — "the UK will invest in AI compute", "South Korea announces a national AI
// programme" — and an extractor doing its job correctly names them as the
// organisation the story is about, because they ARE.
//
// They were the top five entries in the register: `United Kingdom` scoring 90
// Critical, sourced to an ETF investment guide. Every claim this system makes
// about grounding and arithmetic scoring is undercut by that one row, because
// it is the first thing anyone sees.
//
// The lead is never the country. It is whichever named body runs the programme
// — and if the source does not name one, there is no lead yet.
const GENERIC_PREFIXES = [
  'government of', 'the government of', 'the government',
];
// Deliberately SHORT. An earlier version listed ministry, department, agency,
// authority, council and commission here, and it dropped the US Department of
// Energy — which buys exascale supercomputers — along with a county council.
// A NAMED public body is one of the best prospects in this market: sovereign
// AI programmes are signed by one. Only the country itself, and government as
// an abstraction, cannot buy anything.
const GENERIC_SUFFIXES = [
  'government', 'administration', 'parliament', 'cabinet',
];
const GENERIC_EXACT = new Set([
  // Sovereign states and territories seen in this market's reporting
  'unitedkingdom', 'uk', 'unitedstates', 'us', 'usa', 'america', 'southkorea',
  'northkorea', 'japan', 'china', 'india', 'france', 'germany', 'italy',
  'spain', 'netherlands', 'belgium', 'sweden', 'norway', 'denmark', 'finland',
  'poland', 'ireland', 'canada', 'australia', 'singapore', 'taiwan', 'israel',
  'saudiarabia', 'uae', 'unitedarabemirates', 'qatar', 'kuwait', 'brazil',
  'mexico', 'russia', 'ukraine', 'turkey', 'switzerland', 'austria', 'portugal',
  'greece', 'malaysia', 'indonesia', 'thailand', 'vietnam', 'philippines',
  'newzealand', 'southafrica', 'egypt', 'nigeria', 'kenya',
  // Blocs and abstractions
  'europeanunion', 'eu', 'europe', 'asia', 'africa', 'middleeast', 'apac',
  'emea', 'nato', 'g7', 'g20', 'unitednations', 'un',
  // Bare abstractions that reach the extractor from headlines
  'government', 'governments', 'state', 'industry', 'market', 'sector',
  'enterprise', 'enterprises', 'customers', 'companies', 'organisations',
  'organizations', 'universities', 'researchers', 'startups',
]);

/**
 * Is this name a country, a bloc, a bare government, or a description rather
 * than an organisation that could sign a contract?
 */
export function isGenericEntity(raw, { sourceUrl = '' } = {}) {
  const name = String(raw ?? '').trim();
  if (!name) return true;
  const lower = name.toLowerCase();
  const key = keyFor(name);

  if (GENERIC_EXACT.has(key)) return true;
  if (GENERIC_PREFIXES.some((p) => lower.startsWith(p))) return true;
  // "UK government", "South Korea Government", "US administration"
  if (GENERIC_SUFFIXES.some((suf) => lower.endsWith(` ${suf}`))) return true;

  // A DESCRIPTION is handled by ownerOf() below, not dropped here: the owner
  // of the description is a real lead and throwing the row away loses it.

  // A PERSON, and only when the source says so.
  //
  // There was a general heuristic here — two or three capitalised words with
  // no corporate vocabulary — and it dropped "Dell Technologies" on its first
  // test. That is the wrong trade entirely: a stray person in the register is
  // visible and traceable, while a silently dropped roster account is neither.
  //
  // So the rule now needs corroboration from the source. A profile page is
  // about a person; an article is about an organisation.
  // LinkedIn only, deliberately. X and Twitter were in this list and a test
  // immediately caught the consequence: a two-word company name sourced from
  // an X post is dropped as a person. X carries company announcements as often
  // as personal ones; a LinkedIn /in/ or /posts/ url is about a person.
  if (sourceUrl && /(?:^|\.)linkedin\.com$/i.test(hostOf(sourceUrl))
      && /^[A-Z][a-z]+(?:\s+[A-Z][a-z'’-]+){1,2}$/.test(name)
      && !/\b(Inc|Ltd|Limited|Co|Corp|Corporation|Group|Labs?|Systems?|Technologies|Tech|Cloud|Data|Energy|Digital|Networks?|Capital|Partners|Ventures|Bank|University|Institute|Solutions|Services|Holdings|AI|Compute)\b/i.test(name)) {
    return true;
  }

  return false;
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}


// Common nouns that mark the words after a possessive as a DESCRIPTION of
// something a company owns rather than part of its name.
const DESCRIPTION_NOUNS = /\b(company|business|unit|division|subsidiary|venture|arm|platform|programme|program|project|initiative|facility|datacentre|datacenter|data centre|data center|infrastructure|operation|operations)\b/i;

/**
 * "KKR's AI infrastructure company" → "KKR".
 *
 * An extractor naming the thing a company owns, rather than the company, is
 * common and the row is still a real lead — the owner is the organisation to
 * approach. Dropping it loses a genuine prospect, so the name is rewritten.
 *
 * Deliberately narrow. It fires ONLY when what follows the possessive is a
 * common-noun description, because a possessive is part of plenty of real
 * names: "Lloyd's Register", "Moody's", "Standard & Poor's". Those are left
 * exactly as they are.
 */
export function ownerOf(raw) {
  const name = String(raw ?? '').trim();
  const m = name.match(/^(.+?)['’]s?\s+(.+)$/);
  if (!m) return name;
  const [, owner, remainder] = m;
  if (!DESCRIPTION_NOUNS.test(remainder)) return name;
  // A government ministry is a nameable buyer in this market — sovereign AI
  // programmes are signed by one. Only the bare country is not.
  if (/\b(ministry|department|agency|authority|office|bureau)\b/i.test(remainder)) return name;
  return owner.trim();
}

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
    // "KKR's AI infrastructure company" registers as KKR — the owner is the
    // lead, and the description is not an organisation anyone can approach.
    const raw = ownerOf(String(s.company ?? '').trim());
    // A joint announcement is not one organisation. Splitting it reliably is
    // guesswork, so it is skipped rather than registered under a merged name.
    //
    // The original pattern missed the most common shape in this market's
    // reporting — a comma list ending in "and": "Apollo, BlackRock, Microsoft
    // and KKR" registered as a single 40-character organisation scoring 55.
    if (/\s[/&]\s|\sand\s.+\sand\s|,.*\sand\s|,.*,/.test(raw)) { skipped++; continue; }

    // A country, bloc or bare government cannot buy anything, and a
    // description of a company is not the company.
    if (isGenericEntity(raw, { sourceUrl: s.url })) { skipped++; continue; }

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
      // DERIVED, never taken as given. Storing the band alongside the score let
      // the two disagree — four entries sat at 80 labelled "High" when 80 is
      // Critical, because the band came from the signal rather than from the
      // number next to it. Same principle as the score itself: if it can be
      // computed, never accept it as input.
      entry.best_band = bandFor(entry.best_score).band;
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
