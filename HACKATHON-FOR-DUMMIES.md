

# Veridian — the hackathon submission, in plain English

**Who this is for:** you, or anyone who needs to understand this system without
reading code. No jargon that isn't explained. Nothing assumed.

**Last updated:** 23 October 2026 · **Keep this current.** It is rewritten after
every batch of changes, alongside [PITFALLS-AND-LESSONS.md](PITFALLS-AND-LESSONS.md).

**The competition:** Nebius × NVIDIA Global AI Hackathon.
**Deadline:** Friday 30 October 2026, 10:00am Pacific = **17:00 UK time**.
**Track:** Best Apps and Agents.
**Judging:** 1–15 December. Winners announced around 11 January 2027.

---

## Part 1 — What the thing actually is

### The problem, in one paragraph

If you sell anything complicated to businesses — consultancy, recruitment,
infrastructure, software — your job is partly to notice things. A company
announces a new factory. A regulator sets a deadline. Someone resigns. Each of
those events creates a reason for someone to buy something, and whoever notices
first usually wins the work. Nobody can read the whole internet every week, so
in practice people check a few sources, miss most of it, and call the result a
pipeline.

### What Veridian does about it

Every Monday morning at 7am, without anyone pressing anything, it reads the
market, checks what it found, throws away what it can't prove, scores what's
left, and writes a briefing. You open your laptop and there's a page telling you
who moved, what it means, and three things to do this week. You can also just
ask it questions — by typing or out loud.

### The bit that makes it different from a news alert

Most tools tell you *something happened*. This one asks a harder question:

> **What do you sell, and which of those things does this event open a
> conversation about?**

You tell it what your business sells — your "practice areas". It then scores
every event on **how many of those things this event could lead to a sale of**.
An event that opens three of your services scores far higher than a bigger event
that opens one, because a client who buys three things is worth much more than
one who buys one, and is far harder for a competitor to take off you.

In sales language: it's a **cross-sell engine**, not a feed.

### And the bit that is genuinely unusual

**The same event means opposite things to different businesses.**

Take one real headline from October 2026: *"Ingka Group appoints Erika Intiso
as Chief Sustainability Officer."*

- If you **sell sustainability software**, that's excellent news. There's a new
  person with a new budget and about 90 days to show they were worth hiring.
  **Call them.**
- If you're a **headhunter who places sustainability executives**, that's the
  worst possible news. That job is now filled. Your fee is gone. **Forget them.**

No signup form can work that out. If you asked an AI to guess, it would give you
a confident, sensible, wrong answer — and you would never find out, because a
week with no leads looks exactly like a quiet week in the market.

So the system makes you say it, in plain English, in a file called a **profile**.
We call it **polarity** — which way an event points for your business. That
sentence then travels with every instruction the AI is given, at every stage.

**This is the single best idea in the project**, and the two configurations exist
to prove it is real rather than just claimed.

---

## Part 2 — The six configurations

Veridian ships configured for **six different businesses**. Three were written
by hand from prompt packs that were tested on real clients; three more the
system built for itself. Same code, same twelve agents, same scoring — one file
different each time.

| Configuration | The business | What they sell | An appointment is |
|---|---|---|---|
| **nvidia** | AI infrastructure vendor | 6 — compute, networking, software, Omniverse, automotive, edge | a **lead** |
| **exec-search** | ESG executive search | 4 — search, recruitment, interim, advisory | a **dead lead** |
| **consultancy** | Software & data consultancy | 5 — AI, data, engineering, strategy, CX | a lead |
| **serviced-apartments** | Aparthotels across 25+ cities | 6 revenue streams — corporate, real estate, offsites, relocation, travel partners, production | relevant only if it is in a city they operate in |
| **think-tank** | Environmental policy think tank | 6 policy areas | a lead — but to **brief**, not to sell to |
| **sustainability-comms** | Sustainability communications agency | 5 service lines | a lead — a new leader wants an early win |

### The proof, in one headline

*"Company X appoints a Head of Sustainability."* Three configurations, three
different correct answers:

- **The infrastructure vendor** — a lead. A new budget holder with about 90 days to show progress.
- **The executive search firm** — a **dead lead**. The job is filled. The fee is gone.
- **The think tank** — a lead, but not a buyer. A new decision-maker to brief, before their position on policy hardens.

No signup form could ever work that out. Each configuration states it in plain
English in a field called `polarity`, and that sentence travels with every
instruction the AI is given.

### Why these six and not others

They were chosen to be as **unlike each other as possible**, because that is what
tests the engine. A serviced-apartment operator selling city by city has nothing
in common with a GPU vendor — and it still fits without a line of code changing.

Two more sectors exist as tested prompt packs and could be added the same way: a
law firm (already built by the system itself) and an online-safety consultancy.

### What each one actually found — live runs, 29 October

Every configuration has now been run live, with Tavily search and Nemotron on
Token Factory. These are real organisations with real sources:

| Sector | Before | **After a live run** | Briefing |
|---|---|---|---|
| AI Infrastructure & Hardware | 150 | **150** | 1,977 words |
| Policy, Research & Non-profit | 9 | **33** | 1,402 words |
| Communications, Creative & Agencies | 4 | **20** | 1,199 words |
| Executive Search & Recruitment | 1 | **17** | 1,222 words |
| Hospitality & Serviced Accommodation | 2 | **13** | 805 words |
| Technology & Data Consultancy | 1 | **11** | 771 words |
| Legal & Professional Services | 3 | 3 | 410 words |
| | | **247 organisations across 7 sectors** | |

