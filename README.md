# Signal Bureau

**An eight-agent intelligence pipeline that monitors a market autonomously, uses NVIDIA Nemotron on Nebius Token Factory to verify and synthesise signals, diagnoses its own collection failures, and delivers a decision-ready BD briefing every Monday morning without anyone pressing a button.**

Built for the **Nebius x NVIDIA Global AI Hackathon** — Personal AI Track.

---

## What it does

Signal Bureau watches the AI infrastructure market — GPU cloud, enterprise ML, AI tooling, the NVIDIA ecosystem — on behalf of one person: a BD professional or founder selling into it.

Every Monday at 07:00 UTC it runs itself, and by the time its user opens a laptop there is a briefing waiting that names who moved, what it means, and three things to do about it this week.

The design principle is a hard separation between **finding** and **believing**. Four collector agents are tuned for recall and will happily over-collect. A fifth agent, running Nemotron's deep-reasoning tier, is the only thing allowed to decide what survives. Those are opposite skills, and the system never asks one component to do both.

## Why this is a personal AI assistant

| Track requirement | How Signal Bureau meets it |
|---|---|
| **Always-on** | `node-cron` scheduler fires the pipeline every Monday 07:00 UTC with no human involvement |
| **Persistent memory** | `signal_log.json` is append-only across every run. The collectors read it before searching, so a story already reported in a previous week is never surfaced as new — the system's memory of what it already told you shapes what it looks for next |
| **Reusable skills** | Eight composable agents behind one orchestrator, driven by a swappable **profile**. Changing target market is a config file, not a rewrite |
| **Tools and information you choose** | Tavily is the only source of external fact, scoped by editable query sets in `server/agents/collector-*.js` |
| **Tasks across daily workflows** | Weekly briefing, account watch, dashboard, trend history, self-diagnosis, and a JSON API any downstream tool can read |

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

- **20 targeted searches per run** — each of the four collectors runs five distinct queries (`server/agents/collector-*.js`), all with a 7-day window and `search_depth: "advanced"`
- **Every signal carries its Tavily source URL** into the final briefing as a clickable link
- **Hallucinated sources are structurally impossible.** `normalise()` in `server/agents/collector-base.js` discards any signal whose URL was not in the Tavily result set the model was shown. A fabricated URL cannot reach a briefing — this is enforced in code and covered by `test/collector.test.mjs`
- **Results are de-duplicated on a canonical URL** (tracking params and fragments stripped) within a run, across collectors, and against every prior week
- Implementation: `server/lib/tavily.js`

---

## The seven agents

| # | Agent | Engine | Job |
|---|---|---|---|
Collectors are defined by the active profile. For the shipped `nvidia` profile:

| # | Agent | Engine | Job |
|---|---|---|---|
| 1 | Capital & Sovereign | Tavily + Nemotron fast | Funding, hyperscaler capex guidance, government-funded national AI programmes |
| 2 | Infrastructure & Supply | Tavily + Nemotron fast | Power agreements, datacentre siting, HBM/CoWoS allocation — demand signals 12-24 months early |
| 3 | Competitive Displacement | Tavily + Nemotron fast | Custom silicon and AMD wins at named accounts, read defensively |
| 4 | Enterprise Opportunity | Tavily + Nemotron fast | AI factory buildouts, new AI leadership appointments, published RFPs |
| 5 | **Account Watch** | Tavily + Nemotron fast | Sweeps the accounts you already hold for fresh reasons to make contact |
| 6 | **QA Verifier** | **Nemotron Ultra** | Score 0-10, deduplicate, flag for review, find connections, drop everything below the floor |
| 7 | **Briefing Writer** | **Nemotron Ultra** | Synthesise the verified set into the structured weekly briefing |
| 8 | Dashboard Updater | — | Persist briefing, append to the signal log, compute week-on-week trend |

Agents 1-5 run concurrently — they share no state. Agents 6, 7 and 8 are strictly sequential.

**Failure policy:** a collector that fails is logged and the run continues with what the others found. Agents 6, 7 and 8 are load-bearing — if one fails, the run is marked failed and nothing is written.

### Agent 5 — Account Watch

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

Signal Bureau runs that diagnosis automatically, every time. It tracks where signals are lost:

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

## Profiles — one pipeline, any market

Everything strategy-shaped lives in a **profile**: the roster, the queries, the signal types, the decay window per signal type, the scoring guidance, and — most importantly — the **polarity**.

Polarity is the thing no onboarding form can capture. The same event means opposite things to different businesses:

| Business | "Company X appoints a Head of Sustainability" |
|---|---|
| A policy think tank | **Hot lead** — new decision-maker, 90-day window |
| An executive search firm | **Dead lead** — mandate filled, fee gone |
| An infrastructure vendor | **Hot lead** — new budget holder with a mandate |

Nothing in a product description implies which of those applies, so it is stated explicitly in the profile and travels with every prompt in the pipeline.

Swap market by writing a new profile and setting `PROFILE=` in `.env`. The questions a new profile must answer — and why this is deliberately a file rather than a settings screen — are in [`server/profiles/README.md`](server/profiles/README.md).

---

## Quick start

```bash
git clone <your-repo-url> && cd signal-bureau
npm install
cp .env.example .env     # add NEBIUS_API_KEY and TAVILY_API_KEY
npm run models           # confirm the Nemotron model IDs for your account
npm start                # dashboard on http://localhost:8080
```

Try the dashboard before adding keys — `DRY_RUN=true npm start` runs the full seven-agent sequence on fixtures with zero API calls.

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
| `NEBIUS_BASE_URL` | `https://api.studio.nebius.com/v1` | |
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

**Vercel** — add `NEBIUS_API_KEY` and `TAVILY_API_KEY` as environment variables. Serverless functions do not hold a cron process: set `CRON_ENABLED=false` and use Vercel Cron to `POST /api/run` on `0 7 * * 1`.

**Nebius Serverless Endpoints / any container host** — runs as-is with the built-in scheduler; set `CRON_ENABLED=true` and keep one instance.

---

## Prior-work declaration

This project is a rebuild of an existing BD scanner. The Nemotron integration, Tavily search layer, web dashboard, and scheduling system were all built during the hackathon submission period.

The predecessor — the BD Horizon Scanner — was a seven-subagent Claude Code pipeline with four collectors, a QA/verifier, a spreadsheet writer, and a dashboard updater, aimed at a different market. What carried over is the architecture and the operating lessons: separate collection from verification, never trust a pre-scored output, require a fetchable source for every claim, sweep existing relationships as deliberately as new ones, and treat an unverified-but-honest row as recoverable where a confidently wrong one is not.

The yield diagnostics are a direct port of that system's root-cause post-mortems — the difference being that they now run automatically on every execution instead of being discovered by hand after two failed versions. Everything in this repository is new code.

## Licence

MIT — see [LICENSE](LICENSE).
