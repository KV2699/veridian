# Veridian — demo video script

**Length:** **372 spoken words** — 2:39 at a normal pace, 2:59 read slowly.
Deliberately under the three-minute cap, because read-aloud with pauses runs
slower than you expect.
**Read it off the screen:** <https://claude.ai/code/artifact/ef679404-b976-47ab-9c58-a9bc89f137db>
— the same script laid out as a teleprompter, spoken lines large, directions small.
**Required by the rules:** must show the project working, and must show NVIDIA
Nemotron on Nebius Token Factory in the loop. Both are marked ★ below.

**The wedge.** The reference ad sells an AI that works your *pipeline* — "which
deal needs my attention?" It is a good product and it has one hard limit: **it
can only tell you about people you have already met.** Everything it knows came
from your CRM.

Veridian answers the question that comes before that one: **what happened last
week that you don't know about yet?** Keep that contrast in the edit. Never say
a competitor's name — just occupy the ground they can't.

---

## The script

### 0:00 – 0:18 · The Monday problem

> **VO:** Monday morning. Pipeline's full. Calendar's full.
>
> And somewhere out there last week, something happened that should have been
> your next deal. A funding round. A resignation. A regulator setting a
> deadline.
>
> Nobody sent it to you. It just happened.

**On screen:** `WHAT YOU MISSED LAST WEEK` — large, left of a laptop mock.
**Capture:** nothing yet. Title card over the soft gradient ground.

---

### 0:18 – 0:32 · The wedge

> **VO:** Your CRM is very good at the deals you already have. But it can only
> ever tell you about people you've already met.
>
> The lead you lose isn't the one you forgot to chase. It's the one you never
> heard about.

**On screen:** `THE LEADS YOU DIDN'T KNOW ABOUT` — hold it. This is the line
the whole film hangs on.

---

### 0:32 – 1:05 · The idea, and the aha ★

> **VO:** This is Veridian. You tell it what your business sells. It reads the
> market every week and tells you who to call.
>
> And here's the part that makes it work. Watch the same headline hit two
> different businesses.

**Capture — THE AHA SHOT.** Open the dashboard. The first panel on screen is
already this. Zoom into it slowly:

> *"Disney's environmental sustainability co-lead leaves the company."*
>
> **VO:** To a company selling AI infrastructure, that's bad news — the person
> who signs the cheque just walked out.
>
> To a headhunter, the same sentence is the best news of the week. An empty
> chair. A live mandate.
>
> Same story. Opposite answers. Because Veridian knows who it's working for.

---

### 1:05 – 1:40 · Proof ★

> **VO:** So here's a real one, from a real run.

**Capture:** switch the sector chooser to **Executive Search & Recruitment**.
Let the briefing load. Zoom on the headline.

> **VO:** Netflix lost its first chief sustainability officer. No successor
> named. Scored eighty out of a hundred. Critical.
>
> Then it does something most tools won't.

**Capture:** scroll to the counter-reading on that signal.

> **VO:** It argues against itself. Netflix has its own recruiting team — they
> may never go to market. It tells you that before you waste the call.

---

### 1:40 – 2:12 · How it works ★ (the Nemotron / Token Factory beat)

**Capture:** the agent panel, left rail, with the ULTRA / SUPER / FREE labels
visible. Then the "Running on" panel. Then click a signal to open the score
breakdown.

> **VO:** Twelve agents. NVIDIA Nemotron on Nebius Token Factory. Super does
> the fast reading. Ultra does the judging and writes the briefing.
>
> The score isn't a model's opinion. Four factors, added up in code. Take any
> number apart and see where it came from.

**Capture:** the "Rejected, and why" panel.

> **VO:** And it keeps what it threw away. Every rejection, with the reason.

---

### 2:12 – 2:38 · It isn't one industry

**Capture:** open the sector chooser. Let all seven cards sit on screen for a
beat, then click through two or three.

> **VO:** Seven sectors. Executive search. Policy. Hospitality. Law. AI
> infrastructure.
>
> Two hundred and forty-seven organisations nobody handed it. It found them all
> itself.
>
> Same code every time. The only thing that changes is one file describing your
> business.

**Capture:** click **+ Add a business**, paste a website, show the live build
log ticking through. Cut before it finishes.

> **VO:** And if your sector isn't there — point it at a company website. It
> configures itself in two minutes.

---

### 2:38 – 2:50 · Close

> **VO:** Veridian. Verified signal intelligence.
>
> Your pipeline knows who you've met. This tells you who you haven't.

**On screen:** `VERIDIAN` wordmark with the green dot · *Verified Signal
Intelligence* · the repo and demo URLs · `NVIDIA Nemotron · Nebius Token
Factory · Tavily`

---

## Shot list — what to screen-record before you narrate

Record these in one pass with the dashboard already loaded, then cut to the VO.

| # | Shot | Where |
|---|---|---|
| 1 | The aha panel, slow zoom | top of Overview |
| 2 | Sector chooser open, all seven cards | click the sector button |
| 3 | Switch to Executive Search, briefing loads | chooser → that card |
| 4 | The Netflix headline in the briefing | scroll |
| 5 | A counter-reading, held long enough to read | any signal card |
| 6 | Agent panel with ULTRA / SUPER / FREE | left rail ★ |
| 7 | "Running on" panel — the model names | right rail ★ |
| 8 | Score breakdown, four bars to 100 | click any signal |
| 9 | "Rejected, and why" | right rail |
| 10 | + Add a business → paste URL → live log | top bar |

★ = required by the rules. Do not cut these.

## Notes on delivery

- **Short sentences. Full stops where you'd want a comma.** The reference ad
  works because it breathes. Read it slower than feels natural.
- **One number per beat.** Eighty out of a hundred. Twelve agents. Seven
  sectors. Two hundred and forty-seven. Never two in the same sentence.
- **Don't explain the architecture.** Show the labels and move on. A judge who
  wants the detail has the repo.
- **The visual grammar** from the references: device mock on one side, one big
  line of type on the other, soft gradient ground, captions burned in low.
- **Say "Nemotron" and "Token Factory" out loud at least once.** Two of the four
  judging criteria turn on it, and audio counts.
