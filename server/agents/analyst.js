// AGENT — Analyst (the conversational layer)
//
// A BD manager asks a question in their own words; this answers it from the
// register, and only from the register.
//
// Three stages, and the middle one is the important one:
//
//   1. Nemotron Ultra TRANSLATES the question into a filter spec.
//   2. Code RUNS that filter. No model is involved in selecting or sorting.
//   3. Nemotron Ultra NARRATES the rows it is handed, and nothing else.
//
// The temptation is to put 169 organisations in a prompt and ask for the top
// five. That produces five plausible names, some of which are wrong in ways
// nobody checks — the same failure the scoring work eliminated by computing the
// number in code rather than asking for it. Here the model never sees the full
// set, so it cannot invent a member of it.
//
// It must also be able to refuse. "Which of these will close first?" is not in
// the data, and a confident guess is worse than an honest no.

import { complete, completeJSON, MODELS } from '../lib/nebius.js';
import { runQuery, forNarration, SPEC } from '../lib/query-register.js';
import { listRegister } from '../lib/register.js';
import { getSignals } from '../lib/store.js';
import { log } from '../lib/log.js';

const TRANSLATE_SYSTEM = `You turn a business development question into a database filter. You do NOT answer the question.

Return ONLY a JSON object describing which records to fetch.

{"entity":"organisations|signals","filters":{...},"sort":"...","limit":5,"unanswerable":null}

ENTITY — "organisations" for questions about companies or accounts; "signals" for questions about events, news or deadlines.

FILTERS — use only these keys, and only when the question calls for them:
- band: one or more of Critical, High, Medium, Low
- status: "prospect" (not yet a customer) or "account" (already held)
- minScore: number 0-100
- practiceAreas: array of offering keys the question refers to
- multiService: true — opens two or more offerings
- quietForWeeks: number — no signal for this many consecutive sweeps ("gone quiet", "gone cold")
- category: which collector found it
- hasDeadline: true
- deadlineWithinDays: number — "closing in the next N days"
- nameContains: text — a specific company
- needsReview: true — unverified or flagged claims
- sinceDate: YYYY-MM-DD
- signalType: text

SORT — score, deadline, date, weeks, signals, quiet, name. Default score.
LIMIT — how many to return. "Top 5" means 5. Default 10.

UNANSWERABLE — set it to a short reason, and leave filters empty, when the question asks for something the data does not hold. The data records WHAT HAPPENED and HOW IT SCORED. It does not know revenue, headcount, contact names, who will convert, win probability, or anything about a company not in it. Never invent a filter to make an unanswerable question look answered.

VAGUE QUESTIONS — "what should I look at", "what's the biggest lead", "anything interesting" are answerable: they mean the highest-scoring records. Return an empty filter set sorted by score with a small limit. Do not mark these unanswerable, and do not deliberate — pick the obvious interpretation and return it.

OUTPUT FORMAT — strict: your entire reply is one JSON object. No reasoning, no explanation, no code fence. First character is {. Answer immediately; do not think step by step.`;

const NARRATE_SYSTEM = `You are a business development analyst briefing a colleague. You are given the EXACT records that answer their question, already filtered and ranked.

RULES:
- Use only the records given. Never add a company, figure or fact that is not in them.
- Lead with the answer. No preamble, no "based on the data provided".
- Name organisations and give the number that matters — score, band, deadline, or weeks tracked.
- Include the source link where a record has one, as a markdown link on the organisation's name.
- Mark anything flagged for review as "(unconfirmed)".
- If the records are empty, say plainly that nothing matches and suggest what might. Never pad.
- Be brief. A spoken answer should be two or three sentences; a list should be a list.
- British English.`;

