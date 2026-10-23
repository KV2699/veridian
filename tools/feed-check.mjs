// Feed-only validation run — ZERO Tavily credits.
//
// The feed path is the one half of collection that costs no search credits and
// cannot hallucinate a source: publisher-written headlines with their own urls
// and dates. That makes it the right way to prove a NEW profile works on real
// content before spending anything on search.
//
//   node tools/feed-check.mjs [profileKey]
//
// Costs: a few Nemotron Super calls for extraction. No Tavily.
import 'dotenv/config';
import collectFeeds from '../server/agents/collector-feeds.js';
import { loadProfile } from '../server/profiles/index.js';

const profile = loadProfile(process.argv[2] || process.env.PROFILE);
console.log(`\nFeed check — ${profile.name} (${profile.feeds?.sources?.length ?? 0} feeds, no Tavily)\n`);

const out = await collectFeeds({ profile }, { knownUrlKeys: new Set() });

console.log(`\n=== ${out.signals.length} SIGNALS ===`);
for (const s of out.signals) {
  console.log(`\n· ${s.company}  [${s.signal_type}]  ${s.date ?? 'undated'}  score ${s.relevance_score}`);
  console.log(`  ${s.summary}`);
  console.log(`  opens: ${(s.practice_areas ?? []).join(', ') || '(nothing — correct for background news)'}`);
  console.log(`  ${s.url}`);
}
const t = out.telemetry ?? {};
console.log(`\nfunnel: ${t.hits ?? 0} feed items → ${t.fresh ?? 0} on topic → ${out.signals.length} signals`
  + `${t.ungrounded ? ` · ${t.ungrounded} dropped as ungrounded` : ''}`);
