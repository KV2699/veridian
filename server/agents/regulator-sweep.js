// AGENT — Regulator Sweep (obligations, not opinions)
//
// The strongest buying trigger there is, because the work is compulsory.
//
// Every other collector finds organisations that MIGHT buy something. This one
// finds organisations that have been TOLD to do something, by a body with the
// power to enforce it, usually with a deadline attached. A company weighing an
// AI buildout may or may not proceed; a licensee that must submit a new
// reporting pack by 30 September has no such choice.
//
// The lead is not the regulator. The regulator is the source. The lead is
// whoever the decision obliges — which is why this agent extracts the OBLIGATED
// PARTY and the DEADLINE as separate fields, and discards any action that
// creates no obligation for anyone.
//
// Modelled on the regulator sweeps in the earlier prompt packs, which surfaced
// enforcement and licence decisions no topic search ever reached.

import { searchMany, canonicalUrl } from '../lib/tavily.js';
import { completeJSON } from '../lib/nebius.js';
import { log } from '../lib/log.js';

const SYSTEM = `You read regulatory and government publications and extract the OBLIGATIONS they create.

You are given search results from named regulators, departments and public bodies. For each one, decide: does this create a requirement that some named organisation or clearly identified category of organisation must now act on?

WHAT QUALIFIES:
- A decision, determination, direction, licence condition, policy statement or final rule that requires someone to do something
- A consultation with a stated response deadline
- An enforcement action that requires remediation
- A funding programme or allocation with an application deadline
- A standard, scheme or regime with a compliance date

WHAT DOES NOT QUALIFY:
- Speeches, blogs, opinion, "we are considering", research publications with no requirement
- Anything where you cannot say who must do what
- Market commentary or statistics releases

FOR EACH QUALIFYING ITEM:
- obligated_party: who must act. Name the organisation if named. If the decision applies to a category ("electricity distribution licensees", "investment firms"), give the category exactly as the source states it — a category is a valid answer and is often the more valuable one.
- obligation: one sentence stating what they must now do. Use the source's own terms.
- deadline: the compliance or response date as YYYY-MM-DD, or null if none is stated. NEVER invent one.
- demand_created: one sentence on the work this creates for a supplier of the OFFERINGS listed below. Only if it genuinely does. An obligation that creates paperwork, governance or legal work but no demand for those offerings must have demand_created null and an empty practice_areas list — that is the correct answer for most regulatory text, and padding it is how this agent becomes noise.

HARD RULES:
- Use ONLY the supplied results. Never add a decision from your own knowledge.
- url copied exactly from the result it came from.
- date is the publication date of the decision, or null.
- Never state a figure or a date that is not in the source.
- contact_role: the job title a supplier should approach. A role, never a person.

OUTPUT FORMAT — strict: your entire reply must be a single JSON object. Do not reason out loud, do not explain, do not use a code fence. The first character must be {.

{"obligations":[{"id":"the id given","qualifies":true,"regulator":"string","obligated_party":"string","obligation":"string","deadline":"YYYY-MM-DD or null","demand_created":"string or null","date":"YYYY-MM-DD or null","url":"string","practice_areas":["key"],"contact_role":"string"}]}

If an item creates no obligation, return only {"id":"...","qualifies":false}.`;

