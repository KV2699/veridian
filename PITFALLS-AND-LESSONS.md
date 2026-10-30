# Auspius — pitfalls, blockers and lessons learned

Written in the house style of `GA-BD-Pitfalls-Blockers.md`: every entry is
something that actually went wrong, what it cost, how it was found, and the rule
that stops it recurring.

**Updated after every batch of changes**, alongside
[HACKATHON-FOR-DUMMIES.md](HACKATHON-FOR-DUMMIES.md).
**Last updated:** 23 October 2026.

**The one rule above all the others:**

> **Nothing important in this system was found by reading code.**
>
> The first live run returned 182 search results and zero signals. Verification
> silently discarded 46 of 79 verdicts while reporting success. The register
> went backwards by 45 organisations with no error anywhere. NVIDIA appeared in
> its own prospect list. Every one of those surfaced only by running it and
> looking at the output.

---

## Part A — Pitfalls that recur across every version of this methodology

These predate the software. They came out of the Green Alliance, Acre, Futerra
and Scott Logic trackers, and **several of them reappeared in new code** during
this build — which is the strongest argument for keeping this file.

### A1. Hunting states instead of events

**The mistake.** Asking for something that would have to be *absent* to be true:
*"does this organisation lack a Head of Sustainability?"*

**Why it fails.** No document says a company lacks something. Search engines
find things that were published. Faced with an unanswerable question a model
either returns nothing or invents — and we got both: one prompt returned "0
results across all eight sectors", another returned a category essay with no
companies in it.

**The rule.** Every signal type must name something that gets **published on a
date**. Replace "does this org lack a lead?" with "does the source state the
role is vacant, being recruited, or newly created?"

**Where it is enforced now.** `signalTypes` in every profile, and
`test/profiles.test.mjs` fails the build if a query contains "lacks", "without
a", "no existing", "does not have" or "missing".

### A2. Polarity — hunting the event that means you have *lost*

**The mistake.** Searching for appointments on behalf of a recruiter.

**What it cost.** A test search returned Nike, OceanaGold, Deloitte EMEA,
Kimberly-Clark, Boeing and Sun Life — six appointments, all filled jobs, no fee
available on any of them. Worse: the dominant pattern in first-time Chief
Sustainability Officer appointments is **internal promotion**, so no external
search was ever commissioned.

**The inversion that was worth the most.** A departure with no named successor
is an open vacancy. And every internal promotion creates a second vacancy one
level down that nobody is searching for and which is trivially derivable from
the same article.

**The rule.** State in plain English, per business, which way each event type
points. It cannot be inferred from a description of the business.

**Where it is enforced now.** `polarity` in each profile; it travels into every
prompt, and `test/polarity-propagation.test.mjs` asserts it arrives at every
agent.

### A3. The wrong target universe

**The mistake.** A list of ~100 FTSE and global mega-caps.

**Why it fails.** They have mature functions, in-house teams and existing
agreements with the biggest competitors. They are the *worst* prospects, not the
best. The winnable market is mid-sized organisations building the capability for
the first time.

**The rule.** "Who can you actually win" is a different question from "who could
buy this", and only the first one belongs in a profile.

### A4. Scoring inflation

**The mistake.** Letting a model produce the priority number.

**What it cost, twice.** In the predecessor system, one run scored four
prospects 75–77 "Critical" on a self-invented algorithm; recomputed properly
they came to 70 — a whole band out. Separately, DeepSeek-run topic scans output
nearly everything as 90/Critical and had to be manually re-scored.

**The rule.** The model supplies inputs. **Code does the arithmetic.** And if
most of a batch is scoring 8+, the model is ranking the batch against itself
rather than against reality.

**Where it is enforced now.** `server/lib/score.js`, covered by
`test/score.test.mjs`, and an explicit anti-inflation instruction in the
verifier's prompt.

### A5. Practice areas split too finely

**The mistake.** Splitting one revenue line into three practice areas.

**What it cost.** Almost every signal ticked all three, earned the multi-service
bonus, and landed in the top band. **Two thirds of one live week came out
"Critical"**, which makes the ranking worthless.

**The rule.** A practice area is a separate budget signed by a different person.
If two of your areas are always bought together, they are one area.

### A6. Stale source lists

**The mistake.** A prompt citing a publication that had been renamed, while
missing the trade press that actually carries the events.

**The rule.** Fetch every source before committing it. **When the executive
search profile was built on 23 October, 14 candidate feeds were tested: 11
returned content, 3 were dead (one 404, two 403).** Those three would have been
silent failures.

### A7. Contact misattribution

**The mistake.** Naming someone quoted *about* a company as the contact *at*
that company.

**The rule.** A strict contact hierarchy, and `"Unverified — [role] not
identified"` is always an acceptable answer. Never invent a name to fill a
required field.

### A8. Over-constrained AND-chains

**The mistake.** Stacking a three-criterion filter, a mandatory URL, an
unanswerable gap check, role exclusions and a scale threshold — each reasonable
alone.

**What it cost.** Zero results across all eight sectors.

**The rule.** Add one constraint at a time and measure the yield after each.

### A9. One window for every signal type

**The mistake.** A 90-day window for everything, because policy signals keep for
90 days.

**What it cost.** A vacancy is contested by rival firms within days and a job
advert closes. The pipeline was full of opportunities that were already gone.

**The rule.** `windowDays` is set **per collector**. The executive search profile
uses 21 / 30 / 90 for exactly this reason.

### A10. Sector-wide news mistaken for a company-level trigger

**The mistake.** Scoring "the GPU market is tight" or "all UK banks must comply"
as if it were a lead.

**The rule.** A trend is not a trigger. It is a conversation opener, and it
belongs in its own section — or it gets converted into named companies (see
C4).