The executive search briefing now leads with *"Netflix lost its first chief
sustainability officer Emma Stewart after six years, with no named successor"* —
which is exactly the signal type the original Acre diagnosis said the old method
was missing entirely. The system found the thing the methodology was rebuilt to
find.

**What the free-only runs taught us stands.** The serviced-apartment
configuration produced 2 organisations on RSS alone and 13 with search — the
earlier note said its trigger was too rare for feeds and that the fix was search
rather than more feeds. That turned out to be right.

### What every one of them shares

This is the finding that makes the whole thing work. Seven BD trackers were
built independently, for seven different businesses, over several years — and
**every single one scores prospects the same way**:

| Factor | Points |
|---|---|
| How many of your services this opens | 30 |
| Whether it opens two or more | 25 |
| How recent it is | 25 |
| How big the organisation is | 20 |
| | **= 100, banded Critical 75+ / High 50+ / Medium 25+ / Low below** |

Identical thresholds in all of them. That is not a design claim — it is seven
pieces of independent evidence that this is how the job is actually done.

## Part 2b — Onboarding a new business automatically

The system builds its own configurations — all of it except one thing, and that
exception is the whole point.

### Where it lives in the interface

**Top bar, next to the configuration selector: `+ Add a business`.**

That is the answer to "where would a judge do this?". It opens a sheet, takes a
website and a few past deals, and shows a live log while it works. No terminal,
no files, no second tool. The same thing is available from the command line
(`node tools/build-profile.mjs`) for anyone who prefers it.

### What it does on its own

In about a minute, with **no search credits**, it:

1. **Reads the company's own website** over plain HTTP — the homepage plus the
   "what we do" and services pages it finds by following links
2. **Works out what they sell**, as separate budgets signed by different people
3. **Finds their named clients and competitors** from their own site and the brief
4. **Probes for live RSS feeds** and *tests every one*. On the real test it
   found 6 working feeds and correctly rejected 4 — including a "soft 404", a
   page that returns success but isn't a feed
5. **Writes the filter words** that decide which headlines are worth reading,
   weighted to event words (*appoints, steps down, awarded, acquires*) rather
   than topic words
6. **Writes a complete, runnable profile file**

### The one thing it refuses to do

**It will not guess the polarity.** That is the field saying whether an
appointment means "call them" or "we've lost this one", and no amount of
research answers it, because it isn't a fact about the market — it's a fact
about the business model.

But there *is* one reliable source, and it isn't a description of the company.
**It's their own past wins.** For each deal they've already won, one question:

> *What published event started this deal?*

Answer it five times and the polarity falls out of the answers. No guessing.

Here is what it produced from six real wins, unedited:

> - *A COMPLETED ACQUISITION with a stated integration timetable is a LEAD — two estates must be merged against a legally fixed date and the work cannot be deferred.*
> - *A REGULATOR PUBLISHING FINAL RULES with an in-force date is a LEAD on every firm it obliges, and NOT on the regulator itself — the regulator is not a customer.*
> - *AN ORGANISATION STATING IT BUILDS IN-HOUSE is a DEAD LEAD — the work will never come to market, however well it fits.*

That last line came from a deal they **lost**. No market research would ever
have produced it. Each line is written into the file with the deal it came from,
so a human can check it.

**If you give it no wins, it still writes the profile** — with the polarity
block left as explicit unanswered questions and a warning at the top saying the
profile will not score correctly until a human answers them. Refusing to guess
is not a limitation. It's the product.

### Proof: a third business, onboarded free, producing a real briefing

A UK technology consultancy. Website + a research brief + six past wins. One
minute. Zero search credits. Then one free run, and the briefing it wrote found:

> **Open tender** — Future Generations Commissioner for Wales, Cymru Can
> Strategy Review, **£12,500, closing 9 November**
> *Counter-reading: the tender value is only £12.5k, which may be below their
> minimum engagement threshold.*

A real contract, a real deadline, a real source link — and the system arguing
against its own lead on commercial grounds. It also connected that tender to a
government announcement in the same week and recommended a combined pitch.

### And then a fourth, from the interface, in a market with nothing in common

A **UK law firm**. Website, four past deals (three won, one lost), nothing else.
Built from the dashboard in about two minutes. The polarity it derived:

> - *A REGULATOR ANNOUNCING A FORMAL INVESTIGATION INTO A SECTOR is a LEAD — it signals imminent scrutiny that triggers demand for external competition law counsel.*
> - *AN FTSE 100 GROUP ANNOUNCING AN EXPANSION OF ITS IN-HOUSE LEGAL TEAM is a DEAD LEAD — the client is building internal capacity and is less likely to engage external counsel.*

Then one free run produced a 410-word briefing naming two funding rounds that
closed the same day, a live public tender, and this:

> *Counter-reading: the tender is issued by a public authority; the realistic
> buyers are the bidding consortia, which are not named, so there is no direct
> contact point.*
>
> **Recommended action:** monitor the tender outcome to identify the winning
> consortium, then approach the lead bidder's legal team.

It noticed the named buyer wasn't the real buyer, and said who was instead.

**Four markets now run on identical code** — AI infrastructure, executive
search, technology consultancy and law. Two were hand-written. Two the system
built itself. **Zero search credits were spent on any of it.**

