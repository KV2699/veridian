// AGENT — Feed Collector (official newsrooms and trade press RSS)
//
// The zero-hallucination discovery path. A search tool hands a model a pile of
// scraped text and asks it to find facts in there — which is where every
// misattribution in this project has come from. A feed hands over a headline, a
// link and a publication date that the publisher wrote themselves.
//
// So the model never supplies a fact here either. It reads the headline and
// standfirst the publisher wrote and answers three narrow questions: is there a
// named organisation doing something, which offerings does it open, and how big
// is it. The claim itself is the publisher's words, and the url is the one the
// feed gave.

import { fetchFeeds, withinDays, matching } from '../lib/feeds.js';
import { canonicalUrl } from '../lib/tavily.js';
import { completeJSON } from '../lib/nebius.js';
import { log } from '../lib/log.js';

const SYSTEM = `You turn news headlines into business development signals.

Each item is a real, already-published headline with its own url and date. You are NOT verifying it and NOT searching. You are deciding whether it describes a named organisation doing something specific, and what that means commercially FOR THE BUSINESS DESCRIBED BELOW.

The same event means opposite things to different businesses, so read every item through the polarity rules given to you, not through general news sense.

HARD RULES:
- company must be the organisation the headline is about. If the headline names no specific organisation — a market roundup, an opinion piece, a listicle, a "top 10" — set qualifies to false.
- summary must be one factual sentence drawn ONLY from the headline and standfirst given. Never add a figure, date or detail that is not in the text in front of you.
- practice_areas: which of the listed offerings this opens a genuine conversation for. Use only the given keys. Most items open exactly one. If none, set qualifies to false.
- value_level: commercial scale, using only the listed levels, based only on figures stated in the text. No figure stated means the unknown level.
- Product reviews, benchmarks, share-price commentary and general analysis do not qualify.
- relevance_score is 0-10 for how directly this matters to THIS business, read through the polarity rules below. This field has a meaning and a default of 0 is almost never right for an item that qualifies:
    8-10 = a named organisation took a dated action that creates a concrete reason to make contact now
    6-7  = real and relevant, but not directly actionable this week
    0-5  = background, or an event this business reads as a CLOSED opportunity
  An item scoring 5 or below will be discarded, so score an event the polarity rules call a lead accordingly.

OUTPUT FORMAT — strict: your entire reply must be a single JSON object. Do not reason out loud, do not explain, do not use a code fence. The first character must be {.

{"items":[{"id":"the id given","qualifies":true,"company":"string","signal_type":"string","summary":"string","practice_areas":["key"],"value_level":"string","relevance_score":0}]}`;

// Today's date, handed to every model that has to reason about recency.
//
// Without it a model falls back on its training cutoff and treats THIS WEEK's
// news as future-dated and therefore implausible — penalising exactly the
// freshest, most valuable signals. Found by running the pipeline: a Disney
// departure published three days earlier was rejected with "future date
// (2026-10-20) is implausible".
//
// This is in the operator's own prompt pack — "Today's date: [TODAY'S DATE]"
// appears in every prompt there — and it did not survive into the code.
const today = () => new Date().toISOString().slice(0, 10);

