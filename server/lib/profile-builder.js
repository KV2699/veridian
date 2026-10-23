// PROFILE BUILDER — onboarding a new business, as automatically as honesty allows.
//
// A profile is the strategy of a deployment: what the business sells, who it
// can win, which publications carry its market's news, and — the hard one —
// which way each kind of event points for it.
//
// Most of that CAN be gathered automatically. A company's own website states
// its services. Its sector and size are public. The trade press for a market is
// findable. So the builder does all of that.
//
// POLARITY CANNOT BE GATHERED THIS WAY, and the whole architecture rests on
// that. "We are an executive search firm" does not imply "therefore invert
// appointment signals and hunt departures without named successors, plus the
// backfill vacancies created by internal promotions." A model asked to infer it
// produces a confident, plausible, wrong answer — and an empty week looks
// exactly like a quiet market, so nobody finds out for months.
//
// There is exactly one reliable source for it, and it is not a description of
// the business. It is the business's OWN PAST WINS:
//
//   "What was the published event that started this deal?"
//
// Answer that five times and the polarity falls out of the answers. A recruiter
// says "they told us their CSO had resigned". A vendor says "they announced a
// new AI lead". Same question, opposite answers, and neither is a guess.
//
// So the builder works in two modes:
//
//   WITH past wins   → it derives a polarity PROPOSAL from them, each line
//                      traced back to the win it came from.
//   WITHOUT          → it writes the polarity block as explicit unanswered
//                      questions, and says so loudly. The profile will not
//                      score correctly until a human answers them.
//
// Refusing to guess here is not a limitation of the builder. It is the product.

import { completeJSON } from './nebius.js';
import { log } from './log.js';

const UA = 'Mozilla/5.0 (compatible; SignalBureau/1.0; +https://github.com/)';

/** Strip a page to readable text. No parser dependency — this is a sketch, and
 *  the model only needs the prose, not the structure. */