---

## Part B — Pitfalls specific to building this as software

### B1. A "reasoning" model given a simple job never answers

**What happened.** The first live run returned **182 search results and zero
signals.**

**The cause.** `Nemotron-3_5-Lightning` was doing the extraction. It is tuned to
reason, so on a simple extraction job it reasoned until its token budget was
exhausted and produced nothing. Measured against the alternatives:

| Model | Time | Tokens | Result |
|---|---|---|---|
| Nano-30B | 2.5s | 458 | fine |
| **Super-120B** | 2.6s | 406 | **chosen** |
| Ultra | 1.0s | 238 | fine but expensive for this |
| Lightning | 25.9s | budget exhausted | **never answered** |

**The rule.** Match the model to the shape of the job. A reasoning model is the
wrong tool for repetitive extraction, and it fails by producing *nothing* rather
than by producing something wrong — which looks like an empty market.

### B2. Throttling that looks like a model fault

**What happened.** Under load, Nebius returns **HTTP 200 with an empty body** —
not a 429, not an error. It looks exactly like the model declining to answer.

**The rule.** `NEBIUS_CONCURRENCY=2`. Slower, but the run completes. Worth
submitting as feedback: a 429 would have saved hours.

### B3. A truncated answer that parses

**What happened.** When a reply is cut off at the token limit it often still
contains a smaller well-formed fragment. A lenient parser accepts it as the
whole answer. **46 of 79 verification verdicts were silently lost while the run
reported success.**

**The rule.** `finish_reason=length` is refused outright. Verification chunks at
20 signals and halves on truncation rather than accepting a partial result.

### B4. Two runs destroying each other's data

**What happened.** Two overlapping runs took the register from **123
organisations down to 78** — 45 lost, with no error anywhere. Each merged its
signals into the copy it had read, and the last write won.

**The rule.** A cross-process lock, checking whether the holding process is
still alive. `LOCKED` is the system working, not failing — find the other run
rather than deleting the lock file.

### B5. A search window that leaks

**What happened.** An 84-day backfill returned signals dated a **full year**
earlier. A separate 90-day request returned items from seven months before.

**The rule.** **30 days is a ceiling, not a preference.** Past it, Tavily's date
filter stops widening coverage and starts contaminating it. The window is
re-checked in code after results come back, and an out-of-window signal is
flagged rather than scored as current.

### B6. "Is it mentioned" versus "is it about"

**What happened.** A long article mentions many companies; only one is its
subject. Claims about SK Telecom and Meta survived the first grounding check by
appearing deep inside articles about something else. A claim about a national
laboratory was sourced to a post about a physicist.

**The rule.** Grounding asks whether the article is **about** the organisation.
Absent entirely → dropped. Mentioned only outside the headline and opening →
flagged, never top-banded.

### B7. The organisation that is not an organisation

**What happened.** `United Kingdom` scored 90, sourced to an ETF investment
guide. `South Korea` and `South Korea Government` registered as two separate
prospects. `Amazon` and `Amazon Web Services` both sat in the top eight.

**Status: NOT YET FIXED.** It is the first thing a judge sees on the dashboard.

**The rule when it is fixed.** A country is not a prospect. Sovereign states and
government departments need an explicit blocklist, and the alias map must merge
existing register entries, not just new ones.

### B8. Fixtures leaking into real data

**What happened.** Dry-run fixtures accumulated in the live store — seven of
them, one carrying a deadline, which made it the system's answer to *"what is
closing in the next 14 days?"*

**The rule.** A dry run writes to its own directory. A demo artefact presented as
a real tender is the worst kind of wrong, because it is confidently specific.

---

## Part C — Lessons from the 23 October build

### C1. A profile system that was not actually a profile system

**What happened.** The engine was documented as market-agnostic and was not.
**Six places hardcoded the AI infrastructure market outside the profile** — the
system prompts for extraction, verification and briefing-writing, the query
suffixes for two sweeps, and the procurement codes.

**Why it is dangerous.** None of it would have thrown an error. A second profile
would have loaded cleanly, run to completion, produced a briefing — and been
processed throughout by a model told it was reading GPU news.

**The rule.** If a value describes the *business*, it lives in the profile. The
way to find these is to write the second profile, not to read the first one.

### C2. The bug that only a second configuration could expose

**What happened.** The Feed Collector never received the profile's polarity, and
declared a `relevance_score` field without defining what the number meant. The
model returned 0 for everything.

**Checked against the live log, not assumed:** all four feed signals in the last
run carry a collector score of **0 or 1** and a verified score of **7–8**. They
survived only because Nemotron Ultra independently rescored them. The collector's
own score was meaningless on that path, and anything Ultra did not rescue was
lost at the floor — consistent with eight feeds yielding four signals out of 110.

**What the fix produced.** The clearest demonstration in the project. Same feed,
same day: a Disney departure scored **9** by the search-firm configuration, and
an Ingka Group appointment **discarded** — with the infrastructure configuration
reading both the opposite way. The nvidia path improved too: **13 signals from
178 items, scored 2 to 9**, where it previously scored everything 0 or 1.

**The rule, and it is the most important one in this file:**

> **A field that is declared but never defined will be filled with a default
> that is silently wrong.** `relevance_score: 0` in an output schema, with no
> rubric, is an instruction to return zero.

**Now enforced.** `test/polarity-propagation.test.mjs` captures the prompt each
agent actually sends and asserts the polarity text is inside it. Verified to
fail when the bug is reintroduced.

### C3. A test that could destroy the thing it was testing

**What happened.** `test/register.test.mjs` read the live register, wrote `{}`
over it, ran its checks, and restored the backup at the end.

