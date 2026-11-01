# SignalSwarm — project spec

**Part A is the author's spec, reproduced as written.**
**Part B is the amendments the cloud session proposes. Part B is not yet approved.**

---

# PART A — the author's spec, as written

NEAR Hackathon entry. Track: **AI Swarms** (also fits Agent Economy).
Development window: 1 Nov 2026 00:00 UTC to 14 Nov 2026 23:59 UTC.
Submission needs: a PUBLIC repo, a public demo post on X (tag @NEARProtocol and #NEARHackathon, say it was built at NEAR HACKATHON), and both links in the form.

Read this whole file before writing any code. Then follow the build order in section 10, one step at a time.

## 0. Rules of engagement (read first)

1. **Build only what this file lists, in order.** After each step: run the tests, then STOP and report what works, what does not, and what you could not verify. Do not continue to the next step until told.
2. **Never fake it.** If an API, key, endpoint or tool is unavailable or has changed, say so in your report and propose a labelled fallback. Do not silently mock. Anything mocked or simulated is labelled in the UI and the README: `[MOCK DATA]`, `SIMULATED — no funds moved`, or `LEDGER ONLY — no on-chain transfer`.
3. **Verify external tooling against current docs before coding against it** (FRED API, NEAR RPC and account tooling, NEAR Intents 1Click API at docs.near-intents.org). Do not rely on remembered endpoint paths or field names.
4. **All code is written fresh in this repo during the window.** The author has an earlier, unrelated project called Auspius (a Node.js business-development tool). Do NOT copy code, prompts, configs or data from it. Only the general ideas listed in section 12 carry over, and they must be re-implemented from scratch.
5. **Stack:** Python 3.11+, FastAPI, SQLite (stdlib `sqlite3` or SQLAlchemy), Pydantic v2, pytest. Frontend is ONE static HTML file with vanilla JS served by FastAPI. No build step, no npm. Reason: automated screeners must be able to run it with two commands.
6. **One run command and one port, everywhere:** `python app.py` on `http://localhost:8000`. The README, the code and the dashboard must all agree.
7. **Safety:** the default path and the entire demo use paper mode and testnet only. No private keys, API keys or seed phrases in the repo. Provide `.env.example`. Add `.env` and `data/*.db` to `.gitignore`. Real-money micro-execution exists ONLY as an optional, off-by-default, owner-gated tier (section 7.4), built last (Step 9), and only when the author explicitly asks. It must be unreachable without credentials and flags that are never in the repo.
8. **The model never decides.** Models classify, check grounding, and write prose. Code computes every number, every score, every vote direction, every size and every weight.

## 1. What SignalSwarm is

A profile-swappable crypto research swarm. Collector agents gather grounded evidence, a verifier decides what counts as evidence, and a quorum agent turns verified agreement into a simulated, approval-gated NEAR Intents proposal. Outcomes adjust each agent's influence.

The hero demo: **one frozen snapshot of real data, read through two opposite profiles (momentum and contrarian), produces opposite decisions.** Interpretation is declared configuration, not hardcoded logic.

What it does NOT claim: that it learns continuously, predicts markets, identifies smart money, or trades autonomously. See the banned-wording table in section 13.

## 2. Architecture: five agents

| # | Agent | Job | Model use |
|---|---|---|---|
| 1 | Macro Collector | Fed balance sheet (FRED `WALCL`) and Treasury General Account (FRED `WTREGEN`): 4-week percent changes | None (code only) |
| 2 | On-Chain Collector | Curated NEAR wallet watchlist: balance changes over a window | None (code only) |
| 3 | Narrative Collector | Catalyst-only items from public RSS feeds: token unlocks, protocol upgrades, listings, security incidents | FAST tier: classifies each headline into a closed set of event types |
| 4 | Verifier | Grounding ("is this item actually about this asset?"), deduplication, staleness, counter-reading, rejection log | REASONING tier |
| 5 | Quorum Agent | Weighted vote, conflict penalty, sizing, no-trade brief, proposed intent | None (code only) |

- Agents 1 to 3 run concurrently (`asyncio.gather`). Agent 4 runs after all candidates exist. Agent 5 runs only after verification.
- Persistence (SQLite writes, weights) is plain code in `core/store.py`. It is not an agent.
- **Phase 2, do NOT build:** market-structure collector, NEAR-ecosystem collector, intents-volume collector, portfolio watch, unattended or autonomous live execution, shuffled-baseline signal-quality audit.

Project layout:

```text
signalswarm/
├── app.py                      # starts FastAPI on :8000
├── CLAUDE.md
├── README.md
├── .env.example
├── profiles/
│   ├── momentum.json
│   └── contrarian.json
├── data/
│   ├── watchlist.json          # curated wallets, hand-picked by the author
│   └── snapshots/              # recorded real data + cached model outputs
├── signalswarm/
│   ├── agents/                 # macro.py, onchain.py, narrative.py, verifier.py, quorum.py
│   ├── core/                   # evidence.py, profile_engine.py, feedback.py, store.py, llm.py, replay.py
│   ├── near/                   # accounts.py, payments.py, intents.py
│   └── api.py
├── static/index.html
├── tools/record_feed.py
├── scripts/clean_clone_check.sh
└── tests/
```

## 3. The frozen feed (record and replay). Build this FIRST.

Purpose: both profiles must read identical evidence, and demos must be repeatable and free.

- `tools/record_feed.py` calls the REAL data sources once and saves every raw response to `data/snapshots/<YYYY-MM-DD>.json`, each with: source name, source URL, `retrieved_at`, raw payload, and a SHA-256 of the payload. It also records `as_of`, the reference date for the snapshot.
- Real sources to use (verify each works at build time):
  - **FRED**: series `WALCL` and `WTREGEN` (free API key, `FRED_API_KEY`).
  - **NEAR on-chain**: current balances for wallets in `data/watchlist.json` via a public NEAR RPC endpoint (`NEAR_RPC_URL` in env). For balance change over a window, use a free explorer or indexer API (configurable), OR compute the change between two recorded snapshots and say so. Every number must trace to a recorded payload.
  - **Narrative**: public RSS feeds (`RSS_URLS` in env). Choose feeds that need no key. Record the raw items.
- **Never hand-edit a snapshot.** Never hand-craft data to force the polarity flip. If the real snapshot does not produce a flip, record another real snapshot date and disclose in the README that the demo snapshot was selected after the fact.
- Replay mode is the default: `SNAPSHOT=<date>` loads the file, collectors read from it, no network calls.
- **Model outputs are cached too.** Save every model response keyed by a hash of (model tier, prompt) in `data/snapshots/<date>.llm_cache.json`. Replay reads the cache first, so the demo and screeners run with no API keys and get identical results.
- Today's date rule: every prompt includes the snapshot's `as_of` date in replay mode, or today's UTC date in live mode, explicitly stated as "Today's date is ...". A model with no stated date will treat fresh news as being in the future.

## 4. Evidence contract and numeric guard

### 4.1 Signal schema (Pydantic, strict)

```json
{
  "agent": "macro",
  "asset": "NEAR",
  "signal_type": "liquidity_change",
  "direction": "long | short | neutral",
  "confidence": 0.0,
  "metrics": [
    {"id": "m1", "name": "walcl_4w_change_pct", "value": 0.4, "unit": "percent",
     "window": "4w", "source_id": "s1"}
  ],
  "sources": [{"id": "s1", "url": "https://...", "retrieved_at": "ISO-8601"}],
  "as_of": "ISO-8601",
  "expires_at": "ISO-8601",
  "status": "ok | degraded",
  "reason_code": null
}
```

- `direction` and `confidence` are computed by CODE from the active profile's rules (section 5). Never by a model.
- **Metrics are computed by collector code from the raw payload** and given IDs (`m1`, `m2`, ...). Sources get IDs (`s1`, ...).

### 4.2 The numeric guard (prevent, then detect)

- Models never emit numbers or URLs. Where a model produces structured output, it may only reference metric IDs and source IDs, and choose from closed label sets.
- Anything the model writes as prose (counter-readings, explanations) is checked by code: every numeral in the text must match a value rendered from the payload for that signal. A mismatch drops the text and logs `FABRICATED_METRIC`.
- A referenced source ID or URL not in the recorded payload is dropped and logged `UNGROUNDED`.

### 4.3 Reason codes (MVP set, closed)

Signal-level rejections: `UNGROUNDED`, `DUPLICATE`, `STALE`, `FABRICATED_METRIC`, `MISSING_SOURCE_DATA`, `BELOW_FLOOR`.
Decision-level codes: `NO_QUORUM`, `CONFLICT_BELOW_MIN_SIZE`, `INSUFFICIENT_EVIDENCE`.

Every rejection is stored with its code, the signal, and the reason text. Nothing is silently dropped.

### 4.4 Degraded state

If a source fails or required data is missing or stale, the collector returns `status: "degraded"`, `direction: "neutral"`, `confidence: 0.0`, `reason_code: "MISSING_SOURCE_DATA"`, and logs the error. It never fills the gap.

### 4.5 Adversarial test case

Create `tests/fixtures/adversarial_model_output.json`: a scripted model response that cites a metric value that is not in the payload and a source URL that was never retrieved. It is used by the tests AND by a dashboard button, always labelled **ADVERSARIAL TEST CASE — injected on purpose**. Never present it as organic.

## 5. Profiles (polarity)

A profile is a JSON file that declares how the same evidence is read. The engine contains no market opinion.

Required fields: `name`, `description`, `polarity_notes` (plain English, passed into the verifier prompt so counter-readings are written from the profile's point of view), `base_notional`, `min_executable_notional`, `quorum_threshold` (default 1.2), and `rules`.

Each rule: which agent and metric or event type it reads, a threshold condition, the vote it produces, a base confidence, and optional confidence increments. Example shape:

```json
{
  "agent": "onchain",
  "metric": "watchlist_net_balance_change_pct_24h",
  "when": "> 0",
  "vote": "long",
  "base_confidence": 0.30,
  "increments": [
    {"metric": "watchlist_wallets_accumulating", "when": ">= 3", "add": 0.20}
  ],
  "rationale": "Net accumulation by curated wallets reads as demand."
}
```

Contrarian is the declared inverse for the same observations: accumulation by curated wallets reads as crowding (short or neutral), exchange-deposit style outflow-from-holders reads as capitulation (long), and so on. Write both profiles as complete rule sets covering macro, on-chain and narrative event types. Each rule carries a `rationale` string shown in the dashboard.

Process rules:
- Write both profiles BEFORE running them on any snapshot. Commit them. Do not tune thresholds after seeing a result to manufacture a flip.
- The author reviews both rule sets before the first run. Stop and ask after generating them.
- Narrative event types are a closed list: `token_unlock`, `protocol_upgrade`, `listing`, `security_incident`, `governance`, `other`. The FAST model only classifies a headline into this list. The profile maps event type to a vote.

## 6. Verifier, quorum and feedback

### 6.1 Verifier (REASONING tier)
For each candidate signal it may only:
- check grounding: is the cited item actually ABOUT the asset or topic, not merely mentioning it (returns a boolean and a reason from a closed set),
- flag duplicates (same canonical URL, or near-identical titles by code first, model second),
- write ONE sentence counter-reading: the strongest argument against acting, written from the active profile's `polarity_notes`.

It may NOT change direction, confidence, metrics or sources. Counter-readings pass the numeric guard. Rejected signals are logged with codes. A signal the model cannot judge is kept and marked `verified: false`, never silently dropped.

### 6.2 Quorum (code only)
- `long_score = Σ weight_i × confidence_i` over agents voting long. Same for `short_score`. Neutral and degraded agents contribute nothing.
- Require at least 2 non-neutral agents agreeing on the winning direction AND winning score ≥ `quorum_threshold`.
- Conflict penalty: `size = base_notional × (win − lose) / win`.
- If `size < min_executable_notional`, the decision is `NO_ACTION` with `CONFLICT_BELOW_MIN_SIZE`.
- Every cycle produces a Decision record, including no-trade outcomes:

```json
{
  "decision": "propose_long | propose_short | no_action",
  "reason_code": null,
  "long_score": 1.35, "short_score": 0.80, "size": 0.0,
  "votes": [{"agent": "macro", "direction": "long", "weight": 1.0, "confidence": 0.5}],
  "explanation": "Templated by code from the numbers above.",
  "counter_reading": "One sentence from the verifier.",
  "expires_at": "ISO-8601",
  "next_review_at": "ISO-8601"
}
```

The **No-Trade Brief** is this record when `decision` is `no_action`. It is a first-class screen, not an error state.

### 6.3 Feedback (code only, `core/feedback.py`)
- Weights start at 1.0.
- Win: each agreeing agent gains `0.05 × confidence`. Loss: each agreeing agent loses `0.08 × confidence`. Clamp to [0.25, 2.0].
- Neutral and dissenting agents never change.
- Every change is persisted with the reason, the decision ID, and before/after values.
- The "outcome" in the demo is resolved by an explicit user action (`/resolve`), labelled simulated. Do not describe this as the swarm learning from the market.

## 7. NEAR layer

### 7.1 Agent sub-accounts (testnet)
- `scripts/setup_near.py` creates testnet sub-accounts under a parent testnet account provided as `NEAR_PARENT_ACCOUNT` in env: `macro.`, `onchain.`, `narrative.`, `verifier.`, `quorum.` prefixed. The author creates and funds the parent account. Check current NEAR tooling in docs.near.org before implementing and report if account creation is not feasible from Python.
- The dashboard "Agent Accounts" view shows, per agent: sub-account ID, current weight, signals submitted, signals accepted, signals rejected, whether it voted, abstained or was degraded, and payments received.

### 7.2 Coordination mechanism: pay for accepted evidence
- Each collector's signal carries its code-computed confidence as its "bid" for attention.
- The Verifier accepts, corrects or rejects.
- For each ACCEPTED signal, the quorum sub-account sends a tiny testnet transfer (configurable, default 0.01 NEAR) to the collector's sub-account. Rejected signals earn nothing but stay in the rejection log.
- Store each payment in a `payments` table with tx hash. Show it in the dashboard.
- If on-chain transfers fail or are unavailable, fall back to ledger-only entries labelled `LEDGER ONLY — no on-chain transfer`, and state which mode ran in the README. Never imply a transfer happened if it did not.

### 7.3 NEAR Intents: execution tiers
- `near/intents.py` supports tiers selected by `EXECUTION_TIER` (default `paper`). Tier `paper` calls the 1Click API quote endpoint with `dry=true` ONLY. Read the current API docs first for the exact request schema, auth and fields. Do not guess. Tiers `quote` and `micro` are described in 7.4 and are NOT built until Step 9.
- In `paper` tier a wrapper raises if anything other than `dry=true` is requested. Until Step 9 is built there is NO `dry=false` code path in the repo, and a test asserts this.
- Every response shown to the user carries the label `SIMULATED — no funds moved`.
- Size using actual token amounts, never `amountOutUsd`.
- The proposed intent is attributed to the quorum sub-account. A human must click "Request NEAR Intents Quote" in the UI; nothing is requested automatically.

### 7.4 Optional micro-execution (Step 9 only)

Context, checked against the current NEAR Intents docs: there is **no testnet for NEAR Intents**. The docs recommend testing on mainnet with separate dev/test accounts and small amounts. So any real execution test uses real money. Its only purpose is to prove the plumbing works (quote, deposit, settle, status). It does NOT validate the strategy and must never be presented as evidence of returns.

Tiers: `paper` (dry=true, default) → `quote` (build only if the 1Click docs confirm that a non-dry quote moves no funds until a deposit is sent; otherwise skip this tier) → `micro` (one capped swap).

All of the following must hold. Build the locks and their tests BEFORE the executor:

1. **Dedicated account.** A fresh mainnet owner account used only for this test, never the author's main wallet. The backend never holds the owner's private key. It may hold at most a revocable agent credential, in backend env only.
2. **The author funds it manually,** once, outside the app, with an amount they can afford to lose entirely. No code in this repo initiates a deposit from any other wallet.
3. **Limits are enforced by the custody layer, not only by our code.** Use an agent-custody layer where the owner sets a policy that the agent cannot change: swap-only actions, asset-pair allowlist, per-transaction cap, daily cap, destination whitelist limited to an address the author controls, owner approval ON, and a freeze/revoke switch. In Step 0, verify which options actually exist and are current: the author has been pointed to an "Agent API SDK" (package name and key format NOT verified) and OutLayer agent custody is another documented option. Confirm packages, endpoints and key types from official docs. Do not guess.
4. **Our own caps as well (defence in depth):** `MICRO_MAX_AMOUNT_IN` in atomic token units (never USD-sized, never `amountOutUsd`), `MICRO_MAX_SWAPS_PER_DAY=1`, and a pair allowlist in config. Refuse any quote above the cap.
5. **Triple opt-in:** `EXECUTION_TIER=micro`, `MICRO_ENABLED=I_UNDERSTAND_THIS_USES_REAL_FUNDS`, and credentials present in env. If any is missing, `/execute` returns 403 and makes no network call.
6. **Human approval for every execution.** The UI shows the exact quote (pair, amounts, fees, deadline, destination) and requires typing the amount to confirm. No model, loop or scheduler can call `/execute`. The LLM client has no access to the execution module, keys or grant tokens.
7. **Simple mapping:** `propose_long` = swap stable into NEAR; `propose_short` = swap NEAR into stable (an exit to stablecoin, not a leveraged short). Say so in the UI.
8. **Log the full lifecycle** (quote, deposit, settle, status) in an `executions` table with tx hashes. Show failures as failures.
9. **Fees and minimums:** read the docs for the fee without a partner JWT, minimum swap sizes and deadlines. If the cap is below a solver's minimum, report it and ask the author. Never raise the cap yourself.
10. **Unreachable for screeners:** the replay and paper path never loads credentials. `scripts/clean_clone_check.sh` must assert that `/execute` returns 403 on a fresh clone.
11. Loosening the policy or turning off owner approval after a successful run is the author's manual decision, outside this repo.

## 8. Model client and cost ledger

- `core/llm.py` is the only place models are called. Provider and model IDs come from env (OpenAI-compatible endpoint assumed). Never hardcode model IDs.
- Two tiers: `FAST` (narrative headline classification, batched) and `REASONING` (verifier). The author will choose the models after measuring a couple of options on the same task; leave room for that and log the comparison to `docs/model-comparison.md`.
- `LLM_MODE=scripted` returns fixtures for tests. `LLM_MODE=cache` reads the snapshot cache. `LLM_MODE=live` calls the provider and writes the cache.
- Put stable instructions and JSON schemas first in each prompt and volatile evidence last (prompt caching friendly).
- Every call writes to `token_costs`: agent, tier, model, input_tokens, cached_input_tokens, output_tokens, estimated_cost_usd. The dashboard shows a cost-per-cycle panel.

## 9. API and dashboard

Endpoints (final list, no others):

| Method | Path | Does |
|---|---|---|
| POST | `/run?profile=momentum\|contrarian` | Runs a full cycle on the loaded snapshot |
| GET | `/decision/latest` | Latest Decision record incl. votes and counter-reading |
| GET | `/why-no-trade` | The No-Trade Brief for the latest cycle |
| GET | `/signals` | Accepted signals with evidence, source, retrieved_at, expiry |
| GET | `/rejections` | Rejection log with reason codes |
| GET | `/agents` | Sub-accounts, weights, payments |
| POST | `/quote` | Requests the `dry=true` NEAR Intents quote (human-triggered) |
| POST | `/execute` | Step 9 only. Human-approved micro-execution. Returns 403 unless every lock in 7.4 is satisfied |
| POST | `/resolve` | Body `{"outcome": "win" or "loss"}`; applies feedback |
| POST | `/adversarial` | Injects the adversarial test fixture, clearly labelled |
| GET | `/audit` | Three checks only: grounding, rejection, decision |
| GET | `/costs` | Token and cost ledger |
| POST | `/reset` | Reset weights and cycle state |

`/audit` returns exactly:
1. **Grounding audit:** every URL and number in accepted signals exists in the recorded payload.
2. **Rejection audit:** every dropped signal has a reason code.
3. **Decision audit:** every proposal shows votes, weights, scores, conflict penalty and final size.

Do NOT implement a "tautology" or "denominator" check. It is out of scope.

Dashboard (`static/index.html`): buttons **Run Momentum Profile**, **Run Contrarian Profile**, **Request NEAR Intents Quote**, **Resolve as Loss**, **Resolve as Win**, **Run Adversarial Test**; views for Decision, Evidence (click a signal to see source URL, retrieval time, metric, unit, window, confidence, counter-reading, expiry), Rejection Log, Agent Accounts, Why No Trade, Costs. A visible banner states the data mode: `REPLAY: real snapshot recorded <date>` or `LIVE`. Any mock element carries `[MOCK DATA]`.

## 10. Build order (stop and report after each step)

**Step 0: Preflight.** Verify and report in `docs/preflight.md`: FRED key works for `WALCL` and `WTREGEN`; NEAR RPC endpoint reachable and a way to get balance changes; at least two working keyless RSS feeds with NEAR-relevant items; testnet parent account and tooling feasible from Python; 1Click API dry quote schema and auth requirements; LLM provider reachable; and, for the optional Step 9, which agent-custody options currently exist and are documented (the author's "Agent API SDK" and OutLayer), including their policy features, mainnet-only behaviour and minimum swap sizes. List what is NOT available and the proposed labelled fallback. Do not proceed on assumptions.

**Step 1: Scaffolding.** Repo layout, `.env.example`, `.gitignore`, MIT licence, Pydantic models (`core/evidence.py`), SQLite schema (`signals`, `rejections`, `decisions`, `trades`, `outcomes`, `agent_weights`, `weight_changes`, `payments`, `audit_log`, `token_costs`), draft `profiles/momentum.json` and `profiles/contrarian.json`. STOP and let the author review both profiles.

**Step 2: Record and replay.** `tools/record_feed.py`, snapshot format, replay loader, LLM cache. Record one real snapshot. Report what was recorded.

**Step 3: Collectors.** Macro, On-Chain, Narrative. Metrics computed in code with IDs and sources. Degraded-state behaviour. The profile engine turns metrics and event types into direction and confidence.

**Step 4: Evidence guard and verifier.** Numeric guard, source guard, dedupe, staleness, counter-reading, rejection log, adversarial fixture.

**Step 5: Quorum, feedback, No-Trade Brief.** Scores, conflict penalty, minimum executable size, weight updates with persistence.

**Step 6: NEAR.** Sub-accounts, pay-for-accepted-evidence (or labelled ledger fallback), `dry=true` quote wrapper.

**Step 7: API and dashboard.** Endpoints and single-page UI from section 9.

**Step 8: Submission hardening.** README with do-X-see-Y and the prior-work declaration. `scripts/clean_clone_check.sh`: clones the repo into a fresh temp directory with no `.env`, installs, runs `python app.py` in replay mode, hits each endpoint, and fails loudly on any mismatch with the README. Run it and report the result honestly.

**Step 9 (OPTIONAL, only after Steps 0 to 8 pass AND the author explicitly asks):** Build the section 7.4 locks first, with tests, then the executor. STOP before any real request and let the author fund the dedicated account and set the custody policy. Never run the executor yourself. The author triggers the first execution manually from the UI.

## 11. Tests (must pass before each step is called done)

- Fabricated metric in model prose is rejected (`FABRICATED_METRIC`).
- Source URL not in the recorded payload is rejected (`UNGROUNDED`).
- Degraded source yields neutral, 0.0 confidence, `degraded`, no invented data.
- One agent alone cannot pass quorum; two agreeing agents above threshold can.
- Conflict penalty reduces size per the formula; below minimum size gives `CONFLICT_BELOW_MIN_SIZE`.
- Weights: win and loss deltas correct, only agreeing agents change, clamp holds at 0.25 and 2.0, every change persisted with reason.
- Polarity flip: momentum and contrarian run on the SAME snapshot file (byte-identical, assert the hash) and produce different decisions.
- In `paper` tier the Intents wrapper raises on anything but `dry=true`. Until Step 9 exists, a grep test confirms there is no `dry=false` code path. After Step 9, tests confirm `micro` is unreachable by default: with no credentials or flags, `/execute` returns 403 and no non-dry request is made (mock the network and assert).
- Every Intents response carries the SIMULATED label.
- Replay with `LLM_MODE=cache` makes zero network calls (mock the network and assert).
- `/audit` returns the three checks and nothing else.

## 12. README requirements

1. **Do X, see Y.** Numbered, literal and executable: start the app, run momentum, run contrarian, inspect evidence, open the rejection log, view agent accounts, request the dry quote, resolve as loss. Each step says exactly what to click and exactly what appears. The README must match the running app, port and commands exactly. AI screeners run it first.
2. **Data and honesty section:** which parts are real (recorded snapshot date and sources), which are simulated, which are labelled mock, and whether sub-account payments ran on-chain or ledger-only.
3. **Limitations:** replay demo, one snapshot, simulated outcomes, no claim of market prediction, Phase 2 list.
4. **Prior-work declaration** (paste and adjust):

> SignalSwarm adapts general methods from the author's earlier business-development signal platform, Auspius, built for a different hackathon. No Auspius code, configuration, prompts or datasets were copied into this repository. All SignalSwarm code was written for the NEAR HACKATHON after its 1 November 2026 00:00 UTC start. Only author-owned ideas carry over: collector and verifier separation, evidence grounding, rejection logging, counter-readings, profile-driven polarity and checkpoint replay. They were redesigned for crypto market intelligence, NEAR Intents, agent sub-accounts, reputation-weighted quorum and approval-gated simulated execution.

5. Track(s): AI Swarms, Agent Economy.

## 13. Wording rules (README, UI, demo script, X post)

| Do not say | Say |
|---|---|
| "The swarm learns" | "Agent influence is adjusted from recorded outcomes" |
| "AI predicts the market" | "Flags conditions a profile reads as higher or lower conviction" |
| "Smart money" | "Curated wallet watchlist" |
| "Autonomous trading" | "Approval-gated simulated execution" |
| "Live data proves it" | "A frozen real snapshot proves the profiles read identical evidence differently" |
| "Bidding market" (if payments are ledger-only) | "Reputation and payment ledger for accepted evidence" |
| "Trading agent", "profitable", "alpha" | "Plumbing test: one capped swap under owner-set policy limits. No claim about returns" |

## 14. Submission checklist

- [ ] Repo is PUBLIC, MIT licence, `.env` and keys not committed
- [ ] `scripts/clean_clone_check.sh` passes on a fresh clone
- [ ] README do-X-see-Y verified literally by running it
- [ ] If micro-execution was built: documented in a separate "Optional live micro-execution" README section; the do-X-see-Y flow never requires it; no keys committed; the demo post states the amount and claims no returns
- [ ] Prior-work declaration present
- [ ] Demo video or screenshots posted on X, tagging @NEARProtocol and #NEARHackathon, saying it was built at NEAR HACKATHON
- [ ] Demo shows: the polarity flip on the same snapshot, a rejection (adversarial case labelled), a No-Trade Brief, a weight change after "Resolve as Loss", the dry quote labelled SIMULATED, the agent accounts view
- [ ] Form submitted once before 14 Nov 2026 23:59 UTC with repo link, X post link, tracks, project description (20 to 2,000 characters) and the author's NEAR wallet address

---

# PART B — proposed amendments

**Not approved. Each needs the author's yes before it goes into the build.**
Full reasoning in `SIGNAL-CONTEXT.md`.

### B1. Replace the `> 0` thresholds (§5) — **the one that matters**

Two draft rules fail the tautology check: `walcl_4w_change_pct > 0 → long` and
`watchlist_net_balance_change_pct > 0 → long`. Both are keyed to "is it
positive" on series that are positive in most windows, so they vote nearly
always. With a quorum gate needing only two agreeing agents, a near-constant
macro vote plus any one other agent clears it almost every time.

Proposed: fire on the **top or bottom tercile of the trailing 52 observations**,
boundaries computed in code from the recorded series and written into the
decision record. Plus, before the first profile run, report every rule's firing
rate over that series, escalating anything above 80% or below 5%.

### B2. Partially reverse §9's "do NOT implement a tautology or denominator check"

The spec excludes these from `/audit`, and for the **three-check `/audit`
endpoint** that should stand — it keeps the endpoint tight and honest.

But the check B1 describes is not an audit endpoint. It is a **build-time gate**
on the profiles, run once before the first cycle, output to
`docs/rule-firing-rates.md`. Without it the polarity flip — the submission's
load-bearing claim — could rest on a rule that fires regardless of input.

**Proposed: keep `/audit` at exactly three checks as specified; add the firing-rate
report as a build-time artifact, not an endpoint.** Author's call.

### B3. Add a `universe` block to the profile (§5)

Profiles declare how to read, not what to look at — that is hardcoded in
`watchlist.json`, `RSS_URLS` and `asset: "NEAR"`.

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

Sizing becomes `size = base_notional × sector_weight × (win − lose) / win`.
Sector is a declared tag on a watchlist entry, never inferred by a model;
allocation stays arithmetic in `quorum.py`.

### B4. Add `kind` and `sector` to every watchlist entry (§3)

```json
{"account_id": "x.near", "label": "...", "kind": "holder|exchange|treasury|bridge",
 "sector": "l1|defi|ai-agents|infra", "added": "...", "why": "one line"}
```

Without `kind`, a 40,000 NEAR increase on a holder wallet and on an exchange
wallet are netted together and return their difference, which means nothing.

### B5. Use `amount + locked` for on-chain balances, and say so (§2 agent 2)

`view_account` returns liquid `amount` and `locked` separately. Delegating to a
validator drops `amount` and reads as distribution. Use the sum, and state in
the README that the metric measures **account balance change, not net buying** —
unstaking has an epoch delay during which funds appear in neither field.

### B6. Metric `window` is `"4obs"`, not `"4w"` (§4.1)

`WALCL` is weekly. "28 calendar days" compares 4 or 5 observations depending on
the weekday. Four observations is the stable choice and the schema should name it.

### B7. Macro staleness threshold is 14 days (§4.4)

`WALCL` is dated Wednesday and published Thursday. On a Monday snapshot the
freshest observation is 5 days old and that is normal. A 48-hour staleness check
marks the macro agent degraded on every run.

### B8. Add `RRPONTSYD` if preflight confirms it (§2 agent 1)

Net liquidity in general use is `WALCL − WTREGEN − RRPONTSYD`. One more FRED
series on the same call shape. If P1 confirms it, add it; if not, keep
`WALCL − WTREGEN` and state the difference in the README.

### B9. Demote passing mentions rather than rejecting them (§6.1)

`about_reason: mentioned_in_passing` caps confidence at
`passing_mention_ceiling` instead of dropping the signal. An article naming
twelve chains is not evidence about NEAR, but discarding it loses a real item.

### B10. Record the four denominators in the snapshot manifest (§3)

D1–D4 from `SIGNAL-CONTEXT.md` §7, written into every snapshot so a reader can
recompute. This is the paper's own finding applied to this build: an unstated
choice about what to count determines the answer.
