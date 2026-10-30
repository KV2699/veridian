# Devpost submission — field by field

Plain English throughout. Numbers are real and checked against the repo, the
Token Factory account and the Tavily account on 30 October 2026.

---

## Project name
Auspius

## Elevator pitch
Every week it reads the market and tells you who to call — and the same
headline means the opposite thing to two different businesses.

---

## About the project

### The problem

Monday morning. Your pipeline is full, your calendar is full, and somewhere
last week something happened that should have been your next deal. A funding
round. An executive walking out. A regulator setting a deadline. Nobody sent
it to you.

Your CRM is very good at the deals you already have. It can only ever tell you
about people you have already met. The lead you lose isn't the one you forgot
to chase — it's the one you never knew existed.

### What Auspius does

You tell it what your business sells. Every week it reads the market and tells
you who to call, why now, and what the opportunity is worth.

It is not a news feed. A feed tells you something happened. Auspius works out
whether it matters **to you**, scores it, assigns a next step, and shows its
working.

### The idea it is built on

The same news means two different things to two different businesses.

Take one real headline: *"Disney's environmental sustainability co-lead leaves
the company."*

- To a company selling AI infrastructure, that is bad news. The person who
  signs the cheque just walked out. Flag the account; don't open it.
- To an executive search firm, the same sentence is the best news of the week.
  An empty seat with no successor named is a live mandate, contested within
  days.

Same code, same model, same source. The only difference is one sentence in a
configuration file describing who the system is working for. That inversion is
the product. No onboarding form asks "when a decision-maker leaves, is that
good news or bad news for you?" — and that is the question that decides whether
a signal is a lead or a warning.

Seven configurations ship, two of them exact opposites. Between them they have
sourced **247 organisations**, none from a seed list.

### What makes it trustworthy

Three things, in order of how much they matter:

**It only believes sources it actually fetched.** Every week Tavily searches
the live web and brings back real pages — filings, postings, press releases.
The models only ever see those. If a model returns a URL the search never
returned, the signal is dropped before it can be scored. That is enforced in
code, not asked for in a prompt, and it is covered by a test.

**It checks the source actually says the claim.** A URL coming back from search
isn't enough. If the page never mentions the organisation, or states a figure
different to the one claimed, the signal is dropped as ungrounded — and kept,
with its reason, so you can see what was thrown away and why.

**It argues against itself.** Netflix losing its first chief sustainability
officer scores 80 out of 100 and lands as critical. The same card then tells
you Netflix has a large in-house recruiting team and may never go to market.
It would rather talk you out of a bad call than win the click.

### The score is arithmetic, not an opinion

No model supplies the number. Four factors are added up in code — how many of
your practice areas the event opens, whether it is a multi-service opening, how
urgent the signal is, and the size of the organisation. Open any number and you
can see where it came from. A prospect who could buy two of your services
outranks a bigger prospect who could buy one, because multi-service accounts
are stickier and cheaper to serve.

### What I built

Twelve agents, running on NVIDIA Nemotron through Nebius Token Factory. Eight
collectors, each with its own brief and its own Tavily query set; a verifier; an
analyst; a briefing writer; a dashboard updater. The configuration file is the
only thing that changes between industries — the code is identical for all
seven.

### What I learned

**Most of the work was not prompting.** It was deciding what the model is not
allowed to do. Almost every bad output in early runs came from the model being
trusted with something that should have been arithmetic or a lookup — the
score, the URL, whether a page supports a claim. Moving each of those into code
fixed a class of failure rather than an instance of it.

**A counter-argument is worth more than a confidence score.** A number between
0 and 1 tells a salesperson nothing. "They have an in-house team and may never
go to market" tells them whether to pick up the phone.

**Two model sizes beat one.** Extraction is volume work; verification is
judgement. Using the big model for both would have cost roughly four times as
much and read no better.

### The hardest problem

Misattribution. The first clean run produced a confident claim about Oak Ridge
National Laboratory sourced to a Facebook post about a physicist at a different
institution. Nothing in the pipeline was broken — search returned the page, the
model read it, the claim was plausible. It was simply wrong.

The fix was a grounding check that asks a blunt question of every signal: does
this page actually name this organisation and state these figures? If not, the
signal is dropped and recorded as ungrounded. That one check is now the
difference between a tool a BD team would use and one they would stop trusting
in week two.

### What it costs

A whole market, every week, for about eight dollars.

---

## Built with

nebius-token-factory · nvidia-nemotron · nemotron-3-ultra-550b ·
nemotron-3-super-120b · nemotron-3-nano-30b · tavily · node.js · express ·
javascript · html · css · rss · json · node-cron · multi-agent · rag ·
web-search · prompt-engineering

---

## Try it out
- Demo: https://claude.ai/code/artifact/83bd6c5e-04aa-4b56-b454-c22ced8f3a44
- Code: https://github.com/KV2699/veridian

---

## Judges' questions

**Public code repository**
https://github.com/KV2699/veridian
MIT licensed. README has setup instructions, names the Nemotron models and
where each is used, and shows where Token Factory carries the work.

**Working demo**
https://claude.ai/code/artifact/83bd6c5e-04aa-4b56-b454-c22ced8f3a44
No install. Saved results from real runs.

