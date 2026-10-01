// Pipeline orchestrator — runs the eight agents in sequence.
//
// Agents 1-5 collect independently and run concurrently: four discovery
// collectors plus Account Watch. They share no state. Agents 6, 7 and 8 are
// strictly sequential — each consumes the previous one's output.
//
// What the pipeline actually does is read a PROFILE: which collectors exist,
// what they search for, which way each signal points, and which accounts are
// already held. Changing target market means changing the profile, not the
// pipeline.
//
// Failure policy: a collector that fails is logged and the run continues with
// what the others found. Agents 6, 7 and 8 are load-bearing; if one fails the
// run is marked failed and nothing is written to the store.

import { pathToFileURL } from 'node:url';

import { timed, log } from './lib/log.js';
import { knownUrlKeys, saveRun } from './lib/store.js';
import { MODELS } from './lib/nebius.js';
import { diagnose, report } from './lib/diagnostics.js';
import { loadProfile } from './profiles/index.js';

import { runCollector } from './agents/collector-base.js';
import accountWatch from './agents/account-watch.js';
import qaVerify from './agents/qa-verifier.js';
import writeBriefing from './agents/briefing-writer.js';
import updateDashboard from './agents/dashboard-updater.js';

/** The agent roster for a profile — drives the dashboard status panel. */
export function agentList(profile = loadProfile()) {
  const collectors = profile.collectors.map((c, i) => ({ number: i + 1, name: c.name, kind: 'collector' }));
  const n = collectors.length;
  return [
    ...collectors,
    { number: n + 1, name: 'Account Watch', kind: 'collector' },
    { number: n + 2, name: 'QA Verifier', kind: 'nemotron-ultra' },
    { number: n + 3, name: 'Briefing Writer', kind: 'nemotron-ultra' },
    { number: n + 4, name: 'Dashboard Updater', kind: 'persistence' },
  ];
}

// One run at a time: concurrent runs would double-append to the signal log.
let running = false;
export const isRunning = () => running;

