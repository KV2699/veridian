# SignalSwarm — the context contract

What every agent is given, what it computes, and **what it is deliberately not
shown**. Written before any collector code, so the answer to "what is this agent
taking into account?" is a document rather than an archaeology exercise.

Status: DRAFT for author review. Nothing here is verified against a live API —
see `preflight.md` for what is still unknown.

---

## 0. Why this document exists

Three lessons from prior work drive the whole design:

- **A field that is declared but never defined gets a wrong default.**
  (`relevance_score: 0`, `'call them'` five times.) So every field below is
  defined, with units and a worked example.
- **A filter that runs before the model leaves no trace.** So every drop is a
  logged rejection with a reason code, including drops made in code.
- **An unstated choice about what to count determines the answer.** The
  discrimination audit found one denominator choice moving a result 560-fold.
  So §5 states every denominator this system uses, by name.

A fourth lesson is the one that shaped §6, and it is the most important finding
in this document: **two of the draft profile rules are tautologies.**

---

## 1. The shape of a context contract

Each agent gets a contract with six parts. No agent has anything not listed.

| Part | Means |
|---|---|
| **CODE INPUT** | exact paths into the recorded snapshot payload |
| **COMPUTED** | metrics derived in code: formula, unit, window, metric id |
| **MODEL CONTEXT** | the literal blocks of text that reach a model |
| **WITHHELD** | what is kept from the model on purpose, and why |
| **OUTPUT** | closed schema the agent may emit |
| **DEGRADED** | the exact conditions that force neutral / 0.0 |

Rule running through all five: **the model classifies, checks grounding and
writes one sentence. Code computes every number.**

---

## 2. Agent 1 — Macro Collector (no model)

**CODE INPUT** — `snapshot.sources["fred:WALCL"].payload.observations[]` and
`snapshot.sources["fred:WTREGEN"].payload.observations[]`, each an array of
`{date, value}`. `value` is a string and may be `"."` for a missing week.

**COMPUTED**

| id | name | formula | unit |
|---|---|---|---|
| `m1` | `walcl_4w_change_pct` | `(v[t] − v[t−4obs]) / v[t−4obs] × 100` | percent |
| `m2` | `tga_4w_change_pct` | same, on WTREGEN | percent |
| `m3` | `net_liquidity_4w_change_pct` | on the series `WALCL − WTREGEN` | percent |

`m3` is the one that carries meaning. A Fed balance sheet that grows while the
Treasury General Account grows faster is liquidity *leaving* the system, and
`m1` alone reads it backwards. **Proposed addition: `RRPONTSYD`** (overnight
reverse repo), making net liquidity `WALCL − WTREGEN − RRPONTSYD`, which is the
definition in general use. One more FRED series, same call shape.

**MODEL CONTEXT** — none. This agent never calls a model.

**WITHHELD** — n/a.

**DEGRADED** when any of: fewer than 5 usable observations; the latest
observation is more than **14 days** older than `as_of`; any required value is
`"."`. Emits `direction: neutral`, `confidence: 0.0`, `status: degraded`,
`reason_code: MISSING_SOURCE_DATA`.

**The staleness trap.** `WALCL` is **weekly**, dated Wednesday, published
Thursday afternoon. On a Monday snapshot the freshest observation is already
5 days old, and it is normal, not degraded. A naive "is this less than 48 hours
old" staleness check marks this agent degraded on every run. Hence 14 days, and
hence `window: "4obs"` not `"4w"` — see §5 D1.

---

## 3. Agent 2 — On-Chain Collector (no model)

**CODE INPUT** — `data/watchlist.json`, plus `view_account` results for each
account at two snapshot dates. Each account entry is hand-written by the author:

```json
{"account_id": "x.near", "label": "...", "kind": "holder|exchange|treasury|bridge",
 "sector": "l1|defi|ai-agents|infra", "added": "2026-11-01", "why": "one line"}
```

**`kind` is the polarity carrier and it is not optional.** A 40,000 NEAR
increase on a `holder` wallet and the same increase on an `exchange` wallet mean
opposite things: accumulation versus deposits waiting to be sold. Without
`kind`, the net-balance metric adds two opposite signals together and returns
their difference, which means nothing. This is the appointments-versus-vacancies
inversion in a new costume.

**COMPUTED** (holder + treasury wallets only; exchange and bridge wallets feed
`m7`/`m8` separately)

| id | name | formula | unit |
|---|---|---|---|
| `m4` | `watchlist_net_balance_change_pct` | `Σ(bal_now − bal_prev) / Σ bal_prev × 100` | percent |
| `m5` | `watchlist_wallets_accumulating` | count where `delta > dust` | count |
| `m6` | `watchlist_wallets_distributing` | count where `delta < −dust` | count |
| `m7` | `exchange_net_inflow_pct` | same as m4 over `kind == "exchange"` | percent |
| `m8` | `sector_net_change_pct.<sector>` | m4 restricted to one sector | percent |

**Two traps that would silently corrupt every number.**