### It researches the market itself — no second tool needed

A company's own website says what it sells. It does not say which trade press
carries its market's news, which regulators create work for its customers, or
who it competes against. That used to be a separate research step in another
tool. It isn't any more.

**Why it is safe to let the AI do that research**, when the rest of the system
never lets a model supply a fact: *anything it invents can be caught by
fetching it.* A made-up publication doesn't resolve. A real one returns a feed
with articles in it. So the model proposes and the network disposes.

On the law-firm test it proposed 24 publications and 8 regulators; **6 feeds
survived the check and 9 were discarded**, along with every regulator domain
that didn't answer. Nothing unverified reaches the configuration.

That is the exact opposite of how the collectors work, and deliberately so.
There, a model may never supply a fact, because a made-up *signal* looks
identical to a real one and nothing can check it afterwards.

### The workflow, end to end — all in the product

| Step | Where | Cost |
|---|---|---|
| 1. Click **+ Add a business** | the top bar | — |
| 2. Paste their website | the sheet | free |
| 3. Write down a few deals they won — *and lost* | the sheet, 10 minutes | free |
| 4. Watch it build | live log in the sheet | free |
| 5. Read the polarity lines it derived | you, 5 minutes | free |
| 6. Run it | **Run pipeline**, free-sources mode | **free** |

---

## Part 2c — Your accounts, in one place

Verified on 29 October by logging into each service.

| | |
|---|---|
| **Devpost** | ✅ **Registered.** A draft submission exists — "Untitled", **1 of 5 steps done** |
| **Nebius Token Factory** | ✅ Live · **vincentkerrie13@gmail.com** · account name *kerrie vincent* · org *Kerrielouisedesign-g4s* · **balance $29.36** |
| **Nebius AI Cloud** | ✅ Tenant `white-worm-tenant-zdf`, project `default-project-eu-west2` |
| **Tavily** | ✅ Live · same email · Researcher plan · **974 of 1,000 used** · pay-as-you-go disabled |
| **GitHub** | ✅ Authenticated as **KV2699** with repo scope — the public repo can be created on request |
| **Claude / git identity** | kerrielouisedesign@outlook.com |

**The identity thread:** everything hackathon-related sits under *kerrie vincent*
and **vincentkerrie13@gmail.com** — not the Outlook address used for Claude and
git. Worth knowing when hunting for a confirmation email.

**The one unblocking action:** Tavily's dashboard has a **Coupon** box at
app.tavily.com/home — *"enter a coupon code to receive free API credits"*. The
Nebius Builder Program grants $25 of Tavily credit, and the Devpost to-do for it
is already ticked, so the code is most likely sitting in an email at
vincentkerrie13@gmail.com. Pasting it into that box turns 26 remaining credits
into roughly 3,000.

---

## Part 3 — How the hackathon's rules are met

The competition has hard requirements. Here they are, and how we meet each.

| What they require | What we do |
|---|---|
| **Must run on Nebius Token Factory** (their AI service) | Every single AI call goes there. There is no second AI provider and nothing runs on your laptop's own AI. One file, `server/lib/nebius.js`, is the only door |
| **Must use at least one NVIDIA open-source model** | Two of them. **Nemotron Ultra** (the big, slow, clever one) and **Nemotron Super** (the small, fast one) |
| **Pick a track** | Best Apps and Agents |
| **A working demo anyone can click** | The dashboard — *outstanding, see Part 8* |
| **A public code repository with an open-source licence** | MIT licence, in the repo — *needs pushing to GitHub, see Part 8* |
| **A video under 3 minutes on YouTube** | *Outstanding, see Part 8* |
| **A written description** | *Outstanding, see Part 8* |
| **Feedback on their tools** | We have unusually good material — see Part 7 |

### Why we use two different AI models, and why that matters to the judges

The track description literally says: *"Reach for Nemotron 3 Ultra when you need
serious reasoning, and let Nano or Super handle the fast, everyday calls, so your
app stays responsive and your credits stretch further."*

That is exactly what we do, and we did it because we **measured it**, not because
the brief said so. All four NVIDIA models were tested on the same job:

| Model | Time | Result |
|---|---|---|
| Nano 30B | 2.5s | fine |
| **Super 120B** | 2.6s | **chosen for the fast work** |
| Ultra 550B | 1.0s | too expensive for repetitive work |
| Lightning | 25.9s | **never answered at all** — it thought until it ran out of budget |

That last row is worth the most. Lightning is a "reasoning" model: given a simple
job it reasons about it until its time is up and produces nothing. Our first live
run returned **182 search results and zero signals** because of it. Most entrants
will write "we used Nemotron". We can write "we tested all four and here is why
this one", which is a different class of answer.

**Where each one is used:**

- **Ultra** does two jobs that need the whole week in view at once: checking
  every signal, and writing the briefing. You cannot spot that two stories are
  the same event unless you can see both.
- **Super** does the repetitive work: reading each web page and pulling out the
  facts. Dozens of small jobs. Using the big model here would cost more and be
  no better.

---

## Part 4 — How it works, step by step

Twelve pieces, which we call "agents". Nine of them run at the same time, then
three run in order.

### Stage 1 — Finding things (nine agents, all at once)

