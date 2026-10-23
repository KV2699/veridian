# Signal Bureau — change log

Chronological record of every change, with the reason. Written for a fork
session picking this up cold. Companion to `HANDOVER.md`, which covers current
state and standing decisions; this covers **how it got here and what each
change cost to learn**.

Two parallel Claude Code sessions worked on this repo on 2–3 October. Both
committed to the same branch. Everything merged cleanly; nothing was lost
except where noted.

---

## 23 October — second batch: the review fixes, and two living documents

Acting on two outside reviews (DeepSeek and Kimi) plus the query lab's own
backlog. Everything here was free — no search credits spent.

### Verified a claim before it went in a video

One review challenged the feed-collector story, having been shown a paste of the
file that already contained the fix. `git diff b8d611c..b00c6aa --
server/agents/collector-feeds.js` settles it: the polarity block and the scoring
rubric are **additions** in that commit. The claim is reproducible and safe to
put on camera.

Two other review findings were artefacts of an incomplete upload rather than
real gaps: the MIT `LICENSE`, the 15 test files and `public/index.html` all
exist and always did.

### The date bug — a quarter of the score, invisible

Tavily returns RFC-2822 (`"Fri, 02 Oct 2026 18:24:26 GMT"`). `isoDate()` matched
`YYYY-MM-DD` only and returned null for it.

It stayed invisible because the model usually supplies its own date — the damage
happened precisely when it did not, which is exactly when the fallback was the
only thing left. The signal became undated, scored **zero of 25 urgency
points**, dropped a band and was auto-flagged. 8 of 117 signals in the log.

Now prefers an explicit `YYYY-MM-DD` anywhere in the string (unambiguous, and it
avoids the timezone shifting a bare date back a day) and falls back to
`new Date()`. Verified against all four shapes in use.

### Five measured query improvements, applied at last

They had been sitting in `tools/QUERY-LOG.md` marked "awaiting approval", worth
+30 to +60 points of usable yield each:

| Replaced | Gain |
|---|---|
| `"has appointed" chief AI officer OR head of AI infrastructure announcement` | 30 → 90% |
| `"has deployed" AI networking fabric data center announced` | 40 → 90% |
| `signed agreement deploy custom AI accelerators cloud provider announced` | 60 → 90% |
| `taped out custom AI accelerator announced Broadcom OR Marvell partnership` | 60 → 80% |
| `Google OR Amazon OR Microsoft OR Meta unveils new AI chip announced` | 50 → 78% |

Plus two additions (`"breaks ground"` at 100%, `"has awarded"` at 88%) and one
deletion. The deletion is the lesson: the HBM supply query resisted four
rewrites — 40%, 60%, 30%, 50%, 50% — and the reason was not wording. Supply
agreements of that kind are commercially confidential, so the event is rarely
published at all. That is "hunting states, not events" in a new costume. 31 → 32
queries.

### A test for the entire class of bug that produced the feed defect

`test/polarity-propagation.test.mjs` captures the prompt each agent actually
sends to the model and asserts the profile's polarity text is inside it — for
the topic collectors, the feed collector, account watch and the verifier, plus
the market and reader for the briefing writer.

**Verified by reintroducing the bug:** with the polarity argument removed the
test fails on exactly the right line, and passes again when restored. That is
the difference between a test and a comment.

### Two living documents

`HACKATHON-FOR-DUMMIES.md` — the whole system in plain English for a
non-technical reader: what it is, the two configurations and the proof they
work, how every hackathon requirement is met, what has actually been tested and
whether it worked, what it costs to run, the top ten strengths and the top ten
enhancements, and how a new business would supply a profile.

`PITFALLS-AND-LESSONS.md` — every failure with what it cost, how it was found
and the rule that prevents recurrence. Part A is the pitfalls that predate the
software and reappeared in new code; Part B is software-specific; Part C is this
build; Part D distils thirteen working rules.

**Both are updated after every batch of changes from now on.**

### The credit answer, found in the rules themselves

