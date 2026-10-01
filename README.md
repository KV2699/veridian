# Signal Bureau

**A seven-agent intelligence pipeline that monitors the AI infrastructure market autonomously, uses NVIDIA Nemotron on Nebius Token Factory to verify and synthesise signals, and delivers a decision-ready BD briefing every Monday morning without anyone pressing a button.**

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
| **Reusable skills** | Seven composable agents behind one orchestrator. A new signal category is a new collector config file and one line in the pipeline |
| **Tools and information you choose** | Tavily is the only source of external fact, scoped by editable query sets in `server/agents/collector-*.js` |
| **Tasks across daily workflows** | Weekly briefing, dashboard, trend history, and a JSON API any downstream tool can read |

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
| 1 | Funding Collector | Tavily + Nemotron fast | Funding rounds, enterprise procurement, Nebius/NVIDIA ecosystem deals |
| 2 | Product Collector | Tavily + Nemotron fast | Model releases, GPU pricing changes, platform launches |
| 3 | Competitive Collector | Tavily + Nemotron fast | Hyperscaler moves, new entrants, consolidation, supply constraints |
| 4 | Opportunity Collector | Tavily + Nemotron fast | Stated AI initiatives, RFPs, partner programmes, events with deadlines |
| 5 | **QA Verifier** | **Nemotron Ultra** | Score 0-10, deduplicate across categories, flag for human review, find connections, drop everything below 6 |
| 6 | **Briefing Writer** | **Nemotron Ultra** | Synthesise the verified set into the structured weekly briefing |
| 7 | Dashboard Updater | — | Persist briefing, append to the signal log, compute week-on-week trend |

Agents 1-4 run concurrently — they share no state. Agents 5, 6 and 7 are strictly sequential.

**Failure policy:** a collector that fails is logged and the run continues with what the others found. Agents 5, 6 and 7 are load-bearing — if one fails, the run is marked failed and nothing is written.

### What Agent 5 actually enforces

Model judgement is used where judgement is needed, and bounded by code everywhere else:

- **Scoring discipline is prompted against inflation** — the known failure mode of narrow-scope scoring is that everything looks maximally relevant, so the prompt states plainly that a normal week has a handful of 8s and a long tail below
- **Undated signals are capped and auto-flagged** — an undated signal cannot be urgent
- **A signal the model declines to judge is not silently dropped** — it is kept and marked `verified: false`
- **Out-of-range scores are clamped; non-existent signal ids cited in connections are stripped**
- **Exact-URL duplicates are removed in code before the model sees them** — that is not a judgement call

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
| `GET /api/models` | Available Nemotron models and whether the configured IDs are valid |
| `GET /api/health` | Liveness and configuration check |

## Dashboard

Dark UI (`#0f172a` on `#6366f1`) showing the current briefing rendered from markdown, a live agent status panel that updates while a run is in progress, signal counts by category, clickable briefing history, a run log, and a manual **Run pipeline** button.

## Project structure

```
signal-bureau/
├── server/
│   ├── index.js              # Express + cron scheduler
│   ├── pipeline.js           # Orchestrator, concurrency lock, ISO weeks
│   ├── agents/               # The seven agents
│   │   ├── collector-base.js # Shared harness + anti-hallucination guard
│   │   ├── collector-{funding,product,competitive,opportunity}.js
│   │   ├── qa-verifier.js    # Nemotron Ultra
│   │   ├── briefing-writer.js# Nemotron Ultra
│   │   └── dashboard-updater.js
│   └── lib/                  # nebius · tavily · store · log · fixtures
├── public/index.html         # Dashboard
├── data/                     # briefings.json · signal_log.json · runs.json
└── test/                     # Agent logic tests, no API keys needed
```

## Tests

```bash
npm test
```

No API keys required — Agents 5 and 6 accept an injected model client so their logic is tested against scripted responses. Covers the fabricated-URL guard, the score floor, cross-category dedup, score clamping, undated-signal flagging, and the unjudged-row path.

## Deployment

**Vercel** — add `NEBIUS_API_KEY` and `TAVILY_API_KEY` as environment variables. Serverless functions do not hold a cron process: set `CRON_ENABLED=false` and use Vercel Cron to `POST /api/run` on `0 7 * * 1`.

**Nebius Serverless Endpoints / any container host** — runs as-is with the built-in scheduler; set `CRON_ENABLED=true` and keep one instance.

---

## Prior-work declaration

This project is a rebuild of an existing BD scanner. The Nemotron integration, Tavily search layer, web dashboard, and scheduling system were all built during the hackathon submission period.

The predecessor — the BD Horizon Scanner — was a seven-subagent Claude Code pipeline with four collectors, a QA/verifier, a spreadsheet writer, and a dashboard updater, aimed at a different market. What carried over is the architecture and the operating lessons: separate collection from verification, never trust a pre-scored output, require a fetchable source for every claim, and treat an unverified-but-honest row as recoverable where a confidently wrong one is not. Everything in this repository is new code.

## Licence

MIT — see [LICENSE](LICENSE).
