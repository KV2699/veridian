// ONBOARDING A NEW BUSINESS — and the one thing the builder must refuse to do.
//
// Most of a profile can be gathered automatically. Polarity cannot, and the
// entire architecture rests on that distinction: a model asked which way an
// event points for a business it has only read a website about will produce a
// confident, plausible, wrong answer, and the resulting empty pipeline looks
// exactly like a quiet market.
//
// So these check two things in equal measure: that the builder extracts what it
// can, and that it refuses to invent what it cannot.
import { textFrom, serviceLinks, draftProfile, validateDraft, findFeeds } from '../server/lib/profile-builder.js';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

console.log('\nProfile builder — onboarding a new business\n');

// ── Reading a company's own site, for free ─────────────────────────────────
check('scripts, styles, nav and footers are stripped before a model sees them',
  textFrom('<nav>Home</nav><script>evil()</script><style>a{}</style><p>We sell widgets</p><footer>c</footer>')
    === 'We sell widgets');
check('entities and whitespace are normalised',
  textFrom('<p>Risk&nbsp;&amp;&nbsp;Compliance</p>') === 'Risk & Compliance');

const html = `
  <a href="/what-we-do">What we do</a>
  <a href="/services/data">Data</a>
  <a href="/about-us">About</a>
  <a href="/blog/post">Blog</a>
  <a href="https://twitter.com/x/services">Twitter</a>
  <a href="mailto:a@b.com">Mail</a>`;
const links = serviceLinks(html, 'https://example.com');
check('finds the pages that describe what a company sells',
  links.some((l) => l.endsWith('/what-we-do')) && links.some((l) => l.endsWith('/services/data')));
check('ignores blogs, mail links and other hosts',
  !links.some((l) => /blog|mailto|twitter/.test(l)), links.join(' '));

// ── THE REFUSAL ────────────────────────────────────────────────────────────
// With no past wins, the model is told to leave polarity empty and ask
// questions instead. The validator must treat that as "needs a human", not as
// an error — the profile is still worth writing.
const noWins = {
  name: 'Example Ltd', market: 'widgets', reader: 'a widget seller',
  practice_areas: [
    { key: 'a', name: 'A', description: 'first thing sold' },
    { key: 'b', name: 'B', description: 'second thing sold' },
  ],
  polarity: [],
  polarity_questions: ['When a company appoints a Head of Widgets, is that a lead or a lost opportunity?'],
};
const v1 = validateDraft(noWins);
check('a draft without polarity is still valid — it is written, with the questions', v1.ok);
check('and it is flagged as needing a human before it can score', v1.needsPolarity);

const withWins = { ...noWins, polarity: ['A NEW APPOINTMENT is a LEAD — new budget holder.'], polarity_questions: [] };
check('a draft with polarity derived from wins does not need a human first',
  validateDraft(withWins).ok && !validateDraft(withWins).needsPolarity);

// ── The validator catches the ways a profile goes wrong ────────────────────
check('one practice area is rejected — multi-service cannot mean anything',
  !validateDraft({ ...withWins, practice_areas: [{ key: 'a', name: 'A', description: 'x' }] }).ok);
check('nine practice areas are rejected — split too finely, every score inflates',
  !validateDraft({ ...withWins, practice_areas: Array.from({ length: 9 }, (_, i) => ({ key: `k${i}`, name: `N${i}`, description: 'x' })) }).ok);
check('duplicate practice area keys are rejected',
  !validateDraft({ ...withWins, practice_areas: [{ key: 'a', name: 'A', description: 'x' }, { key: 'a', name: 'B', description: 'y' }] }).ok);
check('a missing market is rejected — every prompt needs one',
  !validateDraft({ ...withWins, market: '' }).ok);
check('a draft with neither polarity nor questions is rejected',
  !validateDraft({ ...withWins, polarity: [], polarity_questions: [] }).ok);

// ── The model is never allowed to supply polarity from nothing ─────────────
let sentPrompt = '';
await draftProfile(
  { pages: [{ url: 'https://e.com', text: 'We sell widgets and services.' }] },
  { completeJSON: async ({ user }) => { sentPrompt = user; return { data: { practice_areas: [] } }; } },
);
check('without wins, the prompt explicitly forbids inventing polarity',
  /NO PAST WINS WERE SUPPLIED/.test(sentPrompt));

sentPrompt = '';
await draftProfile(
  { pages: [{ url: 'https://e.com', text: 'We sell widgets.' }], wins: 'We won a deal when their CTO resigned.' },
  { completeJSON: async ({ user }) => { sentPrompt = user; return { data: { practice_areas: [] } }; } },
);
check('with wins, the prompt presents them as the only valid basis for polarity',
  /ONLY VALID BASIS FOR POLARITY/.test(sentPrompt) && /CTO resigned/.test(sentPrompt));

check('no evidence at all is refused rather than guessed', await (async () => {
  try { await draftProfile({}); return false; } catch { return true; }
})());

// ── Feed discovery: a dead feed is a silent failure ────────────────────────
// Root cause 4 of the predecessor methodology was a stale source list. When
// the exec-search profile was built by hand, 3 of 14 candidate feeds were dead.
const fakeFetch = async (url) => {
  if (url === 'https://good.com/feed/') return { ok: true, text: async () => '<rss><item>one</item><item>two</item></rss>' };
  if (url.startsWith('https://soft404.com')) return { ok: true, text: async () => '<html><body>Page not found</body></html>' };
  return { ok: false, text: async () => '' };
};
const feeds = await findFeeds(['good.com', 'soft404.com', 'dead.com', 'Computer Weekly'], { fetchImpl: fakeFetch });
check('a live feed is kept with its item count',
  feeds.live.length === 1 && feeds.live[0].url === 'https://good.com/feed/' && feeds.live[0].items === 2);
check('a soft 404 — HTTP 200 with a web page — is not mistaken for a feed',
  !feeds.live.some((f) => f.name === 'soft404.com'));
check('a dead domain is reported, not silently dropped',
  feeds.dead.some((d) => d.name === 'dead.com'));
check('a publication given as a title rather than a domain is flagged for a human',
  feeds.dead.some((d) => /Computer Weekly/.test(d.name) && /by hand/.test(d.reason)));

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
