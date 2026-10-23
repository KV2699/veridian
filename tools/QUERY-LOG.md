# Query log — what works, what doesn't

**Living document. Append, don't rewrite.** Newest round at the top.

Every figure here is a live measurement from `tools/query-lab.mjs`, not an
opinion. "Usable %" is the share of returned results that read as a dated event
rather than commentary — a smell test for the query, judged before any model
reads a word.

Lab verdicts: **≥70% GOOD · 40–69% MIXED · <40% POOR**

> **Nothing in this log has been applied to the system.** These are tested
> recommendations awaiting approval. The system still runs the queries in
> `server/profiles/nvidia.js`.

---

## Round 3 — 3 October 2026 · the result cap, and why it overturns the 30-day change

### The finding

`max_results` is a **ranking cap, not a date cap**. One search with a 28-day
window returns the 10 results Tavily judges best *across the whole month* — so a
busy week crowds a quiet one out entirely. Asking four times, once per week,
gives each week its own top 10.

Measured — same query, same 28 days, one wide search against four weekly slices:

| Query | Wide (1×28d) | Sliced (4×7d) | New | Overlap |
|---|---|---|---|---|
| GPU cloud funding | 10 | **38** | 32 | 6/10 |
| Data centre power | 10 | **24** | 21 | 3/10 |
| `"has appointed"` AI leader | 10 | **38** | 30 | 8/10 |
| **Total unique** | **30** | **100** | **83** | — |

**3.3× the unique results for 4× the Tavily credits**, and 83 of the 100 were
invisible to the wide search. Tavily accepts explicit `start_date` / `end_date`,
so true slicing works — this is not limited to "last N days".

### ⚠️ PITFALL — this overturns the 30-day window change

Widening the collector windows from 7 to 30 days was reasoned from evidence but
the reasoning missed a step. **A system that runs weekly is already slicing.**

- **7-day window, run weekly** — each run takes that week's top 10. Four runs a
  month accumulate four slices: roughly 40 unique results.
- **30-day window, run weekly** — every run returns the top 10 of the *same*
  rolling month. Runs overlap heavily, URL dedup discards the repeats, and the
  month yields closer to 10–15 unique.

The 30-day window helps a **one-off** run and hurts a **recurring** one. The
weekly cadence was already doing the slicing for free, and widening the window
took that away.

**Recommendation:** 7 days for scheduled weekly runs; explicit week-by-week
slicing for backfill, where a month of history is wanted in a single pass. The
30-day ceiling finding still stands — it is about where Tavily *leaks*, which is
a separate question from where recall is best.

### 💰 The cost that decides where to use it

Slicing multiplies results, and every result is read by a model downstream.
31 queries × 10 results = ~310 per run today; sliced, ~1,000. At four results
per extraction batch and two concurrent calls, that is hours, not minutes.

So: **slice on backfill, where recall is the whole point. Do not slice a weekly
run — the cadence already does it.**

### 🐞 BUG — Tavily's dates do not parse

Tavily returns RFC-2822: `"Fri, 02 Oct 2026 18:24:26 GMT"`. The collector's
fallback parser matches `YYYY-MM-DD` only, so it returns **null**.

The model usually supplies its own date, which is why this has mostly been
invisible — but whenever it does not, the fallback that should rescue the signal
fails instead. The signal becomes undated, scores **zero urgency points**, drops
a band, and is auto-flagged for review. 8 of 117 signals in the current log.

**✅ FIXED 23 October.** `isoDate()` in `collector-base.js` now prefers an
explicit `YYYY-MM-DD` anywhere in the string — unambiguous, and it avoids the
timezone shifting a bare date back a day — and falls back to `new Date(v)` for
everything else. Verified against all four shapes Tavily and the model actually
produce. Covered by `test/collector.test.mjs`.

---

## Round 2 — 3 October 2026 · the quoted-phrase lever

Testing whether quoting an exact verb phrase generalises, after it produced the
largest single improvement ever measured here.

