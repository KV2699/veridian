// YIELD DIAGNOSTICS
//
// The hardest failure in a BD collection system is not a crash — it is a clean
// run that quietly returns nothing useful, because zero results and a quiet
// week look identical from the outside. The Acre prompt pack shipped two full
// versions in that state before anyone replicated the searches by hand and
// found eight root causes.
//
// This module does that diagnosis automatically, every run. It watches where
// signals are lost between four stages:
//
//   searched → hits → fresh (not seen before) → extracted → verified
//
// and names the likely cause of any collapse, with the fix. The point is that
// a bad week announces itself as a bad week, instead of being mistaken for a
// quiet market.

const RULES = [
  {
    id: 'no-key-terms',
    stage: 'search',
    severity: 'high',
    test: (q) => q.hits === 0,
    scope: 'query',
    cause: 'This query returned nothing at all from the web.',
    fix: 'The wording does not match how this event is actually reported, or the window is too short for it. Rewrite it using the vocabulary a journalist would use, not the vocabulary you use internally.',
  },
  {
    id: 'all-stale',
    stage: 'memory',
    severity: 'low',
    test: (q) => q.hits > 0 && q.fresh === 0,
    scope: 'query',
    cause: 'Every result was already collected in a previous week.',
    fix: 'Working as intended if the market is quiet — this is the memory doing its job. If it persists for three runs, the query has exhausted its source and needs broadening.',
  },
  {
    id: 'parse-failure',
    stage: 'extract',
    severity: 'high',
    test: (c) => (c.parseFailures ?? 0) > 0 && c.parseFailures >= (c.batches ?? 0) / 2,
    scope: 'collector',
    cause: 'Most extraction batches failed to return usable JSON.',
    fix: 'This is a model output problem, not a search problem — the fast model is narrating instead of answering. Check NEBIUS_MODEL_FAST: a reasoning-tuned model will think out loud unless told not to. Try a non-reasoning model for extraction, or confirm the repair pass is running.',
  },
  {
    id: 'extraction-collapse',
    stage: 'extract',
    severity: 'high',
    test: (c) => c.fresh >= 5 && c.extracted === 0 && !(c.parseFailures >= (c.batches ?? 0) / 2 && c.parseFailures > 0),
    scope: 'collector',
    cause: 'Plenty of fresh search results, but not one qualified as a signal.',
    fix: 'The signal definition is too narrow or is asking for something unpublishable. Check the signalTypes in the profile: every one must describe a DATED, PUBLISHED EVENT. If any of them requires proving a negative ("companies that lack X"), no search can ever satisfy it.',
  },
  {
    id: 'low-extraction-rate',
    stage: 'extract',
    severity: 'medium',
    test: (c) => c.fresh >= 10 && c.extracted > 0 && c.extracted / c.fresh < 0.15,
    scope: 'collector',
    cause: 'Searches return plenty, but under 15% becomes a signal.',
    fix: 'The queries are finding the right topic but the wrong kind of document — likely commentary and roundups rather than announcements. Add event words (announced, awarded, appointed, signed, filed) to the queries.',
  },
  {
    id: 'qa-wipeout',
    stage: 'verify',
    severity: 'high',
    test: (c) => c.extracted >= 3 && c.kept === 0,
    scope: 'collector',
    cause: 'Signals were extracted, then all of them failed verification.',
    fix: 'These are real events that are not relevant to this business — a target-universe problem, not a search problem. The queries are pointed at the wrong segment of the market. Revisit who this profile is actually selling to.',
  },
  {
    id: 'collector-silent',
    stage: 'collector',
    severity: 'high',
    test: (c) => c.kept === 0 && c.hits > 0,
    scope: 'collector',
    cause: 'This collector contributed nothing to the briefing.',
    fix: 'One silent collector in a run is normal. The same collector silent three runs running means its queries or its signal definition are wrong, not the market.',
  },
  {
    id: 'score-inflation',
    stage: 'verify',
    severity: 'medium',
    test: null, // run-level, see below
    scope: 'run',
    cause: 'More than 70% of verified signals scored 8 or above.',
    fix: 'Known failure mode: inside a narrow topic everything looks maximally relevant. The scores are ranking within the batch rather than measuring real BD value. Tighten the scoring guidance in the profile before trusting this week\'s priorities.',
  },
  {
    id: 'unverified-majority',
    stage: 'verify',
    severity: 'high',
    test: null,
    scope: 'run',
    cause: 'A large share of signals were never judged by the verification pass.',
    fix: 'The verifier returned no verdict for these, so they carry their collector score unchecked — their practice areas, scale and duplicates were never corrected. Usually the verification reply was truncated: lower VERIFY_CHUNK, or raise VERIFY_MAX_TOKENS.',
  },
  {
    id: 'multi-service-inflation',
    stage: 'verify',
    severity: 'high',
    test: null,
    scope: 'run',
    cause: 'Most signals were tagged as opening two or more practice areas.',
    fix: 'A second practice area moves a signal a whole priority band, so this inflates everything downstream. Either the mapping is being padded, or the practice areas in the profile overlap so heavily that most events genuinely implicate several — in which case merge the overlapping ones into a single area rather than loosening the scoring.',
  },
  {
    id: 'band-inflation',
    stage: 'verify',
    severity: 'high',
    test: null,
    scope: 'run',
    cause: 'More than half of this week\'s signals landed in the top priority band.',
    fix: 'A normal week has a handful of top-band signals, not a majority. The usual cause is over-generous practice-area mapping: a second area moves a signal a whole band, so padding that list inflates everything. Check the practice-area discipline in the verifier, and whether organisation scale is being set to "large" by default.',
  },
  {
    id: 'window-leak',
    stage: 'extract',
    severity: 'medium',
    test: null,
    scope: 'run',
    cause: 'A large share of signals are older than the window that was searched for.',
    fix: 'Measured behaviour: the search API honours its date filter at narrow windows and leaks at wide ones — a 90-day request returned items seven months old. Narrow the collector windows (30 days holds reliably) rather than relying on the filter.',
  },
  {
    id: 'undated-heavy',
    stage: 'extract',
    severity: 'medium',
    test: null,
    scope: 'run',
    cause: 'More than 40% of signals carry no published date.',
    fix: 'An undated signal cannot be urgent and cannot be checked against the window. The sources being found are mostly undated pages — prefer news and press-release domains in the queries.',
  },
  {
    id: 'source-concentration',
    stage: 'extract',
    severity: 'low',
    test: null,
    scope: 'run',
    cause: 'Over half of all signals came from a single publisher.',
    fix: 'Coverage is dependent on one outlet. Add queries aimed at the trade press for this sector — vertical publications carry events the general tech press misses entirely.',
  },
  {
    id: 'empty-run',
    stage: 'run',
    severity: 'high',
    test: null,
    scope: 'run',
    cause: 'Nothing survived to the briefing.',
    fix: 'Treat this as a collection failure until proven otherwise. Check the per-query table below: if most queries returned hits, the problem is downstream (signal definition or target universe). If most returned nothing, the problem is the queries themselves.',
  },
];

