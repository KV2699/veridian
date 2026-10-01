// PRIORITY SCORING — four factors, computed in code.
//
// The model supplies the INPUTS (which practice areas a signal opens, how
// large the organisation is). The score itself is arithmetic, done here.
//
// That split is deliberate. A model asked for a priority score will invent its
// own weighting and report it with total confidence — in the predecessor
// system one run scored four prospects 75-77 "Critical" on a self-invented
// algorithm which, recomputed on the real one, came to 70 "High": a whole band
// out. So nothing downstream ever trusts a model-supplied priority number.
//
//   Practice Area Fit     3+ areas = 30 · 2 = 20 · 1 = 10 · 0 = 0
//   Commercial Value      profile-defined, 25 · see below
//   Signal Urgency        ≤7d = 25 · ≤30d = 15 · ≤90d = 5 · older/undated = 0
//   Organisation Scale    large = 20 · mid = 12 · small/unknown = 5
//
// THE SECOND FACTOR IS PROFILE-DEFINED, and it has to be.
//
// It asks "how much money is in this?" — and the answer is business-specific.
// For a consultancy selling six services to one client, breadth is the answer:
// a prospect who could buy two services is worth far more than one who buys
// one, so multi-service is the right measure.
//
// For a vendor whose revenue is concentrated in a single line, breadth measures
// nothing — every signal scores the same and a quarter of the algorithm goes
// dead. Measured on a live week, scores collapsed onto two values (45 and 55)
// and a 2GW datacentre campus ranked identically to a 4.5MW site. There, deal
// SCALE is what separates a big opportunity from a small one.
//
// A profile declares which it uses. Default is multi-service, matching the
// original methodology.

export const BANDS = [
  { min: 75, band: 'Critical', action: 'approach within 7 days' },
  { min: 50, band: 'High', action: 'approach within 30 days' },
  { min: 25, band: 'Medium', action: 'monitor, approach next quarter' },
  { min: 0, band: 'Low', action: 'watchlist only' },
];

export function practiceAreaPoints(n) {
  if (n >= 3) return 30;
  if (n === 2) return 20;
  if (n === 1) return 10;
  return 0;
}

export function urgencyPoints(date, now = new Date()) {
  if (!date) return 0;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 0;
  const days = Math.floor((now - d) / 864e5);
  if (days < 0) return 0;          // future-dated is an extraction error
  if (days <= 7) return 25;
  if (days <= 30) return 15;
  if (days <= 90) return 5;
  return 0;
}

// Default: breadth. A prospect who could buy two things is worth far more
// than one who could buy one.
export const MULTI_SERVICE_FACTOR = {
  key: 'multi_service',
  name: 'Multi-Service Potential',
  // Array.isArray, not a truthy length check: a bare string has a length too,
  // and 'compute' would otherwise read as seven practice areas.
  from: (signal) => (Array.isArray(signal.practice_areas) && signal.practice_areas.length >= 2 ? 'yes' : 'no'),
  points: { yes: 25, no: 0 },
};

export function valuePoints(signal, factor = MULTI_SERVICE_FACTOR) {
  const level = String(factor.from ? factor.from(signal) : signal[factor.key] ?? '').toLowerCase();
  const table = factor.points ?? {};
  // Unknown never scores: a value that was not established cannot be rewarded.
  return Number(table[level]) || 0;
}

export function scalePoints(scale) {
  switch (String(scale ?? '').toLowerCase()) {
    case 'large': return 20;
    case 'mid': case 'medium': return 12;
    case 'small': return 5;
    default: return 5;             // unknown scores as small, never as large
  }
}

export function bandFor(score) {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
}

/**
 * Score one signal. Returns the total, the band, and the breakdown — the
 * breakdown is kept so a score can always be audited back to its four inputs.
 */
export function scoreSignal(signal, { now = new Date(), valueFactor = MULTI_SERVICE_FACTOR } = {}) {
  const areas = Array.isArray(signal.practice_areas) ? signal.practice_areas : [];
  const multiService = areas.length >= 2;

  const breakdown = {
    practice_area_fit: practiceAreaPoints(areas.length),
    // Named for whatever the profile measures, so a breakdown always says
    // which question each point answered.
    [valueFactor.key]: valuePoints(signal, valueFactor),
    signal_urgency: urgencyPoints(signal.date, now),
    organisation_scale: scalePoints(signal.org_scale),
  };

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const { band, action } = bandFor(total);

  return {
    ...signal,
    practice_areas: areas,
    multi_service: multiService,
    priority_score: total,
    priority_band: band,
    priority_action: action,
    score_breakdown: breakdown,
  };
}

export const scoreAll = (signals, opts) => signals.map((s) => scoreSignal(s, opts));

/** Resolve the value factor a profile asks for, falling back to multi-service. */
export function valueFactorFor(profile) {
  const f = profile?.scoring?.valueFactor;
  if (!f?.key || !f?.points) return MULTI_SERVICE_FACTOR;
  return { ...f, from: f.from ?? ((signal) => signal[f.key]) };
}
