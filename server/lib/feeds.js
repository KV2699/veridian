// RSS / Atom feed reader.
//
// Feeds are the zero-hallucination half of collection. A search tool hands a
// model a pile of text and asks it to find facts in there; a feed hands over a
// title, a link and a publication date that the publisher wrote themselves.
// Nothing is inferred, so nothing can be invented — the predecessor system
// rated its RSS script the single highest signal-to-noise source it ever
// tested, above every AI tool.
//
// Deliberately dependency-free: feeds are simple enough to parse directly, and
// an XML library is not worth the supply chain for this.

import { log } from './log.js';

const UA = 'SignalBureau/1.0 (+https://github.com/; BD intelligence research)';

/** Fetch and parse one feed. Returns [] rather than throwing on a bad feed. */
export async function fetchFeed({ name, url }, { timeoutMs = 20000 } = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseFeed(xml).map((i) => ({ ...i, feed: name }));
    log.step(`feed ${name} → ${items.length} items`);
    return items;
  } catch (err) {
    log.warn(`feed ${name} failed, skipping — ${err.message}`);
    return [];
  }
}

/** Fetch many feeds concurrently; one bad feed never sinks the rest. */
export async function fetchFeeds(feeds, opts) {
  const all = await Promise.all(feeds.map((f) => fetchFeed(f, opts)));
  return all.flat();
}

/** Parse RSS 2.0 or Atom into a common shape. */
export function parseFeed(xml) {
  const blocks = [...matchAll(xml, /<item[\s>][\s\S]*?<\/item>/gi)];
  if (blocks.length) return blocks.map(parseRssItem).filter((i) => i.title && i.url);

  const entries = [...matchAll(xml, /<entry[\s>][\s\S]*?<\/entry>/gi)];
  return entries.map(parseAtomEntry).filter((i) => i.title && i.url);
}

function parseRssItem(block) {
  return {
    title: clean(tag(block, 'title')),
    url: clean(tag(block, 'link')) || attr(block, 'guid'),
    summary: clean(tag(block, 'description') ?? tag(block, 'content:encoded')).slice(0, 1200),
    published: isoDate(tag(block, 'pubDate') ?? tag(block, 'dc:date')),
  };
}

function parseAtomEntry(block) {
  // Atom puts the url in an attribute, and may carry several link relations.
  const links = [...matchAll(block, /<link\b[^>]*>/gi)];
  const alternate = links.find((l) => /rel=["']?alternate/i.test(l)) ?? links[0] ?? '';
  return {
    title: clean(tag(block, 'title')),
    url: (alternate.match(/href=["']([^"']+)["']/i) ?? [])[1] ?? '',
    summary: clean(tag(block, 'summary') ?? tag(block, 'content')).slice(0, 1200),
    published: isoDate(tag(block, 'updated') ?? tag(block, 'published')),
  };
}

/** Drop anything published outside the window, and anything undated. */
export function withinDays(items, days) {
  const cutoff = Date.now() - days * 864e5;
  return items.filter((i) => i.published && new Date(i.published).getTime() >= cutoff);
}

/** Keep items whose title or summary mentions any of the given terms. */
export function matching(items, terms) {
  if (!terms?.length) return items;
  const lowered = terms.map((t) => t.toLowerCase());
  return items.filter((i) => {
    const hay = `${i.title} ${i.summary}`.toLowerCase();
    return lowered.some((t) => hay.includes(t));
  });
}

// ── XML helpers ──────────────────────────────────────────────────────────────
const matchAll = (s, re) => String(s).match(re) ?? [];

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m?.[1];
}

function attr(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  const v = m?.[1]?.trim();
  return v && /^https?:/i.test(v) ? v : '';
}

function clean(v) {
  if (!v) return '';
  return String(v)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function isoDate(v) {
  if (!v) return null;
  const d = new Date(clean(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