| # | Agent | What it does | Costs search credits? |
|---|---|---|---|
| 1–4 | **Collectors** | Four web searches, each hunting a different kind of event | Yes |
| 5 | **Roster Sweep** | Goes through every organisation it already knows, by name, and reports on each one — *including "nothing this week"* | Yes |
| 6 | **Regulator Sweep** | Reads named government bodies and regulators | Yes |
| 7 | **Feed Collector** | Reads the trade press's RSS feeds | **No — free** |
| 8 | **Tender Collector** | Reads government procurement websites for published contracts | **No — free** |
| 9 | **Account Watch** | Checks the clients you already have for a reason to call | Yes |

Two of those are worth understanding properly.

**The Roster Sweep is the difference between searching and checking.** A search
finds what it finds. A sweep goes down a list and tells you the result for every
name on it. That means after a run you know what was *checked*, not just what
happened to turn up — and "we checked them and they were quiet for three weeks"
is itself useful information.

**The Feed and Tender collectors cannot make things up.** They read headlines
written by publishers, with the publisher's own link and date, and contract
notices written by the buyer. An AI never supplies a fact on those paths — it
only sorts them. They are also completely free, which matters enormously (Part 6).

### Stage 2 — Deciding what to believe (one agent)

**The QA Verifier**, using Nemotron Ultra, is the only part allowed to delete
anything. It:

1. Scores every signal 0–10 for how much it matters *to your business*
2. Spots the same event found twice and keeps the best-sourced version
3. **Corrects the practice-area list downwards by default** — because claiming
   an event opens three of your services when it opens one is the easiest way to
   corrupt the whole ranking
4. Writes a **counter-reading** — the argument *against* acting on this lead
5. Throws away anything scoring below the threshold, **and writes down why**

### Stage 3 — Scoring (no AI at all)

This is deliberate and it is important.

**The AI never decides the priority score.** It provides the ingredients; a piece
of ordinary arithmetic does the sum:

| Factor | Points |
|---|---|
| How many of your services it opens | 3 or more = 30 · 2 = 20 · 1 = 10 |
| How valuable (deal size, or multi-service) | up to 25 |
| How recent | this week = 25 · this month = 15 · this quarter = 5 |
| How big the organisation is | large = 20 · medium = 12 · small = 5 |
| | **= out of 100** |

75+ is Critical, 50–74 High, 25–49 Medium, below that Low.

**Why it is done this way:** we asked an AI to score things once. It invented its
own weighting, scored four prospects 75–77 "Critical", and sounded completely
certain. Recalculated properly, they came to 70 — a whole band lower. An AI
asked for a number will always give you one, and it will always sound confident.

The other advantage: every score can be taken apart. "Why is this 80?" has an
answer — 30 for three services, 25 for deal size, 25 because it's four days old.

### Stage 4 — Writing it up (two agents)

**The Briefing Writer** (Ultra again) turns the verified signals into the Monday
briefing. It is forbidden from adding anything not in the signals it was handed,
must mark anything uncertain as "(unconfirmed)", and must state the
counter-reading rather than quietly dropping it.

**The Dashboard Updater** saves everything and updates the organisation register.

### And then, any time: asking it questions

Type or say *"top 5 multi-service prospects"* or *"what's closing in 14 days?"*

Here's the clever part. The AI does **not** search the records. It only:
1. Translates your English into a filter ("multi-service = yes, sort by score, top 5")
2. Ordinary code runs that filter and pulls the rows
3. The AI then reads those exact rows out loud

