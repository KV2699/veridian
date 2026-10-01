// Pipeline orchestrator — runs the seven agents in sequence.
//
// Agents 1-4 collect independently and run concurrently: they hit different
// Tavily queries and never read each other's output, so serialising them would
// only make the demo slower. Agents 5, 6 and 7 are strictly sequential — each
// consumes the previous one's output.
//
// Failure policy: a collector that fails is logged and the pipeline continues
// with the signals the others found. Agents 5, 6 and 7 are load-bearing; if one
// of those fails the run is marked failed and nothing is written to the store.

import { pathToFileURL } from 'node:url';

import { timed, log } from './lib/log.js';
import { knownUrlKeys, saveRun } from './lib/store.js';
import { MODELS } from './lib/nebius.js';

import collectFunding, { config as fundingCfg } from './agents/collector-funding.js';
import collectProduct, { config as productCfg } from './agents/collector-product.js';
import collectCompetitive, { config as competitiveCfg } from './agents/collector-competitive.js';
import collectOpportunity, { config as opportunityCfg } from './agents/collector-opportunity.js';
import qaVerify from './agents/qa-verifier.js';
import writeBriefing from './agents/briefing-writer.js';
import updateDashboard from './agents/dashboard-updater.js';

export const AGENTS = [
  { number: 1, name: fundingCfg.name, kind: 'collector' },
  { number: 2, name: productCfg.name, kind: 'collector' },
  { number: 3, name: competitiveCfg.name, kind: 'collector' },
  { number: 4, name: opportunityCfg.name, kind: 'collector' },
  { number: 5, name: 'QA Verifier', kind: 'nemotron-ultra' },
  { number: 6, name: 'Briefing Writer', kind: 'nemotron-ultra' },
  { number: 7, name: 'Dashboard Updater', kind: 'persistence' },
];

// One run at a time: concurrent runs would double-append to the signal log.
let running = false;
export const isRunning = () => running;

export async function runPipeline({ trigger = 'manual', dryRun = process.env.DRY_RUN === 'true' } = {}) {
  if (running) throw Object.assign(new Error('A pipeline run is already in progress'), { code: 'BUSY' });
  running = true;

  const started = Date.now();
  const { week, weekLabel } = isoWeek();
  const statuses = [];

  log.banner(`SIGNAL BUREAU — week ${week} · trigger: ${trigger}${dryRun ? ' · DRY RUN' : ''}`);
  log.step(`Nemotron ULTRA: ${MODELS.ultra}`);
  log.step(`Nemotron FAST:  ${MODELS.fast}`);

  try {
    if (dryRun) return await dryRunPipeline({ week, weekLabel, started, statuses, trigger });

    const ctx = { knownUrlKeys: await knownUrlKeys() };
    log.step(`${ctx.knownUrlKeys.size} URLs already in the signal log will be excluded`);

    // ── Agents 1-4 ───────────────────────────────────────────────────────────
    const collectors = await Promise.all([
      timed(1, fundingCfg.name, () => collectFunding(ctx)),
      timed(2, productCfg.name, () => collectProduct(ctx)),
      timed(3, competitiveCfg.name, () => collectCompetitive(ctx)),
      timed(4, opportunityCfg.name, () => collectOpportunity(ctx)),
    ]);
    statuses.push(...collectors.map(toStatus));

    const signals = collectors.flatMap((c) => c.signals ?? []);
    const failedCollectors = collectors.filter((c) => c.status === 'error');
    if (failedCollectors.length === 4) throw new Error('all four collectors failed — check NEBIUS_API_KEY and TAVILY_API_KEY');
    if (failedCollectors.length) log.warn(`${failedCollectors.length} of 4 collectors failed; continuing with ${signals.length} signals`);
    log.ok(`collection complete — ${signals.length} raw signals from ${collectors.length - failedCollectors.length} collectors`);

    // ── Agent 5 ──────────────────────────────────────────────────────────────
    const qa = await timed(5, 'QA Verifier', () => qaVerify({ signals }));
    statuses.push(toStatus(qa));
    if (qa.status === 'error') throw new Error(`QA verification failed — ${qa.error}`);

    // ── Agent 6 ──────────────────────────────────────────────────────────────
    const briefing = await timed(6, 'Briefing Writer', () => writeBriefing({
      signals: qa.signals, connections: qa.connections, assessment: qa.assessment, week, weekLabel,
    }));
    statuses.push(toStatus(briefing));
    if (briefing.status === 'error') throw new Error(`Briefing writing failed — ${briefing.error}`);

    // ── Agent 7 ──────────────────────────────────────────────────────────────
    const saved = await timed(7, 'Dashboard Updater', () => updateDashboard({
      week, weekLabel,
      markdown: briefing.markdown,
      signals: qa.signals,
      connections: qa.connections,
      counts: briefing.counts,
      assessment: qa.assessment,
      qaStats: qa.stats,
      models: { ultra: MODELS.ultra, fast: MODELS.fast },
    }));
    statuses.push(toStatus(saved));
    if (saved.status === 'error') throw new Error(`Dashboard update failed — ${saved.error}`);

    const ms = Date.now() - started;
    log.total(ms);

    const run = {
      week, week_label: weekLabel, trigger, status: 'success',
      started_at: new Date(started).toISOString(), duration_ms: ms,
      signal_count: qa.signals.length, raw_count: signals.length,
      counts: briefing.counts, agents: statuses,
      models: { ultra: MODELS.ultra, fast: MODELS.fast },
    };
    await saveRun(run);
    return { ...run, markdown: briefing.markdown };
  } catch (err) {
    const ms = Date.now() - started;
    log.error(`pipeline failed after ${(ms / 1000).toFixed(1)}s — ${err.message}`);
    const run = {
      week, week_label: weekLabel, trigger, status: 'error', error: err.message,
      started_at: new Date(started).toISOString(), duration_ms: ms, agents: statuses,
    };
    await saveRun(run).catch(() => {});
    throw err;
  } finally {
    running = false;
  }
}

