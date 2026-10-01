// AGENT 7 — Dashboard Updater
//
// Persistence and trend state. No model calls: this agent's job is to make the
// run durable and comparable to previous weeks, so the system accumulates value
// rather than producing a disposable document every Monday.

import { saveBriefing, appendSignals, getBriefings, getSignals } from '../lib/store.js';
import { log } from '../lib/log.js';

export default async function updateDashboard({ week, weekLabel, markdown, signals, connections, counts, assessment, qaStats, models }) {
  // Trend compares against the most recent DIFFERENT week. Re-running the same
  // week replaces its briefing, so without the week filter a re-run would
  // report a delta against itself and always read "+0".
  const previous = (await getBriefings()).find((b) => b.week !== week) ?? null;

  const briefing = {
    week,
    week_label: weekLabel,
    generated_at: new Date().toISOString(),
    markdown,
    counts,
    signal_count: signals.length,
    flagged_count: signals.filter((s) => s.needs_review).length,
    top_signals: signals.slice(0, 5).map(({ company, signal_type, summary, url, date, relevance_score, category }) =>
      ({ company, signal_type, summary, url, date, relevance_score, category })),
    connections,
    assessment,
    qa_stats: qaStats,
    models,
    trend: previous
      ? {
          previous_week: previous.week,
          previous_count: previous.signal_count ?? 0,
          delta: signals.length - (previous.signal_count ?? 0),
        }
      : null,
  };

  const totalBriefings = await saveBriefing(briefing);
  log.ok(`briefings.json — ${totalBriefings} briefing${totalBriefings === 1 ? '' : 's'} stored (week ${week})`);

  const { added, skipped, total } = await appendSignals(signals);
  log.ok(`signal_log.json — ${added} new signals appended, ${skipped} already logged, ${total} total all-time`);

  if (briefing.trend) {
    const { delta, previous_week } = briefing.trend;
    const dir = delta > 0 ? `up ${delta}` : delta < 0 ? `down ${Math.abs(delta)}` : 'unchanged';
    log.step(`trend vs ${previous_week}: ${dir}`);
  }

  // The dashboard is a static page that reads the API, so there is no HTML to
  // regenerate here — confirming it can see the new data is the useful check.
  const allTime = (await getSignals()).length;

  return {
    week,
    briefings: totalBriefings,
    signals_all_time: allTime,
    summary: `${totalBriefings} briefings, ${allTime} signals all-time`,
  };
}
