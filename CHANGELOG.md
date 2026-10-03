# Signal Bureau — change log

Chronological record of every change, with the reason. Written for a fork
session picking this up cold. Companion to `HANDOVER.md`, which covers current
state and standing decisions; this covers **how it got here and what each
change cost to learn**.

Two parallel Claude Code sessions worked on this repo on 2–3 October. Both
committed to the same branch. Everything merged cleanly; nothing was lost
except where noted.

---

## 1 October — the build

### `7ab9544` Initial build — seven agents
Brief: a seven-agent BD pipeline on Nebius Token Factory using NVIDIA Nemotron,
with Tavily for search, an Express dashboard and a Monday scheduler.

Built as specified, with three deliberate departures:
- **No model ID hardcoded.** The brief named `nvidia/llama-3.1-nemotron-70b-instruct`.
  That model does not exist on this account. `npm run models` was added to
  verify IDs against the live account — it caught the error before the first run.
- **`POST /api/run` returns 202 and runs in the background**, so the dashboard
  can poll agent status live rather than hanging for minutes.
- **Collectors run concurrently** — they share no state.

### `fa90a70` Profiles, Account Watch, yield diagnostics
- **Profiles** make the target market a config file: roster, queries, decay
  windows, scoring guidance, and signal **polarity**.
- **Account Watch** sweeps organisations you already hold. The predecessor
  system's own post-mortem named this as its biggest methodology gap; the
  rebuild had reintroduced it.
- **Yield diagnostics** name *why* a run found nothing — query wording, signal
  definition, target universe, scoring inflation, source concentration. Built
  because a clean run returning nothing looks identical to a quiet market.

### `be29216` Practice areas, multi-service scoring, extraction reliability
User caught a real gap: the original algorithm scores **Practice Area Fit (30)**
and **Multi-Service Potential (25)** — 55 of 100 points — and neither was
captured.

- Priority score now **computed in code**, never taken from the model.
- Measured all four Nemotron models on the same task:

  | Model | Time | Output tokens | Clean JSON |
  |---|---|---|---|
  | Lightning | 25.9s | 2000 (budget exhausted) | ✗ never answers |
  | Nano-30B | 2.5s | 458 | ✓ |
  | Super-120B | 2.6s | 406 | ✓ |
  | Ultra-550B | 1.0s | 238 | ✓ |

- `extractJSON` now scans every balanced candidate and prefers the one carrying
  the expected key, so narration containing `[News]` cannot beat the payload.
- Added a repair pass for unparseable replies.
- **Nebius throttles under concurrency by returning HTTP 200 with an empty
  body**, not a 429. Added a concurrency limiter and jittered retries.

### `943648f` Grounding — does the source support the claim?
The URL guard proved a signal's URL came from Tavily. It did not prove the URL
*supports* the claim. A live run produced:

- *"Oak Ridge National Laboratory is building AI supercomputers"* → sourced to a
  **Facebook post about a university physicist**
- *"SK Telecom announced a 15GW buildout"* → sourced to an article about an
  **unrelated HPE launch**

Both URLs were real and in the search results. The model had read a passing
mention and attached the claim to the nearest result.

Now: company absent from source → **dropped**. Figures absent → flagged.
Social and stock-commentary domains marked weak.

### `386c009` Refuse truncated replies; adaptive verification chunks
A truncated reply often still contains a smaller well-formed fragment, which a
lenient parser accepts as the whole answer. **This silently lost 46 of 79
verification verdicts while the run reported success.** Verdict coverage went
from 42% to 100%.

---

## 1 October — the measurement failure

### `919bc7a` Profile-defined value factor; grounding tightened to subject
The most important change in the project.

Scores had collapsed onto two values (45 and 55) and a **2GW datacentre campus
scored identically to a 4.5MW site**. Cause: 25 of 100 points measured "could
this customer buy more than one thing from us" — the right question for a
consultancy selling six services, a constant for a vendor whose revenue sits in
one line. A quarter of the instrument measured nothing.

The 25-point factor is now **profile-defined**. Default stays multi-service.
NVIDIA uses **deal scale**, graded only on figures the source states.

Result: 11 distinct scores (30–90) replacing 2; a proper band pyramid.

Grounding also tightened from *"is the company mentioned"* to *"is the article
**about** them"*. Two claims had survived the first version by appearing deep in
articles about something else.

**Bug worth remembering:** the multi-service check read string length, so
`practice_areas` arriving as the text `"compute"` counted as seven areas.

---

## 2 October — sources, scale, and the register

### `baf4353` RSS feeds, government procurement, organisation register
The system was handed a roster and asked to watch it. It now sources its own.

- **Organisation register** (`data/organisations.json`) — deduplicated, scored,
  accumulating. Carries weeks-tracked and the union of practice areas across
  weeks, so an organisation that opened compute one week and software another
  shows as a cross-sell no single week could see. This is Tab 2 from the
  predecessor tracker.
- **Feed Collector** — 8 RSS/Atom sources, dependency-free parsing. The
  zero-hallucination path: the publisher wrote the headline, so the model only
  classifies and never supplies a fact.
- **Tender Collector** — UK Find a Tender and Contracts Finder, OCDS JSON,
  keyless. **Bug found:** the first version returned contracts that closed in
  July as live opportunities, because portals publish the whole lifecycle and an
  award notice is competitive intelligence, not a lead.

### `cd83c47` Exclusions enforced, acronyms merged, backfill mode
**NVIDIA was in its own prospect list.** The profile had declared an
`exclusions` list from the start and nothing was reading it.

Also: `AWS`/`Amazon Web Services` registered as two organisations;
`"OpenAI / SB Energy / NVIDIA"` stored as one company.

