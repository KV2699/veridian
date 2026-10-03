#!/usr/bin/env node
// Does slicing a window into weeks return MORE unique results than one wide
// search, or merely reshuffle the same ones?
//
// max_results is a ranking cap, not a date cap: one 28-day search returns the
// 10 Tavily judges best across the whole month, so a busy week can crowd a
// quiet one out entirely. Four 7-day searches each get their own top 10.
//
// The question is whether that actually surfaces different articles. Measured,
// not assumed.
import 'dotenv/config';

const KEY = process.env.TAVILY_API_KEY;
const QUERIES = [
  'GPU cloud AI infrastructure funding round raised billion',
  'AI data center power purchase agreement megawatt announced',
  '"has appointed" chief AI officer OR head of AI infrastructure announcement',
];

const iso = (d) => d.toISOString().slice(0, 10);
const key = (u) => { try { const x = new URL(u); return (x.host.replace(/^www\./, '') + x.pathname).toLowerCase().replace(/\/$/, ''); } catch { return u; } };

async function search(query, extra) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ api_key: KEY, query, search_depth: 'advanced', max_results: 10, topic: 'news', ...extra }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) return [];
  return (await res.json()).results ?? [];
}

console.log('\nOne wide search vs four weekly slices — same query, same 28 days\n');
console.log('query'.padEnd(52) + 'wide'.padEnd(7) + 'sliced'.padEnd(8) + 'new'.padEnd(6) + 'overlap');
console.log('─'.repeat(84));

let totalWide = 0, totalSliced = 0;

for (const q of QUERIES) {
  const wide = await search(q, { days: 28 });
  const wideKeys = new Set(wide.map((r) => key(r.url)));

  const sliced = new Set();
  for (let w = 0; w < 4; w++) {
    const end = new Date(Date.now() - w * 7 * 864e5);
    const start = new Date(end.getTime() - 7 * 864e5);
    const got = await search(q, { start_date: iso(start), end_date: iso(end) });
    got.forEach((r) => sliced.add(key(r.url)));
  }

  const fresh = [...sliced].filter((k) => !wideKeys.has(k)).length;
  const overlap = [...sliced].filter((k) => wideKeys.has(k)).length;
  totalWide += wideKeys.size;
  totalSliced += sliced.size;

  console.log(q.slice(0, 50).padEnd(52) + String(wideKeys.size).padEnd(7) + String(sliced.size).padEnd(8)
    + String(fresh).padEnd(6) + `${overlap}/${wideKeys.size}`);
}

console.log('─'.repeat(84));
console.log(`TOTAL unique: wide ${totalWide} · sliced ${totalSliced} — ${(totalSliced / totalWide).toFixed(1)}x`);
console.log(`Tavily cost : wide ${QUERIES.length * 2} credits · sliced ${QUERIES.length * 4 * 2} credits (4x)\n`);
