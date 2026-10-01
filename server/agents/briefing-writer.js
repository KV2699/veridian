// AGENT 6 — Briefing Writer  ·  NVIDIA Nemotron Ultra (deep synthesis tier)
//
// The deliverable. Everything upstream exists to put a clean, verified,
// scored signal set in front of this one model call. Nemotron Ultra reads the
// whole week at once — which is the point of using the large tier here rather
// than summarising section by section: the headline, the connections and the
// recommended actions can only be written by something holding all of it.

import { complete, MODELS } from '../lib/nebius.js';
import { log } from '../lib/log.js';

const SYSTEM = `You write Signal Bureau, a weekly BD intelligence briefing on the AI infrastructure market, for one reader: a business development professional or founder selling into GPU cloud, enterprise ML, AI tooling and the NVIDIA ecosystem.

They will read this in four minutes on a Monday morning and decide what to do this week.

VOICE:
- Plain, factual, specific. Lead with the organisation and what it did.
- No hype, no filler openers, no "in today's fast-moving landscape", no exclamation marks.
- Every bullet names a company and a dated action, and ends with a markdown link to its source: [source](url)
- Write what the signal means for the reader when it is not obvious, in the same sentence. One clause, not a paragraph.
- Where a signal opens a conversation across TWO OR MORE of this business's offerings, say so explicitly and name them — a multi-service opening is the most valuable thing in the briefing and must never be left implicit.
- Lead each section with its highest-priority signal. Priority bands are given; treat Critical as needing contact this week.

HARD RULES:
- Use ONLY the supplied signals. Never add a company, number, date or event from your own knowledge. If a section has no signals, write "No signals this week." under it.
- Never restate a signal's score, its id, or the name of the agent that found it.
- Mark anything flagged for review inline as "(unconfirmed)" — do not quietly drop it and do not present it as settled.
- Order every section most important first.
- Connections must be real links between the supplied signals, not general market commentary.
- The three recommended actions must each be something the reader can personally start this week, each tied to a specific signal above. No "monitor the market", no "consider exploring". Name who to approach or what to prepare.

Output GitHub-flavoured markdown in exactly the given structure. No preamble, no closing note, no text outside the structure.`;

// Sections come from the profile, with Account Watch always first: a fresh
// reason to contact someone who already knows you outranks a cold prospect.
function sectionsFor(profile) {
  return [
    { key: 'account', heading: 'Your Accounts' },
    ...profile.collectors.map((c) => ({ key: c.key, heading: c.name.replace(/ Collector$/, '') })),
  ];
}

// `deps` exists for testing — see qa-verifier.js.
export default async function writeBriefing({ signals, connections, assessment, week, weekLabel, profile, diagnostics }, deps = {}) {
  const ask = deps.complete ?? complete;
  const CATEGORIES = sectionsFor(profile);
  const counts = Object.fromEntries(CATEGORIES.map(({ key }) => [key, signals.filter((s) => s.category === key).length]));

  if (!signals.length) {
    log.warn('no verified signals — writing an explicit empty briefing rather than inventing content');
    return {
      markdown: emptyBriefing(weekLabel, CATEGORIES, diagnostics),
      counts,
      model: null,
      summary: 'empty briefing (no verified signals)',
    };
  }

  log.step(`Nemotron Ultra synthesis over ${signals.length} verified signals (${MODELS.ultra})`);
  const { text, model, usage } = await ask({
    tier: 'ultra',
    temperature: 0.4,
    maxTokens: 3000,
    system: SYSTEM,
    user: buildPrompt({ signals, connections, assessment, weekLabel, counts, CATEGORIES, profile }),
  });

  const markdown = tidy(text, weekLabel);
  log.ok(`briefing written — ${markdown.split(/\s+/).length} words, ${markdown.split('\n').length} lines`);

  return { markdown, counts, model, usage, summary: `${markdown.split(/\s+/).length}-word briefing` };
}

