# Which Nebius tools this project uses — and which it deliberately does not

**Written:** 23 October 2026. **Why this file exists:** two advisory documents
recommended adding Nebius tooling. Most of those recommendations would cost real
money for no scoring gain. This records what was accepted, what was declined,
and the reasoning, so nobody re-litigates it under deadline pressure.

## The rule that decides every line below

**Everything on the Nebius tooling list except Serverless Endpoints and
Serverless Jobs is a GPU rental.** Devlabs, Ray, SkyPilot, vLLM and SGLang all
mean renting GPUs by the second. The Devlab creation screen from 1 October
priced a single B300 instance at **$0.17/minute = $9.51/hour**. The standing
rule on this project is no real money, and the hackathon's promotional credits
are **Token Factory credits only** — the official FAQ states there is no
published AI Cloud credit grant. So GPU time is paid out of pocket, at list
price, with no credit cover.

## Accepted

### Serverless Job — for the weekly pipeline

**Decision: do this.** It is the cheapest honest claim on Nebius AI Cloud
available to this project, and the narrative fit is exact: Veridian *is* a
finite weekly background run. A Job bills for the duration of the run and then
stops. An Endpoint bills every hour between create and delete, including idle —
and judging runs 1–15 December, six weeks after the deadline, so an Endpoint
left standing is six weeks of idle billing.

This also upgrades the eligibility claim from one qualifying route to two: the
project makes runtime Token Factory calls **and** runs on AI Cloud compute.

### A free-hosted dashboard — for the mandatory demo URL

**Decision: do this.** The rules require "a URL to a working demo, hosted
application, or test build". They do not require it to be on Nebius. Hosting the
dashboard free and running the pipeline as a Nebius Serverless Job satisfies the
requirement and the criterion at the same time, without idle billing.

## Declined

### Devlabs, including "Deep Research with OpenShell"

**Decision: no.** One advisory document ranked this "high value, do second". It
is the single most expensive item on the list. It is a GPU Devlab — $9.51/hour
on the configuration already priced in this account — and what it offers is a
sandboxed environment for prototyping a Tavily + Token Factory research loop.
That loop already exists, works, and runs locally for free. Paying GPU rates to
prototype something already in production is a straight loss.

### vLLM and SGLang, for benchmarking Nemotron models

**Decision: no.** The four Nemotron models were already measured through Token
Factory before Ultra and Super were chosen; that measurement is the project's
strongest criterion-1 evidence and it cost nothing. Standing up vLLM means
renting GPUs to re-measure what Token Factory already reported. No new
information, real money.

### Ray and SkyPilot

**Decision: no.** Multi-GPU cluster orchestration for a pipeline that runs in
nineteen minutes on one laptop. Even the advisory document called this optional.

### n8n, to sketch a model router

**Decision: no — and the router itself is declined.** The proposal is to replace
code rules with a model deciding which model handles what. That reverses this
project's core design decision: **code filters, the model narrates.** The
priority score is arithmetic, not a prompt, and that was forced by live failure.
Determinism is the differentiator and it is defensible in one sentence. A
model-as-router makes the system less explainable, not more.

### JupyterLab, LangChain, LlamaIndex

**Decision: no.** Prototyping environments for a system that is already built.

## The judging evidence behind all of this

From the Devpost update of 22 October, summarising six judges from Nebius,
Tavily and NVIDIA reviewing real submissions:

> "One thing done well beats a big stack. There's no minimum number of tools,
> and every integration should support the main story."

Both advisory documents argued for stack breadth. The judges said, on the
record, that they do not score it. Every declined item above is breadth that
supports no part of the main story.

What the judges *did* ask for, and what this project should spend its remaining
days on instead:

- **The aha moment inside 30 seconds of the demo.** The exec-search polarity
  flip is exactly that, and it is free to run.
- **Show which model is doing what.** Label the Nemotron model on each pipeline
  step in the dashboard. Cheap, and it is criterion-1 evidence a judge can see
  without reading code.
- **Publish your limitations.** `PITFALLS-AND-LESSONS.md` already is this.
  Judges stated they read documented failure cases as rigour.
