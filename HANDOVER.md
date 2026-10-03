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
6  Regulator Sweep                    enumerated — ⚠ NOT YET RUN LIVE
7  Feed Collector                     RSS, 12 feeds
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

---

## 4. Open issues

| Issue | Severity | Note |
|---|---|---|
| **Regulator Sweep never run live** | High | Agent 6 exists, untested against real data |
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

Collection is checkpointed to `data/last_collection.json` before verification runs, so a downstream failure costs seconds to retry rather than 19 minutes and a set of Tavily credits.

---

## 8. Context worth carrying

This is a rebuild of the user's **BD Horizon Scanner** — a seven-subagent Claude Code pipeline for a different market. The prior-work declaration is in the README and must stay.

The user is Signal Bureau and owns the methodology. Their own knowledge files (`../GA-BD-Pitfalls-Blockers.md`, `../GA-BD-Lessons-Learned.md`, `../GA-BD-Tool-Performance.md`, `../Acre BD tracker/Acre_BD_Prompt_Pack_v3.md`) are the authoritative source for *why* the architecture is shaped this way. Several bugs found this session are documented pitfalls from those files reappearing in new code.

**The recurring lesson, twice over:** the thing that breaks the system is always something no onboarding form could ask. First signal polarity (the same event means opposite things to different businesses), then the value factor (the right metric depends on revenue concentration). The pipeline is generic; the judgement is not, and the profile is where the judgement lives.
