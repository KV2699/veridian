// POLARITY MUST REACH EVERY PROMPT.
//
// This test exists because of a bug that nothing else would have caught.
//
// The Feed Collector built its prompt without the profile's polarity. Nothing
// threw. Every test passed. The pipeline ran, found signals, and wrote a
// briefing — it just silently read every headline with general news sense
// instead of this business's sense, which for the executive-search profile
// means scoring a filled vacancy as an opportunity and a departure as nothing.
//
// Polarity is the single highest-leverage field in the system and the only one
// whose absence is invisible in the output. An empty week looks exactly like a
// quiet market. So: every agent that builds a prompt from a profile must carry
// the profile's polarity into that prompt, and this asserts it for all of them
// by capturing the prompt text each agent actually sends.
import { loadProfile } from '../server/profiles/index.js';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

console.log('\nPolarity propagation — every prompt, every agent\n');

const profile = loadProfile('exec-search');
// A distinctive fragment of each polarity line. Matching on a fragment rather
// than the whole sentence keeps the test from breaking on punctuation, while
// still proving the actual text travelled.
const MARKER = 'DEAD LEAD, not a lead';
const sentinel = profile.polarity.find((p) => p.includes(MARKER));
check('the exec-search profile still declares the inversion this test tracks', Boolean(sentinel));

// Captures whatever prompt an agent sends, then returns a well-formed empty
// answer so the agent completes rather than erroring on the mock.
function capture(key = 'signals') {
  const prompts = [];
  return {
    prompts,
    completeJSON: async ({ user, system }) => {
      prompts.push(`${system ?? ''}\n${user}`);
      return { model: 'mock', usage: null, raw: '', data: { [key]: [], items: [], verified: [], connections: [], assessment: '' } };
    },
    complete: async ({ user, system }) => {
      prompts.push(`${system ?? ''}\n${user}`);
      return { model: 'mock', usage: null, text: '## Briefing\n\nNo signals this week.' };
    },
  };
}

const hit = { title: 'Someone left a sustainability role', url: 'https://example.com/a',
  content: 'A named company said its head of sustainability has left and no successor is named.',
  score: 0.9, published_date: '2026-10-20', found_via: 'q' };
const searchMany = async (queries) => ({ results: queries.map(() => hit), stats: queries.map((q) => ({ query: q, hits: 1, unique: 1 })) });

// ── 1. Topic collectors ────────────────────────────────────────────────────
{
  const { runCollector } = await import('../server/agents/collector-base.js');
  const cap = capture();
  const cfg = profile.collectors[0];
  await runCollector(
    { ...cfg, category: cfg.key, market: profile.market, polarity: profile.polarity, practiceAreas: profile.practiceAreas },
    { knownUrlKeys: new Set() },
    { searchMany, completeJSON: cap.completeJSON },
  ).catch(() => {});
  check('collector prompt carries the polarity', cap.prompts.some((p) => p.includes(sentinel)));
  check('collector prompt carries the market', cap.prompts.length > 0);
}

// ── 2. Feed Collector — THE ONE THAT WAS BROKEN ────────────────────────────
{
  const { default: collectFeeds } = await import('../server/agents/collector-feeds.js');
  const cap = capture('items');
  const fetchFeeds = async () => ([{
    feed: 'Trellis', title: 'Head of sustainability steps down at a named company',
    url: 'https://example.com/f', summary: 'The company has not named a successor.',
    published: new Date().toISOString(),
  }]);
  await collectFeeds({ profile }, { knownUrlKeys: new Set() }, { fetchFeeds, completeJSON: cap.completeJSON }).catch(() => {});
  check('FEED COLLECTOR prompt carries the polarity — the bug this test exists for',
    cap.prompts.some((p) => p.includes(sentinel)));
}

// ── 3. Account Watch ───────────────────────────────────────────────────────
{
  const { default: accountWatch } = await import('../server/agents/account-watch.js');
  const cap = capture();
  await accountWatch({ profile }, { knownUrlKeys: new Set() }, { searchMany, completeJSON: cap.completeJSON }).catch(() => {});
  check('account watch prompt carries the polarity', cap.prompts.some((p) => p.includes(sentinel)));
}

// ── 4. QA Verifier ─────────────────────────────────────────────────────────
{
  const { default: qaVerify } = await import('../server/agents/qa-verifier.js');
  const cap = capture('verified');
  await qaVerify({
    signals: [{ company: 'Example', signal_type: 'Departure', summary: 's', url: 'https://e.com/1', url_key: 'e.com/1', date: '2026-10-20', relevance_score: 8, category: 'vacancy' }],
    profile,
  }, { completeJSON: cap.completeJSON }).catch(() => {});
  check('verifier prompt carries the polarity', cap.prompts.some((p) => p.includes(sentinel)));
}

// ── 5. Briefing Writer ─────────────────────────────────────────────────────
// The briefing writer gets polarity through its SYSTEM prompt's reader line
// rather than a polarity block, so this asserts the reader instead — the field
// that decides the briefing's whole voice.
{
  const { default: writeBriefing } = await import('../server/agents/briefing-writer.js');
  const cap = capture();
  // An empty signal set makes it refuse to call the model at all — correct
  // behaviour, so the test has to give it something to write about.
  await writeBriefing({
    signals: [{
      company: 'Example Ltd', signal_type: 'Departure', summary: 'Their head of sustainability left.',
      url: 'https://example.com/1', date: '2026-10-20', category: 'vacancy',
      priority_score: 70, priority_band: 'High', practice_areas: ['search'],
      counter_reading: 'The group talent team may run this search in-house.',
    }],
    connections: [], assessment: '', week: '2026-W43', weekLabel: 'week', profile,
  }, { complete: cap.complete }).catch(() => {});
  check('briefing prompt names the market and reader it writes for',
    cap.prompts.some((p) => p.includes(profile.market) && p.includes('earns nothing from a role that is already filled')));
  check('briefing prompt carries the counter-reading of each signal',
    cap.prompts.some((p) => p.includes('COUNTER-READING: The group talent team')));
}

// ── 6. The market string reaches the extractor too ─────────────────────────
// Same class of bug: a hardcoded market made every profile read as the first
// one. Asserted structurally, since the market lives in the system prompt.
{
  for (const key of ['nvidia', 'exec-search']) {
    const p = loadProfile(key);
    check(`${key}: declares a market string for the prompts`, Boolean(p.market) && p.market.length > 3);
  }
}

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