function buildPrompt({ signals, connections, assessment, weekLabel, counts, CATEGORIES, profile }) {
  const sections = CATEGORIES.map(({ key, heading }) => {
    const rows = signals.filter((s) => s.category === key);
    const body = rows.length
      ? rows.map((s) => [
          `- COMPANY: ${s.company}`,
          `  TYPE: ${s.signal_type}`,
          `  DATE: ${s.date ?? 'undated'}`,
          `  WHAT HAPPENED: ${s.summary}`,
          `  SOURCE URL: ${s.url}`,
          `  PRIORITY: ${s.priority_score}/100 ${s.priority_band}${s.multi_service ? ' · MULTI-SERVICE' : ''}`,
          (s.practice_areas ?? []).length ? `  OPENS: ${s.practice_areas.join(', ')}` : null,
          s.needs_review ? `  FLAGGED FOR REVIEW: ${s.review_reason || 'thinly sourced'}` : null,
        ].filter(Boolean).join('\n')).join('\n')
      : '  (none)';
    return `### ${heading} — ${rows.length} signals\n${body}`;
  }).join('\n\n');

  const multi = signals.filter((s) => s.multi_service);
  const multiBlock = multi.length
    ? `\nMULTI-SERVICE OPENINGS (${multi.length}) — these open two or more offerings and are the highest-value items this week:\n${multi.map((s) => `- ${s.company}: ${s.practice_areas.join(' + ')}`).join('\n')}\n`
    : '';

  const conn = connections?.length
    ? connections.map((c) => `- ${c.observation}`).join('\n')
    : '  (none identified — write your own only if a genuine link exists in the signals above)';

  const structure = CATEGORIES.map(({ key, heading }) =>
    `## ${heading} (${counts[key]} signals)\n[${counts[key] ? '3-5 bullets, most important first, each ending with [source](url)' : 'write "No signals this week."'}]`
  ).join('\n\n');

  return `Write the Signal Bureau briefing for the week of ${weekLabel}.

MARKET: ${profile?.name ?? 'AI infrastructure'} — ${profile?.description ?? ''}

"Your Accounts" are organisations this reader ALREADY has a relationship with. Write those bullets as a reason to get back in touch, never as a new discovery.

VERIFIED SIGNALS (${signals.length} total — ${CATEGORIES.map(({ key, heading }) => `${heading} ${counts[key]}`).join(', ')}):

${sections}

${multiBlock}
CONNECTIONS IDENTIFIED BY THE VERIFICATION PASS:
${conn}

VERIFICATION PASS ASSESSMENT: ${assessment || 'none given'}

Produce exactly this structure:

# Signal Bureau — Week of ${weekLabel}

## This Week's Headline
[One sentence: the single most important thing that happened, naming the organisation.]

${structure}

## Connections Worth Noting
[2-3 observations linking signals across categories]

## Recommended Actions This Week
[3 specific actions, each tied to a named signal above. Prioritise Critical-band and multi-service signals.]`;
}

// Strip any wrapper the model adds and guarantee the H1 is correct.
function tidy(text, weekLabel) {
  let md = text.trim()
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const h1 = md.indexOf('# Signal Bureau');
  if (h1 > 0) md = md.slice(h1);
  if (h1 === -1) md = `# Signal Bureau — Week of ${weekLabel}\n\n${md}`;
  return `${md.replace(/\n{3,}/g, '\n\n')}\n`;
}

// An empty week is written by hand rather than by the model: there is nothing
// to synthesise, and the useful content is the diagnosis of why it was empty.
function emptyBriefing(weekLabel, CATEGORIES, diagnostics) {
  const findings = diagnostics?.findings?.filter((f) => f.severity === 'high') ?? [];
  const actions = findings.length
    ? findings.slice(0, 3).map((f, i) => `${i + 1}. **${f.where}** — ${f.cause} ${f.fix}`)
    : [
        '1. Check the agent status panel: an empty week is more often a collection failure than a quiet market.',
        '2. Review the per-query yield table in the dashboard — it shows which searches returned nothing.',
        '3. Re-run the pipeline manually before treating this as a true read on the market.',
      ];

  return `# Signal Bureau — Week of ${weekLabel}

## This Week's Headline
No signals cleared verification this week.

${CATEGORIES.map(({ heading }) => `## ${heading} (0 signals)\nNo signals this week.`).join('\n\n')}

## Connections Worth Noting
None — nothing to connect.

## Recommended Actions This Week
${actions.join('\n')}
`;
}