**Why it is dangerous.** It worked every time — until an interrupted run between
the blank and the restore, which would have destroyed the real 165-organisation
prospect list with no copy anywhere.

**The rule.** Tests get their own data. They never touch production state, even
with a restore planned.

### C4. Good ideas found in an old spreadsheet

The Scott Logic tracker — the most developed version of this methodology —
contained two ideas the software did not have, both now built:

**The rejection log.** Described there as *"the proof the method holds"*. Every
dropped signal is kept with a reason code. Two reasons it matters: without it a
rejected organisation returns next week and is re-judged from scratch at full
cost, and — more importantly — **some rejections are defect reports rather than
suppressions.** "The event is real but the practice match was wrong" is a bug in
the rules, and it is invisible if the row is simply deleted.

**The counter-reading.** The argument against acting on a lead, stated in the
briefing rather than hidden. In that tracker it changed who the buyer was on
three rows out of ten: a prosecution against one water company made *the rest of
the sector* the buyers; a tax-deadline story made the *software vendors* the
buyers, not the tax authority.

**Still not built, and worth it (see Part 11 of the Dummies guide):** converting
one regulation into many named affected companies, route-to-market on every
lead, and the strike-off list with reason codes.

### C5. Measured improvements that sat unapplied

**What happened.** The query lab had tested 32 queries and found five
replacements worth +30 to +60 percentage points of usable yield each. **None had
been applied.** They sat in a markdown file marked "awaiting approval".

**Fixed 23 October** — all five applied, two new queries added (100% and 88%
usable), and one deleted.

**The deletion is the lesson.** The HBM supply query resisted four rewrites —
40%, then 60%, 30%, 50%, 50%. The reason was not wording: **supply agreements of
that kind are commercially confidential, so the event is rarely published at
all.** That is pitfall A1 in a new costume.

**The rule.** Before rewriting a query a third time, ask whether the event gets
published. If it does not, delete the query rather than tune it.

### C6. A date format that silently cost a quarter of the score

**What happened.** Tavily returns dates as `"Fri, 02 Oct 2026 18:24:26 GMT"`.
The fallback parser matched `YYYY-MM-DD` only, so it returned null.

**Why it stayed invisible.** The model usually supplies its own date. The damage
happened precisely when it did not — exactly when the fallback was the only thing
left. The signal became undated, scored **zero of 25 urgency points**, dropped a
band, and was auto-flagged for review. 8 of 117 signals.

**Fixed 23 October**, and verified against all four date shapes in use.

**The rule.** A fallback that is rarely exercised is a fallback that is rarely
tested. Test the path that only runs when something else has already failed.

### C7. The model did not know what day it was — and penalised this week's news for it

**How it was found.** The first free-sources-only run of the executive search
configuration produced **zero verified signals** from two extracted ones. The
rejection log — which exists precisely so this question has an answer — gave the
reason verbatim:

> *"Future date (2026-10-20) is implausible"*

The signal was three days old. The model was treating **this week's news as
being in the future**, because nothing in the prompt told it what today was, so
it fell back on its training cutoff.

**What it cost.** The exact inversion of what you want: the fresher a signal, the
more "implausible" it looked. Urgency is 25 of the 100 scoring points and
recency is the whole premise of the product, so this penalised the most
valuable signals hardest. Five of the agents that build prompts never stated the
date.

**The galling part.** `Today's date: [TODAY'S DATE]` appears in **every single
prompt** of the operator's own Acre prompt pack. It is a documented, deliberate
practice from the methodology this system was built from — and it did not
survive into the code.

**Fixed 23 October.** Today's date is now stated in the verifier, both topic and
feed collectors, account watch and the roster sweep, with an explicit
instruction that a date on or before today is in the past and must not be
treated as implausible.

**The result, same sources, same day:** 0 verified → **1 verified**, banded High,
a real briefing written, and the organisation register populated — on a run that
cost **zero search credits**.

**The rule.** State the date in every prompt that reasons about recency. A model
has no clock, and the failure mode is silent and backwards.

**The wider rule, which is the more expensive one:** when porting a methodology
into code, port the **small mechanical instructions** too. The big ideas —
polarity, scoring, grounding — were all carried across carefully. A one-line
convention that appeared in every prompt of the original was dropped, and it
quietly degraded every run.

### C8. Free sources as a first-class mode, not a degraded one

**The problem.** A search allowance is a hard floor. At 26 credits with a full
run costing 112, the system could not run at all — and an empty dashboard is a
Design failure in front of a judge.

**The fix.** `FREE_ONLY=true` (`npm run pipeline:free`) runs the two collection
paths that cost nothing: RSS feeds and government procurement portals.
Verification, scoring, the briefing, the register and the rejection log all run
exactly as normal.

**Why this is not a lesser pipeline.** Those two paths are the only ones where a
model never supplies a fact — the publisher writes the headline, the buyer
writes the notice. They cannot misattribute a claim. What they cannot do is find
an organisation nobody has written about yet.

**What it produced on its first proper run:** a 259-word briefing for the
executive search configuration, naming a real vacancy at a real company with a
live source link, a counter-reading arguing against it, and three recommended
actions that each address that counter-reading. Zero credits.

**The rule.** Build the free path properly and the paid path becomes an
accelerator rather than a dependency.

### C9. The register was full of things that cannot buy anything

**What it looked like.** The top five entries, by score: `United Kingdom` (90,
Critical, sourced to an ETF investment guide), `South Korea Government`,
`South Korea` as a separate entry, a government ministry, and `UK government`.
`Amazon` and `Amazon Web Services` both sat in the top ten as separate
prospects. A person was in there, sourced to a LinkedIn post.

