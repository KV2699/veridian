# Signal Bureau — build retrospective

**Session:** 1–3 October 2026 · **Subject:** rebuild of the BD Horizon Scanner on Nebius Token Factory + NVIDIA Nemotron + Tavily

**How this differs from its companions:** `CHANGELOG.md` records *what changed and when*. `HANDOVER.md` records *current state and standing decisions*. This file records *what was learned* — the measurements taken, the failures found, and which of them generalise beyond this project.

Written in the house style of `GA-BD-Pitfalls-Blockers.md` and `GA-BD-Lessons-Learned.md`: a pattern earns a place here only if it was observed, not theorised.

---

## 1. Metrics

### Measured, not assumed

**Nemotron model comparison** — identical extraction task, 8 search results, JSON output required:

| Model | Time | Output tokens | Returned valid JSON |
|---|---|---|---|
| `Nemotron-3_5-Lightning` | 25.9s | 2000 *(budget exhausted)* | **No** — never reached an answer |
| `NVIDIA-Nemotron-3-Nano-30B-A3B` | 2.5s | 458 | Yes |
| `nemotron-3-super-120b-a12b` | 2.6s | **406** | Yes |
| `Nemotron-3-Ultra-550b-a55b` | 1.0s | 238 | Yes |

Selected: **Super-120B** for extraction, **Ultra-550B** for verification and synthesis.

### Scoring distribution — before and after the value-factor change

| | Before | After |
|---|---|---|
| Distinct score values | **2** (45, 55) | **11** (30–90) |
| Critical | 0 | 16 |
| High | — | 29 |
| Medium | — | 16 |
| Top-5 breakdowns | All identical | All distinct |

A 2GW datacentre campus and a 4.5MW site scored identically before the change.

### Verification coverage

| | Before truncation fix | After |
|---|---|---|
| Verdicts returned | 33 of 79 (**42%**) | 79 of 79 (**100%**) |
| Signals dropped below floor | 5 | 21 |
| Run outcome reported | "success" | success |

The 42% run reported success. That is the part worth remembering.

### Yield funnel — progression across live runs

| Run | Searches | Hits | Extracted | Verified | Outcome |
|---|---|---|---|---|---|
| 1 | 19 | 182 | **0** | 0 | Model never answered |
| 2 | 19 | 182 | 0 | 0 | Parser took narration over payload |
| 3–5 | 19 | ~186 | — | — | Throttling / truncation |
| 6 | 19 | 186 | 76 | 58 | First complete run |
| 7 | 19 | 182 | 80 | 45 | Grounding added |
| 8 | 19 | 182 | 84 | **61** | Value factor fixed |

### Cost of a failed run

| | |
|---|---|
| Full collection | ~6–19 minutes, ~40 Tavily credits |
| Resume from checkpoint | **66 seconds**, 0 credits |

Checkpointing collection before verification turned a six-minute retry into a one-minute one.

### Test coverage

| | Start | End of session |
|---|---|---|
| Test files | 0 | **10** |
| Assertions | 0 | ~70 |
| API keys required | — | **None** |

---

## 2. Pitfalls

Each entry: what happened, why, what it cost, what now prevents it.

### P1 — A reasoning model that never answers
**Observed:** 182 search results produced 0 signals across two full runs.
**Cause:** `Nemotron-3_5-Lightning` narrates before answering and exhausts `max_tokens` mid-thought. `response_format: json_object` did not prevent it.
**Cost:** Two complete runs, ~12 minutes, ~80 Tavily credits.
**Prevented by:** Model chosen by measurement, not by name. `npm run verify` checks the configured model live.

### P2 — The parser preferred narration to payload
**Observed:** `Unexpected token 'N', "[News]" is not valid JSON`.
**Cause:** The extractor took the *first* bracket it found. Reasoning prose is full of brackets.
**Fix:** Scan every balanced candidate; prefer one carrying the expected key. Plus a repair pass that hands an unparseable reply back for JSON-only reformatting.
**Covered by:** `test/json-extract.test.mjs` — 11 cases drawn from real failures.

