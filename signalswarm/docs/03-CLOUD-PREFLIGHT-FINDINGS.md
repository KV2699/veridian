# Cloud session findings — partial preflight, research channel only

Written 1 Nov 2026 from the cloud session. **This is not `preflight.md`.**
Nothing here touched a live API with a key. Every item below came from fetching
a public documentation or feed page and reading it. Treat it as P3/P7 groundwork
that saves the local session time, not as a verified probe result.

What would catch any of it if it were wrong: a live call with a key. That has
not happened. Rule 22.

---

## 0. What this container can and cannot reach (measured, not assumed)

The previous cloud session's claim is **confirmed**. Direct egress is denied at
the gateway, not merely slow:

```
api.stlouisfed.org:443   403 to CONNECT (policy denial)
rpc.mainnet.near.org:443 403 to CONNECT
rpc.testnet.near.org:443 403 to CONNECT
docs.near-intents.org:443 403 to CONNECT
1click.chaindefuser.com:443 403 to CONNECT
api.llama.fi:443         403 to CONNECT
docs.near.org:443        403 to CONNECT
```

So **P1, P2, P5 and P6 cannot be run from a cloud container** as configured.
Step 0 stays local. That part of the handoff was right.

But the server-side fetch channel is **not** behind that proxy, and it reaches
some hosts:

| Host | Reachable this way |
|---|---|
| `github.com` | yes |
| `near.org` | **no** — does not resolve |
| `skills.outlayer.ai` | **no** — does not resolve |

Everything below came through `github.com`. The two unreachable hosts are named
as unreachable, not guessed at.

**If you want the cloud session to run the real Step 0**, the hosts to add under
the environment's Network access → Allowed domains (keep *Allow package
managers* ticked) are: `api.stlouisfed.org`, `rpc.mainnet.near.org`,
`rpc.testnet.near.org`, `1click.chaindefuser.com`, `docs.near-intents.org`,
`docs.near.org`, `near.org`, `api.llama.fi`. Settings are in the cloud
environment menu in the session title bar, under Edit.

---

## 1. P3 — `nearcore` releases: verified, and a double-count you will hit

`https://github.com/near/nearcore/releases.atom` — keyless, Atom, works.

**Schema, for the collector:**

- title: `entry/title` (the version tag, e.g. `2.14.0`)
- link: `entry/link[@rel="alternate"]/@href` (tag also appears in the URL path)
- date: **`entry/updated`. There is no `entry/published` element.**
- also present: `entry/id`, `entry/content`, `entry/author/name`

**The catch: two entries per release, not one.**

| Entry | Date (UTC) | What it actually is |
|---|---|---|
| `2.14.0` | 2026-10-26T18:59:52Z | the node release |
| `crates-0.38.0` | 2026-10-26T19:07:00Z | a crates.io snapshot, published by `github-actions[bot]` |

Both are stable, both are non-`rc`, both land eight minutes apart, and both
describe **the same upgrade**. Excluding `-rc.N` — which you have already done,
correctly — does not exclude this one. Counting both doubles nearcore's stable
release rate with a duplicate of a single event.

**Proposed code-level exclusion: drop tags matching `^crates-`,** and log each
drop as a `DUPLICATE` rejection rather than filtering it silently (rule 29).
Stable node releases in the feed's last 90 days then come to **one**, not two.

**One caution on `updated`:** on GitHub release feeds this timestamp moves if
the release notes are later edited, so it is not a stable publication date. If
a catalyst's date matters — and for a dated-event system it does — the tag
creation date from the release page is the safer field.

---

## 2. P3 — the NEPs feed: verified, and it is the source that answers the NEAR question

`https://github.com/near/NEPs/commits/master.atom` — keyless, Atom, works.
20 entries, newest 2026-10-14, oldest 2025-11-19.

**Schema:** `entry/title`, `entry/link[@rel="alternate"]/@href`, `entry/updated`.
Again **no `published`**.

**NEAR-relevant entries inside a 30-day window to 1 Nov 2026:**

