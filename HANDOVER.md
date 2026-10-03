# Signal Bureau — session handover

**Written:** 3 October 2026 · **Deadline:** 30 October 2026, 10:00 PDT
**Competition:** Nebius × NVIDIA Global AI Hackathon — Personal AI track

---

## 1. Current state

Working, running end to end on live data, committed clean.

| | |
|---|---|
| Agents | **12** |
| Tests | **10 files, all passing** (`npm test`, no API keys needed) |
| Last full run | 165 raw signals → **110 verified**, 1,978-word briefing, 1,133s |
| Band spread | 14 Critical · 62 High · 34 Medium · 0 Low |
| Organisation register | **169 organisations** accumulated |
| Working tree | Clean, 15 commits |

**Mandatory competition requirements — met:** runs on Nebius Token Factory; uses NVIDIA Nemotron (Ultra for verification and synthesis, Super for extraction). Tavily is the search layer (eligible for the separate $3,000 Tavily prize).

---

## 2. Architecture

```
1  Capital & Sovereign Collector      Tavily topic search
2  Infrastructure & Supply Collector  Tavily topic search
3  Competitive Displacement Collector Tavily topic search
4  Enterprise Opportunity Collector   Tavily topic search
5  Roster Sweep                       enumerated — walks the org list by name
6  Regulator Sweep                    enumerated — agent proven live, NOT YET IN A FULL RUN
7  Feed Collector                     RSS, 8 feeds
8  Tender Collector                   government procurement portals
9  Account Watch                      the roster you already hold
10 QA Verifier                        Nemotron Ultra — scores, dedups, flags
11 Briefing Writer                    Nemotron Ultra — writes the briefing
12 Dashboard Updater                  persistence, register, trend
```

Agents 1–9 run concurrently. 10 → 11 → 12 are strictly sequential. A collector that fails is logged and the run continues; 10, 11 and 12 are load-bearing.

**Key files**
- `server/profiles/nvidia.js` — all strategy: practice areas, polarity, roster, scoring, value factor
- `server/lib/score.js` — the four-factor algorithm, computed in code
- `server/lib/grounding.js` — does the source actually support the claim
- `server/lib/diagnostics.js` — why a run found nothing
- `server/lib/register.js` — the accumulating organisation register
- `tools/QUERY-FINDINGS.md` — live test results for 32 collector queries
- `CHANGELOG.md` — chronological record of every change and why

---

## 3. Decisions that must not be casually undone

Each of these was reached by measurement, not preference. Reversing one re-breaks something that took a live run to find.

**The priority score is computed in code, never by the model.** A model asked for a priority number invents its own weighting and reports it confidently. The model supplies inputs (practice areas, deal scale, org scale); `score.js` does the arithmetic.

**The 25-point value factor is profile-defined.** Original methodology measures *breadth* (could they buy more than one service). For NVIDIA, revenue is concentrated in one line, so breadth is constant and a quarter of the score measured nothing — scores collapsed onto two values, and a 2GW campus tied with a 4.5MW site. NVIDIA uses **deal scale** instead. Default remains multi-service for other profiles.

**`NEBIUS_MODEL_FAST` must not be a heavy reasoning model.** `Nemotron-3_5-Lightning` reasons until its token budget is gone and never answers — 182 search hits produced 0 signals. Measured all four: Nano-30B 2.5s/458 tokens, Super-120B 2.6s/406, Ultra 1.0s/238, Lightning 25.9s/budget exhausted. Currently on **Super-120B**.

**`NEBIUS_CONCURRENCY=2`.** Nebius throttles under load by returning **HTTP 200 with an empty body**, not a 429. Looks like a model fault, isn't.

**Truncated replies are refused outright.** `finish_reason=length` often still contains a smaller well-formed fragment that a lenient parser accepts as the whole answer — this silently lost 46 of 79 verification verdicts while reporting success. Verification chunks at 20 signals and halves adaptively on truncation.

**Grounding asks "is the article *about* this company", not "is it mentioned".** A long article mentions many companies; only one is its subject. Claims about SK Telecom and Meta survived the first version by appearing deep in articles about something else. Absent entirely → dropped. Mentioned only outside headline/lead → flagged.

**Extraction batches are small (4).** Larger batches push a reasoning model past its budget on real web content.

**30 days is a ceiling, not a preference — do not raise it.** Tavily holds the window at 30 but leaks badly beyond it. Confirmed twice, independently: an 84-day backfill produced signals dated a full year back, while the 30-day run produced a clean two-month range; a separate direct test of a 90-day request returned items from seven months earlier. Past 30 days the window stops widening coverage and starts contaminating it. The 7-day default it replaced came from the hackathon brief, not from evidence — the predecessor methodology swept 90 days, and discovery and urgency are separate questions anyway: the scoring already decays an older signal (25 points inside a week, 15 a month, 5 a quarter), so excluding it from search as well penalises it twice and loses the lead outright. A wide window also self-heals a missed run.

