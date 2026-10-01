// AGENT 5 — Account Watch
//
// Your Tab 1. Every other collector hunts organisations you do not have a
// relationship with; this one sweeps the ones you already hold, looking for a
// fresh, dated reason to make contact.
//
// This is the stage the predecessor system identified as its own biggest
// methodology gap — no prompt deliberately swept existing partners for
// expansion signals, so relationships quietly went cold while the pipeline
// kept hunting strangers.
//
// Two differences from a discovery collector:
//   1. The search universe is a named roster, not a topic. Accounts are swept
//      in batches so cost stays flat as the roster grows.
//   2. Nothing here is a "new prospect". Output is tagged `account` and routed
//      to its own briefing section, so a held account can never be presented
//      as a new find.

import { searchMany, canonicalUrl } from '../lib/tavily.js';
import { completeJSON } from '../lib/nebius.js';
import { log } from '../lib/log.js';
import { normalise } from './collector-base.js';

const SYSTEM = `You monitor organisations a business ALREADY has a relationship with, looking for fresh reasons to make contact.

You receive raw web search results about named organisations. You convert them into structured signals.

HARD RULES:
- Use ONLY the supplied search results. Never add a company, fact, figure or date from your own knowledge.
- Every signal needs the exact url from the result it came from. Never invent or alter a url.
- date must be the published date of the source, or null. Never guess.
- company must be one of the WATCHED ORGANISATIONS named below, spelled as given. If a result is about some other company, skip it — a competitor mentioned in passing is not a signal about the watched account.
- A result that is not a dated, specific event involving a watched organisation is not a signal. Skip it.
- Skip routine coverage: stock movements, analyst ratings, listicles, and general commentary.

relevance_score is 0-10 for how strong a reason this is to contact that account THIS WEEK. A dated, specific development they would expect you to have noticed scores high. Background coverage scores low.

OUTPUT FORMAT — this is strict:
Your entire reply must be a single JSON object. Do not reason out loud, do not explain your thinking, do not write a preamble, do not use a code fence. The first character you output must be {.

Reply with JSON only:
{"signals":[{"company":"string","signal_type":"string","summary":"string","url":"string","date":"YYYY-MM-DD or null","relevance_score":0}]}
If nothing qualifies, return {"signals":[]}.`;

export default async function accountWatch({ profile }, ctx = {}, deps = {}) {
  const find = deps.searchMany ?? searchMany;
  const ask = deps.completeJSON ?? completeJSON;

  const roster = profile?.roster ?? [];
  const cfg = profile?.accountWatch ?? {};
  const { focus = '', signalTypes = [], batchSize = 4, windowDays = 14 } = cfg;

  if (!roster.length) {
    log.warn('no accounts in the profile roster — nothing to watch');
    return { signals: [], telemetry: null, summary: '0 accounts watched' };
  }

  const known = ctx.knownUrlKeys ?? new Set();
  const batches = chunk(roster, batchSize);
  log.step(`watching ${roster.length} accounts in ${batches.length} batches (${windowDays}-day window)`);

  // One query per batch of accounts rather than one per account, so a roster
  // of 50 does not mean 50 searches every week.
  const queries = batches.map((names) => `${names.join(' OR ')} announcement expansion leadership AI infrastructure`);
  const { results, stats } = await find(queries, { days: windowDays, maxResults: 10 });

  const fresh = results.filter((h) => !known.has(canonicalUrl(h.url)));
  log.step(`${results.length} unique results, ${fresh.length} not seen before`);

  let ungrounded = 0;
  const telemetry = (extracted) => ({
    key: 'account', name: 'Account Watch',
    queries: stats.map((s) => ({ ...s, fresh: fresh.filter((h) => h.found_via === s.query).length })),
    hits: results.length, fresh: fresh.length, extracted, ungrounded,
  });

  if (!fresh.length) return { signals: [], telemetry: telemetry(0), summary: '0 account signals (nothing new)' };

  const signals = [];
  const BATCH = Number(process.env.EXTRACTION_BATCH) || 4;
  for (let i = 0; i < fresh.length; i += BATCH) {
    const batch = fresh.slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    const of = Math.ceil(fresh.length / BATCH);
    log.step(`Nemotron FAST extraction, batch ${n}/${of} (${batch.length} results)`);
    try {
      const { data } = await ask({
        tier: 'fast', temperature: 0, maxTokens: 4000, expectKey: 'signals', system: SYSTEM,
        user: buildPrompt({ focus, signalTypes, roster, batch, polarity: profile?.polarity ?? [] }),
      });
      // Reuse the collector's guard: any url the search did not return is dropped.
      signals.push(...normalise(data?.signals, {
        batch, category: 'account',
        onDrop: ({ company, reason }) => { ungrounded++; log.warn(`dropped "${company}" — ${reason}`); },
      }));
    } catch (err) {
      log.warn(`batch ${n}/${of} extraction failed, continuing — ${err.message}`);
    }
  }

  // Final safety net: the model was told to use roster names, but a signal
  // attributed to an organisation not on the roster is not an account signal.
  const onRoster = signals.filter((s) => matchesRoster(s.company, roster));
  const dropped = signals.length - onRoster.length;
  if (dropped) log.warn(`${dropped} signal(s) discarded — company not on the roster`);

  for (const s of onRoster) s.is_account = true;

  log.ok(`${onRoster.length} account signals across ${new Set(onRoster.map((s) => s.company)).size} accounts`);
  return {
    signals: onRoster,
    telemetry: telemetry(onRoster.length),
    summary: `${onRoster.length} signals on ${new Set(onRoster.map((s) => s.company)).size} accounts`,
  };
}

function buildPrompt({ focus, signalTypes, roster, batch, polarity }) {
  const results = batch.map((h, i) => [
    `--- RESULT ${i + 1} ---`,
    `TITLE: ${h.title}`,
    `URL: ${h.url}`,
    `PUBLISHED: ${h.published_date ?? 'unknown'}`,
    `CONTENT: ${(h.content || '').slice(0, 1500)}`,
  ].join('\n')).join('\n\n');

  const polarityBlock = polarity.length
    ? `\nHOW TO READ THESE EVENTS (this business specifically):\n${polarity.map((p) => `- ${p}`).join('\n')}\n`
    : '';

  return `WATCHED ORGANISATIONS (existing relationships — a signal must be about one of these):
${roster.map((r) => `- ${r}`).join('\n')}

WHAT COUNTS AS A REASON TO CONTACT THEM: ${focus}

SIGNAL TYPES:
${signalTypes.map((t) => `- ${t}`).join('\n')}
${polarityBlock}
SEARCH RESULTS:

${results}

Extract the qualifying signals as JSON.`;
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// Loose match so "Microsoft Azure" on the roster still matches a signal
// attributed to "Microsoft", without matching unrelated companies.
function matchesRoster(company, roster) {
  const c = norm(company);
  if (!c) return false;
  return roster.some((r) => {
    const n = norm(r);
    return c === n || c.includes(n) || n.includes(c);
  });
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/\b(inc|ltd|llc|plc|corp|corporation|limited|technologies|group)\b/g, '').replace(/[^a-z0-9]/g, '').trim();
