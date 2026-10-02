# Query lab findings — 32 collector queries, 30-day window

Run: `npm run query -- --file tools/queries.txt --days 30` · 64 Tavily credits, no model calls.

**Overall: 223/310 results usable (72%)** — 23 GOOD, 6 MIXED, 3 POOR.

## Measured: the search window leaks at wide settings

| Requested | Oldest result returned | |
|---|---|---|
| `--days 7` | 1 Oct 2026 | holds |
| `--days 30` | 4 Sep 2026 | holds |
| `--days 90` | **9 Mar 2026** | **leaks — seven months** |

**30 days is the practical ceiling.** Beyond it the filter stops being meaningful,
which is why an 84-day backfill produced signal dates reaching back to the
previous October. Collectors now re-check each signal's date against the window
actually requested and flag anything older.

## The three failures, and what they actually were

Each failing query attracted *commentary about* a topic rather than the event
itself. Two were fixed by naming the actor instead of the subject; one turned
out not to be a search problem at all.

### 1. Hyperscaler capex — 20% → 89% ✅ FIXED

```
WAS: hyperscaler capital expenditure guidance AI infrastructure data center spending
NOW: Microsoft OR Google OR AWS OR Meta announces new data center investment billion country
```

"Guidance" and "spending" are analyst vocabulary, so the results were Goldman
notes and MIT Technology Review essays. Naming the companies and the word
"announces" returns the events themselves — Google's €13bn Finland commitment,
Amazon's $1bn, Meta in Ohio.

### 2. Export controls — 20% ❌ DELETE THIS QUERY

```
WAS: AI chip export controls restriction policy decision announced
```

Rewriting did not help: it returned law-firm explainers, CSET and SSRN papers
whichever way it was worded. The reason is that the event lives on
**bis.doc.gov and the Federal Register**, and open web search returns everyone
writing *about* those documents instead of the documents.

**The Regulator Sweep already covers this properly** with
`site:bis.doc.gov`, which is why site-scoped search exists. Delete the query
from the Competitive Displacement collector rather than trying to fix it —
two collectors hunting the same thing badly is worse than one doing it well.

### 3. Telecom edge — 20% → 70% ⚠️ FIXED BUT DRIFTS

```
WAS: telecom operator AI data center edge compute programme
NOW: telecom operator announces AI data centre investment megawatt
```

"Programme" attracted market-research reports ("Market Size, Share & Growth
2034"). The rewrite returns real dated events, but mostly *not telecom ones* —
it drifts to general data centre investment. Usable, but it is no longer doing
the job its name claims. Either accept it as a second general-investment query
or name the operators explicitly, as the capex fix does.

## Noise domains worth excluding globally

These produced no usable signal in any query and are pure extraction cost —
every one still has to be read by the model before it can be discarded:

```
precedenceresearch.com, igtps.com, indexbox.io, 247wallst.com,
marketgrowthreports.com, grandviewresearch.com, marketsandmarkets.com,
mordorintelligence.com, simplywall.st, seekingalpha.com, fool.com,
facebook.com, instagram.com, reddit.com, youtube.com, marketbeat.com
```

Market-research sites are the worst offenders: SEO-optimised, superficially
on-topic, and never a lead. Social domains are additionally the main source of
undated results.

Pass as `--exclude` in the lab, or as `excludeDomains` on a collector.
**Use a light touch** — an aggressive exclusion list cut one test query from
ten results to one.

## The six MIXED queries (40–69%)

Worth a pass but not urgent:

| Query | Usable |
|---|---|
| HBM CoWoS advanced packaging capacity supply agreement allocation | 50% |
| appointed chief AI officer head of AI infrastructure VP compute | 50% |
| company deploying Trainium TPU MTIA custom AI chip at scale | 60% |
| custom AI accelerator programme expanded cancelled company | 60% |
| hyperscaler custom silicon tape out production announced | 60% |
| AI networking ethernet infiniband deployment win announced | 60% (4 undated) |

## The pattern across all 32

**Queries that name an ACTOR and an ACTION score 80–100%.** Queries that name a
TOPIC score 20–50%. The best performers all have this shape:

- `GPU cloud AI infrastructure funding round raised billion` — 100%
- `NVIDIA investment stake AI infrastructure company announced` — 100%
- `private credit debt facility GPU financing announced` — 100%
- `colocation operator AI capacity expansion lease signed` — 100%
- `RFP tender AI compute GPU procurement notice published` — 100%

Every one contains a verb of commitment: raised, announced, signed, published.
The failures contain abstractions: guidance, policy, programme.

**Rule for writing a new query:** if you cannot point at the verb describing
what somebody DID, the query will return people discussing it instead.