### P3 — Throttling disguised as a model fault
**Observed:** Exactly five empty completions in lockstep, matching five concurrent collectors.
**Cause:** Nebius throttles by returning **HTTP 200 with an empty body**, not 429.
**Fix:** `NEBIUS_CONCURRENCY=2` semaphore, jittered retries, and an error message that names throttling vs budget exhaustion as separate causes.

### P4 — Truncated output silently accepted *(most dangerous)*
**Observed:** 46 of 79 verification verdicts missing. Run reported success.
**Cause:** A truncated reply still contains a smaller well-formed fragment. A lenient parser accepts it as the whole answer.
**Consequence:** Those signals kept collector scores with no practice-area correction, no scale correction, no dedup — and nothing said so.
**Fix:** `finish_reason=length` is refused outright. Verification chunks at 20 and halves adaptively on truncation.

### P5 — The source did not support the claim
**Observed, in a finished briefing:**

| Claim | Actual source |
|---|---|
| "Oak Ridge building AI supercomputers" | Facebook post about a university physicist |
| "SK Telecom announced 15GW buildout" | Article about an unrelated HPE launch |
| "Meta signed a 650-MW solar contract" | LinkedIn post about energy demand |

**Cause:** The URL guard proved the link came from Tavily. It never proved the link said this.
**Fix:** Grounding check — organisation absent from the source entirely → **dropped**.
**Matches:** `GA-BD-Pitfalls-Blockers.md` §11 (speaker conflated with subject).

### P6 — "Mentioned" is not "about"
**Observed:** After P5's fix, 2 of the top 5 signals still misattributed.
**Cause:** A long article mentions many companies. The check passed on any occurrence anywhere in the body.
**Fix:** Three tiers — absent → dropped; named only outside headline and lead → flagged; in headline or lead → passes.

### P7 — A scoring dimension that measured a constant
**Observed:** All top-five signals scored 55 with identical breakdowns.
**Cause:** 25 of 100 points asked *"could this customer buy more than one thing?"* — correct for a consultancy selling six services, meaningless for a vendor whose revenue sits in one line.
**Effect:** A 75-point scale pretending to be 100.
**Fix:** The value factor is now profile-defined. Default stays multi-service; NVIDIA uses deal scale.
**Matches:** `GA-BD-Pitfalls-Blockers.md` §5 and §10 (scoring inflation; invented algorithms).

### P8 — String length read as array length
**Observed:** `practice_areas: "compute"` scored the multi-service bonus.
**Cause:** `.length >= 2` on a string. `"compute".length === 7`.
**Found by:** A test, not by review.

### P9 — A malformed row poisoned its own URL
**Cause:** The dedup set marked a URL "seen" *before* validating the row, so a bad row suppressed a later valid signal from the same source.
**Fix:** Mark seen only after the row passes.

### P10 — Trend compared a week against itself
**Cause:** Re-running a week replaces its briefing, so the "previous" briefing was the same week. Delta always read `+0`.
**Fix:** Compare against the most recent *different* week.

### P11 — A placeholder key reported as configured
**Observed:** `/api/health` returned `tavily_key: true` while `.env` contained `your_tavily_key`.
**Cost:** One confusing failed run.
**Fix:** Health check distinguishes `set` / `missing` / `placeholder`; clients refuse placeholders by name.

### P12 — Smaller environment bugs
- CLI entry check used string concatenation for a file URL — broke on a path containing a space.
- Bar-chart fills were inline `<span>`s, so `width: %` was ignored and all bars rendered empty.

---

## 3. Successes

### S1 — Diagnostics earned their place on day one
Built to detect why a run finds nothing; immediately reported `19 searches → 182 hits → 0 extracted` and correctly located the failure **downstream of search**. Without it the natural assumption would have been "the queries are wrong" — and the queries were fine.

### S2 — Enforcement in code, not in prompts
Every rule that *can* be checked deterministically is. A fabricated URL cannot reach a briefing; a sub-threshold score cannot; a practice area the profile does not sell cannot. The model is asked only for judgement.

**This is the single largest upgrade over the predecessor**, which asked a model nicely and checked afterwards.

### S3 — Checkpointing collection
Collection is written to disk before verification runs. Retry cost fell from ~6 minutes and 40 credits to **66 seconds and nothing**. Paid for itself four times in one session.