**It can never invent a company**, because it never chooses which companies to
mention — it's handed them. Ask it something the data can't answer ("which of
these will sign first?") and it says so rather than guessing.

---

## Part 5 — What has actually been tested, and did it work?

An honest account, because the judges will ask and so should you.

### The infrastructure configuration — tested live, works

| | |
|---|---|
| Full live runs | Several, the last on 2 October |
| Signals collected | 165 raw → **110 verified** |
| Organisations found | **165, with no starting list** — it built its own prospect list from nothing |
| Breakdown | 18 Critical · 78 High · 59 Medium · 10 Low |
| Multi-service prospects | 34 |
| Briefing produced | 1,978 words |
| Time | about 19 minutes |

**Honest assessment:** it works. Roughly **one in five** entries is something you
could act on immediately — which sounds low until you compare it with reading
the trade press yourself. The weak spots are named in Part 8 and the register
still has some junk at the top of it.

### The headhunting configuration — built from a *previously tested* method, newly ported

This one needs care, because the honest answer has two halves.

**The method behind it was tested hard, on a real firm, before this project
existed.** It comes from a prompt pack written for a sustainability executive
search firm (referred to here as the Acre work). Versions 1 and 2 of that pack
**returned almost nothing**. The diagnosis found eight root causes:

| # | What was wrong | What it taught us |
|---|---|---|
| 1 | It hunted **states, not events** — "does this company lack a Head of Sustainability?" | No document on earth says a company *lacks* something. Faced with an unanswerable question, an AI either returns nothing or invents. We got both |
| 2 | It hunted **appointments** — backwards for a recruiter | A test search returned six appointments, all filled jobs. Worse, most first-time Chief Sustainability Officers are **promoted internally**, so there was never a fee available |
| 3 | **Wrong target list** — FTSE 100 giants | They all have in-house recruitment teams and existing deals with the two biggest competitors. The winnable market is mid-sized firms building the function for the first time |
| 4 | **Stale sources** — it named a publication that had been renamed | And it missed the trade press that actually carries these moves |
| 5 | No check for **"another agency already has this job"** | A job already with a rival recruiter is a dead lead. It was scoring them as live |
| 6 | **90-day window** for everything | A vacancy is contested within days. It was producing a pipeline of jobs that were already gone |
| 7 | **Too many conditions chained together** | Each sensible on its own; stacked, they filtered out everything |
| 8 | Built around **one AI tool** | Threw away the reason for using several |

**Did the fixed version work?** Yes — the corrected approach immediately found
real, named vacancies that the old one missed entirely: Netflix (the
sustainability lead left in July and the company had not said whether it would
replace her), Graphic Packaging, and the Science Based Targets initiative, which
had publicly said it would recruit a successor. One trade-press line summed up
the whole opportunity: numerous chief sustainability officers had left in the
previous year without a successor being named.

**What is newly built, and not yet run live, is this system's version of it.**
Five of those eight root causes are now built into the configuration file as
hard constraints. It has been proven on the **free** path — the feed test in
Part 2, which found the Disney vacancy and correctly binned the Ingka
appointment — but it has not yet done a full live run with web search, because
of the credit situation in Part 6.

**And then the free run found a bug worth more than the run.** The first
free-sources run of this configuration verified **nothing** — two signals
extracted, both thrown away. The rejection log said why, word for word:
*"Future date (2026-10-20) is implausible."* The story was three days old. The
AI was treating this week's news as being in the future, because **nothing in
the instructions told it what today's date was**, so it fell back on the last
date it saw during training.

That is precisely backwards: the fresher the news, the more suspicious it looked
— and recency is a quarter of the score. Five of the twelve agents had the same
gap.

Worse, it was a solved problem. `Today's date: [TODAY'S DATE]` appears in every
single prompt of the original Acre prompt pack. The big ideas were carried into
the code carefully; this one-line habit was dropped.

Fixed, and the same sources on the same day then produced the briefing quoted in
Part 6.

**What this means for the submission:** say exactly this. The method is
evidence-tested; the port is proven on real content through the free path; the
full live run is pending credits. Judges discount vague claims. They rarely
discount a specific number offered against your own interest.

### Other business types the method has been tested on

Not configured in the system — but tested as working methods, which is why we
can say the engine generalises rather than guessing.

| Business | What it sells | Status |
|---|---|---|
| **Scott Logic** — software and data consultancy | 5 practices, mostly to banks, energy firms, government | Most advanced tracker of the set: seven pass/fail gates, a rejection log, a "counter-reading" column, converting a regulation into a list of named affected companies. **Two of its ideas are now in the engine** |
| **Green Alliance** — environmental policy think tank | 6 policy areas, funded by partners and foundations | Four-part tracker, built around growing existing partners into more areas |
| **Futerra** — sustainability communications agency | 5 service lines | Built around reputational events — a greenwashing story is a sales trigger |

---

## Part 6 — Money, credits, and what you can run right now

### The short version

**You do not need to spend any money.** The hackathon rules point at a free
programme that gives you credits for both services.

### What things cost

There are two meters running, and only one of them is a problem.

**Meter 1 — Tavily (the web search).** Charged in "credits". Each search costs 2
credits at the good quality setting, 1 at the lower one.

| What | Searches | Credits |
|---|---|---|
| One full infrastructure run | 56 | **112** |
| One full headhunting run | ~37 | **~74** |
| The free feed check | **0** | **0** |
| Re-running from a saved checkpoint | **0** | **0** |
| A dry run with fake data | **0** | **0** |

**Meter 2 — Nebius (the AI).** Charged per word processed. A full run costs well
under a dollar at current rates. **This is not your problem.**

### Where you stand right now

| | |
|---|---|
| Tavily plan | Researcher (free), 1,000 credits a month |
| Used | 974 |
| **Left** | **26** |
| Resets | 1st of the month — **1 November, two days after the deadline** |

**26 credits is not enough for a single full run of anything.** But it is enough
for a handful of individual test searches if you need them.

### The fix — free, legitimate, and named in the hackathon's own rules

The official rules say, word for word:

> *"Entrants can join the Nebius Builder Program and get credits for Nebius
> Token Factory, Tavily, and Nebius Academy."*

Join at **https://dev.nebius.com/builders** — free, takes a few minutes. It
includes:

| | |
|---|---|
| **$25 Tavily credit** | At $0.008 a credit, that's **about 3,125 credits ≈ 28 full runs** |
| **$25 Nebius Token Factory credit** | More AI than this project will use |
| $100 LangSmith credit | Not needed |
| $100 Toloka credit | Not needed |
| Nebius certification for $1 | Worth mentioning in the submission |

You will need a GitHub profile URL to sign up — and you need GitHub for the
submission anyway.

### Until those credits arrive, here is everything you can run for free

```bash
npm test                               # 15 test files, no keys needed
npm run pipeline:free                  # THE WHOLE PIPELINE on free sources only — 0 search credits
node tools/feed-check.mjs exec-search  # just the feed step, to check a profile quickly
npm run pipeline:dry                   # the whole pipeline on fake data, 0 calls
npm run pipeline:resume                # re-run from the last saved search, 0 credits
npm start                              # the dashboard, using data already collected
```

### `pipeline:free` — the one that changes the situation

This runs the **entire** pipeline — verification, scoring, the briefing, the
register, the rejection log — using only the two collection sources that cost
nothing: the trade press RSS feeds and the government procurement portals.

It is not a cut-down version. Those two sources are the *only* ones where an AI
never supplies a fact: the publisher writes the headline, the buyer writes the
contract notice. They cannot get a company wrong. What they can't do is find an
organisation nobody has written about yet.

**On its first proper run for the headhunting configuration it produced a real
briefing, for nothing:**

> **This week's headline:** Disney's environmental sustainability co-lead
> Yalmaz Siddiqui departed on 20 October 2026 with no named successor.
>
> *Counter-reading: Disney is a mega-cap with a mature in-house talent function
> and a likely incumbent search panel, and the remaining co-lead may cover the
> vacancy, making external search unlikely.*
>
> **Recommended action:** contact the remaining co-lead to confirm whether the
> vacancy will be filled externally or covered internally.

That is the system arguing against its own lead and then telling you how to
test the argument. Zero credits.

**`pipeline:resume` is the one to remember for the video.** It replays the last
real collection without searching again, in about two minutes instead of
nineteen, and costs nothing. Record as many takes as you like.

---

## Part 7 — Why this should do well, and the honest weaknesses

Four criteria, equally weighted.

### 1. Technological Implementation

**Strong.** Twelve agents, 15 test files, a deliberate two-model split chosen by
measuring all four, protection against the AI being cut off mid-answer, a lock
stopping two runs corrupting each other, and a search layer that cannot
hallucinate because any link the AI didn't get from the search is thrown away.

**Weak:** not yet deployed anywhere a judge can click.

### 2. Design

**Strong.** It's a complete loop: it runs itself, produces a briefing, answers
questions by voice, shows its workings, and now lets you switch between two
businesses from a dropdown.

**Fixed 23 October:** the register used to have rubbish at the top — `United
Kingdom` scoring 90 Critical, sourced to an investment guide. A country cannot
sign a contract. 15 non-organisations removed, `Amazon` and `Amazon Web
Services` merged, and four entries whose band disagreed with their own score
corrected. 165 → 150 organisations, and the top ten is now defensible.

**Weak:** still not deployed anywhere a judge can click.

### 3. Potential Impact

**Strong.** A real problem, a real practitioner, a method with a decade of
documented failures behind it, and 165 organisations found from a standing start.

**Weak:** this story is buried in technical documents. The README now leads with
it; the Devpost description must too.

### 4. Quality of the Idea

**Strongest, by a distance.** Four genuinely non-obvious decisions, each forced
by something breaking:

1. **Polarity** — the same event means opposite things to different businesses
2. **The AI never chooses** — it translates and narrates; code selects
3. **Scoring is arithmetic** — because an AI asked for a number invents one
4. **"Is this article *about* this company?"** not "does it mention it" — two
   top-five leads once survived by appearing deep inside articles about
   something else entirely

### The two bonus prizes we should go for

- **Best Use of Tavily — $3,000**, and three Tavily staff are judges. We have a
  genuine finding about their product: their result limit caps *ranking*, not
  dates, so four weekly searches returned 100 unique results where one 28-day
  search returned 30.
- **Most Valuable Feedback — $100 × 10 winners.** The material already exists:
  the Lightning model never answering, Nebius silently returning empty results
  when overloaded rather than an error, and answers being cut off mid-sentence
  in a way that looks like success.

---

## Part 8 — What is left to do

| # | Task | Who | Status |
|---|---|---|---|
| 1 | **Confirm you clicked "Join hackathon" on Devpost** | You, 1 minute | **Unverified — no record of it in any session. No registration, no submission** |
| 1b | **Claim the $25 Token Factory credit** at the resources-page form, activation code `NEBIUS-DEVPOST-GLOBAL26` | You, 5 minutes | **Separate from the Builder Program — this is a second, additional $25** |
| 1c | **Join the Nebius Builder Program** — adds another $25 Token Factory **and** the $25 Tavily | You, 5 minutes | **Not claimed. Verified 23 Oct: Tavily still reports the free Researcher plan with no credit applied** |
| 2 | Push the code to a public GitHub repo | Either | Not started |
| 3 | ~~Clean the rubbish out of the register~~ | Claude | **Done 23 Oct** — 165 → 150, top ten defensible |
| 4 | One full live run of each configuration | Claude, once credits land | Blocked on #1 — but **both configurations already produce a real briefing for free** via `npm run pipeline:free` |
| 5 | **A hosted demo URL** — anywhere, not necessarily Nebius | Claude | Not started — **genuinely required by the rules** |
| 5b | Nebius Serverless Job for the pipeline | Claude | Not started — **optional**, a scoring enhancer only. See DECISIONS-NEBIUS-TOOLING.md |
| 6 | Record the 3-minute video | You + Claude | Not started — **required** |
| 7 | Write the Devpost description | You + Claude | Not started — **required** |
| 8 | Write the tooling feedback | Claude | Material exists |
| 9 | ~~Redesign the dashboard from your Figma~~ | Claude | **Done 23 Oct** — built from the published Figma at need-shed-66175757.figma.site |

### What the video should show

Not the system working. **The system catching itself.** Nobody else will have
that.

| Time | What to show |
|---|---|
| 0:00–0:20 | The problem. One person cannot read the whole internet every week |
| 0:20–0:50 | Ask it a question out loud. Real answer, real company, clickable source |
| 0:50–1:20 | Where the answer came from: twelve agents, Ultra checking, Super extracting |
| 1:20–2:00 | **The catch.** A claim about a national laboratory, sourced to a post about a physicist, dropped automatically before it reached the briefing |
| 2:00–2:30 | **The two configurations.** Same headline, opposite verdicts. Switch the dropdown on camera |
| 2:30–2:50 | The register: 165 organisations it found itself, scored by arithmetic you can audit |
| 2:50–3:00 | What's next, named honestly |

---

## Part 9 — How a business would set this up for itself

A judge may ask "how does this generalise?" The answer is a one-page form and
about a day's work. Nothing is retrained, no AI is involved in the setup.

### The seven questions a new business must answer

These are the ones that genuinely cannot be guessed from a company website.

| # | Question | Why it can't be guessed | Example |
|---|---|---|---|
| 1 | **Polarity.** When someone is appointed, is that good or bad news for you? What about a resignation? A funding round? | The most important question in the system, and nothing in "we are a recruitment firm" implies "therefore invert appointments and hunt departures" | Vendor: appointment = lead. Recruiter: appointment = dead lead |
| 2 | **What do you sell?** List the separate things, as a buyer would recognise them | If you list too finely, everything opens "three services" and the ranking stops working. An early version split one product into three and two thirds of a week came out "Critical" | "Executive search / recruitment / interim / advisory" |
| 3 | **Who can you actually win?** Not who could theoretically buy | The biggest names are usually the worst prospects — mature teams, incumbent suppliers | Mid-market, £50m–£1bn, private-equity backed |
| 4 | **How fast does a lead go stale?** Per signal type | A job advert closes in weeks. A policy change lasts a year | Vacancies 30 days, adverts 21, restructures 90 |
| 5 | **Which events actually get published?** | If the event is confidential, no wording will ever find it — delete the search rather than tune it | Supply agreements: mostly never published. Deleted |
| 6 | **Which publications carry your market's news?** | General web search systematically misses trade press, and source lists go stale | 11 named RSS feeds, each checked live |
| 7 | **Who are your clients, and who are your competitors?** | Clients are never "prospects" and get their own weekly check. Competitors are intelligence, never leads | — |

### The quickest version: let the system do it

Most of this is now automated — see Part 2b. Run the Perplexity prompt in
[tools/PERPLEXITY-PROFILE-PROMPT.md](tools/PERPLEXITY-PROFILE-PROMPT.md), write
down five past wins, and `node tools/build-profile.mjs` produces the file. The
only part that needs a human is reading the polarity block afterwards.

### What you would physically send us

1. A list of your services, with a sentence on what each one is
2. Your client list (so they're tracked as relationships, not leads)
3. Your competitors (so they never appear as prospects)
4. 5–10 real past wins — *"what was the event that started this deal?"*, which is
   the fastest way to get polarity right
5. The publications you already read
6. Your rough ideal client size and sector

### How NVIDIA — or anyone — would sell this

Three honest routes:

**a) As a product for professional services firms.** Consultancies, recruiters,
agencies, law firms. They all have the same problem and all have "practice
areas" already. One configuration file per client, sold as a subscription.

**b) As something NVIDIA's partner ecosystem uses.** NVIDIA has thousands of
partners all selling into the same market. One configuration, many partners,
each with their own client roster. Shows off Nemotron doing real commercial work
rather than a demo.

