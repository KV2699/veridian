// Express server: static dashboard, JSON API, and the Monday 07:00 UTC scheduler.

import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPipeline, isRunning, agentList, isoWeek } from './pipeline.js';
import { loadProfile, listProfiles, profileKeys, DEFAULT_PROFILE } from './profiles/index.js';
import { listRegister, registerStats } from './lib/register.js';
import ask from './agents/analyst.js';
import { getBriefings, getSignals, getRuns, getRejections } from './lib/store.js';
import { MODELS, listModels } from './lib/nebius.js';
import { log } from './lib/log.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 7 * * 1';

const app = express();
app.use(express.json());
app.use(express.static(join(ROOT, 'public')));

// Which configuration a request is about.
//
// Every read route is scoped to one profile, because each profile has its own
// register, signal log and briefings — see store.js. An unknown key is a 400,
// not a silent fallback to the default: answering a question about the wrong
// business is worse than refusing it.
function profileOf(req) {
  const asked = String(req.query?.profile ?? req.body?.profile ?? '').trim();
  if (!asked) return DEFAULT_PROFILE;
  if (!profileKeys().includes(asked)) {
    const err = new Error(`Unknown profile "${asked}" — available: ${profileKeys().join(', ')}`);
    err.code = 'BAD_PROFILE';
    throw err;
  }
  return asked;
}

const fail = (res, err) => {
  console.error(err);
  const status = ['BUSY', 'LOCKED'].includes(err.code) ? 409 : err.code === 'BAD_PROFILE' ? 400 : 500;
  res.status(status).json({ ok: false, error: err.message });
};

// ── Pipeline ─────────────────────────────────────────────────────────────────
// Returns immediately with 202 and runs in the background, so the dashboard
// can poll agent status live rather than hanging on a multi-minute request.
app.post('/api/run', (req, res) => {
  if (isRunning()) return res.status(409).json({ ok: false, error: 'A pipeline run is already in progress' });
  const dryRun = req.body?.dryRun === true || process.env.DRY_RUN === 'true';
  let profileKey;
  try { profileKey = profileOf(req); } catch (err) { return fail(res, err); }
  const profile = loadProfile(profileKey);

  runPipeline({ trigger: 'dashboard', dryRun, profileKey })
    .catch((err) => log.error(`background run failed — ${err.message}`));

  res.status(202).json({
    ok: true, started: true, dryRun, profile: profileKey,
    agents: agentList(profile), week: isoWeek().week,
  });
});

app.get('/api/briefings', async (req, res) => {
  try {
    const profile = profileOf(req);
    res.json({ ok: true, profile, briefings: await getBriefings(profile) });
  } catch (err) { fail(res, err); }
});

app.get('/api/briefings/:week', async (req, res) => {
  try {
    const briefing = (await getBriefings(profileOf(req))).find((b) => b.week === req.params.week);
    if (!briefing) return res.status(404).json({ ok: false, error: `No briefing for week ${req.params.week}` });
    res.json({ ok: true, briefing });
  } catch (err) { fail(res, err); }
});

app.get('/api/signals', async (req, res) => {
  try {
    const profile = profileOf(req);
    const all = await getSignals(profile);
    const { category, week, limit } = req.query;
    let signals = all;
    if (category) signals = signals.filter((s) => s.category === category);
    if (week) signals = signals.filter((s) => (s.collected_at ?? '').startsWith(String(week)));
    if (limit) signals = signals.slice(-Number(limit));
    res.json({ ok: true, profile, total: all.length, returned: signals.length, signals });
  } catch (err) { fail(res, err); }
});

app.get('/api/runs', async (req, res) => {
  try {
    const profile = profileOf(req);
    res.json({ ok: true, profile, running: isRunning(), runs: await getRuns(profile) });
  } catch (err) { fail(res, err); }
});