export function textFrom(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The pages on a company site that actually describe what it sells. */
export function serviceLinks(html, baseUrl) {
  const found = new Set();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (!/\b(service|solution|what-we-do|expertise|capabilit|practice|sector|about|offering|team)s?\b/i.test(href)) continue;
    if (/^(mailto:|tel:|#|javascript:)/i.test(href)) continue;
    try {
      const url = new URL(href, baseUrl);
      if (url.hostname !== new URL(baseUrl).hostname) continue;
      url.hash = '';
      found.add(url.toString());
    } catch { /* malformed href */ }
  }
  return [...found].slice(0, 6);
}

/**
 * Read a company's own website. FREE — plain HTTP, no search credits.
 *
 * A company's own description of what it sells is better evidence than anything
 * a search would return about it, and it costs nothing to fetch.
 */
export async function readCompanySite(url, { maxPages = 6, timeoutMs = 20000, fetchImpl = fetch } = {}) {
  const pages = [];
  const get = async (u) => {
    const res = await fetchImpl(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  };

  let home;
  try {
    home = await get(url);
    pages.push({ url, text: textFrom(home).slice(0, 6000) });
    log.step(`read ${url} — ${pages[0].text.length} characters`);
  } catch (err) {
    throw new Error(`could not read ${url} — ${err.message}`);
  }

  for (const link of serviceLinks(home, url).slice(0, maxPages - 1)) {
    try {
      const text = textFrom(await get(link)).slice(0, 5000);
      if (text.length > 400) { pages.push({ url: link, text }); log.step(`read ${link}`); }
    } catch { log.warn(`skipped ${link}`); }
  }
  return pages;
}


/**
 * Try to find a live RSS feed for each publication the research named.
 *
 * This is the "fetch every source before trusting it" rule, automated. A stale
 * source list was root cause 4 of the predecessor methodology's failure — a
 * prompt cited a publication that had been renamed — and when the exec-search
 * profile was built by hand, 3 of 14 candidate feeds were dead (one 404, two
 * 403). A feed that 404s is a silent failure: the collector just finds less.
 *
 * Costs nothing. Tries the handful of paths publishers actually use.
 */
const FEED_PATHS = ['/feed/', '/rss', '/rss.xml', '/feed.xml', '/feeds/news/', '/atom.xml', '/index.xml'];

export async function findFeeds(publications = [], { fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  const live = [];
  const dead = [];

  for (const pub of publications.slice(0, 15)) {
    // A publication may be given as a name or as a domain; only a domain can
    // be probed, so skip anything that is not one.
    const host = String(pub).trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) { dead.push({ name: pub, reason: 'not a domain — find its feed by hand' }); continue; }

    let found = null;
    for (const path of FEED_PATHS) {
      const url = `https://${host}${path}`;
      try {
        const res = await fetchImpl(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) continue;
        const body = await res.text();
        // Must actually contain items — a soft-404 returns 200 and a web page.
        const items = (body.match(/<item[\s>]|<entry[\s>]/g) ?? []).length;
        if (items > 0) { found = { name: host, url, items }; break; }
      } catch { /* try the next path */ }
    }
    if (found) { live.push(found); log.ok(`feed found: ${found.url} (${found.items} items)`); }
    else { dead.push({ name: host, reason: 'no working feed at any standard path' }); log.warn(`no feed: ${host}`); }
  }
  return { live, dead };
}

// ── Stage 2: research the MARKET, not the company ──────────────────────────
//
// A company's own website says what it sells. It does not say which trade
// publications carry its market's news, which regulators create work for its
// customers, or who it competes against — and those are three of the seven
// questions a profile must answer.
//
// That research was being done by hand in a separate tool. It does not need to
// be, because of one asymmetry: a model's knowledge of "which publications
// cover UK banking technology" is broad and mostly right, and ANY ANSWER IT
// INVENTS CAN BE CAUGHT BY FETCHING IT. A hallucinated domain does not resolve.
// A real one returns a feed with items in it.
//
// So the model proposes and the network disposes. That is a safe use of model
// knowledge, and it is the opposite of how the collectors work — there, a model
// may never supply a fact, because a hallucinated SIGNAL looks exactly like a
// real one and nothing can check it after the fact.
//
// The one thing this stage must not do is propose polarity. See the note at the
// top of this file.
const RESEARCH_SYSTEM = `You are researching a MARKET so that a business development intelligence system can be configured for it.

You are told what a business sells and who it sells to. You return the publications, regulators and competitors that define its market.

Everything you return will be CHECKED. Publication and regulator domains are fetched; anything that does not resolve is discarded before it reaches the configuration. So propose your best candidates rather than only the ones you are certain of — but never invent a domain you have no reason to believe exists, because a wrong domain costs a real source its place.

RULES:
- publications: outlets that report EVENTS in this market — appointments, contracts, funding, restructures, regulatory deadlines. Give the bare domain only: "esgdive.com", never "https://..." and never the publication's title. Favour VERTICAL TRADE PRESS over general business media: general web search already finds the Financial Times, and systematically misses the trade outlet that actually carries the event. Give 12-18.
- regulators: bodies whose published decisions, rules or deadlines OBLIGE THIS BUSINESS'S CUSTOMERS to act. Not who regulates this business — who regulates its buyers, because a published deadline someone else must meet is the strongest buying trigger there is. Give the body's name, its bare domain, and the search terms that would find its decisions. 4-8.
- competitors: firms selling the same thing to the same buyer. These are EXCLUDED from the prospect list entirely, so a wrong name here deletes a real opportunity — give only firms you are confident compete directly.
- winnable_universe: who this business can realistically WIN, which is a different question from who it sells to. The largest organisations in any market are usually the worst prospects: mature in-house functions, incumbent suppliers, framework agreements. Name the segment where this business actually wins.
- too_big: the kind of prospect that wastes their time, and why in one clause.
- collector_queries: 5-7 web searches that would find dated, published events creating demand here.

  WRITE THEM AS PLAIN LANGUAGE. No site: operators, no boolean OR chains, no quoted-phrase stacking — the search layer takes a natural-language query and is given its domain restrictions separately, so an operator-heavy query returns nothing and looks like a quiet market. "regulator opens formal investigation into retailer announced" is a query. "\"investigation\" site:gov.uk OR site:ico.org.uk" is not.

  Every query must hunt something that gets PUBLISHED ON A DATE. A query that asks a search engine to prove a negative — "companies that lack X" — can never be satisfied, and a model faced with an unanswerable question either returns nothing or invents.

  Name the ACTOR and the COMMITMENT: company and body names appear in announcements, category words appear in analysis. "signed", "awarded", "raised", "appointed", "opened an investigation", "breaks ground" are dated acts; "deploying", "expanding", "pursuing", "focusing on" are states and will return commentary.

Reply with JSON only. The first character must be {.

{"publications":["domain.com"],"regulators":[{"name":"Body","domain":"body.gov.uk","terms":"decision rule deadline"}],"competitors":["Name"],"winnable_universe":"one sentence","too_big":"one clause","collector_queries":["query"]}`;

/**
 * Research the market around a business. Uses the ULTRA tier: this is recall
 * and judgement about an industry, not extraction from a supplied document.
 */
export async function researchMarket({ name, market, practiceAreas = [], description = '' }, deps = {}) {
  const ask = deps.completeJSON ?? completeJSON;
  const { data } = await ask({
    tier: 'ultra',
    temperature: 0.2,
    maxTokens: 6000,
    expectKey: 'publications',
    system: RESEARCH_SYSTEM,
    user: `THE BUSINESS: ${name}
MARKET: ${market}
WHAT THEY SELL:
${practiceAreas.map((a) => `- ${a.name}: ${a.description}`).join('\n')}
${description ? `\nDESCRIPTION: ${description}` : ''}

Research this market. Return JSON.`,
  });
  return data ?? {};
}

/** Does this domain exist and serve something? Cheap, and it is the only
 *  thing standing between a model's guess and the configuration file. */
export async function verifyDomains(entries = [], { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const live = [];
  const dead = [];
  await Promise.all(entries.map(async (e) => {
    const domain = String(e?.domain ?? e ?? '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) { dead.push({ ...(typeof e === 'object' ? e : { name: e }), reason: 'not a domain' }); return; }
    try {
      const res = await fetchImpl(`https://${domain}/`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
      // Anything that answers at all is real enough — a 403 from a bot wall
      // still proves the domain exists, which is what is being checked.
      if (res.status < 500) live.push(typeof e === 'object' ? { ...e, domain } : { domain });
      else dead.push({ ...(typeof e === 'object' ? e : { name: e }), reason: `HTTP ${res.status}` });
    } catch (err) {
      dead.push({ ...(typeof e === 'object' ? e : { name: e }), reason: 'did not resolve' });
    }
  }));
  return { live, dead };
}

const SYSTEM = `You are drafting a configuration file for a business development intelligence system.

You are given a company's own words about itself, and possibly a list of deals it has won. You turn that into a structured description of what the business sells and who it can win.

HARD RULES:
- Use ONLY the supplied text. Never add a service, client, competitor or publication from your own knowledge of this company.
- practice_areas are what the business SELLS, as a buyer would recognise them, and each must be a SEPARATE BUDGET signed by a DIFFERENT person. If two of them are always bought together they are one area, not two. Four to six is normal; more than eight means you have split too finely.
- If the text does not establish something, return an empty array or an empty string. Never fill a field to look complete.

POLARITY IS DIFFERENT AND YOU MUST NOT GUESS IT.

Polarity is which way an event points for this business — whether a given published event means "call them" or "we have lost this one". The same event means opposite things to different businesses: a company appointing a Head of Sustainability is a new budget holder to a vendor and a filled mandate with the fee gone to a recruiter.

- If you are given PAST WINS, derive the polarity from them, and for each line say which win it came from. A win that started when a client's director resigned tells you a departure is a lead. That is evidence, not inference.

EACH POLARITY LINE IS A FULL SENTENCE naming the EVENT TYPE, which way it points in CAPITALS, and WHY. It is an instruction given to another model later, so "call them" is not an answer — it says nothing about which event is being read. Write them exactly like these:

  "A COMPLETED ACQUISITION with a stated integration timetable is a LEAD — two estates must be merged against a legally fixed date and the work cannot be deferred."
  "A NEW APPOINTMENT into a technology or AI leadership role is a LEAD — a new budget holder inherits an old estate and has roughly 180 days to show progress."
  "A REGULATOR PUBLISHING FINAL RULES with an in-force date is a LEAD on every firm it obliges, and NOT on the regulator itself — the regulator is not a customer."
  "An organisation STATING IT BUILDS IN-HOUSE is a DEAD LEAD — the work will never come to market, however well it fits."

polarity_evidence must name the win each line came from in a few words — "the bank acquisition integration win" — not "win 1".
- If you are NOT given past wins, return polarity as an empty array and populate polarity_questions instead with the questions a human must answer. Do not invent polarity from the company description. A confident wrong answer here produces an empty pipeline that looks exactly like a quiet market.

Reply with JSON only. The first character must be {.

{"name":"short display name","market":"short noun phrase for the market, e.g. sustainability and ESG executive search","reader":"who the weekly briefing is for, one clause","description":"one sentence","practice_areas":[{"key":"lowercase_key","name":"Display Name","description":"what it is and what kind of event opens a conversation about it"}],"winnable_universe":"who this business can realistically win, one sentence","too_big":"the kind of prospect that is a waste of time and why","competitors":["names stated in the text"],"clients":["names stated in the text"],"publications":["trade publications that cover this market — give the DOMAIN where you can, e.g. esgdive.com, not the title"],"polarity":["only if past wins were supplied"],"polarity_evidence":["which win each polarity line came from"],"polarity_questions":["only if no past wins were supplied"],"feed_terms":["15-25 lowercase fragments matched against a headline to decide whether it is worth reading. Weight them to EVENT words — acquires, appoints, steps down, awarded, selects, raises, restructures, deadline, mandates — not to topic words. A feed full of relevant subject matter is useless unless something is HAPPENING. Include partial words where that helps: restructur, acquisit."],"value_factor":"multi_service or deal_scale","value_factor_reason":"one sentence"}`;

/** Draft the profile fields from evidence. Uses the FAST tier — this is
 *  extraction, not reasoning. */
export async function draftProfile({ pages = [], brief = '', wins = '' }, deps = {}) {
  const ask = deps.completeJSON ?? completeJSON;

  const evidence = [
    brief ? `RESEARCH BRIEF SUPPLIED BY THE OPERATOR:\n${brief.slice(0, 12000)}` : '',
    pages.length ? `THE COMPANY'S OWN WEBSITE:\n${pages.map((p) => `--- ${p.url} ---\n${p.text}`).join('\n\n').slice(0, 14000)}` : '',
    wins ? `PAST WINS — the event that started each deal. THIS IS THE ONLY VALID BASIS FOR POLARITY:\n${wins.slice(0, 6000)}` : '',
  ].filter(Boolean).join('\n\n');

  if (!evidence.trim()) throw new Error('no evidence supplied — pass a website, a brief, or both');

  const { data } = await ask({
    tier: 'fast',
    temperature: 0,
    maxTokens: 9000,
    expectKey: 'practice_areas',
    system: SYSTEM,
    user: `${evidence}\n\nDraft the configuration as JSON.${wins ? '' : '\n\nNO PAST WINS WERE SUPPLIED. Return polarity as an empty array and fill polarity_questions.'}`,
  });
  return data ?? {};
}

/** Does this draft describe a business the pipeline can actually serve? */
export function validateDraft(d) {
  const problems = [];
  const areas = Array.isArray(d?.practice_areas) ? d.practice_areas : [];
  if (!d?.name) problems.push('no name');
  if (!d?.market) problems.push('no market — the extraction, verification and briefing prompts all need one');
  if (areas.length < 2) problems.push(`only ${areas.length} practice area(s) — the multi-service score needs at least two to mean anything`);
  if (areas.length > 8) problems.push(`${areas.length} practice areas — probably split too finely, which inflates every score`);
  if (new Set(areas.map((a) => a?.key)).size !== areas.length) problems.push('duplicate practice area keys');
  if (areas.some((a) => !a?.key || !a?.name || !a?.description)) problems.push('a practice area is missing its key, name or description');
  const polarity = Array.isArray(d?.polarity) ? d.polarity : [];
  const questions = Array.isArray(d?.polarity_questions) ? d.polarity_questions : [];
  if (!polarity.length && !questions.length) problems.push('neither polarity nor the questions to establish it');
  return { ok: problems.length === 0, problems, needsPolarity: polarity.length === 0 };
}
