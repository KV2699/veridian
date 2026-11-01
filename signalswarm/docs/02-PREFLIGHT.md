# Step 0 — Preflight

**Run every probe. Paste real output into `docs/preflight.md`. Do not write a
collector against a remembered endpoint shape.**

The cloud session could run none of these: its egress policy denied every host.
A local session should have no such problem, but check the first probe's result
before assuming it.

Record for each: the command, the HTTP status, the first part of the body, and
a one-line verdict — **WORKS / CHANGED / UNAVAILABLE**. For anything that is not
WORKS, propose a **labelled** fallback and stop for the author.

---

## P1 — FRED, `WALCL` and `WTREGEN`

Needs a free API key from https://fred.stlouisfed.org/docs/api/api_key.html,
in `.env` as `FRED_API_KEY`. Never committed.

```bash
curl -sS -w '\nHTTP %{http_code}\n' \
  "https://api.stlouisfed.org/fred/series/observations?series_id=WALCL&file_type=json&api_key=$FRED_API_KEY&sort_order=desc&limit=60"
```

Confirm, and write down:

- the exact JSON path to the array (expected `observations`) and the field names
  (expected `date`, `value`)
- that `value` is a **string**, and what a missing week looks like (expected `"."`)
- the **release cadence and lag**. `WALCL` is weekly, dated Wednesday, published
  Thursday afternoon. Record the gap between the newest `date` and today — the
  staleness threshold in `SIGNAL-CONTEXT.md` §2 is 14 days because of this, and
  a 48-hour check would mark the macro agent degraded on every run.
- at least 56 observations are returnable, since §8's tercile thresholds need a
  trailing 52.

Repeat for `WTREGEN`.

**Also probe `RRPONTSYD`** (overnight reverse repo). Net liquidity in general
use is `WALCL − WTREGEN − RRPONTSYD`. If it returns on the same call shape,
propose adding it; if not, say so and keep net liquidity as `WALCL − WTREGEN`
with the difference stated in the README.

---

## P2 — NEAR RPC

```bash
curl -sS -w '\nHTTP %{http_code}\n' -X POST https://rpc.mainnet.near.org \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"query","params":{"request_type":"view_account","finality":"final","account_id":"aurora"}}'
```

Confirm, and write down:

- that the result carries **both `amount` and `locked`**, and their units
  (expected yoctoNEAR, 10^24 per NEAR, as decimal strings)
- whether the public endpoint rate-limits a watchlist-sized burst, and at what
  rate. If it does, record the limit and the backoff the collector will use.
- **the window problem.** `view_account` gives *now*, not a change. Decide and
  record which applies:
  1. an archival node or indexer that answers a historical block height —
     probe one and record its URL and whether it needs a key;
  2. a free explorer/indexer API — probe it, record auth and limits;
  3. **the difference between two recorded snapshots** — no extra service, but
     the demo then needs two snapshot dates and the README must say so.

  Option 3 always works and is the honest fallback. Say which one shipped.

Also probe testnet (`https://rpc.testnet.near.org`, method `status`) for §7.1.

---

## P3 — RSS feeds

Find **at least two keyless feeds carrying NEAR-relevant catalyst items** —
unlocks, upgrades, listings, security incidents, governance.

```bash
for u in "<candidate-1>" "<candidate-2>" "<candidate-3>"; do
  echo "--- $u"
  curl -sSL -w '\nHTTP %{http_code}\n' -A 'Mozilla/5.0' "$u" | head -c 600
done
```

For every candidate record: HTTP status, whether it parses as RSS or Atom, the
item field names (`title`, `link`, `pubDate` vs `published`), how many items are
inside the last 30 days, and how many mention NEAR.

**And record who each feed is written for.** A feed written for NEAR partisans
reports launches; one written for traders reports unlocks and incidents. The
second kind is what a conviction signal needs. A trade publication serving your
own subject reports it favourably, not usefully.

Expect dead candidates — of 14 feeds tested on a prior project, 3 were dead
(one 404, two 403), and all three would have been silent failures. **Fetch every
source before committing it.**

---

## P4 — NEAR testnet account tooling

For §7.1 sub-accounts (`macro.`, `onchain.`, `narrative.`, `verifier.`,
`quorum.` under `NEAR_PARENT_ACCOUNT`).

Check **current** docs at https://docs.near.org — do not rely on remembered
tooling. Establish: whether sub-account creation is feasible from Python today
and with which library and version; the funding each needs; and whether the
testnet faucet still works as documented.

If it is not feasible from Python, say so and propose the labelled ledger-only
fallback from §7.2 — payments recorded in the `payments` table and shown in the
dashboard as `LEDGER ONLY — no on-chain transfer`. **Never imply a transfer
happened if it did not.**

---

## P5 — NEAR Intents 1Click API

Read https://docs.near-intents.org **before writing anything**. Establish and
record the exact request schema, auth requirements, and the field names for a
quote. In particular:

- the exact flag for a non-executing quote (the spec assumes `dry=true` —
  **verify the real field name**)
- whether a fee applies without a partner JWT, and how much
- minimum swap sizes and quote deadlines
- that amounts are **token amounts**, and that `amountOutUsd` must never be used
  for sizing

Record the documented statement that **there is no testnet for NEAR Intents** if
it is still current, since the whole of §7.4 rests on it.

---

## P6 — LLM provider

Confirm the OpenAI-compatible endpoint answers, and that model IDs come from env
rather than being hardcoded. Record which models are actually exposed on this
account — a prior project was advised to use a model the account did not expose.

Note the two tiers: `FAST` (narrative headline classification, batched) and
`REASONING` (verifier). The author chooses the models after measuring a couple
on the same task; log the comparison to `docs/model-comparison.md`.

---

## P7 — Agent custody, **only** for the optional Step 9

Do not build anything here. Establish what currently exists and is documented:

- the "Agent API SDK" the author was pointed to — **package name and key format
  are unverified**; confirm from official docs or report that it could not be found
- OutLayer agent custody

For each, record: whether an owner can set a policy the agent cannot change,
covering swap-only actions, an asset-pair allowlist, per-transaction and daily
caps, a destination whitelist, owner approval, and a freeze/revoke switch; plus
mainnet-only behaviour and minimum swap sizes.

**If the policy features cannot be confirmed from official docs, Step 9 does not
get built.** Do not guess, and never raise a cap to meet a solver's minimum —
report it and ask the author.

---

## What to produce

`docs/preflight.md`, containing:

1. every command run and its real output
2. the WORKS / CHANGED / UNAVAILABLE verdict per probe
3. **a list of what is NOT available, each with its proposed labelled fallback**
4. anything that contradicts an assumption in `SIGNAL-CONTEXT.md`, which is a
   design document written without network access and may be wrong

Then **stop and report.** Step 1 does not begin until the author has read it.
