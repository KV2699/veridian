# Auspius

**It models what you sell, scores every signal on how many of your practice areas it opens, and only lets a signal keep that score if the source actually supports it — autonomously, every week, on NVIDIA Nemotron via Nebius Token Factory.**

Built for the **Nebius x NVIDIA Global AI Hackathon** — Best Apps and Agents track.

> **New here?** [HACKATHON-FOR-DUMMIES.md](HACKATHON-FOR-DUMMIES.md) explains the
> whole system in plain English — what it does, why each decision was made, what
> has been tested, and what it costs to run.
> [PITFALLS-AND-LESSONS.md](PITFALLS-AND-LESSONS.md) is the log of everything
> that went wrong and the rule that stops each one recurring.

**Seven configurations ship, and two of them are exact opposites.** The same twelve agents, the same scoring code, the same verification — serving a GPU infrastructure vendor, an ESG executive search firm, a policy think tank, a sustainability communications agency, a management consultancy, a serviced-apartment operator and a law firm. Between them they have sourced **247 organisations**, none from a seed list. Switch configuration in the dashboard.

The vendor and the search firm read the identical event in opposite directions, and that inversion is the point of the product.

**[Open the demo](https://claude.ai/code/artifact/83bd6c5e-04aa-4b56-b454-c22ced8f3a44)** · no install, real data from real runs.

---

## What it actually is

Most BD tools are news alerts with a filter on top. They tell you something happened.

This one starts from a different question: **what do you sell, and which of those things does this event open a conversation about?** The profile declares the practice areas. The collectors map each signal to the areas it opens. The verifier corrects that mapping downwards by default. Then the score is computed in code — 30 points for three or more areas, 25 for a multi-service opening — and ranked.

That makes it a **cross-sell and origination engine**, not a feed. A prospect who could buy two of your services outranks a larger prospect who could buy one, because multi-service accounts are stickier and cheaper to serve.

### What is genuinely new here, and what is not

Practice-area prospecting is not a new idea, and the submission does not claim it is. [Sprouts](https://www.sproutsai.com/) does it for law firms. Clay users build it by hand. Signal platforms score fit and intent.

Three things here are not standard, and they are the claim:

1. **The engine is horizontal and profile-swappable.** The same code scores an AI infrastructure vendor and a sustainability executive search firm, driven by a configuration file rather than a codebase. Both ship. Neither is a special case.
2. **Signal polarity is a first-class configuration primitive.** The same event means opposite things to different businesses, and no platform listed above exposes that as something you can declare. A new Head of Sustainability is a *budget holder with a mandate* to a vendor and a *mandate filled, fee gone* to a recruiter. It is stated in plain English in the profile and travels with every prompt in the pipeline.
3. **The mapping is verification-gated and the score is arithmetic.** A signal's practice areas survive only if the grounding check confirms the source is actually about that company. Nothing can inflate a score by mapping a passing mention to three practice areas, because the signal is dropped before it is scored.

### Proof, on real data, from one run of the free feed path

Two headlines, published the same week, read by the two opposed configurations:

| Headline | ESG Executive Search config | Why |
|---|---|---|
| *Disney's environmental sustainability co-lead leaves the company* | **Kept — scored 9** | A departure with no named successor is an open mandate. The strongest signal this configuration can find |
| *Ingka Group appoints Erika Intiso as Chief Sustainability Officer* | **Discarded** | A filled role is a lost mandate. The fee is gone |

The NVIDIA configuration reads the second as a lead — a new budget holder with a 90-day window — and the first as a *stall* on an existing account. Same code, same feed, same day, opposite conclusions. That inversion is declared in six lines of `polarity` in each profile and nowhere else.

---

## The seven configurations

All seven run the identical engine. The two below are shown together because they are polarity opposites — the clearest proof that the engine is not written for one market.

| Configuration | Sector | Organisations sourced |
|---|---|---|
| `nvidia` | AI infrastructure & hardware | 150 |
| `think-tank` | Policy & research | 33 |
| `sustainability-comms` | Sustainability communications | 20 |
| `exec-search` | ESG executive search | 17 |
| `serviced-apartments` | Serviced accommodation | 13 |
| `consultancy` | Management consultancy | 11 |
| `lawfirm` | Legal services | 3 |

**247 total.** Every one was found by the system from public sources; none was supplied as a starting list.

### The two that are opposites

| | `nvidia` | `exec-search` |
|---|---|---|
| **Business** | Selling into the NVIDIA AI infrastructure ecosystem | A sustainability & ESG executive search firm |
| **Practice areas** | 6 — compute, networking, software, Omniverse, automotive, edge | 4 — retained search, professional recruitment, contract & interim, advisory |
| **An appointment is** | a **lead** — new budget holder | a **dead lead** — mandate filled |
| **A departure is** | a **stall** on an existing account | the **strongest lead** in the system |
| **Commercial value measured by** | **Deal scale** — revenue is concentrated in one line, so breadth separates nothing | **Multi-service breadth** — the engine default |
| **Collector windows** | 30 days throughout | 21 / 30 / 90, per signal type — a vacancy is contested in days, a restructure plays out over months |
| **Free collection layer** | 8 RSS feeds, government procurement portals | 11 RSS feeds, recruitment-services procurement notices |

Each configuration keeps its **own register, signal log, briefing history and rejection log**. They never merge: two markets in one register is a list describing nobody.

**A third market is a third file.** The questions it must answer — and why this is deliberately a file rather than a settings screen — are in [`server/profiles/README.md`](server/profiles/README.md). Two ship because two is what proves the architecture; the work to add a third is writing one profile, not changing the engine.

---

## What it does

Every Monday at 07:00 UTC it runs itself, and by the time its user opens a laptop there is a briefing waiting that names who moved, what it means, and three things to do about it this week.

The design principle is a hard separation between **finding** and **believing**. The collector agents are tuned for recall and will happily over-collect. The verifier, running Nemotron's deep-reasoning tier, is the only thing allowed to decide what survives. Those are opposite skills, and the system never asks one component to do both.

Four things follow from that, each forced by a live failure rather than chosen on design grounds:

- **The model never selects.** It translates the question, code runs the filter, and the model narrates only the rows it is handed. A model asked to pick the top five from 165 records returns five plausible names, some of them wrong.
- **Scoring is arithmetic, never a prompt.** A model-supplied priority score was a whole band out when recomputed against the real algorithm.
- **Grounding asks whether the article is *about* the company**, not whether it mentions it. Two top-five leads survived an earlier version by appearing deep in articles about something else.
- **What it rejects is kept, with the reason.** A tool that only shows what it found cannot be audited. Reason codes separate a correct suppression from a defect in the rules — and without the log, a rejected organisation returns next week and is re-judged from scratch at full cost.

## Why it fits Best Apps and Agents

| Track text | How this meets it |
|---|---|
| *"a workflow that runs itself"* | `node-cron` fires the whole pipeline weekly with no human involvement; collection is checkpointed so a downstream failure costs seconds, not a full re-run |
| *"Nemotron 3 Ultra when you need serious reasoning"* | Ultra verifies and synthesises — both need the whole week in context at once |
| *"let Nano or Super handle the fast, everyday calls"* | Super does per-source extraction: dozens of small independent calls. All four Nemotron tiers were measured before choosing — see [RETROSPECTIVE.md](RETROSPECTIVE.md) |
| *"so your credits stretch further"* | The free collection layer (RSS + procurement portals) costs zero search credits and cannot hallucinate a source; `pipeline:resume` reuses a checkpoint and spends nothing |
| *"an app or agent someone would actually use"* | Built from a working BD methodology with a decade of documented pitfalls behind it, by the person who wrote it |

---

## Required technology

### Nebius Token Factory — the inference platform

Every model call in this project goes to Nebius Token Factory through its OpenAI-compatible endpoint (`https://api.studio.nebius.com/v1`). There is no second inference provider and no local model. See `server/lib/nebius.js`.

### NVIDIA Nemotron — the AI layer

Two tiers, each doing the job it is suited to:

| Tier | Used by | Why |
|---|---|---|
| **Ultra** (deep reasoning) | **Agent 5 — QA Verifier**, **Agent 6 — Briefing Writer** | Both need the whole week in context at once. Verification is a judgement task across all signals simultaneously (is this a duplicate of that? do these two connect?). Synthesis needs every signal in view to pick one headline and three actions |
| **Nano / Super** (fast) | **Agents 1-4 — Collectors** | Per-source extraction is narrow and repetitive — dozens of small independent calls. Using the large tier here would be slower and more expensive for no quality gain |

**Agents 5 and 6 are the two Nemotron checkpoints.** Neither has a non-model fallback path: if Nemotron is unavailable the run fails rather than producing an unverified briefing.

> **Verify your model IDs before the first run.** Model strings differ between accounts and change over time.
> ```bash
> npm run models
> ```
> This prints every model your Nebius account can call, highlights the NVIDIA/Nemotron ones, and tells you whether the IDs in your `.env` are valid. `GET /api/models` does the same over HTTP. Nothing in this codebase hardcodes a model ID — both come from the environment.

### Tavily — the search layer

**Tavily is the only source of external fact in this system.** This is an architectural decision, not a convenience: Nemotron is never asked what happened in the market, only to summarise, score and synthesise what Tavily actually fetched. That boundary is what makes the output checkable.

- **Search volume is bounded and counted.** The `nvidia` configuration runs 56 searches a full run (31 collector queries, 7 regulator sweeps, 15 roster-sweep batches, 3 account-watch batches); `exec-search` runs fewer. Windows are 21-90 days *per collector*, set by signal type, and **30 days is a measured ceiling**: past it Tavily's date filter leaks badly — an 84-day backfill returned items dated a full year earlier
- **The free layer carries real load.** RSS feeds and government procurement portals cost zero search credits, cannot hallucinate a source, and are where the proof above came from. `TAVILY_DEPTH=basic` halves credit cost while iterating; `npm run pipeline:resume` reuses the last checkpoint and spends nothing
- **Every signal carries its Tavily source URL** into the final briefing as a clickable link
- **Hallucinated sources are structurally impossible.** `normalise()` in `server/agents/collector-base.js` discards any signal whose URL was not in the Tavily result set the model was shown. A fabricated URL cannot reach a briefing — this is enforced in code and covered by `test/collector.test.mjs`
- **Results are de-duplicated on a canonical URL** (tracking params and fragments stripped) within a run, across collectors, and against every prior week
- Implementation: `server/lib/tavily.js`

---

## The twelve agents

Collectors are defined by the active profile — the table below is the shipped `nvidia` configuration. The `exec-search` configuration swaps agents 1-4 for a Departure & Backfill collector, a Direct-Employer Posting collector, a Restructure & New-Mandate collector and a Deal-Driven Hiring collector. Everything from the verifier onwards is identical.

| # | Agent | Engine | Job |
|---|---|---|---|
| 1 | Capital & Sovereign | Tavily + Nemotron fast | Funding, hyperscaler capex guidance, government-funded national AI programmes |
| 2 | Infrastructure & Supply | Tavily + Nemotron fast | Power agreements, datacentre siting, HBM/CoWoS allocation — demand signals 12-24 months early |
| 3 | Competitive Displacement | Tavily + Nemotron fast | Custom silicon and AMD wins at named accounts, read defensively |
| 4 | Enterprise Opportunity | Tavily + Nemotron fast | AI factory buildouts, new AI leadership appointments, published RFPs |
| 5 | Roster Sweep | Tavily + Nemotron fast | Walks the register by name and reports a result for **every** organisation, including "no signal found" — which is what makes coverage auditable |
| 6 | Regulator Sweep | Tavily + Nemotron fast | Named regulators and public bodies. Compulsory work with a published date is the strongest buying trigger there is |
| 7 | Feed Collector | RSS + Nemotron fast | **Zero search credits, zero hallucination risk** — publisher-written headlines with their own urls and dates |
| 8 | Tender Collector | OCDS portals | The buyer's own words with a closing date. No model supplies a fact on this path |
| 9 | **Account Watch** | Tavily + Nemotron fast | Sweeps the accounts you already hold for fresh reasons to make contact |
| 10 | **QA Verifier** | **Nemotron Ultra** | Score 0-10, deduplicate, correct the practice-area mapping downwards, write the counter-reading, flag for review, drop everything below the floor — and log every drop with its reason |
| 11 | **Briefing Writer** | **Nemotron Ultra** | Synthesise the verified set into the structured weekly briefing |
| 12 | Dashboard Updater | — | Persist briefing, append to the signal log, compute week-on-week trend |

Agents 1-9 run concurrently — they share no state. Agents 10, 11 and 12 are strictly sequential.

**Failure policy:** a collector that fails is logged and the run continues with what the others found. Agents 10, 11 and 12 are load-bearing — if one fails, the run is marked failed and nothing is written.

### The rejection log and the counter-reading

Two things survive a run besides the briefing.

**Every rejected signal is kept with its reason code** — `UNGROUNDED` (the source is not about that organisation), `BELOW_FLOOR`, `DUPLICATE`, `UNVERIFIED`. The distinction that matters is between a *suppression* (correctly dropped) and a *defect report* (dropped because a rule is wrong), because only the second kind should change the next run. `GET /api/rejections`.

**Every kept signal can carry a counter-reading** — the argument against acting on it, in one sentence, written by the verifier. Not a confidence score: the reason a competent person might read the same event and reach the opposite conclusion. The three that recur are *the buyer is someone else* (a regulator publishing a rule is not a customer — the firms it obliges are), *they will do it themselves*, and *the event is real but the trigger is wrong*. It is stated in the briefing, never hidden.

### Agent 9 — Account Watch

Every other collector hunts strangers. This one sweeps the roster in the active profile — the organisations you already hold — for expansion, leadership change, earnings commentary, or a competitor win worth responding to.

It exists because the predecessor system's own post-mortem named this as its single biggest methodology gap: no prompt deliberately swept existing relationships, so accounts went quiet while the pipeline kept finding new names. Account signals get their own briefing section and can never be presented as new prospects. The roster is swept in batches, so cost stays flat as it grows.

### What Agent 5 actually enforces

Model judgement is used where judgement is needed, and bounded by code everywhere else:

- **Scoring discipline is prompted against inflation** — the known failure mode of narrow-scope scoring is that everything looks maximally relevant, so the prompt states plainly that a normal week has a handful of 8s and a long tail below
- **Undated signals are capped and auto-flagged** — an undated signal cannot be urgent
- **A signal the model declines to judge is not silently dropped** — it is kept and marked `verified: false`
- **Out-of-range scores are clamped; non-existent signal ids cited in connections are stripped**
- **Exact-URL duplicates are removed in code before the model sees them** — that is not a judgement call

---

## Yield diagnostics — the system diagnoses itself

The hardest failure in BD collection is not a crash. It is a clean run that quietly returns nothing useful, because **an empty week and a quiet market look identical from the outside**. The predecessor system shipped two full versions of one client's prompt pack in that state before anyone replicated the searches by hand and found eight root causes.

Auspius runs that diagnosis automatically, every time. It tracks where signals are lost:

```
searched → hits → fresh → extracted → verified
```

and names the likely cause of any collapse, with the fix:

| What it sees | What it tells you |
|---|---|
| A query returns 0 hits | Wording problem — rewrite in the vocabulary a journalist would use |
| Hits, but nothing extracted | **Signal definition problem** — likely asking for something unpublishable, such as proving a company *lacks* something |
| Extracted, then all rejected at verification | **Target universe problem** — real events, wrong segment of the market |
| Over 70% of signals scored 8+ | Scoring inflation — ranking within the batch rather than measuring real value |
| Over 40% undated | Date discipline — an undated signal cannot be urgent |
| Over half from one publisher | Source concentration — add vertical trade press |

Findings appear in the dashboard worst-first, with a per-query yield table, and a run that produces nothing writes the diagnosis into the briefing itself rather than presenting silence as a quiet market.

See `server/lib/diagnostics.js` and `test/diagnostics.test.mjs`.

---

## Profiles — one pipeline, two markets, and the room for more

Everything strategy-shaped lives in a **profile**: the practice areas, the roster, the queries, the decay window per signal type, the scoring guidance, the value factor, and — most importantly — the **polarity**.

Polarity is the thing no onboarding form can capture. The same event means opposite things to different businesses:

| Business | "Company X appoints a Head of Sustainability" |
|---|---|
| An infrastructure vendor (`nvidia`) | **Hot lead** — new budget holder with a mandate and a 90-day window |
| An executive search firm (`exec-search`) | **Dead lead** — mandate filled, fee gone |
| A policy think tank | **Hot lead** — new decision-maker to brief |

Nothing in a product description implies which applies. A model asked to infer it produces a confident, plausible, wrong answer — and an empty week looks exactly like a quiet market, so nobody finds out for months. So it is declared in plain English and travels with every prompt in the pipeline.

**The pipeline knows nothing about either market.** Everything market-shaped — the system prompts for extraction, verification and synthesis, the sweep query suffixes, the procurement CPV codes — is supplied by the profile. Seven configurations prove it, and two of them prove it twice over: identical code, opposite readings.

**What another profile costs.** One file. `server/profiles/<key>.js`, registered in `index.js`. The seven questions it must answer — and why this is deliberately a file rather than a settings screen — are in [`server/profiles/README.md`](server/profiles/README.md). Three of the seven shipped configurations were written by hand; the rest were built **by the system itself** from a company website, via `+ Add a business` in the dashboard or `node tools/build-profile.mjs`. No engine change was needed for any of them.

Select a configuration in the dashboard, pass `?profile=<key>` to any API route, or set `PROFILE=` in `.env` for the default.

---

## Quick start

```bash
git clone https://github.com/KV2699/veridian.git && cd veridian
npm install
cp .env.example .env     # add NEBIUS_API_KEY and TAVILY_API_KEY
npm run models           # confirm the Nemotron model IDs for your account
npm start                # dashboard on http://localhost:8080
```

Try the dashboard before adding keys. Two ways, both free:

- **`npm start` with no `.env` at all.** The dashboard detects that nothing has been run and serves `public/demo-data.json` — a real slice of all seven configurations from actual runs, clearly labelled on screen as saved output. This is also what the hosted demo serves.
- **`DRY_RUN=true npm start`** runs the full twelve-agent sequence on fixtures with zero API calls.

```bash
npm start              # server + scheduler
npm run pipeline       # one full run from the CLI
npm run pipeline:dry   # fixture run, no API calls
npm run models         # list available Nemotron models
npm test               # agent logic tests, no API calls
```

### Environment

| Variable | Default | Notes |
|---|---|---|
| `NEBIUS_API_KEY` | — | Required |
| `TAVILY_API_KEY` | — | Required |
| `NEBIUS_BASE_URL` | `https://api.studio.nebius.com/v1` | This is the Token Factory inference API. Nebius has since rebranded Studio to **Token Factory**, and the console now shows a regional host such as `https://api.tokenfactory.us-central1.nebius.com/v1/`. The Studio host above is the one these runs used and it still works; either can be set here. |
| `NEBIUS_MODEL_ULTRA` | `nvidia/llama-3.1-nemotron-70b-instruct` | **Verify with `npm run models`** |
| `NEBIUS_MODEL_FAST` | `nvidia/llama-3.1-nemotron-nano-8b-v1` | **Verify with `npm run models`** |
| `PORT` | `8080` | |
| `CRON_SCHEDULE` | `0 7 * * 1` | Mondays 07:00 UTC |
| `CRON_ENABLED` | `true` | |
| `PROFILE` | `nvidia` | Which business this deployment serves |
| `TAVILY_DEPTH` | `advanced` | `basic` halves credit cost while tuning queries |
| `DRY_RUN` | `false` | Fixtures, no API calls |

---

## API

| Endpoint | Returns |
|---|---|
| `GET /` | Dashboard |
| `POST /api/run` | `202` and runs the pipeline in the background; `409` if one is already running |
| `GET /api/status` | Per-agent status and timings, last run, totals, configured models |
| `GET /api/briefings` | Every briefing, newest first |
| `GET /api/briefings/:week` | One week, e.g. `2026-W40` |
| `GET /api/signals` | Raw signal log — filter by `?category=`, `?week=`, `?limit=` |
| `GET /api/runs` | Last 50 run records |
| `GET /api/diagnostics` | Yield diagnosis for the last run — funnel, findings, per-query table |
| `GET /api/profiles` | The active profile: polarity rules, roster, collectors, scoring |
| `GET /api/models` | Available Nemotron models and whether the configured IDs are valid |
| `GET /api/health` | Liveness and configuration check |

## Dashboard

Dark UI (`#0f172a` on `#6366f1`) showing the current briefing rendered from markdown, a live agent status panel that updates while a run is in progress, the yield funnel and diagnostic findings, signal counts by category, clickable briefing history, a run log, and a manual **Run pipeline** button.

## Project structure

```
signal-bureau/
├── server/
│   ├── index.js              # Express + cron scheduler
│   ├── pipeline.js           # Orchestrator, concurrency lock, ISO weeks
│   ├── agents/               # The eight agents
│   │   ├── collector-base.js # Shared harness + anti-hallucination guard
│   │   ├── account-watch.js  # Your existing accounts
│   │   ├── qa-verifier.js    # Nemotron Ultra
│   │   ├── briefing-writer.js# Nemotron Ultra
│   │   └── dashboard-updater.js
│   ├── profiles/             # Strategy per market — see profiles/README.md
│   │   ├── nvidia.js
│   │   └── index.js
│   └── lib/                  # nebius · tavily · store · log · diagnostics · fixtures
├── public/index.html         # Dashboard
├── data/                     # briefings.json · signal_log.json · runs.json
└── test/                     # Agent logic tests, no API keys needed
```

## Tests

```bash
npm test
```

No API keys required — the agents accept an injected model client, so their logic is tested against scripted responses. Four suites cover the fabricated-URL guard, the score floor, cross-category dedup, score clamping, undated-signal flagging, the unjudged-row path, roster matching and batching in Account Watch, and every diagnostic rule.

`npm run verify` is the separate live check: it calls Nemotron Ultra for real to confirm your Nebius setup, and makes no Tavily calls.

## Deployment

**Nebius Serverless — the intended target**, and the one the Best Apps and Agents track names. The split is clean:

| Component | Nebius resource | Why |
|---|---|---|
| Dashboard + JSON API | **Serverless Endpoint** | Persistent, public URL — what a judge clicks |
| Weekly pipeline | **Serverless Job** | A finite background run, which is exactly what this is |

Set `NEBIUS_API_KEY` and `TAVILY_API_KEY` as environment variables. With the pipeline running as a Job, set `CRON_ENABLED=false` on the Endpoint so only one scheduler exists.

**Any container host** — runs as-is with the built-in scheduler; set `CRON_ENABLED=true` and keep exactly one instance. The cross-process run lock (`server/lib/lock.js`) will refuse a second concurrent run rather than let two runs destroy each other's register, but it cannot schedule for you.

---

## Prior-work declaration

This project is a rebuild of an existing BD scanner. The Nemotron integration, Tavily search layer, web dashboard, and scheduling system were all built during the hackathon submission period.

The predecessor — the BD Horizon Scanner — was a seven-subagent Claude Code pipeline with four collectors, a QA/verifier, a spreadsheet writer, and a dashboard updater, aimed at a different market. What carried over is the architecture and the operating lessons: separate collection from verification, never trust a pre-scored output, require a fetchable source for every claim, sweep existing relationships as deliberately as new ones, and treat an unverified-but-honest row as recoverable where a confidently wrong one is not.

The yield diagnostics are a direct port of that system's root-cause post-mortems — the difference being that they now run automatically on every execution instead of being discovered by hand after two failed versions. Everything in this repository is new code.

## Licence

MIT — see [LICENSE](LICENSE).
