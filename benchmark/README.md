# Benchmark — can another tool beat Auspius?

Four copy-paste prompts for testing Gemini, Grok, Perplexity, DeepSeek, Kimi,
ChatGPT or anything else against this system, plus a scoring sheet.

Every prompt carries the discipline this project learned the hard way — date
anchoring, a hard source rule, structured-only output, and the grounding rule
that broke two live runs before it existed. That matters: a tool handed a loose
prompt will beat a tight one on volume and lose on everything else, and you
want to know which tool is better, not which prompt was slacker.

## The baseline to beat

| | Auspius, one backfill run |
|---|---|
| Distinct organisations | **100** (`baseline-organisations.txt`) |
| Genuinely actionable leads | ~18 |
| Verified signals | 166 from 231 collected |
| Dropped below the score floor | 34 |
| Cross-category duplicates removed | 26 |
| Flagged for human review | 39 |
| Runtime | ~26 minutes, unattended |

**Date window used:** roughly 84 days back from 2 October 2026. Use the same
window in every prompt below or the comparison means nothing.

## Before you start

1. **Run each prompt in a fresh chat.** Context from a previous attempt makes a
   tool look better than it is.
2. **Do not let the tool rewrite the prompt.** Grok in particular will offer to
   "improve" it; testing across the earlier prompt packs showed its own rewrites
   produced zero or worse results every time. Every prompt below says so, but
   watch for it anyway.
3. **Run the same prompt on each tool on the same day.** A week's drift in the
   news changes the answer more than the tool does.
4. **Record what you had to correct.** Ranking by raw yield is how you end up
   trusting the tool that produces the most work.

---

## Prompt 1 — Discovery head-to-head

The main test. Same market, same window, same output shape, so the organisation
list can be diffed against `baseline-organisations.txt`.

```
Copy this prompt exactly as written. Do not rewrite it, do not improve it, and do not change the output format. Use your live web search for everything — do not answer from training data.

Today's date is 2 October 2026. Search window: 10 July 2026 to 2 October 2026. Return nothing dated outside that window.

ROLE
You are finding business development leads for a seller of AI infrastructure — GPU systems and networking, AI platform software, managed AI cloud capacity, digital-twin simulation, automotive and edge compute. The buyer persona is a BD professional selling into the NVIDIA ecosystem.

WHAT COUNTS AS A LEAD
Only a dated, published event involving a NAMED organisation. Specifically:
- A funding round, debt facility or capital commitment raised to buy or build AI compute
- A government or sovereign AI programme with a stated budget
- A data centre, power or capacity agreement (megawatts, gigawatts, sites, PPAs)
- A semiconductor or supply agreement affecting AI compute availability
- A published tender, RFP or procurement notice for compute, GPUs or an ML platform
- A NEW appointment into an AI or infrastructure leadership role — this is a LEAD, because a new budget holder has roughly 90 days to show progress
- An enterprise announcing an AI buildout, AI factory or named AI budget

WHAT DOES NOT COUNT
- Market forecasts, analyst notes, "the AI market will reach $X by 2030"
- Share price movement, earnings commentary with no stated spend
- Product reviews and benchmarks
- Anything where you cannot name a specific organisation that did a specific thing on a specific date
- Anything about NVIDIA itself — NVIDIA is the seller here, not a prospect

HARD RULES
1. Every lead needs a working source URL you have actually retrieved. No URL means the lead does not exist — do not include it.
2. The source must be ABOUT that organisation. A company mentioned in passing inside an article about something else is not a lead for that company. Check the headline and opening paragraph.
3. Never state a figure that is not in the source. If the source gives no size, write "not stated" — do not estimate.
4. Date must be the source's publication or event date. If you cannot establish one, write "undated" — do not guess.

OUTPUT
Return a markdown table and nothing else. No introduction, no commentary, no reasoning, no closing summary.

| Organisation | Country | Signal type | What happened (one sentence) | Date | Deal size as stated | Source URL |

Then, on a final line only: TOTAL LEADS: [n]

Aim for breadth of distinct organisations rather than several entries about the same one. If you find fewer than ten that satisfy every rule, return fewer — a short honest list is the correct answer.
```

**Scoring:** count distinct organisations, then open ten URLs at random and check
the source is genuinely about that organisation. Precision matters more than
count — see the sheet below.

---

## Prompt 2 — Hard mode: find what Auspius missed

The more interesting test. Paste the 100 names from
`baseline-organisations.txt` into the exclusion block and see whether the tool
can find anything new.

```
Copy this prompt exactly as written. Do not rewrite it. Use live web search throughout — do not answer from training data.

Today's date is 2 October 2026. Search window: 10 July 2026 to 2 October 2026.

TASK
Find business development leads in AI infrastructure — organisations that have publicly committed money to buying or building AI compute, or opened a procurement for it — that are NOT in the exclusion list below.

The exclusion list is the complete output of an existing automated system. Your job is to beat it by finding organisations it did not. Returning a name from the list is a failure, not a result.

Bias your search AWAY from the obvious. The excluded list already contains every hyperscaler and most large GPU clouds. Look instead at:
- Mid-market enterprises standing up AI infrastructure for the first time
- Universities, hospitals, national laboratories and research institutes
- Regional and national government programmes outside the US and UK
- Industrial, pharmaceutical, financial and logistics companies buying compute
- Smaller or newer GPU cloud and colocation operators
- Companies in Japan, Korea, India, the Gulf, Latin America, Africa and the Nordics

EXCLUDE — do not return any of these:
[PASTE THE CONTENTS OF baseline-organisations.txt HERE]
Also exclude NVIDIA itself.

HARD RULES
1. Every lead needs a working source URL you have retrieved. No URL, no lead.
2. The source must be ABOUT that organisation, not merely mention it.
3. No figure that is not stated in the source. No guessed dates.
4. A named organisation taking a dated action. Not a trend, not a forecast.

OUTPUT — table only, no other text:

| Organisation | Country | Signal type | What happened | Date | Deal size as stated | Source URL | Why this is a buying signal |

Final line only: NEW ORGANISATIONS FOUND: [n]
```

