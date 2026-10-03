# Signal Bureau — the plain English guide

## What this is, in one paragraph

Every week this goes out and reads the internet looking for organisations that
have just done something which means they might buy what you sell. It checks
what it found is real, scores it, remembers it, and writes you a briefing. Then
you can ask it questions about any of it in plain English — by typing, or out
loud.

It is **not** a CRM. It does not hold your contacts, your emails or your deals.
It finds people worth putting *into* a CRM.

---

## The two ways you use it

### 1. Monday morning — the briefing

It runs itself every Monday at 7am. By the time you open your laptop there is a
briefing waiting: the week's headline, anything with a closing date, what's
happening at accounts you already hold, and three things to actually do.

You read it. That's the whole interaction.

### 2. Any time — ask it things

Open the dashboard and ask:

> *top 5 multi-service prospects*
> *what is closing in the next 14 days?*
> *which accounts have gone quiet?*
> *critical prospects in compute*
> *what was flagged for review?*

Click the **🎤** and you can say it instead of typing, and it answers out loud.
(Chrome and Edge only — typing works everywhere.)

---

## Getting it running

```bash
npm start
```

Then open **http://localhost:8080**. That's it — it serves the dashboard and
starts the Monday scheduler.

| Command | What it does |
|---|---|
| `npm start` | Dashboard + weekly scheduler |
| `npm run pipeline` | Go and look for new signals now (~19 min) |
| `npm run pipeline:resume` | Re-do the thinking on the last search (~2 min, free) |
| `npm run pipeline:dry` | Pretend run, no internet, no cost |
| `npm run backfill` | One big wide sweep — use when starting fresh |
| `npm test` | Check nothing is broken (no internet needed) |
| `node tools/cost.mjs` | What you've spent |
| `node tools/ask.mjs "your question"` | Ask it from the terminal |

**The one worth knowing:** `pipeline:resume` costs nothing and takes two minutes.
If you want to change how it writes the briefing, use that — a full run spends
search credits you don't need to spend.

---

## What the numbers mean

Every organisation gets a score out of 100, built from four things:

| | Worth | What it asks |
|---|---|---|
| **Practice area fit** | 30 | How many of your offerings does this open? |
| **Deal scale** | 25 | How big is it — gigawatts, GPU counts, contract value? |
| **Urgency** | 25 | How recently did it happen? |
| **Organisation size** | 20 | How big are they? |

Which gives a band:

- **Critical (75–100)** — contact this week
- **High (50–74)** — contact this month
- **Medium (25–49)** — keep an eye on
- **Low (0–24)** — watchlist

**Important:** the score is worked out by arithmetic, not by an AI deciding how
it feels. Same inputs always give the same number, and you can see the breakdown
for any organisation. That's deliberate — an AI asked to score things invents
its own weighting and sounds confident about it.

---

## What to trust, and what to check

**Trust the source link.** Every claim has one, and the system checks the
article is genuinely *about* that company before it accepts it. If an article
only mentions a company in passing, it gets thrown out.

**Check anything marked "(unconfirmed)".** That means the system had a doubt —
usually a figure it couldn't find in the source, or a weak source like a social
media post. It keeps them, but labels them.

**Don't trust the top band blindly.** Spot-check the top five before acting on
them or showing them to anyone. The system is good, not infallible.

**If it says it can't answer, believe it.** Ask *"which of these will sign
first?"* and it will tell you that isn't in the data. That's correct — it knows
what happened, not what will happen.

---

## A sensible weekly routine

**Monday** — read the briefing. Look at "Closing Soon" first; those expire
whether or not you act.

**During the week** — ask it things as they come up. *"Anything new at
CoreWeave?"* before a call. *"What's closing this month?"* when planning.

**Monthly** — glance at the diagnostics panel. If it says a query is returning
nothing, that's the system telling you to fix something, not that the market
went quiet.

---

## When something looks wrong

**"No signals this week"** — look at the yield diagnostics on the dashboard.
It will tell you whether the searches found nothing, or found things that
didn't qualify. Those need completely different fixes.

**A lead looks wrong** — click the source link. If the article isn't about that
company, that's a grounding failure and worth telling me about; it should have
been caught.

**It refuses to run** — if it says a run is already in progress, one is. Don't
delete the lock file; find the other run. Two at once loses data.

**Everything is "Critical"** — the scoring has drifted. The diagnostics panel
flags this automatically.

---

## What it costs

**Searching:** a free Tavily allowance of 1,000 credits a month. A weekly run
uses about 100. You will not run out in normal use.

**Thinking:** Nebius charges for the AI. Run `node tools/cost.mjs` to see the
token counts, and check studio.nebius.com for the actual bill.

**The expensive mistake** is re-running the whole thing to test a small change.
Use `pipeline:resume` — it reuses the last search and costs nothing.

---

## What it deliberately doesn't do

- **It won't guess.** No source, no signal.
- **It won't predict.** It records what happened, not what will.
- **It won't hold your relationships.** No contacts, no emails, no deal stages.
  That's a CRM's job.
- **It won't tell you a quiet week was a good one.** If it found nothing it says
  so, and tells you why.
