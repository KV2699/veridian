# Signal Bureau — session handover

**Written:** 3 October 2026 · **Updated:** 23 October 2026
**Deadline:** 30 October 2026, 17:00 UTC
**Competition:** Nebius × NVIDIA Global AI Hackathon — **Best Apps and Agents track**

> **Track changed 23 October**, from Personal AI. Personal AI names a specific
> stack (NemoClaw, OpenShell, Hermes Agent) that this does not use. Best Apps
> and Agents asks for *"a workflow that runs itself"*, Ultra for reasoning with
> Nano/Super for the fast calls, and Serverless Jobs for background processing
> — which is this system, four for four. Verified against the live Devpost page
> on 23 October, not assumed from the brief.

---

## Read these two first

| | |
|---|---|
| [HACKATHON-FOR-DUMMIES.md](HACKATHON-FOR-DUMMIES.md) | The whole system in plain English — what it is, how it works, what is tested, what it costs, what is left. **Kept current after every batch of changes.** |
| [PITFALLS-AND-LESSONS.md](PITFALLS-AND-LESSONS.md) | Everything that went wrong, what it cost, how it was found, and the rule that prevents it recurring. Same update cadence. |

---

## 0. What changed on 23 October — read this first

**Two configurations now ship, and the engine is genuinely market-agnostic.**

| | |
|---|---|
| New profile | `exec-search` — ESG & sustainability executive search. The polarity INVERSE of `nvidia` |
| Data | Now `data/<profile>/` — separate register, signal log, briefings, rejection log per configuration |
| Selection | Dashboard dropdown, `?profile=<key>` on any API route, `PROFILE=` for the default |
| New in the engine | Rejection log (every drop, with a reason code) and counter-reading (the argument against a kept lead) |
| Tests | 12 → **14 files** |

**Six places hardcoded the AI infrastructure market outside the profile** and
had to be fixed before a second configuration could work at all: the system
prompts in `collector-base.js`, `qa-verifier.js` and `briefing-writer.js`, the
query suffixes in `roster-sweep.js` and `account-watch.js`, and the CPV codes
in `collector-tenders.js`. None of these would have thrown — a second profile
would have loaded fine and been extracted by a model told it was reading GPU
news. They are now `profile.market`, `profile.reader`, `profile.sweepTerms`
and `profile.tenders.cpvPrefixes`.

**A seventh was found by running it.** The Feed Collector never received the
profile's polarity, and its prompt declared a `relevance_score` field without
ever defining what the number meant. So the model returned 0 for everything.

Checked against the live log rather than assumed — and the real behaviour is
more interesting than "they were dropped". All four feed signals in the last
`nvidia` run carry `collector_score` **0 or 1** and a verified score of **7-8**:
they survived only because Nemotron Ultra independently rescored them at
verification. The collector's own score was meaningless on that path, so any
feed signal Ultra did not happen to rescue was lost at the floor — which is
consistent with feeds yielding just **4 signals of 110** from eight sources.

Fixed by sending the polarity and defining the score. The result is the best
demo material in the project:

| Headline, same feed, same day | Before the fix | After the fix |
|---|---|---|
| *Disney's sustainability co-lead leaves the company* | scored **0** — below the floor, surviving only if Ultra rescued it | scored **9** — the strongest signal type this configuration has |
| *Ingka Group appoints a Chief Sustainability Officer* | kept as a signal | **discarded at extraction** — a filled role is a lost mandate |

That is the polarity engine working on real published content, with zero
Tavily credits spent, and it is reproducible: `node tools/feed-check.mjs exec-search`.

The `nvidia` path gained as much: a feed-only check after the fix returned **13
signals from 178 items, scored 2 to 9** — a 960MW Amazon nuclear agreement at
9, a conference keynote at 2 — where it previously scored everything 0 or 1.

**Not fixed, worth doing:** 144 of those 178 items passed the `nvidia`
profile's feed term filter. That is far too loose — one extraction call per
four items — and the filter is free to tighten. `exec-search` passed 11 of 145
because its terms are weighted to movement words (steps down, promoted,
recruit) rather than topic words.

---

## 0.1 THE BLOCKER — Tavily credits

Queried from the account on 23 October:

```
plan: Researcher (free) · plan_limit: 1000 · plan_usage: 974 · paygo: not enabled
```

**26 credits left. A full `nvidia` run costs 112** (56 searches × 2 for
`advanced` depth: 31 collector + 7 regulator + 15 roster-sweep + 3 account
watch). The free plan resets on the **1st of the month — 1 November, two days
after the deadline.**

**The fix is Pay-As-You-Go at $0.008/credit: a full run is ~$0.90, and 1,000
credits is $8.** Nebius is not the constraint — at published rates (Ultra
$1/$3, Super $0.30/$0.90 per M tokens) a full run's inference is well under a
dollar. Until PAYG is enabled, work on the free paths: `tools/feed-check.mjs`,
`npm run pipeline:resume`, `npm run pipeline:dry`.

---

## 1. Current state

Working, running end to end on live data, committed clean.

| | |
|---|---|
| Configurations | **2** — `nvidia` (live data, 165 orgs) and `exec-search` (new, register empty) |
| Agents | **12** per configuration |
| Tests | **14 files, all passing** (`npm test`, no API keys needed) |
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
- [x] Track identified — **Best Apps and Agents** (switched 23 Oct, verified against the live Devpost page)
- [ ] **Feedback on Nebius/NVIDIA tooling** — required, and there is unusually strong material: the Lightning no-answer behaviour, empty-200 throttling, and truncation handling are all measured and reproducible
- [ ] Devpost written description
- [ ] **Deployment — Nebius Serverless**, not Vercel: Endpoint for the dashboard/API, Job for the weekly pipeline. The track text names both, and criterion 1 asks how effectively the project uses Nebius
- [ ] **Enable Tavily Pay-As-You-Go** — see section 0.1. Nothing can be run live until this is done

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

## 8. What happened, and when

The full record is in [CHANGELOG.md](CHANGELOG.md) — read it before changing
anything in section 3, because almost every decision there was forced by a live
run rather than chosen on design grounds.

The one-line version: **nothing important in this system was found by reading
code.** The first live run returned 182 search hits and zero signals. The
verification stage silently discarded 46 of 79 verdicts while reporting success.
The register went backwards by 45 organisations with no error anywhere. NVIDIA
appeared in its own prospect list. Every one of those surfaced only by running
it and looking at the output.

**Two sessions have worked this repo concurrently.** History is linear and
nothing has been lost, but the register data loss was caused by exactly that,
and the run lock in section 3 exists because of it. If a second session is
active, check `git log` before editing shared files — `profiles/nvidia.js` and
`collector-base.js` are the contended ones.

---

## 9. Context worth carrying

This is a rebuild of the user's **BD Horizon Scanner** — a seven-subagent Claude Code pipeline for a different market. The prior-work declaration is in the README and must stay.

The user is Signal Bureau and owns the methodology. Their own knowledge files (`../GA-BD-Pitfalls-Blockers.md`, `../GA-BD-Lessons-Learned.md`, `../GA-BD-Tool-Performance.md`, `../Acre BD tracker/Acre_BD_Prompt_Pack_v3.md`) are the authoritative source for *why* the architecture is shaped this way. Several bugs found this session are documented pitfalls from those files reappearing in new code.

**The recurring lesson, twice over:** the thing that breaks the system is always something no onboarding form could ask. First signal polarity (the same event means opposite things to different businesses), then the value factor (the right metric depends on revenue concentration). The pipeline is generic; the judgement is not, and the profile is where the judgement lives.
