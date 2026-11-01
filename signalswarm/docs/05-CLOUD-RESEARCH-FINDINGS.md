# Cloud session — research findings, and two corrections to my own

**Renumbered to 05** to stop colliding with `03-PREFLIGHT-RESULTS.md`, which
already exists locally and which my earlier file wrongly implied did not.

Written from a cloud container with no key, no Mac access, and no live egress.
Everything here came from fetching public pages or from arithmetic on figures
in `BATCH-02-RESEARCH-ACTED.md`. **Nothing here was measured against a running
system.** Where a number is computed rather than observed, it says so.

---

## 0. Two corrections to my previous cloud document

**0.1 My "still unverified" list was stale and partly wrong.** It listed FRED
response shape, the on-chain window decision, and the 1Click quote flag as open.
All three were already closed locally: `03-PREFLIGHT-RESULTS.md` exists, FRED
has been read at 80 weeks, the archival RPC was found deprecated and the
two-snapshot method adopted, and the 1Click fee was *measured* at `fee: 20`.
I wrote a gap list without checking whether the gaps were still gaps.

**0.2 My `crates-` finding is a hypothesis, not a defect.** I said nearcore
release rates were "inflated roughly twofold by bot duplicates". I have not run
your code and I should not have phrased it that way — that is AL-5 exactly, one
day later and from a different session.

What is actually observed: the nearcore releases feed carries `2.14.0` at
18:59:52Z **and** `crates-0.38.0` at 19:07:00Z on 26 Oct, both stable, both
non-`rc`, the second published by `github-actions[bot]` as a crates.io snapshot
of the same upgrade.

What suggests you are already handling it: `BATCH-02` reports NEAR with **1
upgrade**, not 2. If `crates-0.38.0` were being admitted, NEAR would show two.
So your filter is probably a semver-shaped allowlist rather than an `rc`
denylist, and it already excludes this.

**The honest action is a one-line check, not a fix:**

```bash
./.venv/bin/python -c "
import json;s=json.load(open('data/snapshots/2026-11-01.json'))
import re
for k,v in s['sources'].items():
    if 'nearcore' in k or 'release' in k:
        for it in (v.get('payload') or []) if isinstance(v.get('payload'),list) else []:
            t=str(it.get('tag_name') or it.get('name') or '')
            if t: print(k, t)
" | sort -u
```

If `crates-` tags appear in the recorded payload, exclude `^crates-` as a logged
`DUPLICATE`. If they do not, nothing needs doing and this entry is just a note
on why the feed looks odd.

---

## 1. The finding that bears on your open decision: wiring NEPs does not change the ranking

This is the one worth your time. It is arithmetic on your own published figures,
and it says option (b) does not do what it is expected to do.

**Your density formula, recovered from the `BATCH-02` table.** All seven rows fit

```
delta = (catalysts - baseline) / baseline
```

to two decimals (AVAX reconciles at baseline 0.1389, printed as 0.14). So the
metric is a *relative* change against a per-asset baseline.

**That is the problem.** Adding a catalyst source raises the numerator for the
current window **and** the baseline, because the baseline is built from the same
sources over a longer span. A new source only improves an asset's delta if the
current window is above *that source's own* long-run rate.

**The NEPs rate, from the verified feed.** `near/NEPs` master.atom carries 20
commits spanning 2025-11-19 to 2026-10-14 — about 10.8 months. Ten of them are
new NEP proposals:

