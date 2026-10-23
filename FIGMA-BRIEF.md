# Veridian — design brief for Figma

**Product:** Veridian · *Verified Signal Intelligence*
**What it is:** an autonomous business-development intelligence agent. It reads a
market every week, verifies every claim against its source, scores what survives
with arithmetic you can audit, and writes a briefing. Built on NVIDIA Nemotron
models running on Nebius Token Factory, with Tavily as the search layer.

**What I'm sending alongside this:** a populated HTML interface showing the real
content — every panel, filled with real data from a real run. Use it for
*content, density and hierarchy*. Use this document for *brand, colour and type*.
Where they disagree, this document wins on look and the HTML wins on structure.

---

## The one hard constraint

**No white backgrounds. No near-black backgrounds.**

This matters more than anything else here, and it overrides the palette in any
earlier brand research — which proposed `#0B0F0C` deep graphite surfaces. Do not
use those.

Build the interface on **mid-tone grounds**: tinted, desaturated surfaces that
sit in the middle of the value range. Think of a well-lit control room rather
than either a printed page or a dark IDE. Two directions that work, pick one and
commit:

**Direction A — warm stone.** A clay or putty ground around 65–75% lightness,
panels slightly lighter than the page, ink-blue text. Feels considered and
editorial, unusual for a technical product, and makes the signal green read as
genuinely urgent rather than decorative.

**Direction B — cool slate.** A blue-grey ground around 55–65% lightness, panels
a shade deeper or lighter, near-ink text. Feels instrument-like and closer to the
category, while still avoiding the dark-dashboard cliché.

Either way the rule is: **the page ground is a colour, not an absence of one.**
Panels separate from the ground by a small shift in value and a hairline, not by
being white boxes floating on grey.

Contrast still has to pass — body text against the ground at 4.5:1 or better.
A mid-tone ground makes that a real design problem rather than a given, and
solving it properly is most of what will make this look professional.

---

## Colour: semantic before decorative

The product's whole argument is that it tells you *why* — so colour has to carry
meaning, not mood. Four semantic roles, and nothing else should be coloured:

| Role | Means | Where it appears |
|---|---|---|
| **Verified / actionable** | this is real and you can act on it | the signal green, score bands at Critical, verified ticks |
| **Live / working** | the system is doing something right now | agent activity, a running pipeline, the lime accent |
| **Interactive** | you can click this | links, buttons, focus rings — and nothing else |
| **Caution / counter-reading** | the argument against acting | counter-readings, review flags, rejection codes |

Anchor colours to work from, adjusted to whichever ground you choose:

- **Signal green `#76B900`** — NVIDIA's green. Use it as the verified/actionable
  accent. Never decoratively. On a mid-tone ground it will need darkening to hold
  contrast; keep the hue, move the value.
- **Electric lime `#DAFF33`** — live agent activity only. Tiny amounts. A badge,
  a pulse, a running indicator.
- **Ink blue `#052B42`** — primary text on light-to-mid grounds.
- **Interaction blue `#3277FF`** — links, buttons, focus states. Nothing else.
- **Caution amber `#FFB020`** — counter-readings and review flags.

**Priority bands need four distinguishable steps** — Critical, High, Medium, Low.
They must read at a glance and must not rely on hue alone: a weight, a left rule,
a filled versus outlined chip. Someone will print a screenshot in greyscale.

Do not let the green become the identity. It is the *verdict* colour. A page
where everything is green says nothing.

---

## Typography

| Role | Face | Notes |
|---|---|---|
| Wordmark and headlines | **Space Grotesk** | Geometric, engineered, sits credibly beside NVIDIA's DIN-like letterforms |
| Product UI and body | **Inter** | Dense interface text, tables, labels |
| Scores, codes, URLs, timestamps | **IBM Plex Mono** | This is load-bearing — see below |
| The weekly briefing only | **Source Serif 4** | Used sparingly, for narrative prose |

**The mono face is doing real work, not decoration.** Veridian's claim is that
every number is auditable and every source is checkable. Setting scores, source
domains, agent timings and rejection codes in mono makes that claim visible:

`VERIFIED` · `POLARITY: INVERTED` · `GROUNDING: PASS` · `90 / 100` · `SOURCE: TAVILY` · `UNGROUNDED`

Uppercase, tracked out, small. These labels are the texture of the product.

**The serif is the second half of that idea.** The chrome is an instrument; the
briefing is a document a person reads on a Monday morning. Letting those two
things look different is the most distinctive typographic decision available
here — don't flatten it into one sans.

---

## The wordmark

`VERIDIAN` set in Space Grotesk Medium, with **a green terminal dot**. The dot is
the mark: it is the verification tick, reduced.

