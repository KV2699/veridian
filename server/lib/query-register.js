// THE QUERY ENGINE — deterministic retrieval over the register and signal log.
//
// This is the half of the assistant that must never guess. A model translates
// the question into a filter spec and narrates the result, but the selecting,
// sorting and counting all happen here, in code.
//
// The reason is the same one that drove the scoring: a model asked to pick "the
// top 5" from 169 records will produce five plausible names, and some of them
// will be wrong in ways nobody notices. Code cannot do that. So the model's job
// is to understand the question, and this file's job is to answer it.
//
// Every field below is validated. A filter the spec does not define is dropped
// rather than guessed at, so a hallucinated filter narrows nothing and the
// answer stays honest.

const BANDS = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES = ['prospect', 'account'];
const SORTS = {
  score: (a, b) => (b.best_score ?? b.priority_score ?? 0) - (a.best_score ?? a.priority_score ?? 0),
  deadline: (a, b) => String(a.deadline ?? '9999').localeCompare(String(b.deadline ?? '9999')),
  date: (a, b) => String(b.date ?? b.last_seen ?? '').localeCompare(String(a.date ?? a.last_seen ?? '')),
  weeks: (a, b) => (b.weeks_tracked ?? 0) - (a.weeks_tracked ?? 0),
  signals: (a, b) => (b.signal_count ?? 0) - (a.signal_count ?? 0),
  quiet: (a, b) => (b.quiet_streak ?? 0) - (a.quiet_streak ?? 0),
  name: (a, b) => String(a.name ?? a.company ?? '').localeCompare(String(b.name ?? b.company ?? '')),
};

/** The vocabulary the translating model is allowed to use. Kept in one place so
 *  the prompt and the validator can never drift apart. */
export const SPEC = {
  entity: ['organisations', 'signals'],
  sort: Object.keys(SORTS),
  bands: BANDS,
  statuses: STATUSES,
  filters: [
    'band', 'status', 'minScore', 'practiceAreas', 'multiService', 'quietForWeeks',
    'category', 'hasDeadline', 'deadlineWithinDays', 'nameContains', 'needsReview',
    'sinceDate', 'signalType',
  ],
};

/**
 * Run a filter spec. Returns the rows plus a plain-English account of what was
 * actually applied, so an answer can always be traced back to a query.
 */
