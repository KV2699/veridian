// AGENT — Tender Collector (government procurement portals)
//
// The highest-quality source in the system, and the only one where the facts
// are not model-mediated at all. A tender notice is a buyer stating, in public
// and in writing, that they intend to spend money, on what, and by when.
//
// Division of labour: every fact — buyer, title, value, closing date, URL — is
// copied verbatim from the notice. Nemotron is used ONLY to judge which of your
// offerings the notice opens and how large the opportunity is. It is never
// asked what the notice says, so this path cannot hallucinate a lead.

import { fetchPortals, relevant, toSignal, isOpen, PORTALS } from '../lib/procurement.js';
import { completeJSON } from '../lib/nebius.js';
import { log } from '../lib/log.js';

const SYSTEM = `You classify public procurement notices for a business development pipeline.

Each notice is real and already verified — it was published by the buyer. Do NOT restate or rewrite it, and do NOT judge whether it is real.

Your only job, for each notice:
1. practice_areas — which of the listed offerings this notice opens a genuine conversation for. Use only the given keys. Most notices open exactly one. If none apply, return an empty list and set relevant to false.
2. value_level — the commercial scale, using only the listed levels and only on the stated contract value. If no value is stated, use the unknown level.
3. relevant — false if this notice has nothing to do with the offerings at all (procurement portals are filtered by keyword, so some notices will be unrelated).

OUTPUT FORMAT — strict: your entire reply must be a single JSON object. Do not reason out loud, do not explain, do not use a code fence. The first character must be {.

{"notices":[{"id":"the id given","practice_areas":["key"],"value_level":"string","relevant":true}]}`;

export default async function collectTenders({ profile }, ctx = {}, deps = {}) {
  const fetchAll = deps.fetchPortals ?? fetchPortals;
  const ask = deps.completeJSON ?? completeJSON;
  const cfg = profile?.tenders ?? {};
  const { maxPages = 10, terms, cpvPrefixes, portals = PORTALS } = cfg;
  const days = process.env.BACKFILL === 'true' ? (cfg.days ?? 30) * 3 : (cfg.days ?? 30);

  const known = ctx.knownUrlKeys ?? new Set();
  const valueFactor = profile?.scoring?.valueFactor;
  const practiceAreas = profile?.practiceAreas ?? [];

  log.step(`fetching procurement notices from ${portals.length} portal(s), last ${days} days`);
  const releases = await fetchAll(portals, { days, maxPages });
  // Both levers are profile-defined. A vendor profile matches compute CPV
  // codes; a search firm matches recruitment ones. Passing only `terms` left
  // the second profile matching the first profile's CPV codes.
  const filter = {};
  if (terms) filter.terms = terms;
  if (cpvPrefixes) filter.cpvPrefixes = cpvPrefixes;
  const matched = relevant(releases, Object.keys(filter).length ? filter : undefined);
  const matches = cfg.includeClosed ? matched : matched.filter((r) => isOpen(r));
  log.step(`${releases.length} notices → ${matched.length} on topic → ${matches.length} still open to bid`);

  const signals = matches.map((r) => toSignal(r)).filter((s) => s.url && !known.has(s.url_key));
  log.step(`${signals.length} not seen in a previous run`);

  const telemetry = (extracted) => ({
    key: 'tender', name: 'Tender Collector',
    queries: [{ query: `procurement portals (${days}d)`, hits: releases.length, unique: matches.length, fresh: signals.length, failed: false }],
    hits: releases.length, fresh: signals.length, extracted, parseFailures: 0, batches: 0, ungrounded: 0,
  });

  if (!signals.length) return { signals: [], telemetry: telemetry(0), summary: '0 tenders' };

  // Classification only — no fact extraction.
  const BATCH = 10;
  const byId = new Map(signals.map((s, i) => [`T${i + 1}`, s]));
  const classified = new Map();

  for (let i = 0; i < signals.length; i += BATCH) {
    const group = [...byId.entries()].slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    const of = Math.ceil(signals.length / BATCH);
    log.step(`Nemotron FAST classification, batch ${n}/${of} (${group.length} notices)`);
    try {
      const { data } = await ask({
        tier: 'fast', temperature: 0, maxTokens: 3000, expectKey: 'notices',
        system: SYSTEM,
        user: buildPrompt(group, practiceAreas, valueFactor),
      });
      for (const row of Array.isArray(data?.notices) ? data.notices : []) {
        if (row && typeof row.id === 'string') classified.set(row.id, row);
      }
    } catch (err) {
      log.warn(`batch ${n}/${of} classification failed, keeping notices unclassified — ${err.message}`);
    }
  }

  const validAreas = new Set(practiceAreas.map((a) => a.key));
  const validLevels = new Set(Object.keys(valueFactor?.points ?? {}));
  const out = [];
  let irrelevant = 0;

  for (const [id, signal] of byId) {
    const c = classified.get(id);
    if (c && c.relevant === false) { irrelevant++; continue; }
    const areas = Array.isArray(c?.practice_areas)
      ? [...new Set(c.practice_areas.map((a) => String(a).toLowerCase()).filter((a) => validAreas.has(a)))]
      : [];
    // A notice that opens nothing is not a lead, whatever its value.
    if (!areas.length) { irrelevant++; continue; }

    out.push({
      ...signal,
      practice_areas: areas,
      org_scale: 'unknown',
      ...(valueFactor
        ? { [valueFactor.key]: validLevels.has(String(c?.value_level ?? '').toLowerCase())
            ? String(c.value_level).toLowerCase()
            : levelFromValue(signal.contract_value, valueFactor) }
        : {}),
    });
  }

  const withDeadline = out.filter((s) => s.deadline).length;
  if (!out.length && matched.length) log.warn('every on-topic notice had already closed — widen the window or the terms');
  log.ok(`${out.length} tender leads (${withDeadline} with a closing date, ${irrelevant} discarded as unrelated)`);
  return {
    signals: out,
    telemetry: telemetry(out.length),
    summary: `${out.length} tenders, ${withDeadline} with deadlines`,
  };
}

function buildPrompt(group, practiceAreas, valueFactor) {
  const notices = group.map(([id, s]) => [
    `ID: ${id}`,
    `BUYER: ${s.company}`,
    `TITLE: ${s.source_title}`,
    s.contract_value ? `VALUE: ${s.contract_currency} ${s.contract_value}` : 'VALUE: not stated',
    s.deadline ? `CLOSES: ${s.deadline}` : 'CLOSES: not stated',
    `DESCRIPTION: ${(s.description ?? '').slice(0, 500)}`,
  ].join('\n')).join('\n\n');

  const areas = practiceAreas.map((a) => `- ${a.key}: ${a.name} — ${a.description}`).join('\n');
  const levels = valueFactor
    ? `\nVALUE LEVELS — use one of: ${Object.keys(valueFactor.points ?? {}).join(' | ')}\n${(valueFactor.guidance ?? []).map((g) => `- ${g}`).join('\n')}\n`
    : '';

  return `OFFERINGS THIS BUSINESS SELLS:
${areas}
${levels}
PROCUREMENT NOTICES:

${notices}

Classify each notice as JSON.`;
}

// Fallback when the model does not return a level: derive it from the stated
// contract value, which is a fact rather than a judgement.
function levelFromValue(value, factor) {
  const levels = Object.keys(factor?.points ?? {});
  if (!value || !levels.length) return 'unknown';
  const n = Number(value);
  if (n >= 1e9 && levels.includes('mega')) return 'mega';
  if (n >= 1e8 && levels.includes('large')) return 'large';
  if (levels.includes('standard')) return 'standard';
  return 'unknown';
}