| Query | Usable | Verdict |
|---|---|---|
| `"breaks ground" AI data center campus announced` | **100%** | GOOD — new |
| `"has deployed" AI networking fabric data center announced` | **90%** | GOOD — rescues #6 |
| `"has awarded" contract AI compute data centre` | **88%** | GOOD — new |
| `"has raised" GPU cloud AI infrastructure funding round` | 90% | GOOD, but see below |
| `"selected" InfiniBand OR Spectrum-X for AI cluster announced` | 60% | MIXED |
| `"has secured" OR "has signed" HBM supply agreement memory manufacturer` | 50% | MIXED |
| `"will supply" HBM memory to announced agreement` | 50% | MIXED |

### ✅ WORKS — quoting the exact verb phrase

The strongest lever found so far. It forces the search to match reporting
language rather than topic vocabulary, and the gains are large:

- `"has appointed"` — **30% → 90%**
- `"has deployed"` — **40% → 90%**

### ⚠️ PITFALL — do not apply it to a query that already works

The control `GPU cloud AI infrastructure funding round raised billion` scores
**100%**. Adding the quoted phrase — `"has raised" GPU cloud AI infrastructure
funding round` — **dropped it to 90%**.

A quoted phrase is a hard constraint. On a weak query it excludes commentary;
on a strong one it excludes real events reported with different wording. **Use
it to rescue, never to polish.**

### ❌ PITFALL — some signal types have no publishable event

HBM/CoWoS supply resisted **four** separate rewrites: 40% control, then 60%,
30%, 50%, 50%. Naming the suppliers, naming the action, and quoting the verb
all failed to clear 60%.

The reason is not wording. **Supply agreements of this kind are commercially
confidential — the event is rarely published at all**, so the search returns the
analyst commentary that exists instead of the announcements that do not.

This is the "hunting states, not events" failure from the Acre diagnosis in a
new form: before rewriting a query again, ask whether the event gets published.
If it does not, no wording will find it, and the query should be deleted rather
than tuned.

---

## Round 1 — 3 October 2026 · the six MIXED queries

The three POOR queries were fixed previously. These six were live in the system
at 40–60% and had never been addressed.

| # | Query | Control | Best variant | Result |
|---|---|---|---|---|
| 2 | AI leadership appointments | 30% | `"has appointed" chief AI officer OR head of AI infrastructure announcement` | **90%** ✅ |
| 3 | Custom silicon deployment | 60% | `signed agreement deploy custom AI accelerators cloud provider announced` | **90%** ✅ |
| 4 | Accelerator programme | 60% | `taped out custom AI accelerator announced Broadcom OR Marvell partnership` | **80%** ✅ |
| 5 | Hyperscaler silicon | 50% | `Google OR Amazon OR Microsoft OR Meta unveils new AI chip announced` | **78%** ✅ |
| 6 | AI networking | 40% | *(see Round 2)* `"has deployed" AI networking fabric data center announced` | **90%** ✅ |
| 1 | HBM / CoWoS supply | 40% | none found | **60% ceiling** ❌ |

### ✅ WORKS — naming the actors

`hyperscaler custom silicon tape out production announced` (50%) →
`Google OR Amazon OR Microsoft OR Meta unveils new AI chip announced` (78%).

"Hyperscaler" is a category word that appears in analysis. The company names
appear in announcements.

### ✅ WORKS — naming the commitment, not the activity

`company deploying ... at scale` (60%) → `signed agreement deploy ...` (90%).
"Deploying" describes an ongoing state; "signed agreement" is a dated act.

### ⚠️ PITFALL — undated results cluster in vendor-heavy topics

Networking queries returned 3–4 undated results out of 10 throughout. Vendor
product pages carry no publication date, and an undated signal cannot be scored
for urgency — it is capped and flagged downstream. Worth watching per query,
not just the usable percentage.

---