export default async function ask(question, deps = {}) {
  const translate = deps.completeJSON ?? completeJSON;
  const narrate = deps.complete ?? complete;
  const loadOrgs = deps.listRegister ?? listRegister;
  const loadSignals = deps.getSignals ?? getSignals;

  const asked = String(question ?? '').trim();
  if (!asked) return { answer: 'Ask me something about the pipeline.', spec: null, rows: [] };

  // ── 1. Translate ─────────────────────────────────────────────────────────
  const [organisations, signals] = await Promise.all([loadOrgs({}), loadSignals()]);

  // Ultra is a reasoning model: on an open-ended question it thinks at length
  // before emitting anything. A tight budget truncates it mid-thought, and the
  // truncation guard then — correctly — refuses the whole reply. The first
  // version allowed 700 tokens and any question that was not a crisp filter
  // failed outright with an internal error in the user's face.
  let spec;
  try {
    ({ data: spec } = await translate({
      tier: 'ultra', temperature: 0, maxTokens: 4000, expectKey: 'filters',
      system: TRANSLATE_SYSTEM,
      user: buildTranslatePrompt(asked, organisations),
    }));
  } catch (err) {
    // Never show a model failure to someone asking a business question. Fall
    // back to the most useful default — their best prospects — and say so.
    log.warn(`could not translate "${asked}" — ${err.message}`);
    spec = { entity: 'organisations', filters: {}, sort: 'score', limit: 5, _fallback: true };
  }

  if (spec?.unanswerable) {
    log.step(`question declined: ${spec.unanswerable}`);
    return {
      answer: `I can't answer that from this data — ${String(spec.unanswerable).trim().replace(/[.\s]+$/, '')}. `
        + 'This register records what happened to each organisation and how it scored, not commercial detail about them.',
      spec, rows: [], total: 0, declined: true,
    };
  }

  // ── 2. Retrieve — code only ──────────────────────────────────────────────
  const result = runQuery(spec, { organisations, signals });
  log.step(`"${asked}" → ${result.entity}, ${result.applied.join(' · ')} → ${result.total} match, showing ${result.rows.length}`);

  // ── 3. Narrate — only what was retrieved ─────────────────────────────────
  let text;
  try {
    ({ text } = await narrate({
      tier: 'ultra', temperature: 0.3, maxTokens: 3000,
      system: NARRATE_SYSTEM,
      user: buildNarratePrompt(asked, result),
    }));
  } catch (err) {
    // The retrieval succeeded, so there is a real answer to give even if the
    // model could not write it. Render the rows plainly rather than failing.
    log.warn(`could not narrate "${asked}" — ${err.message}`);
    text = plainAnswer(result);
  }

  return {
    answer: (spec?._fallback ? `I wasn't sure exactly what you meant, so here are your highest-scoring prospects.\n\n` : '') + text.trim(),
    fallback: Boolean(spec?._fallback),
    spec,
    rows: result.rows,
    total: result.total,
    truncated: result.truncated,
    applied: result.applied,
    entity: result.entity,
    model: MODELS.ultra,
  };
}

// A readable answer built from the rows alone, for when the narrator fails.
// The retrieval is the valuable part; the prose is a convenience.
function plainAnswer(result) {
  if (!result.rows.length) return 'Nothing in the register matches that.';
  return result.rows
    .map((r, i) => {
      const n = forNarration(r, result.entity);
      const bits = [n.band && `${n.band} ${n.score ?? ''}`.trim(), (n.practice_areas ?? []).join(', '), n.deadline && `closes ${n.deadline}`]
        .filter(Boolean).join(' · ');
      const name = n.name ?? n.company;
      return `${i + 1}. ${n.url ? `[${name}](${n.url})` : name}${bits ? ` — ${bits}` : ''}`;
    })
    .join('\n');
}

function buildTranslatePrompt(question, organisations) {
  // The real vocabulary of this register, so the model filters on values that
  // exist rather than ones it imagines.
  const areas = [...new Set(organisations.flatMap((o) => o.practice_areas ?? []))];
  const cats = [...new Set(organisations.flatMap((o) => Object.keys(o.categories ?? {})))];
  return `QUESTION: ${question}

THIS REGISTER CONTAINS:
- ${organisations.length} organisations, each scored 0-100 and banded ${SPEC.bands.join('/')}
- practice area keys in use: ${areas.join(', ') || 'none'}
- collector categories in use: ${cats.join(', ') || 'none'}
- statuses: ${SPEC.statuses.join(', ')}
- per organisation: weeks tracked, signal count, quiet streak, latest signal, source url
- per signal: date, summary, source url, score, band, and sometimes a deadline

Return the filter spec as JSON.`;
}

function buildNarratePrompt(question, result) {
  const rows = result.rows.map((r) => forNarration(r, result.entity));
  return `QUESTION: ${question}

WHAT WAS SEARCHED: ${result.entity}, ${result.applied.join('; ')}, sorted by ${result.sortedBy}.
${result.total} record(s) matched${result.truncated ? `; the ${rows.length} best are below` : ''}.

RECORDS:
${rows.length ? JSON.stringify(rows, null, 1) : '(none matched)'}

Answer the question from these records.`;
}