export default async function collectFeeds({ profile }, ctx = {}, deps = {}) {
  const fetchAll = deps.fetchFeeds ?? fetchFeeds;
  const ask = deps.completeJSON ?? completeJSON;
  const cfg = profile?.feeds ?? {};
  const { sources = [], terms = [] } = cfg;
  const days = process.env.BACKFILL === 'true' ? (cfg.days ?? 7) * 4 : (cfg.days ?? 7);

  if (!sources.length) {
    log.warn('no feeds configured in the profile');
    return { signals: [], telemetry: null, summary: '0 feeds configured' };
  }

  const known = ctx.knownUrlKeys ?? new Set();
  const practiceAreas = profile?.practiceAreas ?? [];
  const valueFactor = profile?.scoring?.valueFactor;

  log.step(`reading ${sources.length} feeds (${days}-day window)`);
  const all = await fetchAll(sources);
  const recent = withinDays(all, days);
  const onTopic = matching(recent, terms);
  const fresh = onTopic.filter((i) => !known.has(canonicalUrl(i.url)));
  log.step(`${all.length} items → ${recent.length} in window → ${onTopic.length} on topic → ${fresh.length} new`);

  const telemetry = (extracted) => ({
    key: 'feed', name: 'Feed Collector',
    queries: sources.map((s) => ({
      query: s.name,
      hits: all.filter((i) => i.feed === s.name).length,
      unique: onTopic.filter((i) => i.feed === s.name).length,
      fresh: fresh.filter((i) => i.feed === s.name).length,
      failed: false,
    })),
    hits: all.length, fresh: fresh.length, extracted, parseFailures: 0, batches: 0, ungrounded: 0,
  });

  if (!fresh.length) return { signals: [], telemetry: telemetry(0), summary: '0 feed signals' };

  const BATCH = 10;
  const byId = new Map(fresh.map((item, i) => [`F${i + 1}`, item]));
  const judged = new Map();
  let parseFailures = 0;

  for (let i = 0; i < fresh.length; i += BATCH) {
    const group = [...byId.entries()].slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    const of = Math.ceil(fresh.length / BATCH);
    log.step(`Nemotron FAST classification, batch ${n}/${of} (${group.length} headlines)`);
    try {
      const { data } = await ask({
        tier: 'fast', temperature: 0, maxTokens: 4000, expectKey: 'items',
        system: SYSTEM, user: buildPrompt(group, practiceAreas, valueFactor, profile?.polarity ?? []),
      });
      for (const row of Array.isArray(data?.items) ? data.items : []) {
        if (row && typeof row.id === 'string') judged.set(row.id, row);
      }
    } catch (err) {
      parseFailures++;
      log.warn(`batch ${n}/${of} classification failed, continuing — ${err.message}`);
    }
  }

  const validAreas = new Set(practiceAreas.map((a) => a.key));
  const validLevels = new Set(Object.keys(valueFactor?.points ?? {}));
  const signals = [];

  for (const [id, item] of byId) {
    const j = judged.get(id);
    if (!j || j.qualifies === false) continue;
    const company = String(j.company ?? '').trim();
    const summary = String(j.summary ?? '').trim();
    if (!company || !summary) continue;

    const areas = Array.isArray(j.practice_areas)
      ? [...new Set(j.practice_areas.map((a) => String(a).toLowerCase()).filter((a) => validAreas.has(a)))]
      : [];
    if (!areas.length) continue;

    signals.push({
      company, summary,
      signal_type: String(j.signal_type ?? '').trim() || 'News',
      url: item.url,
      url_key: canonicalUrl(item.url),
      date: item.published,
      relevance_score: clamp(j.relevance_score),
      practice_areas: areas,
      org_scale: 'unknown',
      ...(valueFactor
        ? { [valueFactor.key]: validLevels.has(String(j.value_level ?? '').toLowerCase()) ? String(j.value_level).toLowerCase() : 'unknown' }
        : {}),
      category: 'feed',
      source_title: item.title,
      found_via: item.feed,
      collected_at: new Date().toISOString(),
      // The publisher wrote the headline this claim comes from, so there is no
      // third-party article to ground it against.
      source_is_about_company: true,
      weak_source: false,
      grounding_note: null,
    });
  }

  log.ok(`${signals.length} signals from ${fresh.length} headlines across ${new Set(signals.map((s) => s.found_via)).size} feeds`);
  return { signals, telemetry: { ...telemetry(signals.length), parseFailures }, summary: `${signals.length} from feeds` };
}

function buildPrompt(group, practiceAreas, valueFactor, polarity = []) {
  const items = group.map(([id, i]) => [
    `ID: ${id}`,
    `PUBLICATION: ${i.feed}`,
    `DATE: ${i.published ?? 'unknown'}`,
    `HEADLINE: ${i.title}`,
    `STANDFIRST: ${(i.summary ?? '').slice(0, 500)}`,
  ].join('\n')).join('\n\n');

  const areas = practiceAreas.map((a) => `- ${a.key}: ${a.name} — ${a.description}`).join('\n');
  const levels = valueFactor
    ? `\nVALUE LEVELS — use one of: ${Object.keys(valueFactor.points ?? {}).join(' | ')}\n${(valueFactor.guidance ?? []).map((g) => `- ${g}`).join('\n')}\n`
    : '';

  const polarityBlock = polarity.length
    ? `\nHOW TO READ THESE EVENTS (this business specifically — these override general news sense):\n${polarity.map((p) => `- ${p}`).join('\n')}\n`
    : '';

  return `TODAY'S DATE: ${today()}. These headlines were published in the last few weeks — recent is good, not suspicious.

OFFERINGS THIS BUSINESS SELLS:
${areas}
${levels}${polarityBlock}
HEADLINES:

${items}

Classify each item as JSON.`;
}

function clamp(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 5;
  return Math.max(0, Math.min(10, Math.round(n)));
}