export default async function regulatorSweep({ profile, week }, ctx = {}, deps = {}) {
  const find = deps.searchMany ?? searchMany;
  const ask = deps.completeJSON ?? completeJSON;

  const cfg = profile?.regulators ?? {};
  const { bodies = [], windowDays = 30, maxResults = 10 } = cfg;

  if (!bodies.length) {
    log.warn('no regulators configured in the profile');
    return { signals: [], telemetry: null, summary: '0 regulators configured' };
  }

  const known = ctx.knownUrlKeys ?? new Set();
  const practiceAreas = profile?.practiceAreas ?? [];

  log.step(`sweeping ${bodies.length} regulators and public bodies (${windowDays}-day window)`);

  // One query per body, site-scoped where a domain is given, so the sweep is
  // reading the regulator rather than reading commentary about it.
  const queries = bodies.map((b) =>
    (b.domain ? `site:${b.domain} ` : `"${b.name}" `)
    + (b.terms ?? cfg.terms ?? 'decision determination direction consultation licence requirement'));

  const { results, stats } = await find(queries, { days: windowDays, maxResults, topic: 'general' });
  const fresh = results.filter((r) => !known.has(canonicalUrl(r.url)));
  log.step(`${results.length} publications → ${fresh.length} not seen before`);

  const telemetry = (extracted) => ({
    key: 'regulatory', name: 'Regulator Sweep',
    queries: stats.map((s) => ({ ...s, fresh: fresh.filter((r) => r.found_via === s.query).length })),
    hits: results.length, fresh: fresh.length, extracted, parseFailures: 0, batches: 0, ungrounded: 0,
  });

  if (!fresh.length) return { signals: [], telemetry: telemetry(0), summary: '0 obligations' };

  const BATCH = 6;
  const byId = new Map(fresh.map((r, i) => [`R${i + 1}`, r]));
  const judged = new Map();
  let parseFailures = 0;

  for (let i = 0; i < fresh.length; i += BATCH) {
    const group = [...byId.entries()].slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    const of = Math.ceil(fresh.length / BATCH);
    log.step(`Nemotron FAST obligation extraction, batch ${n}/${of} (${group.length} publications)`);
    try {
      const { data } = await ask({
        tier: 'fast', temperature: 0, maxTokens: 4000, expectKey: 'obligations',
        system: SYSTEM, user: buildPrompt(group, practiceAreas, bodies),
      });
      for (const row of Array.isArray(data?.obligations) ? data.obligations : []) {
        if (row && typeof row.id === 'string') judged.set(row.id, row);
      }
    } catch (err) {
      parseFailures++;
      log.warn(`batch ${n}/${of} extraction failed, continuing — ${err.message}`);
    }
  }

  const validAreas = new Set(practiceAreas.map((a) => a.key));
  const signals = [];
  let noObligation = 0, noDemand = 0;

  for (const [id, source] of byId) {
    const row = judged.get(id);
    if (!row || row.qualifies === false) { noObligation++; continue; }

    const party = String(row.obligated_party ?? '').trim();
    const obligation = String(row.obligation ?? '').trim();
    if (!party || !obligation) { noObligation++; continue; }

    const areas = Array.isArray(row.practice_areas)
      ? [...new Set(row.practice_areas.map((a) => String(a).toLowerCase()).filter((a) => validAreas.has(a)))]
      : [];

    // An obligation this business cannot sell into is not a lead, however real
    // it is. Most regulatory text creates compliance work, not infrastructure
    // demand — the first run returned seven AI Act governance duties.
    if (!areas.length) { noDemand++; continue; }

    // A compliance date that has already passed is history, not a lead. The
    // first live run returned AI Act deadlines from August as live obligations.
    const rawDeadline = isoDate(row.deadline);
    const today = new Date().toISOString().slice(0, 10);
    const deadline = rawDeadline && rawDeadline >= today ? rawDeadline : null;
    const expired = Boolean(rawDeadline) && !deadline;
    signals.push({
      company: party,
      signal_type: 'Regulatory Obligation',
      summary: `${party} must ${lowerFirst(obligation)}${deadline ? ` by ${deadline}` : ''}${expired ? ` (compliance date ${rawDeadline} has passed — in force, not upcoming)` : ''}.`,
      url: source.url,
      url_key: canonicalUrl(source.url),
      date: isoDate(row.date) ?? isoDate(source.published_date),
      deadline,
      // An upcoming deadline is urgent; one already in force is context.
      relevance_score: deadline ? 8 : expired ? 5 : 6,
      practice_areas: areas,
      org_scale: 'unknown',
      contact_role: String(row.contact_role ?? '').trim() || null,
      regulator: String(row.regulator ?? '').trim() || null,
      deadline_passed: expired,
      obligation,
      demand_created: String(row.demand_created ?? '').trim() || null,
      category: 'regulatory',
      source_title: source.title,
      found_via: source.found_via,
      collected_at: new Date().toISOString(),
      // The regulator published this decision, so it is the authority on its
      // own obligation — there is no third-party article to ground against.
      source_is_about_company: true,
      weak_source: false,
      grounding_note: null,
    });
  }

  const dated = signals.filter((s) => s.deadline).length;
  log.ok(`${signals.length} obligations (${dated} with an upcoming deadline · ${noObligation} created no obligation · ${noDemand} created no demand for these offerings)`);

  return {
    signals,
    telemetry: { ...telemetry(signals.length), parseFailures },
    summary: `${signals.length} obligations, ${dated} dated`,
  };
}

function buildPrompt(group, practiceAreas, bodies) {
  const items = group.map(([id, r]) => [
    `ID: ${id}`,
    `TITLE: ${r.title}`,
    `URL: ${r.url}`,
    `PUBLISHED: ${r.published_date ?? 'unknown'}`,
    `CONTENT: ${(r.content || '').slice(0, 1500)}`,
  ].join('\n')).join('\n\n');

  const areas = practiceAreas.length
    ? `\nOFFERINGS (use these keys for practice_areas — leave empty if the obligation creates no demand for any of them):\n${practiceAreas.map((a) => `- ${a.key}: ${a.name}`).join('\n')}\n`
    : '';

  return `BODIES BEING SWEPT: ${bodies.map((b) => b.name).join(', ')}
${areas}
PUBLICATIONS:

${items}

Extract the obligations as JSON.`;
}

const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);

function isoDate(v) {
  if (typeof v !== 'string') return null;
  const m = v.match(/\d{4}-\d{2}-\d{2}/);
  if (!m) return null;
  return Number.isNaN(new Date(m[0]).getTime()) ? null : m[0];
}