## Recommendations — ✅ ALL APPLIED 23 October 2026

Five replacements, two additions and one deletion. All were measured here and
all are now live in `server/profiles/nvidia.js`. The collector query count went
31 → 32 (five swapped in place, two added, one deleted).

| Replace | With | Gain |
|---|---|---|
| `appointed chief AI officer head of AI infrastructure VP compute` | `"has appointed" chief AI officer OR head of AI infrastructure announcement` | 30 → 90% |
| `AI networking ethernet infiniband deployment win announced` | `"has deployed" AI networking fabric data center announced` | 40 → 90% |
| `company deploying Trainium TPU MTIA custom AI chip at scale` | `signed agreement deploy custom AI accelerators cloud provider announced` | 60 → 90% |
| `custom AI accelerator programme expanded cancelled company` | `taped out custom AI accelerator announced Broadcom OR Marvell partnership` | 60 → 80% |
| `hyperscaler custom silicon tape out production announced` | `Google OR Amazon OR Microsoft OR Meta unveils new AI chip announced` | 50 → 78% |

**Two new queries worth adding** (not replacements):
- `"breaks ground" AI data center campus announced` — 100%
- `"has awarded" contract AI compute data centre` — 88%

**One deletion to consider:** `HBM CoWoS advanced packaging capacity supply
agreement allocation` — 40%, and four rewrites could not clear 60%. The events
it hunts are mostly not published. Supply-chain intelligence may be better
served by the feed collector than by search.

---

## The rules, as they stand

1. **Name the actor, not the category.** Company names appear in announcements; category words appear in analysis.
2. **Name the commitment, not the activity.** "Signed", "awarded", "raised", "breaks ground" — not "deploying", "expanding", "pursuing".
3. **Quote an exact verb phrase to rescue a weak query** — the single strongest lever, worth up to +60 points.
4. **Never quote a phrase into a query that already scores well** — it is a hard constraint and will exclude real events worded differently.
5. **Avoid abstractions**: guidance, policy, programme, allocation, capacity. They return people discussing the topic.
6. **Before rewriting a third time, ask whether the event is published at all.** If it is commercially confidential, no wording will find it.
7. **Watch undated counts separately from usable percentage.** Vendor-heavy topics return undated pages that cannot be scored for urgency.
8. **`max_results` caps ranking, not dates.** Widening a window does not add results, it exchanges them — and a busy week crowds out a quiet one.
9. **Let the cadence do the slicing.** A weekly run on a 7-day window accumulates a month of weekly top-10s. A weekly run on a 30-day window re-reads the same month and dedup throws most of it away.
10. **Slice explicitly only when backfilling.** 3.3× the recall, 4× the credits, and 3.3× the extraction cost — worth it once, not every week.


---

## Applied, 23 October 2026

| Change | Collector | Measured |
|---|---|---|
| `"has appointed" chief AI officer OR head of AI infrastructure announcement` | opportunity | 30 → 90% |
| `"has deployed" AI networking fabric data center announced` | infrastructure | 40 → 90% |
| `signed agreement deploy custom AI accelerators cloud provider announced` | competitive | 60 → 90% |
| `taped out custom AI accelerator announced Broadcom OR Marvell partnership` | competitive | 60 → 80% |
| `Google OR Amazon OR Microsoft OR Meta unveils new AI chip announced` | competitive | 50 → 78% |
| **Added** `"breaks ground" AI data center campus announced` | infrastructure | 100% |
| **Added** `"has awarded" contract AI compute data centre` | capital | 88% |
| **Deleted** `HBM CoWoS advanced packaging capacity supply agreement allocation` | infrastructure | 40%, four rewrites could not clear 60% |

The deletion is the one worth remembering. Supply agreements of that kind are
commercially confidential, so the event is rarely published at all and no
wording can find it. That is the "hunting states, not events" failure in a new
form: **before rewriting a query a third time, ask whether the event gets
published.** If it does not, delete the query rather than tune it.