If a symbol is needed beside it, the concept is **the verified pulse** — a small
rounded-square badge holding three ascending signal bars, the tallest in signal
green with a dot at its end, the others muted. Abstract. Do not reference
NVIDIA's eye or any part of their mark.

Lockup:

> **VERIDIAN**
> *Verified Signal Intelligence*

---

## What has to be designed

The HTML reference shows all of this populated. In rough order of importance:

1. **The weekly briefing.** The centre of the product — a headline, then scored
   signals, each with a source link and sometimes a counter-reading. This is the
   thing people read. Give it document-like typography.
2. **The configuration selector, in the top bar.** Veridian runs for a different
   business depending on which configuration is loaded, and switching is a
   *context change*, not a filter — the whole page reloads around it. It needs to
   read as more significant than a dropdown filter usually does.
3. **"+ Add a business"**, immediately beside the selector. See the section below.
4. **The score breakdown** — four factors summing to 100, shown as a small
   component that makes the arithmetic visible. This is the product's proof.
5. **The agent panel** — twelve named agents with status and timing. Some are
   marked as free sources, two run on the heavy model. Show that distinction.
6. **The prospect register** — a ranked list of organisations, each with a score,
   a band and the practice areas it opened.
7. **"Rejected, and why"** — a panel of discarded signals with reason codes. This
   is deliberately visible. *"We show what we rejected, and why"* is a brand
   statement, not a debug view.
8. **The counter-reading** — the argument against acting on a lead, attached to
   the lead itself. Needs a treatment that reads as a deliberate caveat, not an
   error.
9. **Ask the register** — a question box, with voice input, and answers that cite
   which filters were applied.
10. **The yield funnel** — searched → found → extracted → verified, with the
    named cause of each drop-off.

---

## The onboarding flow — please design this properly

This is the newest and most important screen, and it is where a judge or a
prospect answers the question *"would this work for MY business?"*.

**+ Add a business** sits in the top bar next to the configuration selector. It
opens a sheet with four fields:

1. **Short name** — becomes the configuration's identifier
2. **Their website** — the homepage; the system follows the links itself
3. **Deals they have already won** — a textarea, and the most important field on
   the screen
4. **Anything else you know** — optional free text

Then it runs, showing a live log of what it is doing:

> Reading https://www.example.com
> Read 5 pages — no search credits used
> Working out what they sell, and deriving polarity from the deals you described
> Found 5 things they sell
> Researching the market — publications, regulators, competitors
> Proposed 24 publications and 8 regulators — now checking every one resolves
> 6 live feeds found, 9 discarded · 8 regulators verified
> Done. Ready to run.

**Two things in this flow carry the brand, and both need design attention:**

**(a) The wins field is not an afterthought.** Everything else can be researched.
The one thing that cannot is *polarity* — whether an event means "call them" or
"we've lost this one". The same headline is a lead to one business and a dead
lead to another, and no amount of research settles it. It can only be derived
from deals already won: *what published event started this deal?* The field
should look like the most important thing on the sheet, with the instruction to
**include deals you lost** given real prominence — a loss is what teaches the
system what a dead lead looks like.

**(b) The refusal is a feature.** If no wins are supplied, the system builds the
configuration anyway and leaves the polarity *unanswered*, with explicit
questions for a human. There is a persistent banner for this state:

> **This configuration has no polarity yet.** Veridian built everything it could
> research, and refused to guess which way events point for this business. It
> will run, and it will score badly, until these questions are answered.

Design that banner as a confident statement, not a warning triangle. A system
that says "I won't guess this" is making a claim about its own integrity. It
should look like it means it.

---

## Voice

Confident, exact, unsentimental. The words that belong here are *verified*,
*grounded*, *auditable*, *polarity*, *counter-reading*, *actionable*.

Never "AI-powered insights" without showing the source and the reason. Never
"scanner", "monitor" or "alerts" — those undersell a twelve-agent pipeline with
a verification stage.

---

## What to avoid

- White cards floating on a grey page. The ground is a colour.
- A dark dashboard. Whatever the category does, this does not.
- Green used decoratively. It means *verified*.
- Rounded cards with an accent bar, one radius and one shadow stamped on
  everything. Spend border, fill and shadow by role.
- Emoji as section markers.
- Big hero numbers for their own sake. Lead with a number only where the number
  is the point.

---

## Deliverables

Desktop frames at 1440 and 1920. Mobile is lower priority — this is read on a
laptop on a Monday morning. Please include:

- The main console, populated
- The onboarding sheet, both states: empty, and mid-build with the live log
- The "no polarity yet" banner state
- A component sheet: score band chips, the score breakdown, rejection codes,
  mono labels, buttons and focus states
- The wordmark, and the mark if you make one