// Status feed for the dashboard's agent panel.
app.get('/api/status', async (req, res) => {
  try {
    const profileKey = profileOf(req);
    const active = loadProfile(profileKey);
    const [runs, briefings, signals] = await Promise.all([
      getRuns(profileKey), getBriefings(profileKey), getSignals(profileKey),
    ]);
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
      agents: agentList(active).map((a) => {
        const s = last?.agents?.find((x) => x.index === a.number);
        return { ...a, status: isRunning() ? 'running' : s?.status ?? 'idle', duration_ms: s?.duration_ms ?? null, detail: s?.detail ?? null, error: s?.error ?? null };
      }),
      totals: { briefings: briefings.length, signals: signals.length, organisations: (await registerStats(profileKey)).total },
      profile: {
        key: active.key, name: active.name, market: active.market ?? null,
        accounts: active.roster?.length ?? 0,
        value_factor: active.scoring?.valueFactor?.name ?? 'Multi-Service Potential',
        // Lets the dashboard offer an example question that means something
        // in THIS market rather than the one it was first written for.
        first_practice_area: active.practiceAreas?.[0]?.key ?? null,
      },
      profiles: listProfiles(),
      diagnostics: last?.diagnostics ?? null,
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

// A key that is still the .env.example placeholder is worse than a missing one:
// it reports as configured and fails later as a confusing 401.
const keySet = (name) => {
  const v = (process.env[name] ?? '').trim();
  if (!v) return 'missing';
  if (/^your_|_key$|^<.*>$|changeme/i.test(v)) return 'placeholder';
  return 'set';
};

// What this deployment is configured to sell, and to whom. The profile is the
// strategy — exposing it makes the configuration auditable from outside.
app.get('/api/profiles', (req, res) => {
  try {
    const active = loadProfile(profileOf(req));
    res.json({ ok: true, active: active.key, default: DEFAULT_PROFILE, profiles: listProfiles(), detail: {
      key: active.key, name: active.name, description: active.description,
      market: active.market ?? null, reader: active.reader ?? null,
      polarity: active.polarity, roster: active.roster, exclusions: active.exclusions,
      practice_areas: active.practiceAreas,
      collectors: active.collectors.map(({ key, name, focus, queries, windowDays }) =>
        ({ key, name, focus, queries, windowDays })),
      scoring: active.scoring,
    } });
  } catch (err) { fail(res, err); }
});

// Ask the register a question in plain English. Retrieval happens in code;
// Nemotron translates the question and narrates the rows it is handed, so an
// answer can always be traced to the records behind it.
app.post('/api/ask', async (req, res) => {
  const question = String(req.body?.question ?? '').trim();
  if (!question) return res.status(400).json({ ok: false, error: 'Ask a question.' });
  if (question.length > 500) return res.status(400).json({ ok: false, error: 'Question is too long.' });
  try {
    const profile = profileOf(req);
    const result = await ask(question, { profile });
    res.json({ ok: true, profile, question, ...result });
  } catch (err) { fail(res, err); }
});

// The prospect list the system has built for itself — deduplicated
// organisations, accumulating week by week.
app.get('/api/organisations', async (req, res) => {
  try {
    const profile = profileOf(req);
    const { status, band, minScore, limit } = req.query;
    const [rows, stats] = await Promise.all([
      listRegister({ status, band, minScore: Number(minScore) || 0, limit, profile }),
      registerStats(profile),
    ]);
    res.json({ ok: true, profile, stats, count: rows.length, organisations: rows });
  } catch (err) { fail(res, err); }
});

// Everything with a stated closing date, soonest first.
app.get('/api/deadlines', async (req, res) => {
  try {
    const profile = profileOf(req);
    const today = new Date().toISOString().slice(0, 10);
    const all = (await getSignals(profile)).filter((s) => s.deadline && s.deadline >= today);
    const seen = new Set();
    const rows = all
      .filter((s) => !seen.has(s.url_key) && seen.add(s.url_key))
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .map(({ company, deadline, summary, url, contract_value, contract_currency, priority_band }) =>
        ({ company, deadline, summary, url, value: contract_value, currency: contract_currency, band: priority_band,
          days_left: Math.ceil((new Date(deadline) - new Date(today)) / 864e5) }));
    res.json({ ok: true, profile, count: rows.length, deadlines: rows });
  } catch (err) { fail(res, err); }
});

// The rejection log — what the pipeline threw away, and why.
//
// Exposed deliberately. A BD tool that only shows what it found cannot be
// audited: the interesting question is always what it discarded and whether it
// was right to. Reason codes separate a SUPPRESSION (correctly dropped) from a
// DEFECT REPORT (dropped because a rule is wrong), because the second kind is
// how the system improves.
app.get('/api/rejections', async (req, res) => {
  try {
    const profile = profileOf(req);
    const { code, limit } = req.query;
    const all = await getRejections(profile);
    const rows = (code ? all.filter((r) => r.reason_code === String(code).toUpperCase()) : all)
      .slice(0, Number(limit) || 200);
    const byCode = all.reduce((a, r) => { a[r.reason_code ?? 'UNKNOWN'] = (a[r.reason_code ?? 'UNKNOWN'] ?? 0) + 1; return a; }, {});
    res.json({ ok: true, profile, total: all.length, by_code: byCode, count: rows.length, rejections: rows });
  } catch (err) { fail(res, err); }
});

// The yield diagnosis for the most recent run: where signals were lost, and
// the named cause of each collapse.
app.get('/api/diagnostics', async (req, res) => {
  try {
    const profile = profileOf(req);
    const last = (await getRuns(profile))[0];
    if (!last) return res.status(404).json({ ok: false, error: 'No runs yet' });
    res.json({ ok: true, profile, week: last.week, status: last.status, diagnostics: last.diagnostics ?? null });
  } catch (err) { fail(res, err); }
});

app.get('/api/health', (_req, res) => {
  const nebius = keySet('NEBIUS_API_KEY');
  const tavily = keySet('TAVILY_API_KEY');
  res.json({
    ok: true,
    status: nebius === 'set' && tavily === 'set' ? 'healthy' : 'not configured',
    uptime_s: Math.round(process.uptime()),
    running: isRunning(),
    week: isoWeek().week,
    config: {
      nebius_key: nebius,
      tavily_key: tavily,
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