### S4 — Tests without API keys
Agents accept an injected model client. Scripted replies exercise the score floor, dedup, clamping, grounding, roster matching, truncation and every diagnostic rule — with no network and no spend. **10 files, ~70 assertions.**

### S5 — Measuring instead of arguing
Four Nemotron models, one task, one table. Settled in two minutes what could have been an afternoon of speculation. The same method settled batch size and result caps.

### S6 — Profiles
All strategy — practice areas, polarity, roster, scoring, value factor — lives in one file per business. The pipeline never needed changing to serve a different market.

---

## 4. Lessons

### L1 — The thing that breaks the system is always what no form could ask
Twice in one session:
- **Signal polarity.** A new appointment is a lead for a vendor and a *lost mandate* for a recruiter. Same event, opposite meaning.
- **Value measure.** Breadth discriminates for a multi-service consultancy and measures nothing for a single-line vendor.

Neither is derivable from "what do you sell." **The pipeline is generic; the judgement is not.** This is the honest answer to "can this work for any business": it can, if a human answers a handful of questions a form cannot phrase.

### L2 — Truncation is more dangerous than failure
A failure stops. A truncated reply returns something plausible, passes a lenient parser, and reports success. **Partial output is worse than none**, because nothing downstream knows it is partial.

### L3 — A dimension that does not vary is dead weight
If a quarter of a scoring instrument returns the same answer every time, the scale is 75 points pretending to be 100. **Check the distribution of each factor, not just the total.**

### L4 — "The source exists" and "the source says this" are different claims
Verifying a URL came back from a search proves nothing about the sentence attached to it. A long article mentions many companies; only one is its subject.

### L5 — Tests caught what review did not
Three real bugs — string-length, URL poisoning, self-comparing trend — were found by writing adversarial cases, not by reading code. **Every test that failed first was a real defect**, not a wrong expectation. Two tests that failed *were* wrong expectations, and the code was right; being willing to check which is the whole value.

### L6 — Live data is the only validator
Everything passed in isolation. Five live runs failed five different ways: concurrency, real content length, real article structure, real score distribution. **Synthetic fixtures validate wiring, never behaviour.**

### L7 — A system that explains its own silence is rarer than one that finds things
An empty week and a quiet market look identical from outside. Reporting *where in the funnel* signals were lost — and naming the likely cause — turns a dead run into a diagnosis. This is the predecessor's Acre post-mortem, automated.

### L8 — Report failure honestly, in the product itself
A run that produces nothing writes the diagnosis into the briefing rather than presenting silence as a quiet market. Applies to this log too: the 42%-coverage run *reported success*, and that is the detail worth carrying forward.

---

## 5. Decisions and their evidence

| Decision | Evidence |
|---|---|
| Score computed in code, never by the model | Predecessor logged a model-invented algorithm a full band out |
| Value factor profile-defined | Scores collapsed to 2 values on a live week |
| `MODEL_FAST` must not reason heavily | Lightning: 0 signals from 182 hits |
| `NEBIUS_CONCURRENCY=2` | Five empty completions in lockstep |
| Refuse `finish_reason=length` | 46 of 79 verdicts silently lost |
| Extraction batch = 4 | Larger batches exhaust budget on real content |
| Grounding on subject, not mention | 2 of 5 top signals misattributed |
| Partner programmes are not a practice area | A route to a conversation is not a purchase; counting it inflated every score it touched |

---

## 6. Carried forward

**Unresolved at session end:**
- Critical tier never manually audited since the value-factor change
- Roster is a labelled demonstration list; instruction is to source ≥100 organisations from the register
- Regulator Sweep built but never run live
- Tender Collector yielded 1 result — under-sourced
- Cross-chunk dedup is URL-only

**Ruled out, with reasons:**
- **X/Twitter scraper** — ToS breach; paid API; and X's advantage is *people* signals, while this market's signals are *deal* signals announced through official channels
- **Cerebras** — direct NVIDIA competitor in an NVIDIA-sponsored competition; rules require running on Nebius

**Strongest material for the submission:** the tooling feedback. Lightning's non-answering, empty-200 throttling, and truncation handling are all measured and reproducible. Most entries will write "it was great"; this one can include a model comparison table.
