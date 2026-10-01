// Tavily web search client — the discovery layer for Agents 1-4.
//
// Every signal in a briefing traces back to a Tavily result with a live URL and
// a published date. Tavily is the only source of external facts in this system:
// Nemotron never supplies a signal from its own weights, it only summarises,
// scores and synthesises what Tavily fetched. That separation is deliberate —
// collection and verification are different jobs with opposite failure modes.

import { log } from './log.js';

const ENDPOINT = 'https://api.tavily.com/search';

// Advanced search costs 2 Tavily credits, basic costs 1. Tune down to `basic`
// while iterating on queries, back to `advanced` for real runs and the demo.
const defaultDepth = () => (process.env.TAVILY_DEPTH === 'basic' ? 'basic' : 'advanced');

function requireKey() {
  const key = (process.env.TAVILY_API_KEY ?? '').trim();
  if (!key) throw new Error('TAVILY_API_KEY is not set — copy .env.example to .env and add your Tavily key');
  // Catch the unedited placeholder here rather than letting it become a 401.
  if (/^your_|_key$/i.test(key)) {
    throw new Error('TAVILY_API_KEY is still the .env.example placeholder — paste your real key from tavily.com');
  }
  return key;
}

/**
 * One Tavily search.
 * @param {string} query
 * @param {{days?:number, maxResults?:number, depth?:'basic'|'advanced', topic?:'general'|'news'}} opts
 * @returns {Promise<Array<{title:string,url:string,content:string,score:number,published_date:string|null}>>}
 */
export async function search(query, { days = 7, maxResults = 10, depth = defaultDepth(), topic = 'news' } = {}) {
  const key = requireKey();
  // Tavily has shipped both a Bearer header and a body api_key field across
  // versions; sending both keeps this working either way.
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: depth,
      max_results: maxResults,
      days,
      topic,
      include_answer: false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.results ?? []).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    content: r.content ?? '',
    score: typeof r.score === 'number' ? r.score : null,
    published_date: r.published_date ?? null,
  }));
}

/**
 * Run a collector's query set and merge the results, de-duplicated by URL.
 * One failed query never sinks a collector — it is logged and skipped.
 */
export async function searchMany(queries, opts = {}) {
  const byUrl = new Map();
  const stats = [];
  let failed = 0;

  for (const query of queries) {
    try {
      const hits = await search(query, opts);
      let fresh = 0;
      for (const hit of hits) {
        if (!hit.url) continue;
        const key = canonicalUrl(hit.url);
        if (byUrl.has(key)) continue;
        byUrl.set(key, { ...hit, found_via: query });
        fresh++;
      }
      // Per-query counts feed the yield diagnostics: a query that reliably
      // returns nothing is a wording problem, and it should be visible.
      stats.push({ query, hits: hits.length, unique: fresh, failed: false });
      log.step(`Tavily "${truncate(query, 56)}" → ${hits.length} hits, ${fresh} new`);
    } catch (err) {
      failed++;
      stats.push({ query, hits: 0, unique: 0, failed: true, error: err.message });
      log.warn(`Tavily query failed, skipping — ${err.message}`);
    }
  }

  if (failed === queries.length) throw new Error('every Tavily query failed');
  return { results: [...byUrl.values()], stats };
}

// Strip tracking params and trailing slashes so the same article found by two
// different queries collapses to one result.
export function canonicalUrl(url) {
  try {
    const u = new URL(url);
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|ref|source|fbclid|gclid|mc_cid|mc_eid)/i.test(p)) u.searchParams.delete(p);
    }
    u.hash = '';
    return `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