> NEP-652, NEP-646, NEP-641, NEP-642, ML-DSA-65 (#645), NEP-639, NEP-611,
> NEP-635 (P256), NEP-638, NEP-621

**0.93 new proposals per month.** And in the 30-day window to 1 Nov 2026 the
feed contributes exactly **one**: NEP-652 on 14 October.

One, against a long-run rate of 0.93. Essentially on trend — so it adds almost
as much to the denominator as to the numerator:

| | catalysts | baseline | delta |
|---|---|---|---|
| NEAR, now | 1.00 | 1.17 | **−0.145** |
| NEAR, with NEPs wired | 2.00 | 2.10 | **−0.045** |

**NEAR clears the catalyst floor of 2. Its density change stays negative.**
Re-ranked against your table it moves from last to **sixth of seven**, still
below BNB only:

```
1. AVAX  +6.20     5. ETH   +0.18
2. BTC   +2.68     6. NEAR  -0.05   <- after an hour's work
3. POL   +0.91     7. BNB   -0.21
4. SOL   +0.49
```

**So option (b) buys eligibility, not competitiveness.** It is an hour of work
that moves NEAR from "excluded by the floor" to "included and ranked sixth".
That may still be worth doing — eligibility is not nothing, and a source that
makes the floor reachable has standalone value — but it will not make the swarm
pick NEAR, and the batch note frames it as though it might.

**Three caveats, because this is computed and not observed:**

1. I inferred the baseline is additive per source. If it is computed some other
   way the figures move, but **the mechanism does not** — any new source feeds
   both terms of a relative-change metric.
2. The atom feed returns the last 20 commits. If master carries more commits
   than that in the span, the NEPs rate is **higher** and NEAR looks **worse**.
3. NEP-652 is a *proposed* change, so under the closed list it is `governance`,
   not `protocol_upgrade`. If the profiles map those to different votes, the
   added catalyst may not even push the same direction as nearcore 2.14.0.

**This is D1–D10 reappearing one level up.** The denominators you named are all
inside a metric; this one is a property *of* the metric. A relative-change score
quietly penalises adding sources, which is the opposite of the incentive you
want while the catalyst pool is thin.

**Worth considering instead:** report absolute catalyst count beside the delta,
and let the floor run on the absolute. Then a new source can only help
eligibility and can never make an asset look worse for having been better
observed.

---

## 2. On the NEAR blog: I disagree with wiring it

`BATCH-02` option (b) names NEPs *and* the NEAR official blog. I would wire
NEPs and leave the blog, for two reasons.

**It is unverified and I could not verify it.** `near.org` does not resolve from
this session. Search results suggest WordPress-style paths (`/blog/feed`, plus
per-tag feeds like `/blog/tag/core-protocol/feed`) but **no feed URL here has
been fetched, so none is trusted.** Rule 8.

**Rule 31 argues against it on merit.** *Ask who a source is written for.*
`near.org/blog` is NEAR's own publication, written for NEAR partisans. By C18's
logic it carries launches, partnerships and ecosystem wins — not unlocks,
incidents or contested governance. That is the exact feed audience
`SIGNAL-CONTEXT.md` §4 warns produces the wrong items for a conviction signal.

It is also the source most likely to inflate NEAR's count with non-events, which
on a relative-change metric means raising NEAR's baseline permanently in
exchange for marketing posts. If it goes in at all, it belongs behind a
source-audience label with a capped confidence, not as a peer of nearcore
releases.

**What NEPs does and does not carry**, now verified:

- schema: `entry/title`, `entry/link[@rel="alternate"]/@href`, `entry/updated`.
  **No `entry/published`.** Same as the releases feed.
- about half the 20 entries are housekeeping — `chore:`, `ci:`, `docs:`,
  `fix: update broken links`. These need the same prefix exclusion as `rc`,
  logged as rejections, or they roughly double NEAR's apparent rate with
  commits that are not events.
- **status transitions are not in it.** The feed carries commit titles only. A
  NEP reaching Final or Approved — the genuinely tradeable moment — does not
  appear. Two entries leak status in body text (`Draft, opened for SME review`;
  `Needs WG to assign SME`) and neither is Final. If "NEP approved" is the
  catalyst you want, this feed is not the source.

---

## 3. The profile-disagreement falsifier: measure it at the right level

`BATCH-02` finding 2 commits to adding this test. The design matters more than
the code, because the obvious version gives a false negative **today**.

Current state, from `INDEX.md`:

```
momentum    narrative SHORT 0.45   ->  NO_ACTION
contrarian  narrative LONG  0.30   ->  NO_ACTION
```

The two profiles **agree on the decision** and **disagree on the reading**. A
test asserting "the profiles must produce different decisions" fails right now —
and it would be wrong to fail, because polarity is working exactly as designed.
The decisions match for an unrelated reason: only one agent votes, so neither
side can reach quorum.

So the falsifier needs two separate assertions, reported separately:

| | Asserts | Why it is the honest metric |
|---|---|---|
| **Signal-level divergence** | for ≥1 agent, the two profiles assign different `direction` on ≥N% of recorded snapshots | this is the actual claim — identical evidence, opposite readings. It is true today and provable today |
| **Decision-level divergence** | the two profiles reach different `decision` on ≥1 snapshot in the set | this is the *demo's* claim. It is **not** true today, and the test should say so rather than hide it |

Reporting one number conflates them. Reporting both says: the configuration
layer demonstrably does work, and the hero demo does not land yet — which is
already what `BATCH-01` §3 says in prose, so the test would simply hold that
honesty in place instead of letting it drift.

A third assertion worth having, cheap: **if the two profiles ever produce
identical signal-level directions across every agent on every snapshot, fail
loudly.** That is the real degenerate case the research was pointing at, and it
cannot happen silently if a test watches for it.

---

## 4. P7, the optional micro tier — the SDK is real and the gate clears

The handoff recorded the "Agent API SDK" as *package name and key format NOT
verified*. Both are now verified from the official examples repository. This is
documentation, not a tested integration.

- **Package:** `@near-intents-agent-api/sdk` · `pnpm add @near-intents-agent-api/sdk`
- **Key format:** prefixed **`naa_`**, created in the partner dashboard, shown once
- **Env:** `NEAR_INTENTS_AGENT_API_KEY`, `NEAR_INTENTS_AGENT_API_URL`
- **Hosted:** `https://api.agentsonintents.com` · dashboard `https://partners.near-intents.org/`

**§7.4 requirement 3, field by field:**

| Spec requires | SDK field | Documented |
|---|---|---|
| swap-only actions | `actions` allowlist | yes |
| asset-**pair** allowlist | `assets` allowlist | partial — see below |
| per-transaction cap | `limits.<asset>.per_transaction` | yes |
| daily cap | `limits.<asset>.daily`, `budget.daily_usd` | yes |
| destination whitelist | `destinations` allowlist | yes |
| owner approval ON | `owner_approval: true` | yes |
| freeze / revoke | `freeze`, `grant_revoke` | yes |
| agent cannot widen its own policy | `policy_update` is **owner-signed** over the whole new policy with an `expected_revision` check | yes |

Also: `max_actions_per_hour`, `timelock_ms`, an owner `schedule` of permitted
hours, `archive`, `delete`, and an optional `native` block **off by default**.
Refusals surface as `spend_budget_exceeded` / `policy_limit_exceeded`; a dry-run
quote *warns* instead and exposes an `owner_approval` flag showing whether the
live call would block.

Grants match §7.4 requirement 1 closely: backend calls `createGrantCredential()`
for a token plus commitment, the owner signs a `grant_issue` carrying **only the
commitment**, the token never leaves your backend, expiry up to 365 days,
`grant_revoke` and `listGrants` for lifecycle.

**Three unresolved points that matter:**

1. `assets` is an asset allowlist, **not** an asset-*pair* allowlist. For a
   two-asset swap-only policy that is probably equivalent, but it is not what
   §7.4 asks for and the difference should be stated, not assumed away.
2. **Whether the `limits` periods stack is undocumented.** The README shows only
   a `per_transaction` example. Whether `per_transaction` plus `daily` enforces
   both, the narrower, or the last written is unknown — and §7.4 requirement 4
   depends on the answer.
3. `limits` are per-asset **atomic-unit strings**; `budget` is **USD**. Your
   spec is emphatic that sizing never derives from a USD figure, so the enforced
   cap must be `limits.<asset>.per_transaction`, with `budget.*_usd` as a coarse
   backstop only.

**Mainnet, real funds, no testnet mentioned** — which confirms the premise §7.4
rests on. The practical blocker is that an `naa_` key comes from **partner
onboarding, not self-service signup**, so whether it is obtainable inside the
window is a question for you.

---

## 5. OutLayer: a testnet, a TEE, and a possible privacy-track route

`github.com/out-layer/outlayer` — *"Verifiable compute and custody for AI
agents, on NEAR."* Agent keys held inside an **Intel TDX enclave**; priced
"connectors" execute in the same enclave.

**Two things here are strategically relevant, beyond custody.**

**It has a testnet**, which contradicts the assumption that this whole layer is
mainnet-only:

- mainnet `https://api.outlayer.ai`, contract `outlayer.near`
- testnet `https://testnet-api.outlayer.ai`, contract `outlayer.testnet`

*NEAR Intents* having no testnet and the *custody layer* having no testnet are
separate claims, and the second looks false. A custody policy could plausibly be
exercised on testnet even where a real swap cannot — which would let §7.4's
locks be demonstrated without real money.

**`INDEX.md` lists `privacy` as a track "if the TEE inference route is taken".**
OutLayer *is* a TDX enclave with a NEAR contract and a testnet. That is a more
direct privacy-track route than standing up TEE inference yourself, and it
overlaps work the optional micro tier would need anyway. Worth an hour's reading
before the track decision, not after.

**But its policy model is undocumented where I could read it.** The README says
the wallet is spent "under a policy its owner sets" and describes **none** of the
fields. They live in `CUSTODY.md`, `VAULTS.md`, `API.md`, and
`skills.outlayer.ai/agent-custody/SKILL.md` — and `skills.outlayer.ai` does not
resolve from this session. So **OutLayer's policy controls remain unconfirmed**,
and on current evidence the Agent API SDK clears the Step 9 gate while OutLayer
does not yet.

Minor, on a dependency you might take: the repo states **Apache-2.0 in its
sidebar and MIT at the foot of the README**. The licence is self-contradictory
as published.

---

## 6. What this container can and cannot reach

Direct egress is denied at the gateway — 403 to CONNECT, not a timeout — for
`api.stlouisfed.org`, `rpc.mainnet.near.org`, `rpc.testnet.near.org`,
`docs.near-intents.org`, `1click.chaindefuser.com`, `api.llama.fi` and
`docs.near.org`. The server-side fetch channel reaches `github.com` but **not**
`near.org` or `skills.outlayer.ai`.

So this session can do GitHub-hosted documentation and feed research, and
nothing that needs a key or a non-GitHub host.

**To make the cloud session useful for live probing**, these go under the
environment's Network access → Allowed domains, with *Allow package managers*
left ticked: `api.stlouisfed.org`, `rpc.mainnet.near.org`,
`rpc.testnet.near.org`, `1click.chaindefuser.com`, `docs.near-intents.org`,
`docs.near.org`, `near.org`, `api.llama.fi`, `api.outlayer.ai`,
`skills.outlayer.ai`. Settings are in the cloud environment menu in the session
title bar, under Edit.

---

## 7. A defect in `PITFALLS-AND-LESSONS.md` Part D

It numbers rules 1–42, then **restarts at 37** for four more, so 37–40 each name
two different rules:

| # | First use | Second use |
|---|---|---|
| 37 | A default that contradicts the documentation… | Audit the clone, not the working copy |
| 38 | Test on the host you will actually deploy to | The example config is production code |
| 39 | A file nobody reads is a file that does not exist | Check the file the field actually lives in… |
| 40 | Two names for the same four things… | A rename proposal needs evidence… |

46 rules under 42 numbers. Worth renumbering to 1–46 before anything cites
"rule 38" — which, by rule 40's own first use, is a duplicated control.
