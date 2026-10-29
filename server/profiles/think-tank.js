// PROFILE — Green Alliance · environmental policy think tank
//
// Ported from the operator's "GA BD Tracker v6" (four tabs: Partner Expansion,
// New Prospects, Live Signals, Coalition & Research) and the GA Prompt
// Compendium v1.
//
// THIS PROFILE IS THE THIRD READING OF THE SAME EVENT, and that is why it is
// worth shipping alongside the other two:
//
//   "Company X appoints a Head of Sustainability"
//     nvidia       → a LEAD. New budget holder with a mandate.
//     exec-search  → a DEAD LEAD. The mandate is filled, the fee is gone.
//     think-tank   → a LEAD, but for a different reason entirely. Not a buyer —
//                    a new decision-maker to brief, with roughly ninety days
//                    before their position on policy hardens.
//
// Three businesses, one headline, three different correct answers. No signup
// form could ever derive that.
//
// WHAT MAKES A THINK TANK DIFFERENT FROM A VENDOR. It does not sell a product.
// It sells partnership, convening and research, funded by business supporters,
// foundations and grants. So the money arrives from a funder while the
// influence is exercised on a company — and the system has to track both.

export default {
  key: 'think-tank',
  name: 'Environmental Policy Think Tank',
  description:
    'BD intelligence for an environmental policy think tank — business supporters, foundation funders, coalition partners and research commissions across six policy areas, in a market where the buying trigger is a published consultation, an appointment or a commitment rather than a procurement.',

  market: 'environmental policy and climate influence',
  reader:
    'a partnerships lead at an environmental policy think tank, who is funded by business supporters, foundations and research commissions, and who needs to reach a new decision-maker inside the ninety days before their position on policy sets',

  sweepTerms: 'climate policy sustainability commitment consultation appointment',

  // ── The six policy areas ──────────────────────────────────────────────────
  // Straight from the v6 tracker's "Current Practice Areas" and "Expansion
  // Practice Areas" columns. A partner already inside one area who could be
  // brought into a second is the single most valuable row in that tracker —
  // which is precisely what the multi-service factor measures.
  practiceAreas: [
    {
      key: 'political',
      name: 'Political Leadership',
      description: 'Convening and influencing across party lines — party conference work, parliamentary engagement, cross-party commissions. Opened by an election, a reshuffle, a select committee inquiry, or a party announcing a policy review.',
    },
    {
      key: 'lowcarbon',
      name: 'Low Carbon Future',
      description: 'Decarbonisation of energy, heat and transport. Opened by a net-zero commitment, a decarbonisation strategy, a grid or heat policy consultation, or a company announcing a transition plan.',
    },
    {
      key: 'economy',
      name: 'Greening the Economy',
      description: 'Green finance, industrial strategy, jobs and skills. Opened by an investment announcement, a green finance framework, a transition-plan requirement, or a company setting a capital allocation policy.',
    },
    {
      key: 'nature',
      name: 'Natural Environment',
      description: 'Nature recovery, land use, water and biodiversity. Opened by a nature commitment, a biodiversity net-gain obligation, a land-use framework, or an enforcement action on a water or land operator.',
    },
    {
      key: 'resources',
      name: 'Resources & Circular Economy',
      description: 'Waste, packaging, plastics and resource productivity. Opened by extended producer responsibility, a deposit return scheme, a packaging commitment, or a company announcing circular targets.',
    },
    {
      key: 'governance',
      name: 'Legislation & Governance',
      description: 'Reporting standards, environmental law and institutional reform. Opened by a reporting regime coming into force, a consultation on environmental governance, or a company first coming into scope of a disclosure requirement.',
    },
  ],

  // ── Polarity ──────────────────────────────────────────────────────────────
  polarity: [
    'A NEW SUSTAINABILITY, CLIMATE OR POLICY LEAD APPOINTED at a company or public body is a LEAD — not as a buyer, but as a decision-maker to brief. There is roughly a ninety-day window before their position on policy hardens, and that window is the whole opportunity.',
    'A GOVERNMENT CONSULTATION OPENING is one of the strongest leads in this system, because it has a published closing date and a response is expected. State the deadline. It is the only thing here that genuinely expires.',
    'A COMPANY PUBLISHING A NET-ZERO, NATURE OR TRANSITION COMMITMENT is a LEAD — a public commitment needs policy credibility behind it, and the organisation now has something to defend.',
    'A COMPANY WEAKENING OR ABANDONING A CLIMATE TARGET is ALSO a LEAD, and a different kind. It is an advocacy target rather than a partnership prospect, so flag it as such and do not score it as a funding opportunity.',
    'A FOUNDATION OR FUNDER ANNOUNCING A GRANT PROGRAMME, strategy or call is a LEAD on the funding side rather than the influence side. These are the rows that actually pay for the work, and they carry hard deadlines.',
    'A COALITION, ALLIANCE OR TASKFORCE FORMING is a LEAD — the question is whether to join it, convene it or brief it, and being early is the whole advantage.',
    'AN ENFORCEMENT ACTION OR PROSECUTION against a company in a policy area we work in is a LEAD on the SECTOR, not usually on the defendant. The other companies in that sector are the ones who now need to demonstrate credibility.',
    'A REGULATOR OR GOVERNMENT DEPARTMENT IS NOT ITSELF A FUNDER OR A PARTNER in most cases. It is the author of the obligation. The lead is whoever the decision obliges.',
  ],

  // ⚠️  ILLUSTRATIVE ROSTER — publicly documented partners and coalition
  // members in this space, not any organisation's confidential supporter list.
  roster: [
    'Aviva', 'AECOM', 'Associated British Ports', 'Co-operative Group',
    'ClientEarth', 'E3G', 'CPRE', 'Esmee Fairbairn Foundation',
  ],

  exclusions: [
    'Green Alliance',
    // Peer think tanks: collaborators and competitors for the same funding.
    'IPPR', 'Demos', 'Policy Exchange', 'Bright Blue', 'Onward',
    'Institute for Government', 'Resolution Foundation', 'Chatham House',
  ],

  aliases: {
    'Co-op': 'Co-operative Group',
    'The Co-operative Group': 'Co-operative Group',
    'Esmée Fairbairn': 'Esmee Fairbairn Foundation',
    DEFRA: 'Department for Environment, Food and Rural Affairs',
    DESNZ: 'Department for Energy Security and Net Zero',
  },

  collectors: [
    {
      key: 'commitment',
      name: 'Commitment & Appointment Collector',
      focus:
        'Organisations taking a public position on climate, nature or resources, and the people newly responsible for it. A commitment creates something to defend; an appointment creates someone to brief.',
      signalTypes: [
        'A company or public body publishing a net-zero, nature, transition or circular-economy commitment with a stated target',
        'A new sustainability, climate, ESG or policy lead appointed at a named organisation',
        'A company weakening, delaying or abandoning a previously stated climate or nature target',
        'An organisation publishing a transition plan or coming into scope of a disclosure requirement for the first time',
      ],
      queries: [
        'company publishes net zero transition plan target announced',
        '"has appointed" head of sustainability OR director of climate announced',
        'company weakens delays scraps climate target announced',
        'nature biodiversity commitment announced company target',
      ],
      windowDays: 90,
    },
    {
      key: 'funding',
      name: 'Funding & Coalition Collector',
      focus:
        'Where the money and the convening power are: foundation grant programmes, research commissions, and coalitions or taskforces forming in our policy areas.',
      signalTypes: [
        'A foundation, trust or funder announcing a grant programme, strategy or open call with a deadline',
        'A research commission, inquiry or evidence call in one of our policy areas',
        'A coalition, alliance or taskforce forming, with named founding members',
        'A government consultation opening, with a stated closing date',
      ],
      queries: [
        'foundation announces grant programme climate nature open call deadline',
        'coalition launched founding members climate business alliance announced',
        'government consultation opens closing date environment climate',
        'commission inquiry call for evidence environment policy launched',
      ],
      windowDays: 90,
    },
  ],

  // ── Regulators and public bodies ──────────────────────────────────────────
  // For a think tank these are the single richest source: a consultation is a
  // published invitation to respond, with a deadline, and responding is the work.
  regulators: {
    windowDays: 90,
    maxResults: 10,
    terms: 'consultation call for evidence closing date policy statement strategy published response',
    bodies: [
      { name: 'DEFRA', domain: 'gov.uk', terms: 'environment consultation call for evidence nature land use closing' },
      { name: 'DESNZ', domain: 'gov.uk', terms: 'energy net zero consultation call for evidence closing date' },
      { name: 'Environment Agency', domain: 'gov.uk', terms: 'enforcement permit consultation water environment decision' },
      { name: 'Ofwat', domain: 'ofwat.gov.uk', terms: 'price review determination consultation decision' },
      { name: 'Ofgem', domain: 'ofgem.gov.uk', terms: 'consultation decision net zero scheme' },
      { name: 'Climate Change Committee', domain: 'theccc.org.uk', terms: 'carbon budget progress report advice published' },
      { name: 'UK Parliament committees', domain: 'committees.parliament.uk', terms: 'inquiry call for evidence environment climate closing' },
    ],
  },

  excludeDomains: [
    'precedenceresearch.com', 'grandviewresearch.com', 'marketsandmarkets.com',
    'mordorintelligence.com', 'marketbeat.com', 'simplywall.st', 'seekingalpha.com',
    'fool.com', 'facebook.com', 'instagram.com', 'reddit.com', 'youtube.com',
  ],

  rosterSweep: { batchSize: 8, windowDays: 90, maxOrganisations: 48 },

  // ── Free collection layer ─────────────────────────────────────────────────
  // Twelve feeds, all fetched and confirmed live. This sector is unusually well
  // served by free sources, which is why this profile is the best demonstration
  // of what the system can do with no search budget at all.
  feeds: {
    days: 30,
    sources: [
      { name: 'edie', url: 'https://edie.net/feed/' },
      { name: 'Carbon Brief', url: 'https://carbonbrief.org/feed/' },
      { name: 'Climate Home News', url: 'https://climatechangenews.com/feed/' },
      { name: 'ESG Dive', url: 'https://esgdive.com/feeds/news/' },
      { name: 'ESG Today', url: 'https://esgtoday.com/feed/' },
      { name: 'Responsible Investor', url: 'https://responsible-investor.com/feed/' },
      { name: 'The Ecologist', url: 'https://theecologist.org/rss' },
      { name: 'DeSmog', url: 'https://desmog.com/feed/' },
      { name: 'Greenpeace UK', url: 'https://greenpeace.org.uk/feed/' },
      { name: 'Friends of the Earth', url: 'https://foe.co.uk/rss.xml' },
      { name: 'Green Alliance', url: 'https://green-alliance.org.uk/feed/' },
      { name: 'The Guardian', url: 'https://theguardian.com/rss' },
    ],
    terms: [
      'net zero', 'climate', 'emissions', 'decarbonis', 'transition plan',
      'nature', 'biodiversity', 'water', 'land use', 'circular', 'packaging',
      'waste', 'recycling', 'plastic', 'green finance', 'taxonomy',
      'consultation', 'call for evidence', 'inquiry', 'select committee',
      'policy', 'legislation', 'regulation', 'bill', 'target', 'commitment',
      'pledge', 'strategy', 'appoint', 'steps down', 'grant', 'funding',
      'foundation', 'coalition', 'alliance', 'taskforce', 'enforcement',
    ],
  },

  tenders: {
    days: 90,
    maxPages: 10,
    terms: [
      'research', 'evaluation', 'policy analysis', 'evidence review',
      'stakeholder engagement', 'consultation support', 'climate', 'net zero',
      'environment', 'sustainability', 'nature recovery', 'circular economy',
      'behaviour change', 'secretariat',
    ],
    cpvPrefixes: ['73110', '73210', '79311', '79315', '79400', '90700', '90710', '90720'],
  },

  accountWatch: {
    focus:
      'A fresh, dated reason to go back to a partner, supporter or funder already held — a new commitment, a leadership change, a consultation they are in scope of, or an expansion into a policy area they do not yet work with us on.',
    signalTypes: [
      'A new commitment, target or transition plan published by this organisation',
      'A leadership change in a sustainability, policy or public affairs role here',
      'A consultation or obligation this organisation is explicitly in scope of',
      'This organisation joining a coalition, or appearing in a policy area beyond the one we work with them on',
    ],
    batchSize: 4,
    windowDays: 90,
  },

  scoring: {
    floor: 6,
    guidance: [
      'A CONSULTATION OR CALL WITH A PUBLISHED CLOSING DATE OUTRANKS ALMOST EVERYTHING ELSE, because it is the only signal here that genuinely expires. Always state the date.',
      'AN EXISTING PARTNER APPEARING IN A POLICY AREA THEY DO NOT YET WORK WITH US ON IS THE MOST VALUABLE ROW IN THE SYSTEM. That is expansion inside a relationship that already exists, and it is cheaper to win than any new name.',
      'A FUNDER IS A DIFFERENT KIND OF LEAD FROM A COMPANY. A foundation grant programme pays for the work; a corporate partner funds and legitimises it. Say which one a signal is.',
      'A NEW APPOINTMENT IS A NINETY-DAY WINDOW, not an open-ended one. Score a recent appointment well above an older one, and say when they started.',
      'A COMPANY RETREATING FROM A TARGET IS AN ADVOCACY TARGET, NOT A PROSPECT. Flag it clearly so nobody approaches them for funding.',
      'SECTOR-WIDE POLICY NEWS WITH NO NAMED ORGANISATION IS CONTEXT, NOT A LEAD. It belongs in the market section and scores 4 or below.',
      'A SIGNAL THAT OPENS TWO OR MORE POLICY AREAS IS WORTH MORE THAN A LARGER SIGNAL CONFINED TO ONE — a partner working across areas is harder to lose and cheaper to serve.',
    ],
  },
};