**`maxResults` is 10 normally, 30 on backfill — measured, not guessed.** One collector, noise domains already excluded, same queries and window:

| | signals | organisations | extraction batches | time |
|---|---|---|---|---|
| 10 per query | 33 | 27 | 19 | 396s |
| 20 per query | 41 | 33 | 32 | 555s |

The second ten results are about half as productive as the first — 0.9 signals per extra batch against 1.7 — for 47% more extraction and 40% more runtime, at **identical Tavily cost**. Worth paying while *building* the register, where every extra organisation counts; not worth it on a weekly refresh. Re-measure with `node tools/maxresults-ab.mjs` whenever the queries change.

**Noise domains are excluded at the search, not filtered later.** Market-research and stock-commentary sites produced no usable signal across all 32 collector queries, and every one of them otherwise has to be read by a model before it can be discarded. Kept deliberately short — an aggressive list cut one test query from ten results to one.

---

**Only one pipeline run at a time, enforced across processes.** `server/lib/lock.js`. This is not a nicety: two overlapping runs silently destroyed 45 organisations from the register — 123 down to 78 — with no error anywhere, because each merged its signals into the copy it had read and the last write won. The in-process `isRunning()` flag never covered a second process, so a manual run overlapping the Monday cron, or a run left alive by a closed session, was enough.