// Fixture run: exercises Agents 5-7 wiring and the dashboard end to end with
// zero API calls, so the UI can be demonstrated before keys are in place.
async function dryRunPipeline({ week, weekLabel, started, statuses, trigger }) {
  const { FIXTURE_SIGNALS } = await import('./lib/fixtures.js');
  log.warn('DRY RUN — using fixture signals, no Nebius or Tavily calls will be made');

  for (const [i, cfg] of [fundingCfg, productCfg, competitiveCfg, opportunityCfg].entries()) {
    const signals = FIXTURE_SIGNALS.filter((s) => s.category === cfg.category);
    statuses.push(toStatus(await timed(i + 1, cfg.name, async () => {
      log.step('dry run — skipping Tavily and Nemotron');
      return { signals, summary: `${signals.length} fixture signals` };
    })));
  }

  const signals = FIXTURE_SIGNALS.map((s, i) => ({ ...s, id: `S${i + 1}`, verified: true, needs_review: false }));
  const connections = [{ observation: 'Fixture connection — dry run only.', signal_ids: ['S1', 'S2'] }];
  const counts = Object.fromEntries(['funding', 'product', 'competitive', 'opportunity']
    .map((k) => [k, signals.filter((s) => s.category === k).length]));

  statuses.push(toStatus(await timed(5, 'QA Verifier', async () => {
    log.step('dry run — skipping Nemotron Ultra verification');
    return { summary: `${signals.length} fixture signals passed through` };
  })));

  const markdown = [
    `# Signal Bureau — Week of ${weekLabel}`, '',
    '## This Week\'s Headline',
    'Dry run: this briefing was generated from fixtures without calling Nebius or Tavily.', '',
    ...['funding:Funding & Investment', 'product:Product & Platform', 'competitive:Competitive Moves', 'opportunity:BD Opportunities']
      .flatMap((pair) => {
        const [key, heading] = pair.split(':');
        const rows = signals.filter((s) => s.category === key);
        return [`## ${heading} (${rows.length} signals)`, ...rows.map((s) => `- ${s.summary} [source](${s.url})`), ''];
      }),
    '## Connections Worth Noting', '- Dry run — no synthesis performed.', '',
    '## Recommended Actions This Week',
    '1. Add NEBIUS_API_KEY and TAVILY_API_KEY to `.env`.',
    '2. Run `npm run models` to confirm the Nemotron model IDs.',
    '3. Re-run the pipeline with `DRY_RUN=false`.', '',
  ].join('\n');

  statuses.push(toStatus(await timed(6, 'Briefing Writer', async () => {
    log.step('dry run — skipping Nemotron Ultra synthesis');
    return { summary: 'fixture briefing' };
  })));

  statuses.push(toStatus(await timed(7, 'Dashboard Updater', () => updateDashboard({
    week, weekLabel, markdown, signals, connections, counts,
    assessment: 'Dry run — no verification performed.',
    qaStats: { input: signals.length, unique: signals.length, kept: signals.length, duplicates: 0, dropped: 0, flagged: 0 },
    models: { ultra: 'dry-run', fast: 'dry-run' },
  }))));

  const ms = Date.now() - started;
  log.total(ms);
  const run = {
    week, week_label: weekLabel, trigger, status: 'success', dry_run: true,
    started_at: new Date(started).toISOString(), duration_ms: ms,
    signal_count: signals.length, raw_count: signals.length, counts, agents: statuses,
    models: { ultra: 'dry-run', fast: 'dry-run' },
  };
  await saveRun(run);
  return { ...run, markdown };
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

// Allow `npm run pipeline` to run the whole thing from the command line.
// pathToFileURL (not string concatenation) — the project path may contain
// spaces or other characters that need percent-encoding to match import.meta.url.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await import('dotenv/config');
  try { await runPipeline({ trigger: 'cli' }); process.exit(0); }
  catch { process.exit(1); }
}
