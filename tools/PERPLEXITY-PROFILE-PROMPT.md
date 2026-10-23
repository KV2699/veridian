# The Perplexity prompt — researching a business so the system can be configured for it

**What this is for.** Signal Bureau needs a *profile* before it can work for a
business: what that business sells, who it can realistically win, which
publications carry its market's news, and which way each kind of event points
for it. Most of that is public. This prompt gathers it in one pass.

**How it fits together:**

```
1.  Run the prompt below in Perplexity          → a research brief
2.  Save the answer as  brief.md
3.  Write the past wins into  wins.md           ← the bit only the business knows
4.  node tools/build-profile.mjs \
      --brief brief.md --wins wins.md \
      --site https://thecompany.com --key thekey
5.  Register it in server/profiles/index.js
6.  PROFILE=thekey npm run pipeline:free        → a real briefing, 0 search credits
```

Steps 4–6 cost **no search credits**. Step 1 costs nothing if you have a
Perplexity account.

**Why Perplexity for step 1.** It has the highest citation discipline of the
research tools tested in this methodology — it marks something "not verified"
rather than filling the gap with a plausible guess, which is exactly what you
need when the output becomes a configuration file.

---

## The prompt — paste everything inside the box

```
I need a research brief on a company so I can configure a business development
intelligence system for it. Accuracy matters more than completeness: if you
cannot verify something, write "NOT VERIFIED" rather than giving a plausible
answer. Cite a source URL for every factual claim.

THE COMPANY: [COMPANY NAME]
THEIR WEBSITE: [URL]
TODAY'S DATE: [TODAY'S DATE]

Answer these eight sections, using these exact headings, in this order.

═══ 1. WHAT THEY SELL ═══
List their distinct service lines, practice areas or product lines, as a BUYER
would recognise them. For each one give a single sentence describing what it is.

Important: I need things that are bought SEPARATELY, by DIFFERENT people, from
DIFFERENT budgets. If two of their services are always bought together as one
engagement, say so and count them as one. Four to six is typical. If you find
more than eight you have split them too finely — say which ones you would merge.

═══ 2. WHO THEY SELL TO — AND WHO THEY CAN ACTUALLY WIN ═══
Two different questions. Answer both.

a) Who do they say they serve? (sectors, company sizes, geographies)
b) Who can they realistically WIN? The largest organisations in any market are
   usually the worst prospects — they have mature in-house teams and incumbent
   suppliers on framework agreements. Name the segment where this company
   actually beats the competition, and name the kind of prospect that is a
   waste of their time, with a reason.

═══ 3. NAMED CLIENTS ═══
Organisations publicly named as their clients — case studies, press releases,
their own website, award entries. Name and source URL for each. These are
relationships, not prospects, so accuracy matters more than volume.
If you find none, say so. Do not guess from sector overlap.

═══ 4. COMPETITORS ═══
Who they actually compete against for work, with a source. Distinguish:
 - direct competitors (the same service to the same buyer)
 - substitutes (a different way the buyer could solve the same problem,
   including doing it in-house)
These will be excluded from their prospect list entirely, so a wrong name here
removes a real opportunity.

═══ 5. THE TRADE PRESS — I NEED DOMAINS, NOT TITLES ═══
This is the most operationally useful section, so take it seriously.

Which publications actually report the EVENTS that matter in this market —
appointments, contracts, funding, restructures, regulatory deadlines? General
web search systematically misses vertical trade press, which is why I need it
named explicitly.

For each one give:
 - the DOMAIN, e.g. esgdive.com — not just the publication's title
 - the RSS feed URL if you can find one, e.g. https://esgdive.com/feeds/news/
 - one line on what it carries

Include niche trade outlets, not just the big names. Ten to fifteen is ideal.
Flag any publication that has been renamed, merged or shut down, with the date
— a dead source is worse than no source, because it fails silently.

═══ 6. THE REGULATORS AND PUBLIC BODIES THAT CREATE WORK ═══
Which regulators, government departments or standards bodies publish decisions,
rules or deadlines that OBLIGE this company's customers to do something?

For each: the body, its domain, and what kind of obligation it creates.

I am not looking for who regulates this company. I am looking for who regulates
its CUSTOMERS — because a published deadline that someone else must meet is the
strongest buying trigger there is. The lead is never the regulator; it is
whoever the decision obliges.

═══ 7. THE EVENTS THAT PRECEDE A PURCHASE ═══
What publicly announced events typically happen shortly BEFORE an organisation
buys this kind of service? Think about what has to be true for someone to need
them — a merger, a funding round, a new executive, a regulatory deadline, a
failure, an expansion, a resignation.

For each: the event, roughly how long the window stays open, and whether it is
usually published at all. That last part matters: if the event is commercially
confidential it will never appear in a search, however well worded.

═══ 8. HOW BIG, AND WHO SIGNS ═══
 - Company size: headcount, revenue, offices, founded
 - Who signs for their services at a client — job titles, not names
 - Typical engagement size, if stated anywhere publicly

═══ FORMAT ═══
Use the eight headings above, in order. Under each, use short bullets.
Put the source URL on the same line as each claim.
Write "NOT VERIFIED" wherever you could not confirm something.
Do not write an introduction, a summary, or a conclusion.
```

---

## What this prompt deliberately does NOT ask for

**It does not ask which way an event points for this business.** That is called
*polarity*, and it is the single highest-leverage field in the whole system —
whether an appointment means "call them" or "we have lost this one".

No amount of research answers it, because it is not a fact about the market. It
is a fact about the business model. A company appointing a Head of
Sustainability is a new budget holder with a mandate to a software vendor, and a
filled mandate with the fee gone to the recruiter who wanted to place that role.
Both read the same sentence.

Ask a research tool and it will give you a confident, plausible, wrong answer —
and the cost of being wrong is invisible, because a week with no leads looks
exactly like a quiet week in the market.

**There is exactly one reliable source, and it is the business's own won deals.**

Write five to ten of them into `wins.md`, in plain English, one per paragraph.
For each, the only question that matters is:

> **What published event started this deal?**

```
1. We won a data migration programme at a UK bank. It started when the bank
   announced it had completed an acquisition and would integrate both estates
   under a legally fixed timetable.

2. We won a regulatory reporting engagement at an asset manager. It started
   when the regulator published final rules with a fixed in-force date.

3. We LOST an opportunity at a government department — they announced they
   build in-house by design, and the work never came to market.
```

Include the losses. A loss tells you what a DEAD lead looks like, and that is
half of polarity. In the test above, the in-house loss produced the line *"an
organisation stating it builds in-house is a DEAD LEAD — the work will never
come to market, however well it fits"*, which no amount of market research
would ever have produced.

The builder derives the polarity from those wins and writes each line with the
deal it came from, so you can check it. Supply no wins and it refuses to guess:
it writes the polarity block as unanswered questions, says the profile will not
score correctly until they are answered, and leaves them for a human.