**Scoring:** this is the one that tells you whether a tool has genuinely wider
reach, or just restates the same famous names. Any tool returning excluded
names failed to read its own instructions.

---

## Prompt 3 — Open procurement hunt

Auspius's weakest area: it scanned 2,000 UK notices and surfaced only one
to three live opportunities. If another tool does better here, that is worth
knowing.

```
Copy this prompt exactly as written. Do not rewrite it. Use live web search throughout.

Today's date is 2 October 2026.

TASK
Find OPEN, currently biddable public-sector procurement opportunities for AI compute infrastructure — GPUs, accelerators, HPC clusters, AI data centres, ML platforms or the networking and cooling around them.

CRITICAL: the opportunity must still be open. A contract award notice names a contract someone else has already won and is NOT an opportunity. If the closing date has passed, do not include it.

Search national and supranational procurement portals, including but not limited to: EU Funding & Tenders Portal, TED, UK Find a Tender, UK Contracts Finder, SAM.gov, Canada's CanadaBuys, Australia's AusTender, Indian government e-procurement, UN Global Marketplace, World Bank, and national portals in Japan, Korea, the Gulf states and the Nordics.

For each opportunity, confirm from the notice itself:
- The buying organisation's name
- What is being procured
- The closing date, and that it is after today
- The stated value, or "not stated"
- A working link to the notice

HARD RULES
1. Only notices you have actually retrieved. No URL, no entry.
2. Never infer a closing date. If the notice does not state one, write "not stated" and say so.
3. Do not include framework awards, contract award notices, or expired opportunities.

OUTPUT — table only, no other text:

| Buyer | Country | What is being procured | Closing date | Value as stated | Portal | Notice URL |

Sort earliest closing date first.
Final line only: OPEN OPPORTUNITIES: [n] — of which with a stated closing date: [n]
```

---

## Prompt 4 — Verification test (the one most tools fail)

Discovery is the easy half. This tests whether a tool can catch a bad lead,
which is what actually determines whether a briefing is safe to send.

```
Copy this prompt exactly as written. Do not rewrite it. Use live web search to check each claim.

Below are business development leads produced by an automated system. Some are sound. Some are not — the known failure modes are:

(a) MISATTRIBUTION — the source URL is real, but the article is about a different organisation and merely mentions this one in passing.
(b) UNSUPPORTED FIGURE — a number appears in the claim that does not appear in the source.
(c) STALE DATE — the event is real but happened outside the stated window, or the date given is wrong.
(d) NOT AN EVENT — the claim is background, a forecast or a general fact rather than a dated action.
(e) WRONG ENTITY — the claim concerns a subsidiary, parent or similarly named organisation.

For each lead: retrieve the source URL, read it, and judge.

Return this table and nothing else:

| # | Organisation | Verdict | Failure mode (a-e, or none) | What the source actually says |

Verdict is CONFIRMED, UNCONFIRMED or WRONG.
- CONFIRMED: the source is about this organisation and states this claim.
- UNCONFIRMED: you could not retrieve the source, or it is paywalled.
- WRONG: the source does not support the claim. Say what it actually says.

Do not be generous. A claim the source does not clearly support is WRONG, not CONFIRMED.

Final line only: CONFIRMED: [n] | UNCONFIRMED: [n] | WRONG: [n]

LEADS TO CHECK:
[PASTE 15-20 ROWS FROM YOUR OWN BRIEFING OR FROM ANOTHER TOOL'S PROMPT 1 OUTPUT]
```

**Why this one matters most:** on a live run, two of Auspius's top five
leads were attached to articles that were not about them — a national
laboratory claim sourced to a post about a university physicist, and a telecom
buildout sourced to an article about an unrelated product launch. A tool that
cannot catch that cannot be trusted to verify, whatever its discovery numbers
look like.

---

## Scoring sheet

Fill this in per tool. Rank on **corrected yield**, never on raw count.

| Measure | How to get it |
|---|---|
| **A. Organisations returned** | Count distinct names |
| **B. Already in the baseline** | Diff against `baseline-organisations.txt` |
| **C. Genuinely new** | A − B |
| **D. URL opens and is about that organisation** | Check 10 at random, express as a percentage |
| **E. Figures supported by the source** | Of those 10, how many state the figure given |
| **F. In the stated window** | Of those 10, how many are correctly dated |
| **G. Actionable** | A named buyer with a dated commitment or an open procurement — not market intelligence |
| **H. Needed correction** | Anything in D, E or F that failed |
| **Corrected yield** | **G × D** — the number of leads you could actually use |
| **Format compliance** | Did it return the table only, or wrap it in prose? |
| **Prompt integrity** | Did it try to rewrite the prompt? |

### How to read the result

- **High A, low D** — a tool producing confident volume you cannot trust. The
  most expensive kind, because the correction work lands on you.
- **Low A, high D** — narrow but honest. Usually the better partner, and the
  easier one to widen with more queries.
- **High C** — genuinely wider reach. This is the finding worth acting on: add
  that tool's angle to the collectors rather than replacing anything.
- **Fails Prompt 4** — do not use it for verification regardless of how well it
  discovers. Collection and verification are different jobs with opposite
  failure modes, and one tool rarely does both well.

### Record it

Keep the results in `GA-BD-Tool-Performance.md` style — tool, what it was best
at, what it needed correcting, and the evidence. A ranking without the
correction column is how you end up adopting the tool that generates the most
work.