1. **`view_account` returns `amount` (liquid) and `locked` separately, and
   staking is not selling.** Delegating 10,000 NEAR to a validator drops
   `amount` by 10,000 and reads as distribution. The balance used must be
   `amount + locked`, and even then unstaking has a 2–3 epoch delay during
   which funds sit in the staking pool contract and appear in neither. This is
   a **known, stated limitation**, not something to paper over: the README says
   the on-chain metric measures *account balance change*, not net buying.
2. **Gas burns make every active wallet drift slightly negative.** Hence
   `dust`, set in config at `0.1 NEAR`, and `m5`/`m6` count only moves past it.

**MODEL CONTEXT** — none.

**DEGRADED** when fewer than 60% of watchlist accounts returned a balance, or
only one snapshot date is available. Never interpolates a missing balance.

---

## 4. Agent 3 — Narrative Collector (FAST model)

The only collector that calls a model, so its contract is the strictest.

**CODE INPUT** — `snapshot.sources["rss:<domain>"].payload.items[]`, each
`{title, link, published, summary}`. Code first canonicalises `link` (strip
query strings and `utm_*`), drops items published outside the window, and drops
exact-duplicate canonical URLs. **Each code-level drop is a logged rejection**
(`STALE`, `DUPLICATE`), never a silent filter.

**MODEL CONTEXT** — one call per batch of up to 20 items. The prompt is four
blocks, stable instructions first, volatile evidence last:

1. `Today's date is <as_of>. Any date on or before today is in the past and is not implausible.`
2. The closed event-type list, each with a one-line definition and one worked
   example of a headline that does and does not qualify.
3. The output JSON schema, with one fully written example row.
4. The items, as `{item_id, title, source_domain, published}`.

**WITHHELD from the model, on purpose:**

| Withheld | Why |
|---|---|
| the asset under analysis | so classification is not bent toward a wanted answer |
| the active profile and its `polarity_notes` | an event type is a fact; its direction is configuration |
| every metric from agents 1 and 2 | prevents narrative agreeing with macro by contamination |
| price, or any market data | the system has none, and a model asked would invent it |
| the item body and the URL | it may only return an `item_id`, so it cannot cite a source that was never retrieved |

**OUTPUT** — per item, and nothing else:

```json
{"item_id": "i7", "event_type": "token_unlock", "is_about_near": true,
 "evidence_span": "verbatim substring of the title"}
```

Closed `event_type` set: `token_unlock`, `protocol_upgrade`, `listing`,
`security_incident`, `governance`, `other`. No numbers, no URLs, no free prose,
no direction, no confidence. `evidence_span` must appear verbatim in the title
or the row is dropped as `UNGROUNDED` — a cheap, automatic falsifier, which is
the test for whether a model may be trusted with something at all.

**DEGRADED** when no feed returned items, or the model call fails and no cache
entry exists. An empty feed set is `degraded`, **not** a quiet market — the two
look identical and must be distinguished automatically.

**The source-audience question.** A feed written *for* NEAR partisans reports
NEAR launches; a feed written for traders reports unlocks and incidents. The
second kind is what a conviction signal needs. Feed selection is recorded in
`preflight.md` with who each source is written for.

---

## 5. Agent 4 — Verifier (REASONING model)

**CODE INPUT** — the candidate signals from agents 1–3, already carrying
code-computed `direction` and `confidence`.

**MODEL CONTEXT** — per candidate:

1. `Today's date is <as_of>.`
2. The asset, and the active profile's `polarity_notes` verbatim (so the
   counter-reading argues against *this* profile, not against trading in general).
3. The rendered metric lines: `m1 walcl_4w_change_pct = 0.4 percent (window 4obs)`.
4. Source **domain**, title, and `retrieved_at`. Not the full URL.
5. The direction and confidence **code** assigned, labelled as code's.

**WITHHELD from the verifier, on purpose:**

| Withheld | Why |
|---|---|
| the raw snapshot payload | it must work from rendered metrics, so the numeric guard can check it |
| the other profile | no awareness that an opposite reading is being run |
| agent weights, running `long_score` / `short_score`, `quorum_threshold` | **a counter-reading that can see the scores can be written to flip the outcome** |
| every past decision and outcome | no drift toward whatever was rewarded last |
| the execution tier, and whether funds are real | cannot reason about stakes |

**OUTPUT** — closed:

```json
{"signal_id": "s3", "is_about_asset": true,
 "about_reason": "subject_of_headline|mentioned_in_passing|not_present",
 "duplicate_of": null, "counter_reading": "one sentence"}
```

It may **not** change direction, confidence, metrics or sources. `counter_reading`
passes the numeric guard: every numeral in it must match a rendered metric value
or the sentence is dropped and `FABRICATED_METRIC` logged. A candidate the model
cannot judge is kept with `verified: false` — never silently dropped.

**"Mentioned" versus "about".** `about_reason: mentioned_in_passing` does not
reject; it caps confidence at the profile's `passing_mention_ceiling`. A long
article naming twelve chains is not evidence about NEAR, and dropping it
outright loses a real item, so it is demoted rather than discarded.

