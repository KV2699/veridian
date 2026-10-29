// PROFILE — Futerra · sustainability communications agency
//
// Ported from the operator's "Futerra BD Intelligence Prompt Pack v1" — five
// service lines, eight prompts, five tools, and the same four-factor scoring as
// every other tracker in the collection.
//
// WHAT THIS PROFILE ADDS THAT NO OTHER DOES: a REPUTATIONAL event as the
// primary buying trigger. For every other business here the trigger is growth,
// obligation or vacancy. For a communications agency the strongest single
// signal is an organisation being publicly challenged on its environmental
// claims — because that is the moment it needs a credible narrative and has no
// time to run a procurement.
//
// Which produces a polarity line that exists nowhere else in the set:
//
//   A GREENWASHING RULING AGAINST A COMPANY IS A LEAD.
//
// To a think tank the same ruling is an advocacy target. To an investor it is a
// risk flag. To this business it is a client who needs help today.

export default {
  key: 'sustainability-comms',
  name: 'Sustainability Communications',
  description:
    'BD intelligence for a sustainability communications and creative agency — brand narrative, campaigns, reporting design, behaviour-change training and thought leadership, sold to organisations that have just made, broken or been challenged on an environmental claim.',

  market: 'sustainability communications and creative',
  reader:
    'a new business lead at a sustainability communications agency, who wins work when an organisation has a story it cannot tell on its own — a commitment to land, a report to make credible, or a claim it has just been challenged on',

  sweepTerms: 'sustainability communications campaign commitment reporting brand',

  // ── The five service lines ────────────────────────────────────────────────
  // Verbatim from the pack, including the signal each one responds to. Note
  // they are genuinely separate budgets: brand sits with the CMO, reporting
  // with the CFO or company secretary, training with HR.
  practiceAreas: [
    {
      key: 'brand',
      name: 'Brand Strategy & Narrative',
      description: 'Helping an organisation define and own its sustainability story. Signalled by a new CSO in post, a strategy launch, a greenwashing challenge, or any reputational event where the organisation\'s environmental credibility is in question.',
    },
    {
      key: 'campaigns',
      name: 'Campaigns & Creative',
      description: 'Making commitments land with customers, employees and investors. Signalled by a net-zero or nature commitment announced, a new CMO in post, B Corp certification, an award win, or a consumer-facing sustainability campaign launching.',
    },
    {
      key: 'reporting',
      name: 'Reporting Design',
      description: 'Making ESG and sustainability reports credible, engaging and compliant. Signalled by a mandatory reporting regime coming into force, a first-time CSRD or TNFD disclosure, an assurance requirement, or a listed company approaching annual report season.',
    },
    {
      key: 'training',
      name: 'Training & Behaviour Change',
      description: 'Building sustainability confidence and culture inside an organisation. Signalled by a new strategy needing internal rollout, a large employer with a complex change programme, or a governance reform that has to reach staff.',
    },
    {
      key: 'thought',
      name: 'Thought Leadership & Research',
      description: 'Publishing ideas that shape the agenda. Signalled by a new CSO building an external profile, an organisation wanting to lead an industry debate, a foundation grant for research, or an existing campaign needing intellectual underpinning.',
    },
  ],

  // ── Polarity ──────────────────────────────────────────────────────────────
  polarity: [
    'A GREENWASHING RULING, CHALLENGE OR INVESTIGATION against a named organisation is the STRONGEST LEAD in this system. The organisation needs a credible narrative immediately and has no time to run a procurement. Speed is the entire advantage.',
    'A NET-ZERO, NATURE OR SOCIAL COMMITMENT ANNOUNCED is a LEAD — a commitment nobody has heard of does nothing for the company that made it, and making it land is exactly what this business sells.',
    'A NEW CSO OR CMO IN POST is a LEAD — a new leader arrives wanting a visible early win, and an agency relationship is one of the fastest they can commission.',
    'A MANDATORY REPORTING REGIME COMING INTO FORCE is a LEAD on every organisation it newly captures, and NOT on the regulator that wrote it. First-time reporters are the best prospects, because they have no incumbent designer.',
    'B CORP CERTIFICATION, AN AWARD WIN OR A RATINGS UPGRADE is a LEAD — the organisation has something it wants to talk about and a reason to spend on saying it well.',
    'A COMPANY QUIETLY DROPPING A TARGET is a WEAK LEAD at best. It signals retreat from spending on this agenda, not appetite for it — score it low and say why, rather than treating any sustainability news as an opportunity.',
    'AN ORGANISATION WITH NO PUBLIC ENVIRONMENTAL POSITION AT ALL IS NOT A PROSPECT. This business sells help with a story; a company that has not started telling one has nothing to brief on yet.',
  ],

  // ⚠️  ILLUSTRATIVE ROSTER — organisations with publicly documented
  // sustainability communications activity. Not any agency's client list.
  roster: [
    'Unilever', 'IKEA', 'Patagonia', 'BT Group', 'Sky', 'Ørsted',
  ],

  exclusions: [
    'Futerra',
    // Competing agencies and consultancies in this niche.
    'Given London', 'Revolt', 'Forster Communications', 'Lucky Generals',
    'Edelman', 'Weber Shandwick', 'FleishmanHillard', 'Hill+Knowlton',
    'Accenture Song', 'Wunderman Thompson',
  ],

  aliases: {
    'Orsted': 'Ørsted',
    'BT': 'BT Group',
    'Unilever PLC': 'Unilever',
    'Sky Group': 'Sky',
    ASA: 'Advertising Standards Authority',
  },

  collectors: [
    {
      key: 'reputation',
      name: 'Reputation & Challenge Collector',
      focus:
        'Organisations publicly challenged on an environmental or social claim — advertising rulings, regulator findings, NGO campaigns, litigation and investigative reporting. The strongest and fastest-moving signals in this market.',
      signalTypes: [
        'An advertising regulator upholding a complaint about an environmental claim made by a named company',
        'A regulator, competition authority or consumer body opening or concluding an investigation into green claims',
        'An NGO campaign or investigation naming a specific company over its environmental claims',
        'Litigation filed against a named company over climate or sustainability claims',
      ],
      queries: [
        'advertising watchdog upholds greenwashing complaint company ruling',
        'regulator investigation green claims misleading company announced',
        'NGO report accuses company greenwashing campaign launched',
        'lawsuit filed climate claims misleading company announced',
      ],
      windowDays: 60,
    },
    {
      key: 'commitment',
      name: 'Commitment & Appointment Collector',
      focus:
        'Organisations with something new to say: commitments, strategies, certifications, awards, and the people newly responsible for communicating them.',
      signalTypes: [
        'A company publishing a net-zero, nature or social commitment with a stated target',
        'A new Chief Sustainability Officer or Chief Marketing Officer appointed at a named organisation',
        'B Corp certification, a sustainability award win, or a ratings upgrade announced',
        'A company newly in scope of a mandatory sustainability reporting regime',
      ],
      queries: [
        'company announces net zero commitment target campaign launched',
        '"has appointed" chief sustainability officer OR chief marketing officer announced',
        'B Corp certification achieved company announced',
        'first sustainability report CSRD published company announced',
      ],
      windowDays: 90,
    },
  ],

  // The bodies whose rulings create work here. The lead is never the regulator
  // — it is the company it just named.
  regulators: {
    windowDays: 90,
    maxResults: 10,
    terms: 'ruling upheld investigation green claims misleading guidance published requirement',
    bodies: [
      { name: 'Advertising Standards Authority', domain: 'asa.org.uk', terms: 'ruling upheld environmental claim misleading' },
      { name: 'Competition and Markets Authority', domain: 'gov.uk', terms: 'green claims code investigation undertaking misleading' },
      { name: 'Financial Conduct Authority', domain: 'fca.org.uk', terms: 'sustainability disclosure anti-greenwashing rule labelling' },
      { name: 'Financial Reporting Council', domain: 'frc.org.uk', terms: 'sustainability reporting standards assurance requirement' },
      { name: 'European Commission — green claims', domain: 'ec.europa.eu', terms: 'green claims directive empowering consumers requirement' },
    ],
  },

  excludeDomains: [
    'precedenceresearch.com', 'grandviewresearch.com', 'marketsandmarkets.com',
    'mordorintelligence.com', 'marketbeat.com', 'simplywall.st', 'seekingalpha.com',
    'fool.com', 'facebook.com', 'instagram.com', 'reddit.com', 'youtube.com',
  ],

  rosterSweep: { batchSize: 8, windowDays: 60, maxOrganisations: 48 },

  feeds: {
    days: 30,
    sources: [
      { name: 'Trellis', url: 'https://trellis.net/feed/' },
      { name: 'ESG Dive', url: 'https://esgdive.com/feeds/news/' },
      { name: 'ESG Today', url: 'https://esgtoday.com/feed/' },
      { name: 'ESG News', url: 'https://esgnews.com/feed/' },
      { name: 'edie', url: 'https://edie.net/feed/' },
      { name: 'Sustainable Brands', url: 'https://sustainablebrands.com/rss' },
      { name: 'Marketing Week', url: 'https://marketingweek.com/feed/' },
      { name: 'CSO Futures', url: 'https://csofutures.com/feed/' },
    ],
    terms: [
      'greenwash', 'misleading', 'advertising standards', 'asa', 'upheld',
      'complaint', 'investigation', 'accused', 'challenged', 'lawsuit',
      'net zero', 'commitment', 'pledge', 'target', 'strategy', 'launches',
      'campaign', 'rebrand', 'brand', 'b corp', 'certification', 'award',
      'report', 'reporting', 'csrd', 'tnfd', 'disclosure', 'assurance',
      'appoint', 'chief sustainability', 'chief marketing', 'cmo', 'cso',
      'behaviour change', 'training', 'employee engagement', 'purpose',
    ],
  },

  tenders: {
    days: 90,
    maxPages: 10,
    terms: [
      'communications', 'campaign', 'creative services', 'brand strategy',
      'behaviour change', 'public engagement', 'sustainability communications',
      'annual report design', 'report design', 'training', 'awareness campaign',
    ],
    cpvPrefixes: ['79340', '79341', '79342', '79400', '79416', '79822', '79800', '80500'],
  },

  accountWatch: {
    focus:
      'A fresh, dated reason to go back to a client already held — a new commitment, a leadership change, a reporting deadline they are in scope of, or a challenge to a claim they have made.',
    signalTypes: [
      'A new commitment, campaign or strategy published by this organisation',
      'A sustainability or marketing leadership change here',
      'A challenge, ruling or investigation naming this organisation',
      'A reporting obligation or assurance requirement this organisation is in scope of',
    ],
    batchSize: 4,
    windowDays: 60,
  },

  scoring: {
    floor: 6,
    guidance: [
      'A CHALLENGE TO A CLAIM OUTRANKS EVERYTHING. A ruling, investigation or campaign naming a company is the fastest-converting signal in this market, because the organisation needs an answer this week and has no time to run a procurement.',
      'A FIRST-TIME REPORTER IS WORTH MORE THAN AN EXPERIENCED ONE. An organisation newly in scope of a reporting regime has no incumbent designer; one on its fifth report almost certainly does.',
      'A NEW CSO OR CMO IS A NINETY-DAY WINDOW. They arrive wanting a visible early win. Score a recent appointment well above an older one and say when they started.',
      'A COMMITMENT WITH NO CAMPAIGN BEHIND IT IS THE WHOLE PITCH. If a company has announced a target and said nothing since, say so — that gap is the opportunity.',
      'A COMPANY RETREATING FROM A TARGET IS A WEAK LEAD, not a strong one. It signals less appetite to spend here, not more. Score it low and explain why.',
      'A SIGNAL THAT OPENS TWO OR MORE SERVICE LINES IS WORTH MORE THAN A BIGGER ONE CONFINED TO ONE. A new strategy opens brand AND internal training. A first CSRD report opens reporting AND thought leadership. Name both.',
      'GENERAL SUSTAINABILITY NEWS WITH NO NAMED ORGANISATION IS NOT A LEAD and scores 3 or below, however well reported.',
    ],
  },
};