**c) As a reference implementation.** The honest pitch to Nebius: this is what a
genuinely useful Token Factory application looks like — big model and small model
each doing the job they're suited to, costs measured, and the reasons documented.

### The honest competitive picture

Do not claim to have invented practice-area selling. A judge who follows this
market will know better:

- **Sprouts** does exactly this for law firms — models practice groups, scores
  signals against each one. But it is **only** for law firms
- **Clay** can do it, but you build it yourself. It's a workbench, not a product
- **Common Room, ZoomInfo, Harmonic** score "fit" and "intent" but none treats
  cross-sell as a first-class part of the score

**What is genuinely ours:** it's horizontal (one engine, any sector, driven by a
file), the scoring is deterministic arithmetic rather than a dial in a settings
screen, and **nobody else lets you declare that an event means the opposite thing
for your business.** That last one is the claim to lead with.

---

## Part 9b — What the interface looks like, and how someone uses it

The dashboard was rebuilt on 23 October from the published Figma design. Four
things make the journey work:

**1. The top bar answers "whose business is this?"** The configuration selector
sits beside the wordmark, because switching configuration is not a filter — it
is a different business, with its own register, its own briefings and its own
reading of the same news.

**2. `+ Add a business` sits right next to it.** That is the answer to "would
this work for mine?", and it is one click from anywhere.

