// ONE-TIME REGISTER CLEANUP.
//
// The guards in register.js stop bad entries being created. This applies the
// same rules to entries that were created before those guards existed.
//
//   node tools/clean-register.mjs [profile] [--apply]
//
// Dry run by default — it prints exactly what it would do and changes nothing.
// Pass --apply to write. A backup is written alongside the register first.
//
// Four things it fixes, in the order they were found in the live data:
//
//   1. Countries, blocs and bare governments registered as prospects.
//      `United Kingdom` sat at the top of the register scoring 90 Critical,
//      sourced to an ETF investment guide. A country cannot sign a contract.
//   2. Descriptions registered instead of the organisation they belong to.
//      "KKR's AI infrastructure company" becomes KKR, which is a real lead.
//   3. Aliases that were never merged. `Amazon` and `Amazon Web Services` both
//      sat in the top ten as separate prospects.
//   4. Bands that disagree with their own score — four entries at 80 labelled
//      "High" when 80 is Critical, because the band had been stored as given
//      rather than derived from the number beside it.
import { readFile, writeFile } from 'node:fs/promises';
import { filesFor } from '../server/lib/store.js';
import { keyFor, isGenericEntity, ownerOf } from '../server/lib/register.js';
import { bandFor } from '../server/lib/score.js';
import { loadProfile } from '../server/profiles/index.js';

const profileKey = process.argv.find((a) => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1]) || 'nvidia';
const apply = process.argv.includes('--apply');

const profile = loadProfile(profileKey);
const file = filesFor(profileKey).register;
const register = JSON.parse(await readFile(file, 'utf8'));

const before = Object.keys(register).length;
const aliasMap = new Map(Object.entries(profile.aliases ?? {}).map(([from, to]) => [keyFor(from), keyFor(to)]));
const canonical = new Map(Object.entries(profile.aliases ?? {}).map(([from, to]) => [keyFor(from), to]));
const excluded = new Set((profile.exclusions ?? []).map(keyFor));

const dropped = [];
const merged = [];
const rebanded = [];
const renamed = [];
const out = {};

// Deterministic order, so the result does not depend on object key order.
for (const entry of Object.values(register).sort((a, b) => (b.best_score ?? 0) - (a.best_score ?? 0))) {
  const sourceUrl = entry.signals?.[0]?.url ?? '';

  // 1 + 2. Rewrite a description to its owner, then test what is left.
  const owned = ownerOf(entry.name);
  if (owned !== entry.name) renamed.push([entry.name, owned]);

  if (isGenericEntity(owned, { sourceUrl })) {
    dropped.push([entry.name, 'not an organisation that can buy anything']);
    continue;
  }

  let key = keyFor(owned);
  if (excluded.has(key)) { dropped.push([entry.name, 'on the profile exclusion list']); continue; }
  // 3. Fold aliases together.
  if (aliasMap.has(key)) key = aliasMap.get(key);

  const name = canonical.get(keyFor(owned)) ?? owned;
  const existing = out[key];

  if (!existing) {
    out[key] = { ...entry, key, name };
  } else {
    merged.push([entry.name, existing.name]);
    // Keep the better of the two everywhere it matters.
    existing.best_score = Math.max(existing.best_score ?? 0, entry.best_score ?? 0);
    existing.signal_count = (existing.signal_count ?? 0) + (entry.signal_count ?? 0);
    existing.signals = [...(existing.signals ?? []), ...(entry.signals ?? [])]
      .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
      .slice(0, 10);
    existing.practice_areas = [...new Set([...(existing.practice_areas ?? []), ...(entry.practice_areas ?? [])])];
    existing.weeks_seen = [...new Set([...(existing.weeks_seen ?? []), ...(entry.weeks_seen ?? [])])];
    existing.aliases = [...new Set([...(existing.aliases ?? []), entry.name])].filter((a) => a !== existing.name);
    if (entry.status === 'account') existing.status = 'account';
  }
}

// 4. Derive every band and the multi-service flag from the data, never trust
//    what was stored.
for (const entry of Object.values(out)) {
  const correct = bandFor(entry.best_score ?? 0).band;
  if (entry.best_band !== correct) {
    rebanded.push([entry.name, entry.best_band, correct]);
    entry.best_band = correct;
  }
  entry.multi_service = (entry.practice_areas ?? []).length >= 2;
  entry.weeks_tracked = (entry.weeks_seen ?? []).length;
}

const after = Object.keys(out).length;

const list = (rows, fmt) => rows.length ? rows.map(fmt).join('\n') : '  (none)';
console.log(`\nREGISTER CLEANUP — ${profileKey}${apply ? '' : '   [DRY RUN — nothing written]'}\n`);
console.log(`Dropped (${dropped.length}):`);
console.log(list(dropped, ([n, why]) => `  − ${n}  —  ${why}`));
console.log(`\nRewritten to their owner (${renamed.length}):`);
console.log(list(renamed, ([a, b]) => `  ~ ${a}  →  ${b}`));
console.log(`\nMerged (${merged.length}):`);
console.log(list(merged, ([a, b]) => `  ⇢ ${a}  into  ${b}`));
console.log(`\nBand corrected to match its own score (${rebanded.length}):`);
console.log(list(rebanded, ([n, was, now]) => `  ± ${n}  ${was} → ${now}`));

const top = Object.values(out).sort((a, b) => b.best_score - a.best_score).slice(0, 10);
console.log(`\nTop 10 after cleanup:`);
top.forEach((o, i) => console.log(`  ${String(i + 1).padStart(2)}  ${String(o.best_score).padStart(3)}  ${o.best_band.padEnd(8)}  ${o.name}`));
console.log(`\n${before} → ${after} organisations\n`);

if (apply) {
  await writeFile(`${file}.backup`, JSON.stringify(register, null, 2));
  await writeFile(file, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Written. Previous register saved to ${file}.backup\n`);
} else {
  console.log('Re-run with --apply to write.\n');
}