The lock checks pid liveness (a dead process's lock is reclaimable), times out after an hour (a crash cannot block runs forever), and refuses to delete a lock another run has since taken. **If a run is refused with `LOCKED`, that is working as intended — find the other run, do not delete `data/.pipeline.lock`.** Covered by `test/lock.test.mjs`.

---

## 4. Open issues

| Issue | Severity | Note |
|---|---|---|
| **Regulator Sweep not yet in a full pipeline run** | Medium | The agent HAS been run live standalone and works — 3 obligations from 59 publications, including a mandated EuroHPC AI supercomputer procurement. What is unproven is the integration: no `regulatory` signals have reached the register yet |
| **Tender Collector yield is 1** | High | Only 2 procurement sources configured. This is the feature the deadline-tracking work depends on |
| **Roster is a demonstration list** | High | 12 publicly-announced NVIDIA ecosystem companies, clearly labelled in the profile. User has no access to a real client list (hackathon entry). **User's instruction: the roster should be ≥100 organisations sourced by the system itself** — the 169-org register is the obvious source, needs promoting |
| **Critical tier needs spot-checking** | Medium | Scoring discriminates now, but top-band entries have not been manually audited since the value-factor change |
| **Run takes ~19 minutes** | Medium | Concurrency 2 is the cost of not being throttled. Fine for cron, slow for a demo — use `npm run pipeline:resume` when filming |
| **Cross-chunk dedup is URL-only** | Low | Verification chunks at 20; same event under two URLs across chunks can survive |

---

## 5. Pending work (user's latest instructions, not started)

Agreed scope, roughly a day, then **stop building and make the video**:

1. **Expand procurement + RSS** — "government procurement portals, rss feed needs to be incorporated and tested". Partly built, under-sourced, Tender Collector returning 1 result.
2. **Roster of ≥100 sourced organisations** — promote from the 169-org register rather than hand-writing a list.
3. **Route-to-market + buyer map** — every lead should name a door (Inception, channel, cloud partner, direct, event) and a role to approach. This is the Suggested Entry Point / contact hierarchy from the predecessor system, currently missing.
4. **Rejection log** — verifier drops are currently discarded, so a rejected org can return next week and be re-judged from scratch. Strongest available evidence for the track's "persistent memory" requirement.
5. **Deadline tracking** — signals carrying a future date (tender close, renewal, framework expiry) should be diarised and counted down weekly, not reported once and forgotten.

**Explicitly ruled out:** Twitter/X scraper (ToS breach, paid API, and X's edge is *people* signals — this market's signals are *deal* signals that come through official channels). **Cerebras** (direct NVIDIA competitor in an NVIDIA-sponsored competition; rules require running on Nebius).

---

## 6. Submission checklist

- [x] Runs on Nebius Token Factory
- [x] Uses an NVIDIA open-source model
- [x] Public open-source repo with MIT licence — *local only, not yet pushed to GitHub*
- [x] Working build
- [ ] **Public YouTube demo under 3 minutes**
- [x] Track identified — Personal AI
- [ ] **Feedback on Nebius/NVIDIA tooling** — required, and there is unusually strong material: the Lightning no-answer behaviour, empty-200 throttling, and truncation handling are all measured and reproducible
- [ ] Devpost written description
- [ ] Deployment (Vercel — set `CRON_ENABLED=false` and use Vercel Cron to POST `/api/run`)

**Demo advice from review feedback, endorsed:** lead with the *diagnostic story* — how the measurement failure was caught — not just the final scores. That is what demonstrates the system works.

---

## 7. Running it

```bash
npm test               # 10 files, no API keys needed
npm run models         # verify Nemotron model IDs against the account
npm run verify         # live Nebius check, no Tavily calls
npm run pipeline       # full run (~19 min)
npm run pipeline:resume# reuse last collection, skip searching (~2 min)
npm run pipeline:dry   # fixtures, zero API calls
npm run query          # query lab — test collector queries in isolation
npm start              # server + Monday 07:00 UTC scheduler
```

```bash
node tools/query-lab.mjs        # test individual collector queries in isolation
node tools/maxresults-ab.mjs    # re-measure the maxResults trade-off
```

Collection is checkpointed to `data/last_collection.json` before verification runs, so a downstream failure costs seconds to retry rather than 19 minutes and a set of Tavily credits.

**Benchmarking against other tools:** `benchmark/README.md` holds four copy-paste prompts for testing Gemini, Grok, Perplexity, DeepSeek or Kimi head-to-head — discovery, hard mode (find what this system missed, with the known organisations supplied as exclusions), open procurement, and a verification test. `benchmark/baseline-organisations.txt` is the list to diff against. Score on **corrected yield** (actionable leads × source accuracy), never raw count — ranking on volume is how you adopt the tool that generates the most correction work.

---

## 8. Change log — what happened, in order

Every entry below was a live-run discovery, not a design decision. The pattern is worth noticing: almost nothing here was found by reading code.

| Commit | Change | Why it happened |
|---|---|---|
| `7ab9544` | Initial seven-agent pipeline | Built to the brief |
| `fa90a70` | Profiles, Account Watch, yield diagnostics | Target market became a config file; Account Watch filled the predecessor system's own documented biggest gap (nothing swept existing relationships) |
| `be29216` | Practice areas, multi-service scoring; extraction fixes | **First live run: 182 search hits → 0 signals.** `Nemotron-3_5-Lightning` reasons until its budget is gone and never answers. Measured all four Nemotron models and switched. Also found Nebius throttles with empty HTTP 200s under concurrency |
| `943648f` | Grounding checks | Top-five leads included a national-laboratory claim sourced to a Facebook post about a university physicist. The URL guard proved the link existed; nothing proved the link said this |
| `386c009` | Refuse truncated replies; adaptive chunking | Verification silently lost 46 of 79 verdicts — a truncated reply contained a smaller valid fragment the parser accepted as the whole answer, and the run reported success |
| `919bc7a` | Profile-defined value factor; grounding by subject | Scores collapsed onto two values; a 2GW campus tied with a 4.5MW site. Breadth measures nothing when revenue sits in one line. Grounding tightened from "is the company mentioned" to "is the article about them" |
| `baf4353` | RSS feeds, procurement portals, organisation register | The system was handed a roster; it now sources its own |
| `cd83c47` | Exclusions enforced, acronyms merged, backfill mode | **NVIDIA was in its own prospect list** — the profile had declared exclusions from the start and nothing read them |
| `7c630a8` | Benchmark prompts | For testing other tools head-to-head |
| `eeb3f9f` `3928179` `7ce93a4` | Roster Sweep, Regulator Sweep, Query Lab | Enumeration instead of topic search only; 32 queries tested live, 72% usable |
| `ffa2282` | Roster Sweep, 30-day windows, cross-process lock | **The register went backwards, 123 → 78, silently.** Two overlapping runs |
| `97170c7` | maxResults settled by measurement | Resolved a disagreement between two sessions with an A/B rather than an argument |

**Two sessions have been working this repo concurrently.** History is linear and nothing was lost, but the register data loss above was caused by it. The lock now prevents a recurrence.

---

## 9. Context worth carrying

This is a rebuild of the user's **BD Horizon Scanner** — a seven-subagent Claude Code pipeline for a different market. The prior-work declaration is in the README and must stay.

The user is Signal Bureau and owns the methodology. Their own knowledge files (`../GA-BD-Pitfalls-Blockers.md`, `../GA-BD-Lessons-Learned.md`, `../GA-BD-Tool-Performance.md`, `../Acre BD tracker/Acre_BD_Prompt_Pack_v3.md`) are the authoritative source for *why* the architecture is shaped this way. Several bugs found this session are documented pitfalls from those files reappearing in new code.

**The recurring lesson, twice over:** the thing that breaks the system is always something no onboarding form could ask. First signal polarity (the same event means opposite things to different businesses), then the value factor (the right metric depends on revenue concentration). The pipeline is generic; the judgement is not, and the profile is where the judgement lives.