**3. A numbered workflow strip** — *01 Overview, what changed · 02 Signals,
where to act · 03 Proof, why it scored · 04 Ask, query the register*. Someone
seeing it for the first time can follow the numbers. Someone who knows where
they are going uses the tabs instead. Same journey, described twice.

**4. It opens with the aha, not a chart.** The judges' own guidance was *"get to
the aha moment fast — 30 seconds in the demo"*. So the first panel on the page
is one real headline read by two configurations, reaching opposite verdicts,
with the reason stated underneath. Then the greeting, the grounding badge, four
numbers, and the briefing.

**5. Every agent says which engine ran it.** The judges also asked to *"show
which model is doing what"*. Each row is labelled **ULTRA**, **SUPER** or **NO
MODEL**, and separately **FREE** where the step touches no paid service at all.
That is the Token Factory criterion made visible without opening a file.

### Three design decisions worth knowing

**No grey text anywhere.** The Figma sets secondary copy in mid-grey. Every word
here is either the near-black ink or the green label colour, and hierarchy comes
from **weight and size** instead. Faded type is the quickest way to make an
interface look cheap and the fastest way to fail an accessibility check.

**The page ground is a colour.** Cards are white; the surface they sit on is a
soft neutral, so panels separate by value and a hairline rather than being white
boxes floating on grey.