---

## 6. Agent 5 — Quorum (no model, no context beyond numbers)

Takes only: accepted signals' `direction` and `confidence`, and each agent's
current `weight`. Nothing else — no titles, no prose, no profile text.

```
long_score  = Σ weight_i × confidence_i  over agents voting long
short_score = Σ weight_i × confidence_i  over agents voting short
```

Gate: **≥ 2 non-neutral agents** on the winning side **and** winning score
≥ `quorum_threshold`. Then `size = base_notional × (win − lose) / win`, and
`size < min_executable_notional` ⇒ `no_action` / `CONFLICT_BELOW_MIN_SIZE`.

With the sector layer: `size = base_notional × sector_weight × (win − lose) / win`,
where `sector_weight` comes from the profile's `universe.allocation_weights` and
the sector is read off the watchlist entries that produced the on-chain vote.
Allocation is arithmetic in code. No model touches it.

---

## 7. The denominators, stated

Each of these is a free parameter. Unstated, it silently determines the answer.

| | Choice | Declared value | Alternative rejected |
|---|---|---|---|
| **D1** | what "4-week change" counts over | **4 observations** of a weekly series | 28 calendar days — on weekly data this silently compares 4 or 5 observations depending on the weekday |
| **D2** | what counts as a wallet "accumulating" | delta > **0.1 NEAR** | `> 0` — every gas-burning wallet reads as distributing |
| **D3** | a narrative rule's chance to fire | items **classified into a non-`other` event type** | all items retrieved — makes every rate a function of feed volume |
| **D4** | the on-chain balance | `amount + locked` | `amount` alone — staking reads as selling |

Each is written into the snapshot manifest, so a reader can recompute.

---

## 8. The tautology check, applied to our own draft rules

The free check: **if the condition that makes a rule fire is the same condition
that counts as a chance to fire, it fires every time it can and reports only
that something is present.** You see it by reading the rule. Two draft rules
fail it.

**T1 — `walcl_4w_change_pct > 0 → long`.** The Fed balance sheet grows in the
large majority of 4-observation windows. A rule keyed to "is it positive" is
close to a constant. It would contribute its confidence to `long_score` on
almost every snapshot, and because the quorum gate needs only two agreeing
agents, **a constant macro vote plus any one other agent clears the gate.**
That is not a signal; it is a thumb on the scale.

**Fix:** thresholds on the **distribution**, not on zero. The rule fires when
the 4-observation change is in the **top or bottom tercile of the trailing 52
observations**, with the tercile boundaries computed in code from the recorded
series and written into the decision record. A rule that fires about a third of
the time has something to be right or wrong about.

**T2 — `watchlist_net_balance_change_pct > 0 → long`.** Same defect, plus a
second one: a watchlist whose entries were chosen *because* they accumulate is
a selected sample, so the metric is near-constant by construction. Fix: the
same tercile treatment, **and** `kind` separation from §3, **and** the watchlist
`why` field recorded per wallet so a reader can see the selection rule.

**The check applied to the whole profile before the first run:** for each rule,
state its firing rate over the recorded series. Any rule firing above 80% or
below 5% of windows is reported to the author, not quietly kept.

This is the one piece of work here that cannot be done without a recorded
snapshot, and it must happen **before** the polarity demo, or the demo's flip
could rest on a rule that fires regardless of input.

---

## 9. The universe layer

Polarity says how to read an observation. **Universe says what is looked at** —
a separate axis, and the spec currently hardcodes it in three places
(`watchlist.json`, `RSS_URLS`, `asset: "NEAR"`).

```json
"universe": {
  "assets": ["NEAR"],
  "sectors": ["l1", "defi", "ai-agents", "infra"],
  "watchlist_file": "data/watchlist.near.json",
  "rss_urls": ["..."],
  "allocation_weights": {"l1": 0.5, "defi": 0.3, "ai-agents": 0.2},
  "passing_mention_ceiling": 0.15
}
```

Three rules keep it honest: a sector is a **declared tag on a watchlist entry**,
never inferred by a model; allocation is **arithmetic in `quorum.py`**; and if a
profile names a sector list, **the list lives in the profile** — a criterion the
verifier cannot evaluate becomes a penalty, not a neutral.

The payoff for the demo: the two profiles then differ on **two** axes — same
evidence read inversely, and sectors weighted differently — which makes
"interpretation is declared configuration" a materially bigger claim.

---

## 10. What is still unverified

Nothing in this document has touched a live API. Outstanding for `preflight.md`:
FRED response shape and whether `RRPONTSYD` is as described; whether
`view_account` exposes `locked` as assumed; whether two balance snapshots or an
indexer supplies the on-chain window; which keyless RSS feeds carry
NEAR-relevant catalyst items, and who each is written for; the 1Click quote
request schema, auth, fees and minimums; and the agent-custody options for the
optional micro tier.

**Until each is checked against the current docs, every number in this document
is a design assumption and is labelled as one.**