**Why it mattered more than it looked.** The register is the first screen anyone
sees. Every claim this system makes — grounding, arithmetic scoring, the
rejection log — is undercut by one row reading `United Kingdom — 90 — Critical`.

**Four distinct defects, not one:**

1. **No guard on what can be a prospect.** A country cannot sign a contract.
   Neither can a bloc, nor "government" as an abstraction.
2. **The joint-announcement check missed comma lists.** The pattern caught
   "A and B and C" but not "Apollo, BlackRock, Microsoft and KKR", which
   registered as one 40-character organisation.
3. **Aliases were never merged in the register**, only applied to new signals.
4. **The band was stored next to the score instead of derived from it**, so the
   two could disagree — and did, on four entries sitting at 80 labelled "High"
   when 80 is Critical.

**The near-miss worth recording.** The first version of the guard dropped
**Dell Technologies** — a roster account — because a general "two capitalised
words with no corporate vocabulary" heuristic read it as a person's name. It
also dropped the **US Department of Energy**, which buys exascale
supercomputers, because the rule treated any "Department of X" as a bare
government body.

**The rule that came out of it.** When writing a filter, the two error
directions are never equally costly. A stray person in the register is visible
and traceable; a silently dropped roster account is neither. So the person check
now requires corroboration from the source — a LinkedIn profile URL — and named
public bodies are explicitly KEPT, because in this market a named ministry
running a sovereign AI programme is one of the best prospects there is.

**A better fix than dropping.** "KKR's AI infrastructure company" is not an
organisation, but KKR is — and it is a real lead. So a possessive description
now registers under its **owner** rather than being discarded. The same
mechanism leaves "Lloyd's Register" and "Moody's" alone, because what follows
the possessive there is part of the name, not a description.

### C10. Automating onboarding without automating the judgement

**The question.** Can the system configure itself for a new business?

**The answer, and why it is interesting.** Almost all of it, yes: what a
business sells, who it can win, who its competitors are, and which trade press
carries its market's news are all public, and the builder gathers them from the
company's own website in about a minute for no search credits.

**Polarity is the exception, and it is the whole product.** Asked which way an
event points for a business it has only read a website about, a model produces a
confident, plausible, wrong answer — and the resulting empty pipeline looks
exactly like a quiet market.

**But "cannot be researched" is not the same as "cannot be derived".** There is
one reliable source and it is the business's own won deals: *what published
event started this deal?* Answer it five times and the polarity falls out. The
builder derives each line from a specific win and writes that win beside it, so
a human can check the reasoning rather than the conclusion.

**The best line it produced came from a LOSS**, not a win: *"an organisation
stating it builds in-house is a DEAD LEAD — the work will never come to market,
however well it fits."* No market research would have produced that. **Always
ask for the losses.**

**And the failure on the first attempt is the recurring lesson again.** The
first run returned a polarity block reading `'call them'` five times. The field
was specified without being shown — the schema said what to return but never
what a polarity line looks like. The same defect as the feed collector's
undefined `relevance_score` (C2), in a new place, two days later.

Fixed by putting four fully written examples in the prompt. **The rule: show the
shape, do not just name the field.**

### C11. Free sources are not a lesser pipeline — they are a different risk profile

