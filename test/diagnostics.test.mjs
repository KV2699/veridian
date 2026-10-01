// The yield diagnostics must name the RIGHT cause, because the whole point is
// telling a collection failure apart from a quiet market. Each case below is a
// documented root cause from the predecessor system's own post-mortems.
import { diagnose } from '../server/lib/diagnostics.js';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };
const ids = (d) => d.findings.map((f) => f.id);

console.log('\nYield diagnostics — does it name the right cause?\n');

// A query whose wording finds nothing at all.
let d = diagnose({
  collectors: [{ key: 'a', name: 'A', hits: 4, fresh: 4, extracted: 2, kept: 2,
    queries: [{ query: 'good one', hits: 4, fresh: 4 }, { query: 'bad wording', hits: 0, fresh: 0 }] }],
  signals: [{ relevance_score: 7, date: '2026-09-29', url: 'https://a.com/1', category: 'a' },
            { relevance_score: 6, date: '2026-09-29', url: 'https://b.com/2', category: 'a' }],
});
check('dead query flagged as a wording problem', ids(d).includes('no-key-terms'));

// Plenty found, nothing qualified — the Acre "hunting states not events" failure.
d = diagnose({
  collectors: [{ key: 'a', name: 'A', hits: 12, fresh: 12, extracted: 0, kept: 0,
    queries: [{ query: 'q', hits: 12, fresh: 12 }] }],
  signals: [], rawCount: 0,
});
check('results but zero extracted → signal definition, not search', ids(d).includes('extraction-collapse'));
check('that finding explains the proving-a-negative trap',
  d.findings.find((f) => f.id === 'extraction-collapse')?.fix.includes('proving a negative'));

// Extracted fine, all rejected at verification — wrong target universe.
d = diagnose({
  collectors: [{ key: 'a', name: 'A', hits: 20, fresh: 20, extracted: 8, kept: 0,
    queries: [{ query: 'q', hits: 20, fresh: 20 }] }],
  signals: [], rawCount: 8,
});
check('extracted then all rejected → target universe, not queries', ids(d).includes('qa-wipeout'));

// Scoring inflation — the DS-4/DS-5 failure.
d = diagnose({
  collectors: [{ key: 'a', name: 'A', hits: 10, fresh: 10, extracted: 10, kept: 10, queries: [{ query: 'q', hits: 10, fresh: 10 }] }],
  signals: Array.from({ length: 10 }, (_, i) => ({ relevance_score: 9, date: '2026-09-29', url: `https://x${i}.com/1`, category: 'a' })),
});
check('everything scored 8+ flagged as inflation', ids(d).includes('score-inflation'));

// Undated and single-source skew.
d = diagnose({
  collectors: [{ key: 'a', name: 'A', hits: 6, fresh: 6, extracted: 6, kept: 6, queries: [{ query: 'q', hits: 6, fresh: 6 }] }],
  signals: Array.from({ length: 6 }, (_, i) => ({ relevance_score: i < 2 ? 9 : 6, date: null, url: 'https://same.com/' + i, category: 'a' })),
});
check('mostly undated signals flagged', ids(d).includes('undated-heavy'));
check('one publisher dominating flagged', ids(d).includes('source-concentration'));

// A healthy run should be quiet.
d = diagnose({
  collectors: [{ key: 'a', name: 'A', hits: 15, fresh: 12, extracted: 6, kept: 5,
    queries: [{ query: 'q1', hits: 8, fresh: 6 }, { query: 'q2', hits: 7, fresh: 6 }] }],
  signals: [
    { relevance_score: 9, date: '2026-09-29', url: 'https://a.com/1', category: 'a' },
    { relevance_score: 7, date: '2026-09-29', url: 'https://b.com/2', category: 'a' },
    { relevance_score: 6, date: '2026-09-28', url: 'https://c.com/3', category: 'a' },
    { relevance_score: 6, date: '2026-09-28', url: 'https://d.com/4', category: 'a' },
    { relevance_score: 7, date: '2026-09-27', url: 'https://e.com/5', category: 'a' },
  ],
});
check('a healthy run reports no high-severity findings', d.healthy, `${d.findings.length} finding(s)`);
check('funnel totals computed', d.funnel.hits === 15 && d.funnel.verified === 5, JSON.stringify(d.funnel));

// Totally empty run.
d = diagnose({ collectors: [], signals: [], rawCount: 0 });
check('empty run told to suspect collection before the market', ids(d).includes('empty-run'));

// Worst first.
d = diagnose({
  collectors: [{ key: 'a', name: 'A', hits: 12, fresh: 12, extracted: 0, kept: 0,
    queries: [{ query: 'dead', hits: 0, fresh: 0 }] }],
  signals: [], rawCount: 0,
});
check('findings sorted most severe first', d.findings[0].severity === 'high');

// A model narrating instead of answering must be named as such, not blamed on
// the signal definition — that misdirection cost a whole live run.
d = diagnose({
  collectors: [{ key: 'a', name: 'A', hits: 40, fresh: 40, extracted: 0, kept: 0,
    batches: 5, parseFailures: 5, queries: [{ query: 'q', hits: 40, fresh: 40 }] }],
  signals: [], rawCount: 0,
});
check('batches failing to parse blamed on the model, not the queries', ids(d).includes('parse-failure'));
check('and extraction-collapse suppressed so the real cause is not buried', !ids(d).includes('extraction-collapse'));
check('the fix names the fast model', d.findings.find((f) => f.id === 'parse-failure')?.fix.includes('NEBIUS_MODEL_FAST'));

// Band inflation is measured on the computed band, not the model's relevance —
// a live run produced 67% Critical while every relevance score looked sane.
d = diagnose({
  collectors: [{ key: 'a', name: 'A', hits: 60, fresh: 60, extracted: 58, kept: 58, batches: 8, parseFailures: 0, queries: [{ query: 'q', hits: 60, fresh: 60 }] }],
  signals: Array.from({ length: 58 }, (_, i) => ({
    relevance_score: 7, date: '2026-09-29', url: `https://x${i}.com/1`, category: 'a',
    priority_band: i < 39 ? 'Critical' : 'Medium', multi_service: i < 41,
  })),
});
check('majority in the top band flagged as inflation', ids(d).includes('band-inflation'));
check('and the fix points at practice-area mapping',
  d.findings.find((f) => f.id === 'band-inflation')?.fix.includes('practice-area'));

// A sane distribution must stay quiet.
d = diagnose({
  collectors: [{ key: 'a', name: 'A', hits: 30, fresh: 25, extracted: 12, kept: 12, batches: 4, parseFailures: 0, queries: [{ query: 'q', hits: 30, fresh: 25 }] }],
  signals: Array.from({ length: 12 }, (_, i) => ({
    relevance_score: i < 3 ? 9 : 6, date: '2026-09-29', url: `https://y${i}.com/1`, category: 'a',
    priority_band: i < 3 ? 'Critical' : i < 7 ? 'High' : 'Medium', multi_service: i < 3,
  })),
});
check('a healthy band spread is not flagged', !ids(d).includes('band-inflation'));

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