export async function runPipeline({ trigger = 'manual', dryRun = process.env.DRY_RUN === 'true', profileKey } = {}) {
  if (running) throw Object.assign(new Error('A pipeline run is already in progress'), { code: 'BUSY' });
  running = true;

  const started = Date.now();
  const profile = loadProfile(profileKey);
  const agents = agentList(profile);
  const total = agents.length;
  const { week, weekLabel } = isoWeek();
  const statuses = [];

  log.banner(`SIGNAL BUREAU — ${profile.name} · week ${week} · ${trigger}${dryRun ? ' · DRY RUN' : ''}`);
  log.step(`profile: ${profile.key} — ${profile.collectors.length} collectors, ${profile.roster?.length ?? 0} accounts watched`);
  log.step(`Nemotron ULTRA: ${MODELS.ultra}`);
  log.step(`Nemotron FAST:  ${MODELS.fast}`);

  try {
    if (dryRun) return await dryRunPipeline({ profile, agents, week, weekLabel, started, statuses, trigger });

    const ctx = { knownUrlKeys: await knownUrlKeys() };
    log.step(`${ctx.knownUrlKeys.size} URLs already in the signal log will be excluded`);

    // ── Agents 1-N: discovery collectors + Account Watch, concurrently ──────
    const collectorRuns = await Promise.all([
      ...profile.collectors.map((cfg, i) =>
        timed(i + 1, cfg.name, () => runCollector({ ...cfg, category: cfg.key, polarity: profile.polarity }, ctx), total)),
      timed(profile.collectors.length + 1, 'Account Watch', () => accountWatch({ profile }, ctx), total),
    ]);
    statuses.push(...collectorRuns.map(toStatus));

    const signals = collectorRuns.flatMap((c) => c.signals ?? []);
    const telemetry = collectorRuns.map((c) => c.telemetry).filter(Boolean);
    const failed = collectorRuns.filter((c) => c.status === 'error');
    if (failed.length === collectorRuns.length) throw new Error('every collector failed — check NEBIUS_API_KEY and TAVILY_API_KEY');
    if (failed.length) log.warn(`${failed.length} of ${collectorRuns.length} collectors failed; continuing with ${signals.length} signals`);
    log.ok(`collection complete — ${signals.length} raw signals`);

    // ── QA Verifier ─────────────────────────────────────────────────────────
    const qa = await timed(total - 2, 'QA Verifier', () => qaVerify({ signals, profile }), total);
    statuses.push(toStatus(qa));
    if (qa.status === 'error') throw new Error(`QA verification failed — ${qa.error}`);

    // ── Yield diagnostics ───────────────────────────────────────────────────
    // Runs after verification so it can see the whole funnel, and before the
    // briefing so a bad week is labelled as a bad week rather than presented
    // as a quiet market.
    for (const t of telemetry) t.kept = qa.signals.filter((s) => s.category === t.key).length;
    const diagnostics = diagnose({ collectors: telemetry, signals: qa.signals, rawCount: signals.length });
    report(diagnostics, log);

    // ── Briefing Writer ─────────────────────────────────────────────────────
    const briefing = await timed(total - 1, 'Briefing Writer', () => writeBriefing({
      signals: qa.signals, connections: qa.connections, assessment: qa.assessment,
      week, weekLabel, profile, diagnostics,
    }), total);
    statuses.push(toStatus(briefing));
    if (briefing.status === 'error') throw new Error(`Briefing writing failed — ${briefing.error}`);

    // ── Dashboard Updater ───────────────────────────────────────────────────
    const saved = await timed(total, 'Dashboard Updater', () => updateDashboard({
      week, weekLabel, markdown: briefing.markdown, signals: qa.signals,
      connections: qa.connections, counts: briefing.counts, assessment: qa.assessment,
      qaStats: qa.stats, diagnostics, profile: { key: profile.key, name: profile.name },
      models: { ultra: MODELS.ultra, fast: MODELS.fast },
    }), total);
    statuses.push(toStatus(saved));
    if (saved.status === 'error') throw new Error(`Dashboard update failed — ${saved.error}`);

    const ms = Date.now() - started;
    log.total(ms);

    const run = {
      week, week_label: weekLabel, trigger, status: 'success',
      profile: profile.key,
      started_at: new Date(started).toISOString(), duration_ms: ms,
      signal_count: qa.signals.length, raw_count: signals.length,
      counts: briefing.counts, agents: statuses, diagnostics,
      models: { ultra: MODELS.ultra, fast: MODELS.fast },
    };
    await saveRun(run);
    return { ...run, markdown: briefing.markdown };
  } catch (err) {
    const ms = Date.now() - started;
    log.error(`pipeline failed after ${(ms / 1000).toFixed(1)}s — ${err.message}`);
    const run = {
      week, week_label: weekLabel, trigger, status: 'error', error: err.message,
      profile: profile.key,
      started_at: new Date(started).toISOString(), duration_ms: ms, agents: statuses,
    };
    await saveRun(run).catch(() => {});
    throw err;
  } finally {
    running = false;
  }
}