/**
 * Diagnose a completed run.
 * @param {{collectors:Array, signals:Array, rawCount:number}} run
 * @returns {{findings:Array, funnel:object, queries:Array, healthy:boolean}}
 */
export function diagnose({ collectors = [], signals = [], rawCount = 0 }) {
  const findings = [];
  const add = (rule, where, detail) => findings.push({
    id: rule.id, severity: rule.severity, stage: rule.stage,
    where, cause: rule.cause, fix: rule.fix, detail,
  });

  // ── Per-query and per-collector rules ────────────────────────────────────
  const queries = [];
  for (const c of collectors) {
    for (const q of c.queries ?? []) {
      queries.push({ collector: c.name, ...q });
      for (const rule of RULES.filter((r) => r.scope === 'query')) {
        if (rule.test(q)) add(rule, `${c.name} · "${q.query}"`, `${q.hits} hits, ${q.fresh} fresh`);
      }
    }
    for (const rule of RULES.filter((r) => r.scope === 'collector' && r.test)) {
      if (rule.test(c)) add(rule, c.name, `${c.hits} hits → ${c.fresh} fresh → ${c.extracted} extracted → ${c.kept} kept`);
    }
  }

  // ── Run-level rules ───────────────────────────────────────────────────────
  const byId = Object.fromEntries(RULES.map((r) => [r.id, r]));

  if (signals.length) {
    const high = signals.filter((s) => s.relevance_score >= 8).length;
    if (high / signals.length > 0.7) {
      add(byId['score-inflation'], 'whole run', `${high} of ${signals.length} scored 8+`);
    }
    // Band inflation is measured on the computed priority band, not on the
    // model's own relevance view — the two can disagree, and the band is what
    // the reader acts on.
    const unverified = signals.filter((s) => s.verified === false).length;
    if (unverified / signals.length > 0.25) {
      add(byId['unverified-majority'], 'whole run', `${unverified} of ${signals.length} unjudged`);
    }

    const top = signals.filter((s) => s.priority_band === 'Critical').length;
    if (top / signals.length > 0.5) {
      add(byId['band-inflation'], 'whole run', `${top} of ${signals.length} Critical`);
    }
    const multi = signals.filter((s) => s.multi_service).length;
    if (signals.length >= 10 && multi / signals.length > 0.6) {
      add(byId['multi-service-inflation'], 'practice-area mapping', `${multi} of ${signals.length} tagged multi-service`);
    }

    const stale = signals.filter((s) => s.out_of_window).length;
    if (signals.length >= 10 && stale / signals.length > 0.25) {
      add(byId['window-leak'], 'whole run', `${stale} of ${signals.length} older than the window searched`);
    }

    const undated = signals.filter((s) => !s.date).length;
    if (undated / signals.length > 0.4) {
      add(byId['undated-heavy'], 'whole run', `${undated} of ${signals.length} undated`);
    }
    const domains = {};
    for (const s of signals) {
      const d = hostOf(s.url);
      if (d) domains[d] = (domains[d] ?? 0) + 1;
    }
    const [topDomain, topCount] = Object.entries(domains).sort((a, b) => b[1] - a[1])[0] ?? [];
    if (topCount && topCount / signals.length > 0.5) {
      add(byId['source-concentration'], 'whole run', `${topCount} of ${signals.length} from ${topDomain}`);
    }
  } else {
    add(byId['empty-run'], 'whole run', `${rawCount} raw signals collected, 0 survived`);
  }

  const funnel = {
    searched: queries.length,
    hits: sum(collectors, 'hits'),
    fresh: sum(collectors, 'fresh'),
    extracted: sum(collectors, 'extracted'),
    verified: signals.length,
  };

  // Worst first, so the dashboard shows the thing to fix at the top.
  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    findings,
    funnel,
    queries: queries.sort((a, b) => a.hits - b.hits),
    healthy: !findings.some((f) => f.severity === 'high'),
  };
}

/** Compact console report — shown at the end of every run. */
export function report(d, log) {
  const f = d.funnel;
  log.step(`yield funnel: ${f.searched} searches → ${f.hits} hits → ${f.fresh} fresh → ${f.extracted} extracted → ${f.verified} verified`);

  if (!d.findings.length) { log.ok('yield diagnostics: no issues detected'); return; }

  const high = d.findings.filter((x) => x.severity === 'high').length;
  (high ? log.warn : log.step)(`yield diagnostics: ${d.findings.length} finding${d.findings.length === 1 ? '' : 's'}${high ? ` (${high} needing attention)` : ''}`);

  for (const x of d.findings.slice(0, 6)) {
    const mark = x.severity === 'high' ? '!' : '·';
    log.step(`  ${mark} [${x.where}] ${x.cause}`);
    if (x.severity === 'high') log.step(`      fix: ${x.fix}`);
  }
  if (d.findings.length > 6) log.step(`  … ${d.findings.length - 6} more in the dashboard`);
}

const sum = (rows, key) => rows.reduce((n, r) => n + (r[key] ?? 0), 0);

function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return null; }
}