**Which models, and why that size?**

Three, each doing the job its size suits:

- **Nemotron-3-Super-120B-A12B** — the reading. Eight collectors pull pages
  from Tavily and pull structured signals out of them. This is volume work with
  a strict output shape, and Super does it accurately and cheaply. 6.77M tokens.
- **Nemotron-3-Ultra-550B-A55B** — the judgement. Deciding whether a source
  genuinely supports a claim, writing the counter-argument, and writing the
  weekly briefing. This is where being wrong is expensive, so it gets the big
  model. 1.97M tokens.
- **Nemotron-3-Nano-30B-A3B** — small mechanical passes where a large model
  would be waste. 0.58M tokens.

Splitting it this way is the single biggest cost decision in the project. Super
reads about 3.4x the tokens Ultra does; running everything on Ultra would have
cost roughly four times as much for no gain in the reading step.

**Nemotron output quality — rating and detail**

Strongest at instruction-following under a strict schema. Across eight
collectors returning JSON against a fixed shape, malformed output was rare
enough that the repair path almost never fires.

Reasoning held up where it mattered: asked whether a page actually supports a
claim, it reliably says no when the page is about something else, which is the
check the whole product rests on. Counter-arguments were genuinely useful rather
than hedging — "they have an in-house team and may never go to market" is a real
objection, not a disclaimer.

Where it fell short: left to itself it is too generous about relevance. Early
runs mapped signals to more practice areas than the source justified. The fix
was to correct that mapping downwards by default rather than to ask more nicely
in the prompt. Also, like every model I have used, it will produce a plausible
URL if you let it — which is why URLs are allowlisted against what search
actually returned rather than trusted.

**Fine-tune, prompt-engineer, or out of the box?**

Out of the box, prompt-engineered, no fine-tuning.

The approach was to give the model a narrow job with a fixed output shape, and
to move every decision that could be arithmetic or a lookup out of the prompt
and into code. The score is computed in code. URLs are checked against the
search results in code. Whether a source supports a claim is a deterministic
check in code, with the model's opinion as an input rather than the verdict.

What stayed in the prompt is the thing only a model can do: read a page and say
what happened in it, and say what that would mean for a business whose
priorities are described in one paragraph.

**How did Nemotron compare to other models?**

Comparable on quality for this workload and materially cheaper, which is what
decided it. The thing that mattered more than raw quality was having two sizes
of the same family with the same prompting behaviour — the prompts port between
Super and Ultra unchanged, so moving a step up or down a tier is a one-line
change rather than a rewrite. That made the cost tuning above possible at all.

**Which Nebius capabilities were most valuable?**

Token Factory, used as a serverless inference API rather than as managed GPUs.
I did not provision, size or scale an instance; the application calls an
OpenAI-compatible endpoint with a model name, and the two tiers are selected
per agent in configuration. For a twelve-agent weekly batch that is exactly the
right shape — the work is bursty, and paying per token rather than per hour
means an idle week costs nothing.

Two things earned their keep beyond the basics. The usage page gave a per-model
token and cost breakdown that made the Super/Ultra split a measurable decision
rather than a guess. And one OpenAI-compatible endpoint for all three model
sizes meant switching an agent between tiers was a configuration change, not a
code change.

A full weekly run across a market: about $8.20.

**What would have made it more effective?**

- Per-request cost in the API response, not just in the dashboard. I ended up
  inferring per-agent cost from token counts; having it returned inline would
  let the app surface its own running cost.
- Batch or queued inference for non-urgent work. A weekly pipeline does not
  need an interactive response time, and would happily trade latency for price.
- A spend cap that hard-stops rather than alerts, for unattended scheduled runs.

**What do you most hope to see from the Nemotron team next?**

Something between Super and Ultra in size. The gap is wide and several steps in
this pipeline sit awkwardly in it — too much judgement for Super, not enough to
justify Ultra.

Beyond that: structured output that is guaranteed rather than well-behaved. The
schema compliance is good enough that the repair path rarely fires, but "rarely"
still means the code has to exist.

**Did you use Tavily?**
Yes. Tavily is the search layer the whole product sits on. Every collector runs
its own query set against the Tavily API at runtime, and the pages it returns
are the only pages the models are allowed to read. 521 search requests this
month, 1,242 credits, every signal keeping the source it came from.

---

## Admin fields

- **Submitter type:** Individual
- **Organisation:** N/A
- **Track:** Best Apps and Agents
- **New or existing:** New (built for this hackathon, after 26 August 2026)
- **Canada province:** N/A
- **AI tools used:** Claude (Claude Code) for building; NVIDIA Nemotron via
  Nebius Token Factory inside the product itself; Tavily for live search.

---

## Still to do before submitting

1. **Demo video** — upload to YouTube as unlisted, under 3 minutes, then paste
   the URL.
2. **Image gallery** — the raw Nebius Token Factory usage page and Tavily usage
   page screenshots belong here. The video uses rebuilt versions because a raw
   dashboard is unreadable at 1080p; the gallery is where the raw proof goes.
3. **Make the demo artifact public** and open it in a logged-out browser to
   confirm a judge can reach it.
4. **Check the LICENSE file** — it still reads "Copyright (c) 2026 Signal
   Bureau", the pre-rebrand name.