| Date | Entry | Substantive? |
|---|---|---|
| 2026-10-14 | NEP-652: Early Chunk Producer Reassignment (#652) | **yes — new proposal** |
| 2026-10-07 | chore: fix link and add missing image (#658) | no — maintenance |

So the NEPs feed contributes **exactly one** real NEAR catalyst in the current
window.

**The noise problem, which is the same class of error as the `rc` one.** Of the
20 entries, roughly half are repository housekeeping — `chore:`, `ci:`, `docs:`,
`fix: update broken links`. Admitting those as `governance` events would inflate
NEAR's catalyst rate about twofold with commits that are not events at all.
A prefix exclusion on `chore:`/`ci:`/`docs:`/`fix:` is needed, logged as
rejections.

**Also worth knowing:** the feed carries commit titles only. Status transitions —
a NEP reaching Final or Approved, which is the genuinely tradeable moment — are
**not visible in it**. Two entries expose status in their body text (`Draft,
opened for SME review`; `Status: Needs WG to assign SME`) and neither is Final.
If "NEP approved" is the catalyst you want, this feed does not carry it and the
NEPs repo would have to be read another way.

**Event-type mapping question for you:** NEP-652 is a *proposed* change. Under
your closed list it is `governance`, not `protocol_upgrade` — a shipped nearcore
release is the upgrade. Mapping a draft proposal to `protocol_upgrade` would
repeat the `rc` mistake at the semantic level: counting a proposal to change
something as the change.

---

## 3. P3 — `near.org/blog`: not verified, and rule 31 says be wary of it

**Could not be fetched from here** — `near.org` does not resolve in this
session. Its feed path is unconfirmed; search results suggest a WordPress
pattern (`/blog/feed`, plus per-tag and per-category feeds such as
`/blog/tag/core-protocol/feed`), but **no feed URL here has been fetched, so
none of them is trusted.** Rule 8.

More importantly, before any effort goes into wiring it:

> **Rule 31. Ask who a source is written for. Your industry's trade press
> reports your competitors, not your customers.**

`near.org/blog` is NEAR's own publication. It is written for NEAR partisans, and
by C18's logic it will carry launches, partnerships and ecosystem wins — not
unlocks, incidents or hostile governance fights. That is precisely the feed
*audience* that `SIGNAL-CONTEXT.md` §4 warns produces the wrong kind of item for
a conviction signal.

`nearcore/releases` and `NEPs` are the opposite: primary, mechanical, dated, and
indifferent to whether the news flatters NEAR. **My recommendation is to wire
NEPs and leave the NEAR blog alone**, or admit it only under a source-audience
label that caps its confidence.

---

## 4. P7 — the "Agent API SDK" is real, and §7.4 requirement 3 is satisfiable

The handoff recorded this as *"package name and key format NOT verified"*. Both
are now verified from the official examples repository.

- **Package:** `@near-intents-agent-api/sdk` (TypeScript)
- **Install:** `pnpm add @near-intents-agent-api/sdk`
- **Key format:** API keys are prefixed **`naa_`**, created in the partner
  dashboard, shown once
- **Env:** `NEAR_INTENTS_AGENT_API_KEY`, `NEAR_INTENTS_AGENT_API_URL`
- **Hosted API:** `https://api.agentsonintents.com`
- **Partner dashboard:** `https://partners.near-intents.org/`
- **Repos:** `NEAR-Intents-Agent-API/{sdk-typescript,examples,api}`

**§7.4 requirement 3, field by field:**

| Spec requires | SDK policy field | Documented |
|---|---|---|
| swap-only actions | `actions` allowlist | yes |
| asset-**pair** allowlist | `assets` allowlist | **partially — see below** |
| per-transaction cap | `limits.<asset>.per_transaction` | yes |
| daily cap | `limits.<asset>.daily`, `budget.daily_usd` | yes |
| destination whitelist | `destinations` allowlist | yes |
| owner approval ON | `owner_approval: true` | yes |
| freeze / revoke switch | `freeze`, `grant_revoke` | yes |
| agent cannot change the policy | `policy_update` is an **owner-signed** op over the complete new policy, with an `expected_revision` check | yes |

Also present: `max_actions_per_hour`, `timelock_ms` execution delay, an owner
`schedule` of permitted hours, `archive`, `delete`, and an optional `native`
block that is **off by default**. Refusals surface as `spend_budget_exceeded` /
`policy_limit_exceeded`; a dry-run quote *warns* instead of refusing, and
exposes an `owner_approval` flag showing whether the live call would block.

Grants: your backend calls `createGrantCredential()` to mint a token plus a
commitment; the owner signs a `grant_issue` carrying **only the commitment**;
the token never leaves your backend and is stored encrypted; expiry up to 365
days; `grant_revoke` and `listGrants` for lifecycle. That matches §7.4
requirement 1 — the backend holds a revocable agent credential, not the owner's
key — closely enough to be worth the author's attention.

**Three things that are not resolved, and matter:**

1. **`assets` is an asset allowlist, not an asset-pair allowlist.** Allowlisting
   `{NEAR, USDC}` permits both directions. For a swap-only, two-asset policy
   that is probably equivalent in practice, but it is not what §7.4 asks for and
   the difference should be stated rather than assumed away.
2. **Whether the `limits` periods stack is explicitly undocumented.** The README
   shows only a `per_transaction` example. Whether setting `per_transaction` and
   `daily` together enforces both, or the narrower, or the last written, is
   unknown. §7.4 requirement 4 depends on the answer.
3. **`limits` are per-asset atomic-unit strings; `budget` is USD.** The spec is
   emphatic that sizing never comes from a USD figure. So the enforced cap must
   be `limits.<asset>.per_transaction` in atomic units, and `budget.*_usd`
   treated only as a coarse backstop — never as the control that defines the
   trade size.

**Mainnet, and no testnet.** The README states the hosted API "runs on mainnet
with real funds" and creating an agent performs a real on-chain onboarding. No
testnet or sandbox is mentioned; the only alternative described is a self-hosted
deployment via `baseUrl`. **This confirms the premise §7.4 is built on.**

**The practical blocker is the partner dashboard.** An `naa_` key comes from
partner onboarding, not a self-service signup. Whether that is obtainable inside
the submission window is unknown and is a question for you, not for code.

---

## 5. P7 — OutLayer: a contradiction worth recording

`github.com/out-layer/outlayer` — "Verifiable compute and custody for AI agents,
on NEAR". Agent keys held inside an Intel TDX enclave; priced "connectors" run
in the same enclave.

**It has a testnet**, which contradicts the assumption that this whole layer is
mainnet-only:

- mainnet: `https://api.outlayer.ai`, contract `outlayer.near`
- testnet: `https://testnet-api.outlayer.ai`, contract `outlayer.testnet`

That matters: *NEAR Intents* having no testnet (§7.4) and the *custody layer*
having no testnet are separate claims, and the second one appears to be false.
A custody policy could potentially be exercised on testnet even if a real swap
cannot.

**But its policy model is undocumented where I could read.** The README says the
wallet is spent "under a policy its owner sets" and describes **none** of the
fields. The policy detail lives in `CUSTODY.md`, `VAULTS.md`, `API.md`, and
`skills.outlayer.ai/agent-custody/SKILL.md` — and `skills.outlayer.ai` does not
resolve from this session. **So OutLayer's policy controls remain unconfirmed.**

Minor but worth noting on a dependency you might take: the repo states
**Apache-2.0 in its sidebar and MIT at the foot of the README.** The licence is
self-contradictory as published.

**Verdict on Step 9's gate.** The handoff said: if the policy features cannot be
confirmed from official docs, Step 9 does not get built. On this evidence the
**Agent API SDK clears that bar** and OutLayer does not yet. That reverses the
conclusion I would have drawn an hour ago, and it is a documentation result, not
a tested one.

---

## 6. The NEAR question, answered from your own rules

You asked whether to wire NEPs and the NEAR blog, or to wait on whether NEAR
should earn its place at all. Two rules in `PITFALLS-AND-LESSONS.md` Part D
decide this between them:

> **33. Do not lower the floor to make a thin week look better. Check the
> near-misses first; if they are marginal, the number is the truth.**

The local session was right not to touch the floor — that is the half of rule 33
everyone remembers. But the rule has a second clause, and it is an instruction:
**check the near-misses first.** NEAR sitting at one catalyst against a floor of
two *is* the near-miss. Checking it means asking whether a real second event
exists that no wired source is carrying.

It does: **NEP-652, 14 October 2026.** Dated, primary, keyless, and verified
above.

So wiring NEPs is not lowering the floor. It is the near-miss check rule 33
requires, and it is the honest half of the fix. NEAR would then clear the floor
on **two real events** — nearcore 2.14.0 on 26 Oct and NEP-652 on 14 Oct —
neither of them manufactured.

> **11. "Checked and quiet" is a finding. "Didn't look" is not.**

Which is the other half. If NEAR still comes last after NEPs is wired, that is a
finding and it should ship as one. The strongest version of this submission is
the one where the number is the truth and the README says so.

**So: wire NEPs. Leave the blog.** And keep the honest reporting either way —
the argument that NEAR is the settlement layer rather than the subject is a real
one, and it is not weakened by NEAR having two catalysts instead of one.

---

## 7. A defect in Part D itself

`PITFALLS-AND-LESSONS.md` Part D numbers its rules 1–42, then **restarts at 37**
for four more. Numbers 37, 38, 39 and 40 each name two different rules:

| # | First use | Second use |
|---|---|---|
| 37 | A default that contradicts the documentation… | Audit the clone, not the working copy |
| 38 | Test on the host you will actually deploy to | The example config is production code |
| 39 | A file nobody reads is a file that does not exist | Check the file the field actually lives in… |
| 40 | Two names for the same four things… | A rename proposal needs evidence… |

There are 46 rules under 42 numbers. Worth renumbering to 1–46 before anything
cites "rule 38" — which, by rule 40's own first use, is a duplicated control.

---

## 8. What is still unverified, and must stay local

- **P1 FRED** — no key used, host denied. Response shape, `"."` missing weeks,
  whether 56+ observations return, `RRPONTSYD` availability: all still open.
- **P2 NEAR RPC** — `amount`/`locked` presence, yoctoNEAR units, rate limits,
  and which of the three window options ships.
- **P5 1Click** — the real flag name for a non-executing quote (the spec assumes
  `dry=true`), minimums, deadlines. Note the local session has already *measured*
  the fee at `fee: 20` = 0.2%, which beats the two disagreeing doc pages.
- **P6 LLM provider** — which models the account actually exposes. The Auspius
  precedent is directly relevant: advisory documents recommended
  `Nemotron-3-Nano-Omni`, and the account exposed five Nemotron models of which
  that was not one.
- **near.org blog feed**, and **OutLayer's `CUSTODY.md` / agent-custody skill.**
- Whether an `naa_` partner key is obtainable inside the window.
