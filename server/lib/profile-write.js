// Turning a draft into a registered, runnable profile — from the API, not a CLI.
//
// A judge opening the hosted demo should be able to point the system at a
// business it has never seen and watch it configure itself. That cannot require
// a terminal, so the rendering and registration that `tools/build-profile.mjs`
// does on disk happens here too, callable from a route.
//
// Generated profiles are written to data/profiles/<key>.json rather than to
// server/profiles/*.js. Three reasons: a deployed container's source tree is
// read-only, a JSON file cannot execute anything a caller puts in it, and the
// generated set stays cleanly separated from the two hand-written profiles that
// ship with the system.
import { readJSON, writeJSON, DATA_ROOT } from './store.js';
import { join } from 'node:path';
import { readdir, rm } from 'node:fs/promises';

const DIR = join(DATA_ROOT, 'profiles');
const file = (key) => join(DIR, `${key}.json`);

/** Keys may become directory names, so they are constrained here rather than
 *  trusted. Nothing from a request body should ever reach a path untouched. */
export function safeKey(raw) {
  const key = String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  if (!key || /^(nvidia|exec-search|consultancy|dry-run|profiles)$/.test(key)) return null;
  return key;
}

export async function listGenerated() {
  try {
    const files = await readdir(DIR);
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  } catch { return []; }
}

export const readGenerated = (key) => readJSON(file(key), null);
export const deleteGenerated = (key) => rm(file(key), { force: true });

/**
 * Build a runnable profile object from a draft the model produced.
 *
 * Every value is copied field by field rather than spread from the draft: a
 * model's output is untrusted input, and a profile is executed by the pipeline.
 */
export function toProfile(key, d = {}, { feeds = [], regulators = [] } = {}) {
  const areas = (d.practice_areas ?? [])
    .filter((a) => a?.key && a?.name)
    .slice(0, 8)
    .map((a) => ({
      key: String(a.key).toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 32),
      name: String(a.name).slice(0, 80),
      description: String(a.description ?? '').slice(0, 400),
    }));

  const str = (v, n = 200) => String(v ?? '').slice(0, n);
  const arr = (v, n = 40, len = 120) => (Array.isArray(v) ? v : []).slice(0, n).map((x) => str(x, len)).filter(Boolean);

  return {
    key,
    generated: true,
    generated_at: new Date().toISOString(),
    name: str(d.name ?? key, 80),
    description: str(d.description, 400),
    market: str(d.market, 120),
    reader: str(d.reader, 300),
    sweepTerms: str(d.market, 120),
    practiceAreas: areas,
    // Empty is meaningful: it says a human has not yet established which way
    // events point for this business, and the dashboard shows that as a warning
    // rather than pretending the profile is finished.
    polarity: arr(d.polarity, 10, 400),
    polarityQuestions: arr(d.polarity_questions, 10, 300),
    polarityEvidence: arr(d.polarity_evidence, 10, 200),
    roster: arr(d.clients, 60, 80),
    exclusions: [str(d.name, 80), ...arr(d.competitors, 40, 80)].filter(Boolean),
    aliases: {},
    collectors: [{
      key: 'primary',
      name: 'Primary Collector',
      focus: `Dated, published events that create demand for what this business sells. Winnable universe: ${str(d.winnable_universe, 300)}`,
      signalTypes: areas.map((a) => `A named organisation taking a dated, published action that creates a concrete reason to discuss ${a.name}`),
      queries: arr(d.collector_queries, 8, 160),
      windowDays: 30,
    }],
    regulators: regulators.length
      ? { windowDays: 90, maxResults: 10, bodies: regulators.slice(0, 10).map((r) => ({ name: str(r.name, 80), domain: str(r.domain, 80), terms: str(r.terms, 160) })) }
      : undefined,
    feeds: { days: 30, sources: feeds.slice(0, 20).map((f) => ({ name: str(f.name, 60), url: str(f.url, 300) })), terms: arr(d.feed_terms, 40, 40) },
    tenders: { days: 60, maxPages: 10 },
    rosterSweep: { batchSize: 8, windowDays: 30, maxOrganisations: 48 },
    accountWatch: {
      focus: 'A fresh, dated reason to contact an organisation already held.',
      signalTypes: [
        'A leadership change, restructure or growth announcement at this organisation',
        'A new obligation or commitment stated to apply to this organisation',
      ],
      batchSize: 4,
      windowDays: 30,
    },
    scoring: {
      floor: 6,
      guidance: [
        `The winnable universe is: ${str(d.winnable_universe, 300)}. Score inside it higher.`,
        `${str(d.too_big, 240) || 'A prospect with a mature in-house function and an incumbent supplier'} scores down, even on a real signal.`,
        'A named organisation taking a dated action always outranks a market trend, however well sourced the trend is.',
        'A signal that opens a conversation across two or more practice areas is worth more than a larger signal confined to one.',
        'Never score an inferred need. If the source does not state the event, there is no signal.',
      ],
    },
  };
}

export async function saveGenerated(profile) {
  await writeJSON(file(profile.key), profile);
  return profile;
}
