# Submission plan — audited against the real criteria

**Source:** [nebiusglobalaihackathon.devpost.com](https://nebiusglobalaihackathon.devpost.com)
**Deadline:** 30 October 2026, **17:00 UTC** · **7 days remaining as of 23 October**

> **Updated 23 October.** Finding 1 is DONE — the track is now Best Apps and
> Agents, re-verified against the live Devpost page. Findings 2 and 3 stand.
> Two things have changed since this plan was written:
>
> 1. **Two configurations now ship**, not one. That strengthens criterion 4
>    (Quality of the Idea) more than anything else available: the polarity
>    claim stops being an assertion in a README and becomes something a judge
>    can watch happen — the same headline kept by one configuration and
>    discarded by the other.
> 2. **Tavily credits are the binding constraint.** 26 left of 1,000, resetting
>    1 November — after the deadline. A full run costs 112. Pay-as-you-go at
>    $0.008/credit makes a run ~$0.90. Nothing live can be demonstrated until
>    that is enabled. See HANDOVER.md §0.1.

---

## Three findings that change the plan

### 1. We are in the wrong track — ✅ FIXED 23 October

The Personal AI track names a specific stack — *"use tools such as NVIDIA
NemoClaw, OpenShell, Hermes Agent"* — none of which this uses.

**Best Apps and Agents** reads like it was written for this project:

> *"Build any app or agent someone would actually use... or **a workflow that
> runs itself**. Power it with Nemotron models on Nebius through Token Factory.
> **Reach for Nemotron 3 Ultra when you need serious reasoning, and let Nano or
> Super handle the fast, everyday calls**, so your app stays responsive and your
> credits stretch further. We encourage you to deploy with **Nebius Serverless
> Endpoints**, or use **Nebius Serverless Jobs for background processing and
> asynchronous workflows**."*

Four for four. A workflow that runs itself. Ultra for reasoning, Super for the
fast calls — exactly the tiering built here, chosen by measurement. A background
batch pipeline. **Switch tracks.**

### 2. Deployment target should be Nebius, not Vercel

The track text explicitly encourages Serverless Endpoints and Serverless Jobs,
and judging criterion 1 asks *"how effectively does it use Nebius Token Factory
or AI Cloud"*. Vercel answers that question with "it doesn't".

Serverless AI runs container images behind a public URL (Endpoints) or as
finite runs (Jobs). The mapping is clean:

| Component | Nebius resource |
|---|---|
| Dashboard + API | **Serverless Endpoint** — persistent, public URL |
| Weekly pipeline | **Serverless Job** — finite, background |

That is the architecture their own track description asks for.

### 3. Two bonus prizes are being left on the table

- **Most Valuable Feedback** — $100 × **10 winners**. Short odds, and the
  material here is unusually strong and reproducible.
- **Best Use of Tavily** — $3,000, and **three Tavily people are on the judging
  panel**. The slicing discovery (max_results is a ranking cap, not a date cap —
  four weekly slices returned 100 unique results where one 28-day search
  returned 30) is a genuine characterisation of their product, not just API
  usage.

---

## Audit against the four criteria

Each is weighted equally.

### 1. Technological Implementation
*"How well is the project built, and how effectively does it use Token Factory and Nemotron?"*

**Have:** 12 agents, 12 test suites, deliberate Ultra/Super tiering chosen by
measuring all four Nemotron models, concurrency limiting, truncation refusal,
cross-process locking, retry with jitter.

**Missing:** not deployed on Nebius. The pipeline is a cron job on a laptop, not
a Serverless Job.

**To exceed:** deploy both halves on Nebius Serverless, and put the four-model
comparison in the README — most entrants will say "we used Nemotron"; this can
say *why this Nemotron, measured*.

### 2. Design
*"Does the project deliver a complete, coherent product experience, not just a technical proof of concept?"*

**Have:** autonomous weekly collection → verified briefing → conversational
interface → voice. That is a product loop, not a demo.

**Missing:** the register's top entries are embarrassing. `United Kingdom`
scoring 90 sourced to an ETF investment guide; `South Korea` and `South Korea
Government` as separate entities; `Amazon` and `Amazon Web Services` both in the
top eight. **That is the first thing a judge sees.**

**To exceed:** clean the top of the register, and make sure the hosted demo
answers a question correctly on first click.

### 3. Potential Impact
*"Does the project make a credible, specific case for solving a real problem for a real audience?"*

**Have:** a real problem, a real practitioner, a real methodology with a decade
of documented pitfalls behind it. 165 organisations sourced with no seed list.
Verified leads including an open RFP confirmed by fetching the page.

**Missing:** none of that is written down anywhere a judge will read. The README
opens with architecture.

**To exceed:** lead with the problem and the person. The honest conversion
figure — roughly one in five register entries is directly actionable — is worth
stating plainly. Judges discount unqualified claims; they rarely discount a
number offered against interest.

### 4. Quality of the Idea
*"Is this a creative, non-obvious use... does the team show genuine understanding of the problem space?"*

**This is the strongest criterion and it is entirely buried in the CHANGELOG.**
Four genuinely non-obvious decisions, each forced by a live failure:

- **Signal polarity.** The same event means opposite things to different
  businesses. A new Head of Sustainability is a hot lead to a vendor and a dead
  lead to an executive search firm. No onboarding form can ask this, so it is
  declared per profile and travels with every prompt.
- **The model never selects.** Model translates the question, code runs the
  filter, model narrates only the rows it is handed. A model asked to pick the
  top five from 169 records returns five plausible names, some wrong.
- **Scoring is arithmetic, never a prompt.** A model-supplied priority score was
  a whole band out when recomputed against the real algorithm.
- **Grounding asks whether the article is *about* the company**, not whether it
  mentions it. Two top-five leads survived an earlier version by appearing deep
  in articles about something else.

**To exceed:** make these the spine of the description and the video, not
footnotes.

---

## The 14-day plan

### P0 — required, or the submission is invalid
| | Days |
|---|---|
| Public GitHub repo, MIT licence visible at top | 0.5 |
| **Working demo URL** — hosted, clickable, works first time | 1.5 |
| 3-minute YouTube video | 1.5 |
| Project description (what, why, how) | 0.5 |
| Feedback on Nebius/NVIDIA tooling | 0.5 |

### P1 — highest scoring leverage
| | Days | Criterion |
|---|---|---|
| ~~Switch track to Best Apps and Agents~~ — **done 23 Oct** | 0 | fit |
| ~~Second sector configuration~~ — **done 23 Oct**, `exec-search` | 0 | 4 |
| **Enable Tavily pay-as-you-go** — blocks every live run | 0 | all |
| Deploy on Nebius Serverless (Endpoint + Job) | +0.5 over Vercel | 1 |
| Clean the register's top entries | 0.5 | 2 |
| Write the impact story properly | — *(in description)* | 3 |
| Surface the four non-obvious decisions | — *(in description + video)* | 4 |

### P2 — bonus prizes, cheap
| | Days |
|---|---|
| Most Valuable Feedback entry — the material already exists | 0.25 |
| Tavily section: the slicing finding, the grounding guard, 20 searches/run | 0.25 |

### Explicitly not doing
- Stage 4 proposal generation — a three-week RAG build
- Stage 5 learning loop — needs won/lost data that does not exist
- Stage 3 solution mapping — genuinely good, but fourth priority behind shipping

**Total: 6.5 days of work in 14 days.** The slack is deliberate: deployment
always takes longer than planned, and a video re-record costs half a day.

---

## Suggested order

**Days 1–2** — clean the register, Dockerise, push to GitHub.
**Days 3–4** — deploy to Nebius Serverless, verify a judge can click the URL and get an answer.
**Days 5–6** — write the description, the tooling feedback, the Tavily section.
**Days 7–8** — record and cut the video.
**Days 9–14** — slack. Use it for Stage 3 only if everything above is genuinely finished.

---

## The video, in three minutes

The temptation is to show it working. Show it **catching itself** instead —
nothing else will have that.

| Time | Beat |
|---|---|
| 0:00–0:20 | The problem. A BD person cannot read the whole internet every week. |
| 0:20–0:50 | Ask it a question. Voice. Real answer, real company, real source link. |
| 0:50–1:30 | Where the answer came from: twelve agents, Tavily, Ultra verifying, Super extracting. |
| 1:30–2:15 | **The diagnostic story.** 182 search hits, zero signals — and the system saying why. Then the grounding catch: a claim about a national laboratory sourced to a post about a physicist, dropped automatically. |
| 2:15–2:45 | The register: 165 organisations it sourced itself, scored by arithmetic you can audit. |
| 2:45–3:00 | What is next, named honestly: solution mapping, proposal generation, outcome learning. |