The third business type was onboarded and run entirely on free sources, and the
briefing it produced named a real tender with a real closing date and a
counter-reading sharp enough to be useful (*"the tender value is only £12.5k,
which may be below their minimum engagement threshold"*).

**The thing to understand about the free paths**: RSS and procurement portals
cannot invent a fact, because the publisher writes the headline and the buyer
writes the notice. What they cannot do is find an organisation nobody has
written about. That is a different limitation from "worse", and it is worth
saying plainly rather than presenting a free run as equivalent to a full one.

### C12. When a model may be trusted for facts, and when it may not

The system has a hard rule: **a model never supplies a fact.** Every signal must
come from a fetched source, and a URL the search did not return is discarded in
code.

Making the builder self-sufficient meant breaking that rule on purpose, and the
distinction is worth stating precisely, because it is the difference between a
safe use of model knowledge and the thing that produces confident fiction.

| | Collectors | Profile research |
|---|---|---|
| What the model supplies | an event that happened | a candidate domain |
| Can it be checked afterwards? | **No.** A fabricated signal looks exactly like a real one | **Yes.** Fetch it. A made-up domain does not resolve |
| So the rule is | the model may never supply a fact | the model proposes, the network disposes |

On the law-firm test it proposed 24 publications; 6 survived the fetch and 9 were
discarded, along with every regulator domain that did not answer.

**The rule.** Model knowledge is safe exactly where a cheap, automatic check can
falsify it, and dangerous everywhere else. Before letting a model supply
something, ask what would catch it if it were wrong. If the answer is "nothing",
do not ask the model.

### C13. A model writing search queries writes them for the wrong search engine

The first generated profile came back with queries like:

```
"investigation" "FCA" OR "CMA" site:fca.org.uk OR site:gov.uk/cma
```

Syntactically impressive, and useless: the search layer takes natural language
and is given its domain restrictions separately, so an operator-heavy query
returns nothing — which looks exactly like a quiet market.

Fixed by stating the constraint in the prompt with an example of each form. The
rebuilt queries read `FCA opens investigation into fintech announced`.

**The rule, which is rule 17 again in a new costume.** A model will produce the
most generically plausible version of whatever you ask for. If your tool is not
the generic one, say so and show an example.

### C14. Untrusted input that the pipeline executes

A configuration built from the interface arrives in an HTTP request body and is
then used to drive twelve agents, name directories and build prompts. It is
untrusted input with unusually wide reach.

So the boundary is explicit rather than assumed: the key is reduced to
`[a-z0-9-]` and refused if it collides with a shipped profile or a data
directory, every string is length-capped, practice-area keys are normalised to
safe identifiers, and lists are capped — eight practice areas, sixty roster
names, eight queries. Generated profiles are written as **JSON**, never as
executable JavaScript, into `data/profiles/` rather than the source tree.

**The rule.** The moment a configuration can arrive over the network, it stops
being configuration and starts being input. Cap it, normalise it, and never let
it become code.

### C15. Splicing code by string-matching function boundaries

Three separate times in one session, a scripted edit that replaced everything
between `function A` and `function B` produced a file that would not parse:

- `loadRejections` declared twice, because the replacement text ended with the
  declaration that marked the end of the span
- `drawBars` declared twice, for the same reason
- `drawProfiles` deleted entirely, because it had been sitting between the two
  functions being spliced and nothing checked what was in the gap

Each one broke the whole dashboard — one unbalanced brace means the browser
parses nothing, so every panel reads "Loading…" forever. And the browser's
error, *"Unexpected end of input"*, points at the last line of the file rather
than the fault.

**The rule.** After any scripted edit to a code file, parse it. `node --check`
on the extracted script took seconds and would have caught all three
immediately. Finding the third one by hand took twenty times longer than the
check would have.

**The second rule.** When replacing a span between two anchors, print what is
being removed before removing it. The `drawProfiles` deletion was invisible —
the file parsed, the page loaded, and the only symptom was a selector that
never populated.

### C16. Hierarchy from weight, not from fading the text

The brief was "no grey text — use font weight and size". It is worth recording
why that is the better instruction, because the lazy version of de-emphasis is
always to reduce contrast.

Grey text fails twice. It fails accessibility, because a mid-grey on a light
ground often lands under 4.5:1 and the people it fails are the ones who most
need the secondary information. And it fails aesthetically, because faded type
reads as *unfinished* rather than *secondary* — the eye registers it as a
rendering problem.

The alternative costs nothing: one ink, and hierarchy carried by **size**
(15px against 12.5px), **weight** (700 against 400) and **letterform** (a
tracked-out mono label against a sans sentence). A label set in mono at 10px,
uppercase and tracked, is unmistakably subordinate at full contrast.

**The rule.** De-emphasise with weight, size and letterform. Reach for lower
contrast only when all three are already spent.

### C17. The yield problem was three separate things, and none of them was the window

Three configurations were producing one organisation each. The assumed cause was
the scan window not covering 30 days. **It was already 30 days everywhere** —
`feeds.days: 30` on every profile and `windowDays: 30` on every collector. An
hour would have been lost confirming that.

The actual causes, in order of how much yield each was costing:

**1. Too few free sources.** With no search budget, the RSS feed list and the
procurement portals ARE the system. `exec-search` had 11 feeds covering the ESG
press and none covering the HR press — half of its market's events are reported
in the half it was not reading. `consultancy` had 6.

**2. A term filter weighted only to movement verbs.** `exec-search` matched on
*steps down, promoted, recruit* and almost nothing else, so it passed **11 items
of 145** before a model ever saw them. The opposite error is just as bad:
`nvidia` matched on topic nouns and passed 144 of 178, paying for extraction on
everything. The right filter pairs the sector's nouns with the events that
create demand, and lets the model — the thing actually qualified to judge —
decide.

**3. Procurement codes that matched almost nothing.** The CPV prefixes were all
compute and data-centre codes, inherited from the first profile. A think tank
needs research and evaluation codes; a serviced-apartment operator needs
accommodation and travel codes. With the right ones, one profile went from
**1 tender to 24, 18 of them with published deadlines.**

**The result of fixing all three**, on the same free path and still zero search
credits: 1 organisation → **9**, with a 803-word briefing naming real UK
government tenders at £85k and £120k with real closing dates.

**The rule.** When yield is low, measure the funnel before theorising about it.
`searched → hits → fresh → extracted → verified` is printed on every run and it
names the stage that is losing the signal. All three of these were visible in
that line and none of them was the window.

**The second rule.** A filter that runs BEFORE the model is the most dangerous
thing in a pipeline, because what it drops is never seen again and leaves no
trace. Tune it loose and let the model refuse; do not tune it tight and let the
run look like a quiet market.

### C18. The trade press for your own industry reports your competitors

The serviced-apartment profile's first run extracted 18 signals and verified
**none**. The rejection log named every one: Rosewood, Accor, Hyatt, IHG,
Aimbridge — scored 1 to 3 and dropped.

The feed list had been built from the hospitality trade press, which was the
obvious choice and the wrong one. **Hotel Dive, Hotel News Resource and
Boutique Hotel News report on hotel operators** — which is to say, on this
business's competitors. They are the right sources for knowing what rivals are
doing and the wrong ones for finding customers.

The customers of a serviced-apartment operator are companies that need
accommodation and landlords who own buildings. So the feed list was rebuilt
around European startup and business press (Sifted, Tech.eu, EU-Startups,
Silicon Canals, City AM) plus property press, with a single hospitality source
kept for buildings changing hands. Yield went 0 → 2.

A second defect surfaced in the same run. The profile's polarity said *"an
organisation with no presence in a city we serve is not a prospect"* — and the
profile never listed the cities. The verifier was told geography mattered, given
no way to test it, and marked everything down. Eighteen cities are now named in
the file and in the scoring guidance.

**The rule.** Ask who the sources are written FOR. A trade publication serves an
industry, and if that industry is yours, it is reporting your rivals. The
sources that find customers are the ones your customers read.

**The second rule.** If a profile's scoring guidance refers to a list —
cities, products, regions — the list has to be IN the profile. A criterion the
verifier cannot evaluate does not become neutral; it becomes a penalty.

**And the honest finding worth keeping:** this is the hardest of the six sectors
to serve without a search budget. Its trigger — a company opening an office in
one of eighteen named cities — is genuinely rare in thirty days of RSS. Two
organisations is a real result, not a broken one, and the fix is search rather
than more feeds. The floor was deliberately NOT lowered to inflate it: of 21
rejections only 2 were near-misses, and both were marginal.

### C19. Three weeks of sessions could not answer "which email is this under"

The question *"what email did I use for Nebius and Tavily"* could not be
answered from eleven session transcripts. API keys had been pasted; signup
details never had. The transcripts contained only two addresses, and **neither
was the right one**.

Logging into the services answered it in four minutes: both accounts sit under
**vincentkerrie13@gmail.com**, under the name *kerrie vincent* — a third
identity that appears nowhere in any transcript, and which differs from both the
Claude account and the git identity.

The same four minutes also settled a question that had been open for days and
had been listed as a blocking risk: **the Devpost registration exists, and a
draft submission with it.**

**The rule.** When a question is about the state of an external account, do not
mine the history for it. Open the account. Session transcripts record what was
pasted, which is rarely the thing being asked about, and absence of evidence in
them is not evidence of absence — it had been read that way here, and the
conclusion was wrong.

---

## Part E — The judge's-eye audit, 29 October

One day before the deadline the project was audited the way the judging actually
happens: clone the public repository on a clean path with no `.env`, run it, open
the links, recompute the numbers. **Eleven findings. Every fatal one was in the
packaging; not one was in the engine.**

### What the engine got right, measured

| Check | Result |
|---|---|
| Test suite | 17/17 files |
| Score arithmetic vs displayed total | 8 of 8 recomputed by hand, exact |
| Band thresholds at boundaries | consistent — 80 Critical, 75 Critical, 57 High, 50 High |
| Source URLs resolve | 6 of 6 top exec-search sources, HTTP 200 |
| Counter-readings | 111 across 6 profiles, substantive |
| Generic-entity guard | countries rejected; `"KKR's AI infrastructure company"` → `"KKR"` |
| Secrets | none committed, none in history, none in the 311KB demo payload |

### The four that would have cost real marks

**1. The repo shipped the wrong NVIDIA model.** `.env.example` and the fallbacks
in `server/lib/nebius.js` named `llama-3.1-nemotron-70b-instruct`; the live `.env`
uses `Nemotron-3-Ultra-550b-a55b`. The startup banner printed the wrong one. A
judge following the Quick start would have run the pipeline on a different model
family from the one the entire submission is built on — and the terminal
announced the contradiction before they typed a second command.

**2. A fresh clone showed an empty dashboard.** `data/**/*.json` is gitignored,
correctly. But `public/index.html` never referenced the committed 311KB
`public/demo-data.json`, so the file that would have fixed it sat unused beside
the problem. `GET /api/signals?profile=nvidia` returned `total: 0`.

**3. The README sold two sectors.** Four places still claimed two configurations
ship, against seven profiles and 247 organisations all run that week — the
submission advertising 29% of what was built, in the first document a judge
reads.

**4. A pre-cleanup register was public.** `.gitignore` caught `data/**/*.json` but
not `*.json.backup`, so `data/nvidia/organisations.json.backup` was live on
`raw.githubusercontent.com` containing **"United Kingdom" scored 90 Critical**,
"South Korea", and `kkrsaiinfrastructure`. Not a secret and not a security
problem — worse placed than that. This log documents cleaning countries out of
the register; a judge reading that and then browsing `data/` finds the uncleaned
file with no way to tell it is historical. It makes a true claim look like spin.

### One mistake made during the audit itself

The audit first reported **zero counter-readings across all 371 signals** — the
feature apparently dead, and the video script's required beat apparently
unfilmable. Wrong. The query had read `organisations.json`; counter-readings live
in `signal_log.json`. There are 111, and the Netflix one reads *"Netflix is a
mega-cap with mature sustainability function and in-house executive recruiting;
the CSO seat may have a succession plan"* — which is what the script narrates.

**The rule.** Check the file the field actually lives in before reporting it
missing. A whole feature looked 0% present because one path was wrong, and that
near-miss would have sent a correct script back for a rewrite.

### The rename that was never started

The audit brief asked which of seven candidate names was final, and instructed
that the work be marked **BLOCKED** until that was answered. A repository sweep
settled it in one command: **Auspius in 18 files** including the package name,
the page title, the README, the video script and the git remote — and **zero
files** for Pority, Tekmora, Kairon, Semeon, Cernora or Polara. There was nothing
to reconcile. Followed literally, that section would have halted all work with 23
hours left, to resolve a question the repository had already answered.

**The rule.** A rename proposal needs evidence it was ever started. Sweep for the
name first. A name appearing in zero files is a suggestion, not pending work —
and 23 hours out, a rename means a new repo URL, a new demo link, a republished
artifact and a re-recorded video.

### What the audit did not cover, deliberately

The brief ran to roughly 180 checks across 11 sections — more than a day's work,
which would have consumed the deadline it existed to protect. Skipped on purpose:
the ten onboarding input variations, the full 13-step judge journey, and
per-signal evidence for all 371 signals rather than a sample. Recorded here so
the gap is known rather than assumed covered.

**Published:** <https://claude.ai/code/artifact/38c5e587-601c-466f-bcf6-08ce5a2ca689>

---

## Part D — Working rules, distilled

Pin these up.

1. **Run it and look at the output.** Nothing important here was found by reading.
2. **State the polarity.** It cannot be inferred, and getting it backwards is invisible for months.
3. **Hunt events, not states.** If no document would say it, no search will find it.
4. **Code does the arithmetic.** A model asked for a number will invent one and sound certain.
5. **A field with no definition gets a wrong default.** Define every value you ask a model for.
6. **One constraint at a time**, measuring yield after each.
7. **A window per signal type**, never one for everything.
8. **Fetch every source before trusting it.** Publications get renamed and feeds go dead.
9. **Keep what you threw away.** A rejection with no reason cannot teach you anything.
10. **Tests get their own data.**
11. **"Checked and quiet" is a finding.** "Didn't look" is not.
12. **Ask whether the event gets published** before rewriting a query a third time.
13. **An empty week and a broken pipeline look identical.** Diagnose the difference automatically, or you will not notice for months.
14. **Tell the model what day it is.** It has no clock, and without one it treats today's news as implausibly futuristic.
15. **When porting a method into code, port the small conventions too.** The big ideas get carried across carefully; a one-line habit gets dropped and silently degrades every run.
16. **Make the free path a real path.** If it only works when you are paying, it does not work.
17. **Show the shape, do not just name the field.** A schema that names `polarity` without showing what a polarity line looks like gets `'call them'` five times.
18. **The two error directions are never equally costly.** Dropping a real account is far worse than keeping a stray row. Write the filter accordingly.
19. **Recover, do not discard.** "KKR's AI infrastructure company" is not an organisation, but KKR is — and it is a real lead.
20. **A number that can be computed must never be stored.** A band kept beside its score will eventually disagree with it.
21. **Ask for the losses, not just the wins.** A lost deal tells you what a dead lead looks like, which is half of polarity.
22. **Before trusting a model for a fact, ask what would catch it if it were wrong.** If nothing would, do not ask the model.
23. **A model writes for the generic tool, not yours.** Name the constraint and show an example of right and wrong.
24. **Configuration that arrives over the network is input.** Cap it, normalise it, and never let it become code.
25. **Parse every file you edit with a script.** `node --check` is seconds; finding one unbalanced brace by hand is an hour.
26. **Print what a splice removes before removing it.** A silently deleted function parses fine and fails quietly.
27. **De-emphasise with weight and size, not with grey.** Faded text reads as unfinished and fails contrast on the people who need it most.
28. **Measure the funnel before theorising about yield.** `searched → hits → fresh → extracted → verified` names the stage that is losing the signal.
29. **A filter that runs before the model is the most dangerous thing in a pipeline.** What it drops leaves no trace. Tune it loose and let the model refuse.
30. **Inherited configuration is wrong configuration.** Procurement codes, feed lists and filter terms copied from the first profile fit only the first profile.
31. **Ask who a source is written for.** Your industry's trade press reports your competitors, not your customers.
32. **If the scoring guidance names a list, put the list in the profile.** A criterion the verifier cannot evaluate becomes a penalty, not a neutral.
33. **Do not lower the floor to make a thin week look better.** Check the near-misses first; if they are marginal, the number is the truth.
34. **For the state of an external account, open the account.** History records what was pasted, not what was signed up for.
35. **Every claim bound for the camera gets checked against the run log first.** A sentence in a script is harder to retract than a sentence in a chat.
36. **A private link is worse than a missing one.** A missing link is obviously unfinished; a private link looks finished and shows the reader nothing.
37. **A default that contradicts the documentation is worse than no default.** Whatever ships in `.env.example` is what a stranger runs, and they will believe the README over the behaviour.
38. **Test on the host you will actually deploy to.** A framework convenience — a charset header, a MIME type, a rewrite rule — hides a bug that a plain static host exposes.
39. **A file nobody reads is a file that does not exist.** Generating an artefact is half the work; the half that counts is the code path that consumes it.
37. **Audit the clone, not the working copy.** Every fatal finding in the 29 October audit was invisible on the machine that built the project and obvious on a fresh clone.
38. **The example config is production code.** `.env.example` is the configuration most readers will actually run. A stale default there contradicts the submission in the reader's own terminal.
39. **Check the file the field actually lives in before reporting it missing.** A feature looks 0% broken when you query the wrong file.
40. **A rename proposal needs evidence it was ever started.** Sweep for the name before treating a rename as pending work; a name that appears in zero files is not a decision, it is a suggestion.

---

## A script claimed the free runs threw everything away. The log said otherwise

**What happened.** Drafting the demo narration, a line was written to the effect
that the free RSS path collected signals and discarded them all — a neat,
dramatic way of explaining why search was needed. It was checked against the
live pipeline log before it went any further. The log contradicted it: the
collector had indeed scored those items 0 and 1, but **Nemotron Ultra then
verified several of them at 7 and 8** and they reached the briefing. The
collector's score is a cheap pre-filter, not a verdict. Ultra overrules it, and
that rescue is one of the better things the architecture does.

**What it would have cost.** Nothing, because it was caught. Had it not been, a
three-minute film submitted to a judging panel would have contained a factual
claim about the system's own behaviour that the repository's logs disprove — in
a competition where one criterion is technological implementation and the code is
public. It would also have talked the project out of its own best mechanism.

**How it was found.** By opening `data/<profile>/runs` and reading the stage
counts rather than reasoning from the design.

**The rule.** Every claim bound for the camera gets checked against the run log
first. Chat is retractable, a committed script is awkward, and a recorded video
is permanent. The same check costs thirty seconds at each of those three stages
and the value of doing it rises steeply.

---

## The demo was published and left private, which is the failure mode that hides

**What happened.** The hosted demo — a hard submission requirement — was
published successfully and the URL recorded. It defaults to **private**. A judge
opening it would be asked to sign in to an account that cannot see it.

**How it was found.** By reading the publish confirmation rather than skimming
it: *"Artifacts are private unless shared from the page's share menu."*

**The rule.** A private link is worse than a missing one. A missing link reads as
unfinished and gets fixed; a working-but-private link reads as done. Any URL that
is part of a submission gets opened once in a browser that is not signed in. The
only proof a link is public is a stranger loading it.

---

## The repository shipped a different model from the one it documents

**What happened.** `server/lib/nebius.js` defaulted the Ultra tier to
`nvidia/llama-3.1-nemotron-70b-instruct`, and `.env.example` — the file a reader
copies — named the same older model. The project's actual `.env` uses
`nvidia/Nemotron-3-Ultra-550b-a55b`, and every document, the dashboard and the
submission describe the Nemotron-3 family and the measurements that led to it.

So anyone who cloned the repository, copied the example and supplied an API key
ran **a different, older model** from the one the project claims to have
benchmarked and chosen. The startup banner printed the contradiction on every
boot, under a heading that still read `SIGNAL BUREAU` three weeks after the
project was renamed.

**What it would have cost.** One of the four judging criteria is technological
implementation, and the repository is public. The strongest evidence for that
criterion — that all four Nemotron models were measured before Ultra was chosen
for reasoning and Super for extraction — is contradicted by the first two lines
a reader sees when they run it.

**How it was found.** By cloning the public repository into a temporary
directory, running `npm install` and `npm start` with no `.env`, and reading
what the terminal printed. Not by reading the source.

**The rule.** A default that contradicts the documentation is worse than no
default. Whatever is in `.env.example` is what a stranger runs. Clone your own
public repository and run it before you submit it.

---

## The demo payload was built, and nothing ever read it

**What happened.** `tools/export-demo.mjs` baked all seven configurations into
`public/demo-data.json` — 311KB of real organisations, briefings, scores and
rejection reasons — and committed it. `public/index.html` never referenced the
file. The export tool even read `public/index.html` into a variable named
`shell` and then never used it: the wiring was started and abandoned.

Because `data/**/*.json` is correctly gitignored, a fresh clone had no register,
no signals and no briefings. The dashboard rendered an empty shell. The fix for
that was sitting in the same directory, unread.

**What it would have cost.** A judge who cloned the repository saw a product
that appears to do nothing, with the evidence that it works one unreferenced
`fetch` away.

**How it was found.** By grepping `public/index.html` for `demo-data` after the
clone came up empty, and getting no matches.

**The rule.** A file nobody reads is a file that does not exist. When you
generate an artefact, write the code path that consumes it in the same change,
and test the consumer — not the generator.

---

## A charset bug that only exists on the host nobody tested

**What happened.** `public/index.html` had no `<meta charset="utf-8">`. Express
sends `charset=utf-8` in the `Content-Type` header for static HTML, so every
local run looked perfect for weeks. Served from a plain static host — which is
what a hosted demo is — the browser fell back to a legacy encoding and every
en-dash, middot and curly quote rendered as `â€"` and `Â·`.

**How it was found.** By serving `public/` with `python3 -m http.server` — no
Express, no backend — to reproduce the clone-and-host case, and reading the
rendered text rather than the source.

**The rule.** Test on the host you will actually deploy to. A framework
convenience hides a bug that a plain static host exposes, and the failure is
invisible in every environment where you do your work.

---

## Advisory documents argued for stack breadth; the judges said they don't score it

**What happened.** Two advisory documents (23 October) recommended adding Nebius
tooling to strengthen criterion 1: a GPU Devlab for prototyping, vLLM/SGLang for
benchmarking, Ray/SkyPilot for orchestration, n8n to sketch a model router, and a
multimodal Super-VL step. One of them ranked the Devlab "high value, do second".

**What it would have cost.** Every one of those items except Serverless
Endpoints and Jobs is a GPU rental. This account's own Devlab creation screen,
from 1 October, priced a single B300 instance at **$9.51/hour**. The hackathon's
promotional credits are Token Factory credits only — the official FAQ states
there is no published AI Cloud credit grant — so GPU time is paid at list price
with no credit cover. The Devlab recommendation was to prototype a Tavily +
Token Factory research loop that already exists and runs locally for free.

**What the judges actually said**, one day before the advice was written, in the
Devpost recording summary from six judges across Nebius, Tavily and NVIDIA:

> "One thing done well beats a big stack. There's no minimum number of tools,
> and every integration should support the main story."

**The rule.** Check an advisory recommendation against two things before acting
on it: whether the capability it names exists on this account, and whether the
judges have said they score it. One document recommended
`Nemotron-3-Nano-Omni`; the account exposes five Nemotron models and that is not
one of them. Another recommended replacing code rules with a model router, which
would have reversed this project's core design decision. Advice that sounds
sophisticated can still be more expensive than everything else combined and
score nothing.

**Recorded in full:** `DECISIONS-NEBIUS-TOOLING.md`.

---

## "Deployment on Nebius is required" was wrong, and it distorted the plan

**What happened.** The submission plan and handover both recorded Nebius
Serverless deployment as **required** and "the single biggest scoring gap".
Re-reading the live rules on 23 October showed otherwise. The rules define the
platform requirement explicitly:

> "Runs on Nebius Token Factory or Nebius AI Cloud" means the project makes a
> runtime call to the Token Factory inference API, **or** is deployed/run using
> Nebius AI Cloud compute.

The project already satisfies that through Token Factory calls. The track text
adds that Serverless is encouraged "though neither is required", and the FAQ
confirms the rest of an app need not be hosted on Nebius.

**What was actually required and had been missed:** a URL to a working demo,
hosted anywhere. That is a hard submission requirement, it is free to satisfy,
and it had been filed behind an optional item.

**The rule.** Read the rules page for the definition of a requirement, not a
summary of it. A requirement phrased as a platform name ("must run on Nebius")
may be defined far more loosely than it reads, and an optional item written in
bold can displace a mandatory one written in plain text.
