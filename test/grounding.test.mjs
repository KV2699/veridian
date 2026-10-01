// Does the source actually say this? Every case below is taken from, or models,
// a real misattribution the first clean live run produced.
import { checkGrounding, figuresIn, isWeakDomain, distinctiveTokens } from '../server/lib/grounding.js';

let failed = 0;
const check = (label, pass, extra = '') => { if (!pass) failed++; console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); };

console.log('\nGrounding — does the source support the claim?\n');

// The real failure: a claim about Oak Ridge sourced to a post about a physicist.
const misattributed = checkGrounding(
  { company: 'Oak Ridge National Laboratory',
    summary: 'Oak Ridge National Laboratory is building AI supercomputers.',
    url: 'https://www.facebook.com/FSUartsandsciences/posts/mayly-sanchez' },
  { title: 'Mayly Sanchez is one of six researchers in the FSU department of physics',
    content: 'Mayly Sanchez is one of six researchers in the FSU Department of Physics leading a new neutrino experiment with collaborators across several universities and laboratories nationwide.' },
);
check('claim dropped when the source never names the organisation', misattributed.ok === false, misattributed.reason);
check('and the social-media domain is marked weak', misattributed.weakSource === true);

// A genuine signal must survive.
const genuine = checkGrounding(
  { company: 'Nscale', summary: 'Nscale raised $3.36 bn via convertible loan notes led by Third Point.',
    url: 'https://www.nscale.com/press-releases/pre-ipo-convertible-financing' },
  { title: 'Nscale announces pre-IPO convertible financing',
    content: 'Nscale today announced it has raised $3.36 billion through convertible loan notes in a round led by Third Point, with participation from NVIDIA, to fund further data centre capacity.' },
);
check('genuine signal passes', genuine.ok === true);
check('its figures are found in the source', genuine.ungroundedFigures.length === 0, genuine.reason || 'clean');
check('a real publisher is not marked weak', genuine.weakSource === false);

// Company named, but the figure invented — flagged, not dropped.
const badFigure = checkGrounding(
  { company: 'Nscale', summary: 'Nscale raised $9.99 bn in new funding.', url: 'https://news.example.com/a' },
  { title: 'Nscale raises capital', content: 'Nscale today announced it has raised $3.36 billion through convertible loan notes led by Third Point.' },
);
check('unsupported figure flagged but signal kept', badFigure.ok === true && badFigure.ungroundedFigures.length === 1,
  badFigure.reason);

// Partial name matches must still work.
const partial = checkGrounding(
  { company: 'Microsoft Azure', summary: 'Microsoft Azure opened a new India region.', url: 'https://news.microsoft.com/a' },
  { title: 'Azure expands in India', content: 'Azure today announced a new datacenter region in India South Central serving Asia.' },
);
check('"Microsoft Azure" matches a source that only says "Azure"', partial.ok === true);

// Too little source text: never drop on no evidence.
const thin = checkGrounding(
  { company: 'Some Corp', summary: 'Some Corp did a thing.', url: 'https://news.example.com/b' },
  { title: 'News', content: '' },
);
check('thin source text does not cause a false drop', thin.ok === true, thin.reason);

// Helpers.
check('figures parsed from money, power and percentages',
  figuresIn('raised $3.36 bn for a 250 MW site, up 62%').length === 3,
  JSON.stringify(figuresIn('raised $3.36 bn for a 250 MW site, up 62%').map((f) => f.text)));
check('generic words are not treated as identifying',
  !distinctiveTokens('Global Technology Group Limited').length);
check('weak domains recognised, real ones not',
  isWeakDomain('https://www.linkedin.com/posts/x') && isWeakDomain('https://facebook.com/y')
  && !isWeakDomain('https://www.reuters.com/z'));

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