export function runQuery(spec, { organisations = [], signals = [], today = new Date() } = {}) {
  const entity = SPEC.entity.includes(spec?.entity) ? spec.entity : 'organisations';
  const f = spec?.filters ?? {};
  const applied = [];

  let rows = entity === 'organisations' ? [...organisations] : [...signals];
  const field = (r, name) => (entity === 'organisations' ? r[name] : r[name]);

  // ── Band ────────────────────────────────────────────────────────────────
  const bands = asArray(f.band).filter((b) => BANDS.includes(b));
  if (bands.length) {
    rows = rows.filter((r) => bands.includes(r.best_band ?? r.priority_band));
    applied.push(`band is ${bands.join(' or ')}`);
  }

  if (STATUSES.includes(f.status)) {
    rows = rows.filter((r) => r.status === f.status);
    applied.push(`status is ${f.status}`);
  }

  if (Number.isFinite(Number(f.minScore)) && Number(f.minScore) > 0) {
    const n = Number(f.minScore);
    rows = rows.filter((r) => (r.best_score ?? r.priority_score ?? 0) >= n);
    applied.push(`score at least ${n}`);
  }

  // ── Practice areas — ANY of, because a BD question means "touches this" ──
  const areas = asArray(f.practiceAreas).map((a) => String(a).toLowerCase());
  if (areas.length) {
    rows = rows.filter((r) => (r.practice_areas ?? []).some((a) => areas.includes(String(a).toLowerCase())));
    applied.push(`opens ${areas.join(' or ')}`);
  }

  if (f.multiService === true) {
    rows = rows.filter((r) => r.multi_service === true || (r.practice_areas ?? []).length >= 2);
    applied.push('opens two or more practice areas');
  }

  if (Number.isFinite(Number(f.quietForWeeks)) && Number(f.quietForWeeks) > 0) {
    const n = Number(f.quietForWeeks);
    rows = rows.filter((r) => (r.quiet_streak ?? 0) >= n);
    applied.push(`no signal for ${n}+ consecutive sweeps`);
  }

  if (typeof f.category === 'string' && f.category.trim()) {
    const c = f.category.trim().toLowerCase();
    rows = rows.filter((r) => (r.category ?? '').toLowerCase() === c
      || Object.keys(r.categories ?? {}).map((k) => k.toLowerCase()).includes(c));
    applied.push(`found by the ${c} collector`);
  }

  if (typeof f.signalType === 'string' && f.signalType.trim()) {
    const t = f.signalType.trim().toLowerCase();
    rows = rows.filter((r) => String(r.signal_type ?? '').toLowerCase().includes(t));
    applied.push(`signal type mentions "${f.signalType.trim()}"`);
  }

  // ── Deadlines — the one filter that must respect "today" ─────────────────
  const todayIso = toIso(today);
  if (f.hasDeadline === true) {
    rows = rows.filter((r) => r.deadline || (r.signals ?? []).some((s) => s.deadline));
    applied.push('has a stated deadline');
  }

  if (Number.isFinite(Number(f.deadlineWithinDays)) && Number(f.deadlineWithinDays) > 0) {
    const n = Number(f.deadlineWithinDays);
    const limit = toIso(new Date(today.getTime() + n * 864e5));
    rows = rows
      .map((r) => withNearestDeadline(r, todayIso))
      .filter((r) => r.deadline && r.deadline >= todayIso && r.deadline <= limit);
    applied.push(`closing within ${n} days (by ${limit})`);
  }

  if (typeof f.nameContains === 'string' && f.nameContains.trim()) {
    const q = f.nameContains.trim().toLowerCase();
    rows = rows.filter((r) => String(r.name ?? r.company ?? '').toLowerCase().includes(q));
    applied.push(`name contains "${f.nameContains.trim()}"`);
  }

  if (f.needsReview === true) {
    rows = rows.filter((r) => r.needs_review === true);
    applied.push('flagged for human review');
  }

  if (typeof f.sinceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.sinceDate)) {
    rows = rows.filter((r) => String(r.date ?? r.last_seen ?? '') >= f.sinceDate);
    applied.push(`seen since ${f.sinceDate}`);
  }

  // ── Sort and limit ───────────────────────────────────────────────────────
  const sortKey = SORTS[spec?.sort] ? spec.sort : (f.deadlineWithinDays || f.hasDeadline ? 'deadline' : 'score');
  rows.sort(SORTS[sortKey]);
  if (spec?.direction === 'asc') rows.reverse();

  const total = rows.length;
  const limit = clampLimit(spec?.limit);
  return {
    entity,
    rows: rows.slice(0, limit),
    total,
    truncated: total > limit,
    sortedBy: sortKey,
    applied: applied.length ? applied : ['no filters — everything'],
  };
}

/** Compact a row to what a narrator needs. Keeps the answer small and the
 *  source link intact, so every claim can be checked. */
export function forNarration(row, entity) {
  if (entity === 'signals') {
    const { company, signal_type, summary, url, date, deadline, priority_score, priority_band, practice_areas, needs_review, review_reason } = row;
    return { company, signal_type, summary, url, date, deadline, score: priority_score, band: priority_band, practice_areas, needs_review, review_reason };
  }
  const latest = (row.signals ?? [])[0] ?? {};
  return {
    name: row.name,
    score: row.best_score,
    band: row.best_band,
    status: row.status,
    practice_areas: row.practice_areas,
    multi_service: row.multi_service,
    weeks_tracked: row.weeks_tracked,
    signal_count: row.signal_count,
    quiet_streak: row.quiet_streak ?? 0,
    latest_signal: latest.summary ?? null,
    latest_date: latest.date ?? null,
    deadline: row.deadline ?? latest.deadline ?? null,
    url: latest.url ?? null,
  };
}

// An organisation's deadline lives on its signals. Surface the soonest one that
// has not already passed, so "closing in 14 days" works on organisations too.
function withNearestDeadline(row, todayIso) {
  if (row.deadline) return row;
  const upcoming = (row.signals ?? [])
    .map((s) => s.deadline).filter((d) => d && d >= todayIso).sort();
  return upcoming.length ? { ...row, deadline: upcoming[0] } : row;
}

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const toIso = (d) => new Date(d).toISOString().slice(0, 10);

function clampLimit(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(50, Math.round(n));
}