**Colour means one thing each.** Green is *verified / actionable*. Lime is *the
system is working*. Blue is *you can click this*. Amber is *the argument
against*. Rust is *act now*. Nothing is coloured decoratively — so the colour
itself tells you something before you have read a word.

### On a phone

The briefing leads; the instrument panels follow. The workflow strip scrolls
sideways, the configuration selector and **Run pipeline** share one row, and the
question box moves below the briefing — because on a phone you read first and
ask second.

---

## Part 10 — The top eleven things this does brilliantly

1. **It reads the same news two opposite ways, correctly.** Provable in 30
   seconds, for free, on real headlines. Nothing else in this competition will
   have this.
2. **It builds its own prospect list from nothing.** 165 named organisations from
   no starting list, each with every signal ever seen about it and how many weeks
   it's been tracked.
3. **It cannot invent a source.** Any link the AI didn't receive from the search
   is discarded in code. A made-up URL physically cannot reach a briefing.
4. **It asks whether an article is *about* a company, not whether it mentions
   it.** Long articles mention many companies; only one is the subject.
5. **The score is arithmetic you can take apart.** Four numbers, auditable,
   identical every time. No AI invents a priority.
6. **The AI never picks the answer.** It translates your question; code does the
   selecting; the AI reads out only the rows it was handed.
7. **It tells you why a bad week was bad.** Searched → found → extracted →
   verified, with the named cause of each drop-off. Most tools show you an empty
   list and let you assume the market is quiet.
8. **It keeps what it threw away, and why.** Rejected signals are logged with a
   reason code, so a rejection that's actually a *bug in the rules* can be told
   apart from a correct one.
9. **It argues against its own leads.** Every signal can carry a counter-reading
   — including "the real buyer here is someone else entirely".
10. **It checks every name on the list, including the quiet ones.** "Checked and
    nothing" is different from "didn't look", and only one of those is useful.
11. **It onboards a new business itself** — reads their website, works out what
    they sell, finds and *tests* their trade press feeds, and writes the
    configuration file. One minute, no search credits. And it refuses to guess
    the one field that cannot be researched, deriving it from past wins instead
    or leaving it as explicit questions for a human.

---

## Part 11 — The top ten things to add next

Ranked by what each would add against the judging criteria.

| # | Enhancement | What it adds | Effort |
|---|---|---|---|
| 1 | **Deploy on Nebius Serverless** — dashboard as an Endpoint, weekly run as a Job | **Required for submission.** Directly answers "how effectively does it use Nebius" | 1 day |
| 2 | ~~Clean the register~~ | **Done 23 Oct** — 165 → 150 organisations | — |
| 3 | **Route to market** — every lead names a door and a job title to approach | Turns "here's a lead" into "here's what to do". From the Scott Logic tracker | ½ day |
| 4 | **Deadline countdown** — anything with a closing date, diarised and counted down weekly | A tender reported once and forgotten is a lost tender. Strong "persistent memory" evidence | ½ day |
| 5 | **Turn one regulation into many named companies** — a rule obliging "all UK water companies" becomes 11 named leads | The fastest route from one signal to a pipeline. Proven in the Scott Logic work | 1 day |
| 6 | ~~A third configuration~~ | **Done 23 Oct** — and built BY the system in a minute, which is a better story than building it by hand | — |
| 7 | **Let the user strike off an account** — with a reason code, excluded from all future runs | Gives the user control, and two of the reason codes are bug reports that improve the system | ½ day |
| 8 | **Learn from what you win** — mark a lead won or lost, feed it back into scoring | The obvious next step, honestly out of reach this week: needs real outcome data | Weeks |
| 9 | **Email the briefing on Monday morning** | Removes the last manual step. Trivially easy and demos beautifully | 2 hours |
| 10 | **Show the two configurations side by side on one screen** — same headline, both verdicts | Makes the best idea in the project visible without switching views | ½ day |

---

## Appendix — The jargon, decoded

| Word | What it means |
|---|---|
| **Agent** | One piece of the system doing one job. Twelve of them |
| **Profile / configuration** | The file describing one business — what it sells, who it sells to, which way events point |
| **Polarity** | Which way an event points for *your* business. Lead or dead lead |
| **Practice area** | One of the things your business sells |
| **Multi-service** | A signal that opens a conversation about two or more of them. Worth 25 points |
| **Signal** | One dated, published event involving one named organisation |
| **Grounding** | Checking the source actually supports the claim — and is *about* that company |
| **The register** | The prospect list the system builds for itself, growing every week |
| **Rejection log** | Everything thrown away, with the reason |
| **Counter-reading** | The argument against acting on a lead |
| **Credits** | What Tavily charges per search. 2 per search at good quality |
| **Token Factory** | Nebius's AI service. Where all the AI runs |
| **Nemotron** | NVIDIA's family of open AI models. We use Ultra and Super |
| **Dry run** | The whole pipeline on fake data. Free, instant, proves the plumbing |
| **Resume** | Re-running from the last saved search. Free, 2 minutes |
