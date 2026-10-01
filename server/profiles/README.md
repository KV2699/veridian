# Profiles

A profile is the **strategy** of a Signal Bureau deployment. The pipeline is
generic; the profile is not.

Changing target market means writing a new profile — not retraining anything,
and not filling in a form.

## Why this is a file and not a settings screen

The tempting version of this product asks a business to describe itself —
practice areas, products, sales method, client list — and derives the signal
logic automatically. That does not work, for one reason above all others:

**The same event means opposite things to different businesses.**

Take *"Company X appoints a Head of Sustainability"*:

| Business | Meaning | Action |
|---|---|---|
| A policy think tank | New decision-maker, ~90-day window | **Hot lead** |
| An executive search firm | Mandate filled, fee gone | **Dead lead** |
| An infrastructure vendor | New budget holder with a mandate | **Hot lead** |

Nothing in "we are an executive search firm" implies *"therefore invert
appointment signals and hunt departures without named successors, plus the
backfill vacancies created by internal promotions."* That has to be decided by
someone who knows the business, and it is the single highest-leverage decision
in the whole system. A model asked to infer it will produce a confident,
plausible, wrong answer — and an empty week looks exactly like a quiet market,
so nobody finds out for months.

So the polarity is stated explicitly, in `polarity`, in plain English, and it
travels with every prompt in the pipeline.

## The questions a new profile must answer

These are the ones that cannot be derived from a product description:

1. **Polarity.** When a company hires a Head of [your area], is that a reason
   to call them or a sign you have lost the opportunity? Ask the same of
   departures, funding rounds, and competitor wins.
2. **Winnable universe.** Not "who could buy this" — who can you actually win?
   The largest names in a market are often the worst prospects, because they
   have mature functions and incumbent suppliers. Name the segment you beat.
3. **Decay.** How long before a signal of each type is stale? Policy signals
   keep for 90 days. A vacancy is contested in weeks. A job posting closes.
   Set `windowDays` per collector, not once for the profile.
4. **Findable events.** Every entry in `signalTypes` must name something that
   gets *published on a date*. If a signal type requires proving a negative
   ("companies that lack X"), no search can ever satisfy it and the collector
   will return nothing or invent.
5. **Sources.** Which trade press actually carries these events? General web
   search systematically misses vertical publications, and source lists go
   stale as outlets rebrand.
6. **Value.** What makes one signal worth more than another here — deal size,
   urgency, seniority, renewal risk? That goes in `scoring.guidance`.
7. **Roster.** Which organisations do you already hold? They are never
   prospects, and they get their own sweep.

## Writing one

Copy `nvidia.js`, change the fields, add it to `index.js`, set `PROFILE=` in
`.env`. The shape:

| Field | What it is |
|---|---|
| `polarity` | How to read each event type for this business. The most important field |
| `roster` | Accounts you already hold — swept by Account Watch, never returned as prospects |
| `exclusions` | Never return these at all |
| `collectors[]` | `key`, `name`, `focus`, `signalTypes[]`, `queries[]`, `windowDays` |
| `accountWatch` | `focus`, `signalTypes[]`, `batchSize`, `windowDays` |
| `scoring` | `floor` (numeric cutoff, enforced in code) and `guidance[]` (judgement, enforced by prompt) |

## Then check the diagnostics

After the first run, read the yield diagnostics in the dashboard before
changing anything. They tell you *which* of the questions above you got wrong:

| Finding | What it means |
|---|---|
| A query returned 0 hits | Wording problem — question 5 |
| Hits, but nothing extracted | Signal definition problem — question 4 |
| Extracted, but all rejected at verification | Target universe problem — question 2 |
| Everything scored 8+ | Scoring guidance too loose — question 6 |

That loop — run, read the diagnosis, fix one thing, run again — is how a
profile gets good. It is not guesswork, and it should take two or three rounds.
