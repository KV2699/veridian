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

// The miss the first version let through: the company IS named in the body,
// but the article is about something else entirely.
const passingMention = checkGrounding(
  { company: 'SK Telecom', summary: 'SK Telecom announced a 15 GW AI data center buildout.', url: 'https://www.hpcwire.com/a' },
  { title: 'HPE teams with NVIDIA to bring secure agentic AI into enterprise production',
    content: 'HPE announced a new agentic AI platform with NVIDIA at its annual event. '.repeat(8)
      + 'Separately, analysts noted that operators such as SK Telecom continue to expand regional capacity.' },
);
check('company named only deep in the body is flagged, not silently accepted',
  passingMention.ok === true && passingMention.subject === false, passingMention.reason);

// The company IS the subject — must pass clean.
const realSubject = checkGrounding(
  { company: 'Samsung', summary: 'Samsung invested $1 billion in Helix Digital Infrastructure.', url: 'https://www.techbuzz.ai/a' },
  { title: "Samsung Invests $1B in KKR's AI Infrastructure Play",
    content: 'Samsung today confirmed a $1 billion investment into Helix Digital Infrastructure, the KKR-backed AI infrastructure provider.' },
);
check('company in the headline passes clean', realSubject.ok === true && realSubject.subject === true && !realSubject.reason);

console.log(failed ? `\n✗ ${failed} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failed ? 1 : 0);
