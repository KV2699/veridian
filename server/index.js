// Express server: static dashboard, JSON API, and the Monday 07:00 UTC scheduler.

import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPipeline, isRunning, AGENTS, isoWeek } from './pipeline.js';
import { getBriefings, getSignals, getRuns } from './lib/store.js';
import { MODELS, listModels } from './lib/nebius.js';
import { log } from './lib/log.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 7 * * 1';

const app = express();
app.use(express.json());
app.use(express.static(join(ROOT, 'public')));

const fail = (res, err) => {
  console.error(err);
  res.status(err.code === 'BUSY' ? 409 : 500).json({ ok: false, error: err.message });
};

// ── Pipeline ─────────────────────────────────────────────────────────────────
// Returns immediately with 202 and runs in the background, so the dashboard
// can poll agent status live rather than hanging on a multi-minute request.
app.post('/api/run', (req, res) => {
  if (isRunning()) return res.status(409).json({ ok: false, error: 'A pipeline run is already in progress' });
  const dryRun = req.body?.dryRun === true || process.env.DRY_RUN === 'true';

  runPipeline({ trigger: 'dashboard', dryRun })
    .catch((err) => log.error(`background run failed — ${err.message}`));

  res.status(202).json({ ok: true, started: true, dryRun, agents: AGENTS, week: isoWeek().week });
});

app.get('/api/briefings', async (_req, res) => {
  try {
    res.json({ ok: true, briefings: await getBriefings() });
  } catch (err) { fail(res, err); }
});

app.get('/api/briefings/:week', async (req, res) => {
  try {
    const briefing = (await getBriefings()).find((b) => b.week === req.params.week);
    if (!briefing) return res.status(404).json({ ok: false, error: `No briefing for week ${req.params.week}` });
    res.json({ ok: true, briefing });
  } catch (err) { fail(res, err); }
});

app.get('/api/signals', async (req, res) => {
  try {
    const all = await getSignals();
    const { category, week, limit } = req.query;
    let signals = all;
    if (category) signals = signals.filter((s) => s.category === category);
    if (week) signals = signals.filter((s) => (s.collected_at ?? '').startsWith(String(week)));
    if (limit) signals = signals.slice(-Number(limit));
    res.json({ ok: true, total: all.length, returned: signals.length, signals });
  } catch (err) { fail(res, err); }
});

app.get('/api/runs', async (_req, res) => {
  try {
    res.json({ ok: true, running: isRunning(), runs: await getRuns() });
  } catch (err) { fail(res, err); }
});

// Status feed for the dashboard's agent panel.
app.get('/api/status', async (_req, res) => {
  try {
    const [runs, briefings, signals] = await Promise.all([getRuns(), getBriefings(), getSignals()]);
    const last = runs[0] ?? null;
    res.json({
      ok: true,
      running: isRunning(),
      current_week: isoWeek().week,
      last_run: last && {
        week: last.week, status: last.status, trigger: last.trigger, dry_run: Boolean(last.dry_run),
        started_at: last.started_at, duration_ms: last.duration_ms,
        signal_count: last.signal_count ?? 0, error: last.error ?? null,
      },
      agents: AGENTS.map((a) => {
        const s = last?.agents?.find((x) => x.index === a.number);
        return { ...a, status: isRunning() ? 'running' : s?.status ?? 'idle', duration_ms: s?.duration_ms ?? null, detail: s?.detail ?? null, error: s?.error ?? null };
      }),
      totals: { briefings: briefings.length, signals: signals.length },
      models: { ultra: MODELS.ultra, fast: MODELS.fast },
      schedule: { cron: CRON_SCHEDULE, enabled: process.env.CRON_ENABLED !== 'false' },
    });
  } catch (err) { fail(res, err); }
});

// Verifies the configured Nemotron IDs against what the account actually serves.
app.get('/api/models', async (_req, res) => {
  try {
    const available = await listModels();
    res.json({
      ok: true,
      configured: { ultra: MODELS.ultra, fast: MODELS.fast },
      valid: { ultra: available.includes(MODELS.ultra), fast: available.includes(MODELS.fast) },
      nvidia_models: available.filter((id) => /nvidia|nemotron/i.test(id)),
      total_available: available.length,
    });
  } catch (err) { fail(res, err); }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    uptime_s: Math.round(process.uptime()),
    running: isRunning(),
    week: isoWeek().week,
    config: {
      nebius_key: Boolean(process.env.NEBIUS_API_KEY),
      tavily_key: Boolean(process.env.TAVILY_API_KEY),
      dry_run: process.env.DRY_RUN === 'true',
      models: { ultra: MODELS.ultra, fast: MODELS.fast },
    },
  });
});

// ── Scheduler ────────────────────────────────────────────────────────────────
if (process.env.CRON_ENABLED !== 'false') {
  if (!cron.validate(CRON_SCHEDULE)) {
    log.error(`CRON_SCHEDULE "${CRON_SCHEDULE}" is not a valid cron expression — scheduler not started`);
  } else {
    cron.schedule(CRON_SCHEDULE, () => {
      log.banner('SCHEDULED RUN');
      runPipeline({ trigger: 'cron' }).catch((err) => log.error(`scheduled run failed — ${err.message}`));
    }, { timezone: 'UTC' });
    log.ok(`scheduler armed — "${CRON_SCHEDULE}" UTC (default: Mondays 07:00)`);
  }
} else {
  log.warn('scheduler disabled (CRON_ENABLED=false)');
}

app.listen(PORT, () => {
  log.banner('SIGNAL BUREAU');
  log.ok(`dashboard  http://localhost:${PORT}`);
  log.step(`ULTRA ${MODELS.ultra}`);
  log.step(`FAST  ${MODELS.fast}`);
  if (!process.env.NEBIUS_API_KEY) log.warn('NEBIUS_API_KEY not set — pipeline runs will fail (use DRY_RUN=true to demo the UI)');
  if (!process.env.TAVILY_API_KEY) log.warn('TAVILY_API_KEY not set — collectors will fail');
});