// Fixture run: exercises the full agent sequence and the dashboard with zero
// API calls, so the UI can be demonstrated before keys are in place.
async function dryRunPipeline({ profile, agents, week, weekLabel, started, statuses, trigger }) {
  const { fixtureSignals } = await import('./lib/fixtures.js');
  log.warn('DRY RUN — using fixture signals, no Nebius or Tavily calls will be made');

  const signals = fixtureSignals(profile);
  const total = agents.length;

  for (const [i, cfg] of profile.collectors.entries()) {
    const mine = signals.filter((s) => s.category === cfg.key);
    statuses.push(toStatus(await timed(i + 1, cfg.name, async () => {
      log.step('dry run — skipping Tavily and Nemotron');
      return { summary: `${mine.length} fixture signals` };
    }, total)));
  }
  statuses.push(toStatus(await timed(profile.collectors.length + 1, 'Account Watch', async () => {
    log.step('dry run — skipping Tavily and Nemotron');
    return { summary: `${signals.filter((s) => s.category === 'account').length} fixture signals` };
  }, total)));
  statuses.push(toStatus(await timed(total - 2, 'QA Verifier', async () => {
    log.step('dry run — skipping Nemotron Ultra verification');
    return { summary: `${signals.length} fixture signals passed through` };
  }, total)));

  const counts = countsFor(signals, profile);
  const markdown = fixtureBriefing({ weekLabel, signals, profile });
  statuses.push(toStatus(await timed(total - 1, 'Briefing Writer', async () => {
    log.step('dry run — skipping Nemotron Ultra synthesis');
    return { summary: 'fixture briefing' };
  }, total)));

  const diagnostics = diagnose({ collectors: [], signals, rawCount: signals.length });
  report(diagnostics, log);
  statuses.push(toStatus(await timed(total, 'Dashboard Updater', () => updateDashboard({
    week, weekLabel, markdown, signals, connections: [], counts,
    assessment: 'Dry run — no verification performed.',
    qaStats: { input: signals.length, unique: signals.length, kept: signals.length, duplicates: 0, dropped: 0, flagged: 0 },
    diagnostics, profile: { key: profile.key, name: profile.name },
    models: { ultra: 'dry-run', fast: 'dry-run' },
  }), total)));

  const ms = Date.now() - started;
  log.total(ms);
  const run = {
    week, week_label: weekLabel, trigger, status: 'success', dry_run: true, profile: profile.key,
    started_at: new Date(started).toISOString(), duration_ms: ms,
    signal_count: signals.length, raw_count: signals.length, counts, agents: statuses, diagnostics,
    models: { ultra: 'dry-run', fast: 'dry-run' },
  };
  await saveRun(run);
  return { ...run, markdown };
}

export function countsFor(signals, profile) {
  const counts = Object.fromEntries(profile.collectors.map((c) => [c.key, 0]));
  counts.account = 0;
  for (const s of signals) if (s.category in counts) counts[s.category]++;
  return counts;
}

function fixtureBriefing({ weekLabel, signals, profile }) {
  const section = (title, rows) => [`## ${title} (${rows.length} signals)`,
    ...(rows.length ? rows.map((s) => `- ${s.summary} [source](${s.url})`) : ['No signals this week.']), ''];
  return [
    `# Signal Bureau — Week of ${weekLabel}`, '',
    "## This Week's Headline",
    'Dry run: this briefing was generated from fixtures without calling Nebius or Tavily.', '',
    ...section('Your Accounts', signals.filter((s) => s.category === 'account')),
    ...profile.collectors.flatMap((c) => section(c.name.replace(/ Collector$/, ''), signals.filter((s) => s.category === c.key))),
    '## Connections Worth Noting', '- Dry run — no synthesis performed.', '',
    '## Recommended Actions This Week',
    '1. Add NEBIUS_API_KEY and TAVILY_API_KEY to `.env`.',
    '2. Run `npm run models` to confirm the Nemotron model IDs.',
    '3. Re-run the pipeline with `DRY_RUN=false`.', '',
  ].join('\n');
}

const toStatus = ({ agent, index, status, ms, error, summary }) =>
  ({ agent, index, status, duration_ms: ms, ...(error ? { error } : {}), ...(summary ? { detail: summary } : {}) });

/** ISO week key (2026-W40) plus a human label for the briefing title. */
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day + 1);
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const num = Math.ceil(((thursday - jan1) / 864e5 + 1) / 7);
  return {
    week: `${thursday.getUTCFullYear()}-W${String(num).padStart(2, '0')}`,
    weekLabel: monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };
}

// pathToFileURL (not string concatenation) — the project path may contain
// spaces or other characters that need percent-encoding to match import.meta.url.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await import('dotenv/config');
  try { await runPipeline({ trigger: 'cli' }); process.exit(0); }
  catch { process.exit(1); }
}
