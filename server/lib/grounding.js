// GROUNDING — does the source actually say this?
//
// The URL guard in collector-base proves a signal's url came back from Tavily.
// It does NOT prove the url supports the claim attached to it, and those are
// very different things. On the first clean live run the model produced:
//
//   "Oak Ridge National Laboratory is building AI supercomputers"
//     → sourced to a Facebook post about a university physicist
//   "SK Telecom announced a 15GW AI data center buildout"
//     → sourced to an article about an unrelated HPE product launch
//
// Both urls were real and both were in the search results. The model had read
// a passing mention, or supplied the fact from its own weights, and attached it
// to whichever result was nearest. A wrong fact in front of a BD team is not
// recoverable, so this is checked in code rather than asked for in a prompt.
//
// Three tiers, because "is the company mentioned" turned out to be too weak a
// test. A long article mentions many companies; only one is its subject. A
// claim about SK Telecom's 15GW buildout survived the first version because the
// word "SK Telecom" appeared somewhere inside a piece about an unrelated HPE
// launch.
//
//   company absent entirely        → DROP. The attribution is wrong.
//   company only deep in the body  → FLAG. Probably a passing mention.
//   company in the title or lead   → PASS. The article is about them.
//
// Figures that do not appear in the source are flagged separately.

// How much of the content counts as the lead — a subject is named early.
const LEAD_CHARS = 400;

// Domains that carry real reporting rarely, and passing mentions often.
const WEAK_DOMAINS = [
  'facebook.com', 'linkedin.com', 'reddit.com', 'x.com', 'twitter.com',
  'instagram.com', 'youtube.com', 'tiktok.com', 'medium.com', 'quora.com',
  'pinterest.com', 'simplywall.st', '247wallst.com',
];

// Words that identify nothing on their own.
const STOP = new Set([
  'group', 'holdings', 'technologies', 'technology', 'limited', 'corporation',
  'company', 'international', 'global', 'systems', 'solutions', 'services',
  'partners', 'ventures', 'labs', 'cloud', 'data', 'center', 'centre', 'the',
  'and', 'inc', 'ltd', 'llc', 'plc', 'national', 'government', 'university',
]);

/**
 * @returns {{ok:boolean, reason:string, weakSource:boolean, ungroundedFigures:string[]}}
 */
export function checkGrounding({ company, summary, url }, source) {
  const title = normalise(source?.title ?? '');
  const content = normalise(source?.content ?? '');
  const lead = `${title} ${content.slice(0, LEAD_CHARS)}`;
  const haystack = `${title} ${content}`;
  const weakSource = isWeakDomain(url);

  // Not enough source text to judge — do not drop on no evidence, but say so.
  if (haystack.trim().length < 60) {
    return { ok: true, reason: 'source text too short to verify', weakSource, ungroundedFigures: [], subject: false };
  }

  const tokens = distinctiveTokens(company);
  const mentioned = !tokens.length || tokens.some((t) => haystack.includes(t));
  if (!mentioned) {
    return { ok: false, reason: `source does not mention "${company}"`, weakSource, ungroundedFigures: [], subject: false };
  }

  const subject = !tokens.length || tokens.some((t) => lead.includes(t));
  const ungroundedFigures = figuresIn(summary).filter((f) => !haystack.includes(f.digits));

  const notes = [];
  if (!subject) notes.push(`"${company}" is mentioned only in passing, not in the headline or opening of this source`);
  if (ungroundedFigures.length) {
    notes.push(`figure${ungroundedFigures.length > 1 ? 's' : ''} not found in source: ${ungroundedFigures.map((f) => f.text).join(', ')}`);
  }

  return {
    ok: true,
    reason: notes.join('; '),
    weakSource,
    ungroundedFigures: ungroundedFigures.map((f) => f.text),
    subject,
  };
}

export function distinctiveTokens(company) {
  return String(company ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !STOP.has(t));
}

// Money, power and percentage figures — the numbers a BD reader would act on.
export function figuresIn(text) {
  const out = [];
  const re = /(?:[$£€]\s?)?(\d[\d,.]*)\s?(?:bn|billion|m|million|tn|trillion|k|MW|GW|TW|%)/gi;
  for (const m of String(text ?? '').matchAll(re)) {
    const digits = m[1].replace(/,/g, '').replace(/\.0+$/, '');
    // Bare small integers are usually counts, not claims worth checking.
    if (digits.length < 2 && !/[.,]/.test(m[1])) continue;
    out.push({ text: m[0].trim(), digits });
  }
  return out;
}

export function isWeakDomain(url) {
  try {
    const host = new URL(url).host.replace(/^www\./, '').toLowerCase();
    return WEAK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch { return false; }
}

const normalise = (s) => String(s).toLowerCase().replace(/[‐-―]/g, '-').replace(/,/g, '').replace(/\s+/g, ' ');
