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

## Recommendations awaiting approval

Five replacements, all measured, none applied:

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