The official rules say entrants can join the **Nebius Builder Program**
(https://dev.nebius.com/builders), which includes **$25 of Tavily credit** —
about 3,125 credits, or 28 full runs — and $25 of Token Factory credit. Free,
legitimate, and named by the sponsor. No pay-as-you-go needed.

---

## 23 October — the second configuration

The brief: change the hackathon track, and make the system ship with **two**
sector configurations, each demonstrably good at its own market, with a note
that further sectors are additive.

### Track: Personal AI → Best Apps and Agents

Verified against the live Devpost page rather than the brief. Personal AI names
a specific stack — NemoClaw, OpenShell, Hermes Agent — that this does not use.
Best Apps and Agents asks for *"a workflow that runs itself"*, Nemotron 3 Ultra
for reasoning with Nano or Super for the fast everyday calls, and Serverless
Jobs for background processing. That is a description of this system.

### The second profile — `exec-search`

An ESG and sustainability executive search firm. Chosen over the other tested
markets in the methodology (policy think tank, sustainability communications,
software consultancy) for one reason: it is the only one that **inverts** the
existing profile rather than varying it. A new Head of Sustainability is a
budget holder with a mandate to the `nvidia` profile and a filled mandate with
the fee gone to this one. Two profiles that differed only in keywords would
prove nothing about the architecture.

It is a port of a prompt pack diagnosed against live test searches after two
earlier versions returned almost nothing. Five of the eight root causes found
there are now design constraints in the file, annotated where they apply:
events not states, inverted appointment polarity, a mid-market target universe
rather than mega-caps, a source list verified live, and per-collector windows
(21 days for job postings, 30 for vacancies, 90 for restructures) instead of
one 90-day window that guaranteed leads which were already gone.

It also uses the **engine default value factor** — multi-service breadth —
where `nvidia` overrides it with deal scale. So the two configurations exercise
both halves of the scoring system, not just two query sets.

### Six places hardcoded the market OUTSIDE the profile

Found by reading, before a second profile could work at all. None of them would
have thrown; a second profile would have loaded cleanly and been processed by a
model that had been told it was reading GPU news:

| File | Was | Now |
|---|---|---|
| `collector-base.js` | `"signal extractor for the AI infrastructure market"` | `profile.market` |
| `qa-verifier.js` | `"relevance for someone doing BD in AI infrastructure — GPU cloud..."` | `profile.market` + `profile.reader` |
| `briefing-writer.js` | `"for one reader: a founder selling into GPU cloud..."` | `profile.reader` |
| `roster-sweep.js` | query suffix `"AI infrastructure announcement"` | `profile.sweepTerms` |
| `account-watch.js` | same suffix | `profile.sweepTerms` |
| `collector-tenders.js` | passed profile `terms` but kept compute CPV codes | `profile.tenders.cpvPrefixes` |

Collectors also gained optional `topic` and `includeDomains`, because a job
advert is not a news article and Tavily's news index will never return one.

### A seventh, found only by running it

`tools/feed-check.mjs` was added to exercise a profile on the **free** path —
RSS feeds, no Tavily credits — and the first run showed the Feed Collector
never received the profile's polarity, and declared a `relevance_score` field
without ever defining what the number meant. The model returned 0 for
everything.

Checked against the live signal log rather than assumed: all four feed signals
in the last run carry a `collector_score` of **0 or 1** and a verified score of
**7-8**. They survived only because Nemotron Ultra independently rescored them.
The collector's score was meaningless on that path, and anything Ultra did not
rescue was lost at the floor — consistent with eight feeds yielding four
signals out of 110.

The fix — send the polarity, define the score — produced the clearest
demonstration of the polarity engine in the project. Same feed, same day:

- *"Disney's environmental sustainability co-lead leaves the company"* →
  **scored 9** by `exec-search` (an open mandate) and read as a *stall on an
  existing account* by `nvidia`.
- *"Ingka Group appoints Erika Intiso as Chief Sustainability Officer"* →
  **discarded** by `exec-search` (the fee is gone) and a lead for `nvidia`.

The `nvidia` profile benefits as much. A feed-only check after the fix returned
**13 signals from 178 items with scores spread 2 to 9** — a 960MW Amazon
nuclear power agreement at 9, a conference keynote at 2 — where the same path
previously assigned a collector score of 0 or 1 to everything it found. The
scoring on that path now discriminates instead of deferring entirely to the
verifier.

One thing it also exposed, not yet fixed: 144 of 178 feed items passed the
`nvidia` profile's term filter, which is far too loose and costs an extraction
call per batch of four. The `exec-search` terms are weighted to movement words
rather than topic words and passed 11 of 145. Worth tightening.

### Data is now per profile

`data/<profile>/`. Not tidiness: one register holding two markets describes
nobody, and a shared cross-week URL exclusion list would suppress a story for
one business because the *other* had already seen it. The profile key is
threaded through as an argument rather than held as module state — this repo
has already lost 45 organisations to two runs sharing one mutable view of one
file, and a module-level "current profile" is the same mistake in a new place.

`.gitignore` needed widening to `data/**/*.json` at the same time: the old
`data/*.json` only matched the top level, so the register and the whole signal
log would have been committed to a public repository the moment they moved into
a subdirectory.

`test/register.test.mjs` previously read, blanked and restored the **live**
register. It now runs against a throwaway profile key; one interrupted run
between the blank and the restore would have destroyed the real prospect list.

### Rejection log and counter-reading

Both ported from the operator's most developed tracker, where the rejection log
is described as *"the proof the method holds"*.

**Every dropped signal is now kept with a reason code** — `UNGROUNDED`,
`BELOW_FLOOR`, `DUPLICATE`, `UNVERIFIED` — at both stages that drop things:
grounding during extraction, and the verifier. Two reasons it matters: without
it a rejected organisation returns next week and is re-judged from scratch at
full cost, and a rejection that is actually a *defect in the rules* is
indistinguishable from one that is a correct suppression. `GET /api/rejections`,
and it is shown on the dashboard next to what was kept.

**Every kept signal can carry a counter-reading** — the argument against acting
on it, written by the verifier, capped at 400 characters in code. Not a
confidence score: the reason a competent person might reach the opposite
conclusion. The three that recur are *the buyer is someone else* (a regulator
publishing a rule is not a customer — the firms it obliges are), *they will do
it themselves*, and *the event is real but the trigger is wrong*. The briefing
writer is instructed to state it, never to soften or drop it.

### Tavily credits — the blocker this surfaced

Queried from the account: **974 of 1,000 used, 26 left**, free Researcher plan,
pay-as-you-go not enabled, and the plan resets on **1 November — two days after
the deadline**. A full `nvidia` run costs **112 credits** (56 searches at
`advanced` depth). Nothing could be run live.

Pay-as-you-go is $0.008/credit, so a full run is about **$0.90**. Nebius is not
the constraint: at published rates a full run's inference is well under a
dollar. Everything in this entry was therefore validated on the free paths —
feeds, dry run, and the test suite.

### Tests: 12 → 14 files

`test/profiles.test.mjs` asserts the two-configuration contract structurally —
that both profiles declare every field an agent reads, that the polarity
genuinely inverts, that the value factors differ, and that no store file is
shared between them. `test/rejections.test.mjs` covers the rejection log and
the counter-reading.

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
