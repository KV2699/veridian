// Build a self-contained demo of the dashboard.
//
// The hackathon requires "a URL to a working demo, hosted application, or test
// build". The dashboard needs a server to run the pipeline — but a judge does
// not need to run the pipeline to see the product. They need to switch between
// sectors, read a briefing, take a score apart, and look at what was rejected.
//
// So this bakes every configuration's real data into one HTML file: real
// organisations, real briefings written by Nemotron Ultra, real score
// breakdowns, real rejection reasons. Everything the live app shows except the
// Run button, which is honestly labelled as such.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProfile, loadGeneratedProfiles, listProfiles } from '../server/profiles/index.js';
import { getBriefings, getSignals, getRuns, getRejections } from '../server/lib/store.js';
import { listRegister, registerStats, isGenericEntity, ownerOf } from '../server/lib/register.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
await loadGeneratedProfiles();

const out = { profiles: [], data: {} };

for (const p of listProfiles()) {
  const key = p.key;
  const [briefings, runs, rejections, orgs, stats] = await Promise.all([
    getBriefings(key), getRuns(key), getRejections(key),
    listRegister({ profile: key, limit: 14 }), registerStats(key),
  ]);
  if (!briefings.length && !orgs.length) continue;   // never run — leave it out

  const profile = loadProfile(key);
  const signals = (await getSignals(key))
    .map((x) => ({ ...x, company: ownerOf(x.company) }))
    .filter((x) => !isGenericEntity(x.company, { sourceUrl: x.url }) && Number.isFinite(x.priority_score))
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 8)
    .map(({ company, signal_type, summary, url, date, priority_score, priority_band,
            practice_areas, multi_service, score_breakdown, counter_reading }) =>
      ({ company, signal_type, summary, url, date, priority_score, priority_band,
         practice_areas, multi_service, score_breakdown, counter_reading }));

  out.profiles.push({ ...p, organisations: stats.total });
  out.data[key] = {
    briefing: briefings[0] ?? null,
    run: runs[0] ?? null,
    signals,
    orgs: orgs.map(({ name, best_score, best_band, multi_service, practice_areas }) =>
      ({ name, best_score, best_band, multi_service, practice_areas })),
    stats,
    rejections: rejections.slice(0, 6).map(({ company, reason_code, reason }) => ({ company, reason_code, reason })),
    polarity: profile.polarity ?? [],
    areas: profile.practiceAreas ?? [],
    models: briefings[0]?.models ?? null,
  };
}

const shell = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
await writeFile(join(ROOT, 'public', 'demo-data.json'), JSON.stringify(out));
console.log(`exported ${out.profiles.length} sectors · ${JSON.stringify(out).length} bytes`);
for (const p of out.profiles) console.log(`  ${p.key.padEnd(22)} ${String(p.organisations).padStart(4)} orgs`);