`BACKFILL` mode widens every window for a single run — a tracker has to be
populated before it can be maintained. Query sets doubled to eight per
collector. **Result: 100 organisations sourced, no seed list supplied.**

### `7c630a8` Benchmark prompts
Four copy-paste prompts plus a scoring sheet for testing other tools head to
head: discovery, hard-mode (with the known 100 excluded), open procurement, and
verification. Scores on **corrected yield** (actionable × source accuracy),
never raw count — the mistake that makes the most expensive tool look best.

### `eeb3f9f` Roster Sweep — enumerate, don't just search
User's critique, and it was correct: **this system searched; the predecessor
trackers swept.**

A topic search registers whatever comes back and has no idea what it did not
look at, so a quiet organisation and an unchecked one are indistinguishable. A
sweep walks a **named list** and returns a result for every name, including
"no signal found". Coverage becomes auditable.

The system had been built against its own documented principles —
`GLOBAL_PRINCIPLES.md` says *"explicit and named, not inferred"* and
*"running + grand totals required at end"*.

The list is the register itself, closing the loop between output and input.
**A failed batch is never recorded as quiet** — those names were not checked.

Live: 21 signals across 83 organisations checked, 62 quiet.

### `3928179` Regulator Sweep and Query Lab; window-leak guard
**Regulator Sweep** — obligations, not opinions. Every other collector finds
organisations that *might* buy; this finds organisations that have been *told*
to act, with a deadline. First run was pointed at AI-governance regulators and
returned seven EU AI Act duties on bodies like "Member States" — all real, none
a reason to buy compute. Repointed at grid connection, siting and export
control, which is what actually gates this market.

**Query Lab** (`npm run query`) — run a query live, see what a collector would
be handed, before any model reads it. Tavily credits only.

**Measured: Tavily leaks its own date filter at wide windows.**

| Requested | Oldest returned |
|---|---|
| 7 days | 1 Oct 2026 ✓ |
| 30 days | 4 Sep 2026 ✓ |
| 90 days | **9 Mar 2026** ✗ seven months |

30 days is the practical ceiling. Signals are now re-checked against the window
actually requested and flagged when older.

### `7ce93a4` Query lab findings — 32 queries tested live
**72% of results usable** (223/310). 23 GOOD, 6 MIXED, 3 POOR.

**The pattern:** queries naming an **actor + action** score 80–100%; queries
naming a **topic** score 20–50%. Every top performer contains a verb of
commitment (*raised, announced, signed, published*); every failure contains an
abstraction (*guidance, policy, programme*).

Three failures diagnosed and fixed:
- Hyperscaler capex **20% → 89%** by naming the companies
- Export controls **20%, deleted** — unfixable by rewording; the event lives on
  `bis.doc.gov` and open search returns everyone writing *about* it. The
  Regulator Sweep already covers it with site-scoped search.
- Telecom edge **20% → 70%**, but drifts to general datacentre investment

Also: a 16-domain exclusion list. Market-research sites produced **zero** usable
signals across all 32 queries and every one still had to be read before it could
be discarded.

### `ffa2282` Windows widened to 30 days; concurrent-run data loss fixed
*(parallel session)*

Windows had defaulted to 7 days, taken from the hackathon brief rather than the
user's own methodology, which swept 90. Widened to 30 and `max_results` raised
to 20 — both levers, since window alone is capped by results-per-query.

Yield: ~35–40 unique results per collector → **118/99/119/147**.

**Serious bug found: the register went backwards, 123 → 78, silently.** Two
pipeline processes ran concurrently; both read the register, both merged their
own signals into what they read, both wrote back. Last write won.

The `isRunning()` guard only ever covered one process. Fixed with a
cross-process lock: pid liveness check, staleness timeout, and a release that
refuses to delete a lock another run has taken.

**Cause, for the record:** the other session was starting background pipeline
runs and killing them with `pkill`, then immediately launching new ones. Lost
entries were restored from backup.

### `97170c7` maxResults settled by measurement
*(parallel session)* Confirmed 30 days as a ceiling rather than a preference.

---

## 3 October

### `49c734d` Session handover
*(parallel session)* State, standing decisions, open issues, pending work.

### This commit — change log, query fixes applied, handover corrections
- The three tested query fixes from `7ce93a4` applied to the profile
  (31 queries now, export-controls query removed).
- 16-domain exclusion list wired through the collectors.
- Two corrections to `HANDOVER.md` — see below.

---

## Corrections to HANDOVER.md

**"Feed Collector — RSS, 12 feeds"** → there are **8** configured and all 8 are
verified reachable.

**"Regulator Sweep — NOT YET RUN LIVE"** → the agent **has** been run live
standalone and works: it returned 3 obligations from 59 publications, including a
mandated EuroHPC AI supercomputer procurement. What it has *not* done is run as
part of a full pipeline, so no `regulatory` signals have reached the register
yet. The distinction matters: the agent is proven, the integration is not.

---

## Recurring lessons

**Everything that broke was something no onboarding form could ask.**
First signal polarity — the same event means opposite things to different
businesses. Then the value factor — the right metric depends on revenue
concentration. The pipeline is generic; the judgement is not.

**Every significant bug was found by running it, not reading it.** The Lightning
no-answer behaviour, the empty-200 throttling, truncated verdicts, misattributed
sources, the register going backwards, the window leak — none were visible in
code review.

**Several bugs are documented pitfalls from the user's own knowledge files
reappearing in new code.** Pitfall #11 (source conflates who said something with
who to contact) became the grounding failures. Pitfall #5 (scoring inflation)
became the 67%-Critical run. Pitfall #14 (stale exclusion list) became NVIDIA
appearing in its own prospect list.
