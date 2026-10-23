// PROFILE — ESG & sustainability executive search
//
// This is the second configuration, and it exists to prove something the
// architecture claims: that the SAME pipeline, with no code changes, can serve
// a business that reads the identical event in the OPPOSITE direction.
//
// Run the nvidia profile and "Company X appoints a Head of Sustainability" is
// a new budget holder with a 90-day mandate — a lead. Run this profile and the
// same sentence is a mandate filled and a fee gone — a dead lead. Nothing in a
// product description implies that inversion. It has to be declared, and it is
// declared below in `polarity`, from where it travels into every prompt in the
// pipeline.
//
// EVIDENCE BASE. This is not a sketch written for a demo. It is a port of a
// prompt pack (v3) that was diagnosed against live test searches, after v1 and
// v2 of the same pack returned almost nothing. Eight root causes were found;
// five of them are design constraints in this file:
//
//   1. The prompts hunted STATES, not EVENTS. "Does this organisation lack a
//      Head of Sustainability" asks a search engine to prove a negative. No
//      document says it, so a model either returns nothing or invents. Every
//      signalTypes entry below names something that gets PUBLISHED on a date.
//   2. Appointment-hunting is backwards for a recruiter. A test search for
//      appointments returned six closed appointments — and the dominant
//      pattern in first-CSO hires is INTERNAL PROMOTION, where no search fee
//      was ever available. The inversions are in `polarity`.
//   3. The target universe was wrong. The original ~100-org list was FTSE and
//      global mega-caps: the worst prospects here, because they have mature
//      functions, in-house talent teams and incumbent PSLs with the two
//      largest competitors. See the winnable-universe note on `scoring`.
//   4. The source list was stale. It cited a publication that had rebranded,
//      and omitted the trade press that actually carries these moves. Every
//      feed below was fetched and confirmed live before it was committed;
//      three candidates were dropped for returning 403 or 404.
//   6. A 90-day window is wrong for recruitment. A vacancy is contested by
//      rival firms within days and a job posting closes. Windows are set PER
//      COLLECTOR below — 30 days for vacancies, 21 for postings, 90 only for
//      the slower-burning restructure and deal-driven signals.
//
// NAMING. The methodology this is ported from was written for a specific firm.
// The profile is named generically, and the roster is illustrative, because
// this repository is public: nothing here is any firm's real client list and
// nothing confidential was used to build it. A real deployment replaces the
// roster with the CRM export and keeps everything else.

export default {
  key: 'exec-search',
  name: 'ESG Executive Search',
  description:
    'BD intelligence for a sustainability and ESG executive search firm — hunting open mandates rather than filled ones. Departures without named successors, backfill vacancies created by internal promotions, un-mandated direct-employer postings, and functions that are about to be rebuilt.',

  // Short noun phrase for the agent prompts. The pipeline is generic; every
  // prompt needs to be told which market it is reading.
  market: 'sustainability and ESG executive search',
  reader:
    'a business development lead at a sustainability and ESG executive search firm, who is paid when a senior sustainability role is filled and earns nothing from a role that is already filled',

  // Suffix appended to the enumerated sweeps, where the query is a list of
  // organisation names and needs a topic to pin it to this market.
  sweepTerms: 'sustainability ESG leadership hiring departure restructure',

  // ── Practice areas — the four things this business actually sells ─────────
  // These are the capabilities a signal can open a conversation about. Breadth
  // is the right commercial-value measure here, which is why this profile does
  // NOT declare a valueFactor: it keeps the engine default, Multi-Service
  // Potential. A prospect who could buy a retained search AND interim cover
  // AND a pay benchmark is worth materially more than one who could buy a
  // single placement, and unlike the nvidia profile that breadth genuinely
  // varies signal to signal.
  practiceAreas: [
    {
      key: 'search',
      name: 'Executive Search',
      description: 'Retained search for board, C-suite and functional-head roles — Chief Sustainability Officer, Head of ESG, Head of Responsible Investment. The highest-fee engagement and the one a departure or a newly created leadership seat points at directly.',
    },
    {
      key: 'recruitment',
      name: 'Professional Recruitment',
      description: 'Permanent mid-senior hiring below functional-head level — managers, specialists and the second layer of a team. The backfill vacancy left behind by an internal promotion usually lands here, not in retained search.',
    },
    {
      key: 'interim',
      name: 'Contract & Interim',
      description: 'Interim and contract cover. Count it when a seat is vacant NOW with no successor named, when a reporting deadline falls before a permanent hire could realistically start, or when a restructure has removed capacity a company still needs.',
    },
    {
      key: 'advisory',
      name: 'Advisory & Assessment',
      description: 'Leadership assessment, team and function diagnostics, pay benchmarking, and market-mapping or census work. Count it when an organisation is building or rebuilding a function rather than filling one seat — a new division, a post-restructure rebuild, or a first-time compliance scope change.',
    },
  ],

  // ── Signal polarity — THE field that makes this profile different ─────────
  // Read these against the same block in nvidia.js. Items 1, 2 and 3 are
  // exact inversions. This is the single highest-leverage decision in the
  // system, and an empty week looks exactly like a quiet market, so getting it
  // backwards is invisible for months.
  polarity: [
    'A NEW APPOINTMENT into a sustainability or ESG leadership role is a DEAD LEAD, not a lead — the mandate is filled and the fee is gone. Return it ONLY if it created a backfill vacancy, or the source states further hiring or team build-out.',
    'A DEPARTURE WITH NO NAMED SUCCESSOR is the strongest lead in this system — an open seat with a live search need and a decision-maker under pressure to fill it.',
    'An INTERNAL PROMOTION is a lead for the role the promotee VACATED, never for the role they filled. Read the promotee\'s PREVIOUS title: that seat is now open, is usually not yet advertised, and nobody else is searching for it.',
    'A JOB POSTING THAT NAMES A RECRUITMENT AGENCY OR SEARCH FIRM IS A DEAD LEAD — the mandate already belongs to a competitor. A senior role posted directly by the employer with no agency named is an un-mandated live search and scores high.',
    'A RESTRUCTURE, LAYOFF OR TITLE ELIMINATION in a sustainability function is a lead on a 6-12 month horizon, not a negative — the function rebuilds, and the firm that was talking to them before the rebuild wins it.',
    'HIRING MUST BE STATED, NEVER INFERRED. "This company has grown and probably needs a sustainability lead" is not a signal. If you are deducing a hiring need rather than reading one, there is no signal.',
    'A MEGA-CAP IS A WEAK PROSPECT EVEN ON A REAL SIGNAL — FTSE 100 majors, global oil and gas, the Big Four and global banks have mature functions, in-house talent teams and incumbent search agreements. They qualify on a departure or a restructure and almost never on general activity.',
  ],

  // ── Accounts already held (Account Watch) ─────────────────────────────────
  // ⚠️  ILLUSTRATIVE ROSTER — not a client list, and not anyone's CRM.
  //
  // These are well-known organisations in the sustainability employment market,
  // chosen so Account Watch has something real to sweep in a public demo. They
  // are NOT represented as customers of any firm. A real deployment pastes the
  // CRM export here, at which point this becomes a relationship tracker rather
  // than a watch list of organisations in the right market.
  //
  // What the roster does mechanically matters more than who is on it: these
  // names are never returned as new prospects, and they get their own weekly
  // sweep for a fresh reason to make contact.
  roster: [
    // Mid-market and B Corp employers — the winnable universe, built a
    // sustainability function recently or still building one
    'Octopus Energy', 'Ørsted', 'Ecotricity', 'Innocent Drinks', 'Patagonia',
    // Asset managers and infrastructure funds building ESG capability
    'Federated Hermes', 'Impax Asset Management',
    // Mid-tier consultancies and engineering firms below the Big Four
    'Ramboll', 'Royal HaskoningDHV',
    // Certification, standards and assurance — adjacent hiring, high churn
    'Lloyd\'s Register', 'Carbon Trust',
  ],

  // Never registered as prospects at all.
  //
  // The competitor list is the important half. A rival search firm is
  // INTELLIGENCE, not an opportunity — it does not buy executive search — and
  // in testing, agency-branded content is exactly what a sustainability-hiring
  // query surfaces most. Without this, a quarter of the register would be
  // competitors.
  exclusions: [
    'Acre', 'Acre Resources',
    'Korn Ferry', 'Heidrick & Struggles', 'Russell Reynolds Associates',
    'Spencer Stuart', 'Egon Zehnder', 'Odgers Berndtson', 'Robert Walters',
    'Hays', 'Michael Page', 'PageGroup', 'Fawkes & Reece',
  ],

  // Press variants a normaliser cannot reconcile on its own.
  aliases: {
    SBTi: 'Science Based Targets initiative',
    'Science Based Targets': 'Science Based Targets initiative',
    'M&S': 'Marks & Spencer',
    'Marks and Spencer': 'Marks & Spencer',
    JLR: 'Jaguar Land Rover',
    'Unilever PLC': 'Unilever',
    'Nestlé': 'Nestle',
    PwC: 'PricewaterhouseCoopers',
    EY: 'Ernst & Young',
    KPMG: 'KPMG',
    'Deloitte LLP': 'Deloitte',
    'Orsted': 'Ørsted',
    'Kimberly Clark': 'Kimberly-Clark',
  },

  // ── Collectors ─────────────────────────────────────────────────────────────
  // Four collectors, mapping the six findable signal types (S1-S6) from the
  // tested pack. Every query hunts a published event. None of them asks
  // whether a company "needs" anything.
  collectors: [
    {
      key: 'vacancy',
      name: 'Departure & Backfill Collector',
      // S1 + S2. The highest-value collector in this profile and the one that
      // did not exist in the original pack at all.
      focus:
        'Senior sustainability and ESG seats that are OPEN. Two kinds: a departure where the source does not name a confirmed successor, and the seat vacated one level down when someone was promoted internally into a sustainability leadership role. The second kind is almost never advertised, which is exactly why it is worth finding.',
      signalTypes: [
        'A Chief Sustainability Officer, Head of Sustainability, Head of ESG, Sustainability Director or equivalent has left or announced they are leaving, and the source does NOT name a confirmed successor — state the role now open',
        'Someone was PROMOTED INTERNALLY into a sustainability leadership role — the lead is the role they VACATED, named explicitly, with whether any successor to it has been named',
        'Someone announced they are JOINING a new organisation from a named sustainability role elsewhere — the ORIGIN organisation now has the vacancy and is the lead, not the destination',
        'A source explicitly states an organisation will recruit, is recruiting, or has begun a search for a named sustainability or ESG role',
      ],
      queries: [
        'chief sustainability officer steps down no successor named',
        'head of sustainability departs company will recruit successor',
        'ESG director leaves role replacement not yet named',
        'promoted to chief sustainability officer from previous role internal promotion',
        'sustainability leadership change announced search for successor begins',
        'inaugural chief sustainability officer exits after years',
      ],
      windowDays: 30,
    },
    {
      key: 'posting',
      name: 'Direct-Employer Posting Collector',
      // S3. Window is 21 days and not negotiable upward: postings close. A
      // 90-day window here guaranteed a pipeline of roles that were gone.
      focus:
        'Senior sustainability and ESG roles advertised DIRECTLY BY THE EMPLOYER, with no recruitment agency named. A role already listed with an agency is a dead lead — the mandate belongs to a competitor. A role posted direct, at or above Head-of level, is an un-mandated live search.',
      signalTypes: [
        'A senior sustainability, ESG, climate, impact or responsible-investment role at or above Head-of level, advertised by the employing organisation itself, with no recruitment agency or search firm named anywhere in the posting',
        'A NEWLY CREATED senior sustainability role, where the source states the role is new rather than a replacement',
        'An organisation publicly stating it is building or expanding a sustainability team, with named roles',
      ],
      // General web, not news: a job advert is not a news article, and the
      // news topic will never return one.
      topic: 'general',
      queries: [
        'head of sustainability vacancy apply careers newly created role',
        'hiring head of ESG director of sustainability apply directly employer',
        'recruiting chief sustainability officer applications closing date',
        'vacancy head of responsible investment head of impact apply',
        'join our team building sustainability function roles open',
        'now hiring sustainability director climate lead employer careers page',
      ],
      windowDays: 21,
    },
    {
      key: 'restructure',
      name: 'Restructure & New-Mandate Collector',
      // S4 + S5. Slower, so 90 days is correct here and nowhere else.
      focus:
        'Functions that are about to be rebuilt, and functions that are about to exist. A sustainability team cut, a title eliminated, or a sustainability remit handed to a new entity, region or business unit. A cut function is not bad news here — it rebuilds within 6-12 months, and the early mover wins the rebuild.',
      signalTypes: [
        'A restructure, layoff round or title elimination affecting a sustainability, ESG or climate function at a named organisation',
        'A sustainability or ESG function being merged into, or split out of, another function — risk, legal, operations, communications',
        'A new entity, region, subsidiary or business unit created WITH a sustainability remit, implying net-new roles',
        'An organisation newly in scope of a mandatory sustainability reporting regime by growth, listing or acquisition, where the source states the compliance obligation',
      ],
      queries: [
        'sustainability team restructure ESG function cut roles eliminated',
        'company eliminates chief sustainability officer role merged into',
        'ESG team reorganisation sustainability function scaled back',
        'new sustainability business unit launched office opened region',
        'company creates ESG division building new team',
        'first time CSRD reporting scope company compliance obligation',
      ],
      windowDays: 90,
    },
    {
      key: 'dealflow',
      name: 'Deal-Driven Hiring Collector',
      // S6. The hard rule here is the whole collector: hiring must be STATED
      // in the announcement. Every funding round "probably" means hiring, and
      // that inference is how the original pack filled up with nothing.
      focus:
        'Funding, private-equity, M&A and IPO announcements that STATE hiring or team build-out with a sustainability, ESG or impact remit. The deal is not the signal; the stated hiring is. If the announcement does not say they are hiring, there is no signal here.',
      signalTypes: [
        'A funding round, PE investment, acquisition or IPO where the announcement explicitly states hiring, team build-out or leadership appointments with a sustainability, ESG, impact or climate remit',
        'A portfolio company or newly acquired business stating it will build a sustainability or ESG function',
        'An asset manager, infrastructure fund or investor stating it is building ESG, stewardship or responsible-investment capability',
      ],
      queries: [
        'raised funding plans to hire sustainability ESG team build out',
        'private equity portfolio company building ESG function hires planned',
        'asset manager building responsible investment team appoints hires',
        'acquisition integration ESG reporting team hiring stated',
        'climate tech scale up hiring sustainability leadership after Series',
        'infrastructure fund expands ESG capability new hires announced',
      ],
      windowDays: 90,
    },
  ],

  // ── Regulators and public bodies ───────────────────────────────────────────
  // Compulsory work is the strongest buying trigger there is, because the
  // organisation has no choice. Here the chain is one step longer than in a
  // vendor profile: the regulation does not create a hiring need directly, it
  // creates a REPORTING OBLIGATION WITH A DATE, and an organisation newly in
  // scope has to staff it — usually with an interim first, because the deadline
  // arrives before a permanent hire can.
  //
  // The lead is never the regulator. It is whoever the decision obliges.
  regulators: {
    windowDays: 90,
    maxResults: 10,
    terms: 'reporting requirement first reporting period in scope deadline assurance mandatory effective date',
    bodies: [
      { name: 'Financial Reporting Council', domain: 'frc.org.uk', terms: 'UK Sustainability Reporting Standards effective date reporting requirement assurance' },
      { name: 'Financial Conduct Authority', domain: 'fca.org.uk', terms: 'sustainability disclosure requirements labelling rules in scope deadline' },
      { name: 'EFRAG', domain: 'efrag.org', terms: 'ESRS reporting standard first reporting period scope' },
      { name: 'IFRS Foundation / ISSB', domain: 'ifrs.org', terms: 'IFRS S1 S2 adoption jurisdiction effective date requirement' },
      { name: 'European Commission — finance', domain: 'finance.ec.europa.eu', terms: 'CSRD corporate sustainability reporting scope threshold deadline' },
      { name: 'Singapore Exchange', domain: 'sgx.com', terms: 'climate reporting requirement listed issuers effective' },
    ],
  },

  // ── Domains worth never reading ────────────────────────────────────────────
  // Deliberately short — the measured lesson from the other profile is that an
  // aggressive exclusion list cut one test query from ten results to one.
  //
  // The market-research block is market-agnostic SEO noise. The job-aggregator
  // block is specific to this profile: those sites republish agency postings,
  // which are dead leads by definition, and every one of them otherwise has to
  // be read by a model before it can be discarded.
  excludeDomains: [
    'precedenceresearch.com', 'grandviewresearch.com', 'marketsandmarkets.com',
    'mordorintelligence.com', 'indexbox.io', 'marketgrowthreports.com',
    'marketbeat.com', 'simplywall.st', 'seekingalpha.com', 'fool.com',
    'facebook.com', 'instagram.com', 'reddit.com', 'youtube.com',
    'jobserve.com', 'cv-library.co.uk', 'totaljobs.com', 'reed.co.uk',
  ],

  // ── Roster sweep (enumerated coverage) ─────────────────────────────────────
  // Smaller than the vendor profile's. Deliberate: this profile is new, the
  // register starts empty, and a sweep of 120 names costs 15 searches a week
  // that a young register cannot justify. Raise it as the register fills.
  rosterSweep: {
    batchSize: 8,
    windowDays: 30,
    maxOrganisations: 48,
  },

  // ── Official feeds (zero-hallucination discovery) ──────────────────────────
  // The cheapest yield in the system: publisher-written headlines with their
  // own urls and dates, no search credits, and no way for a model to invent a
  // source. This is the corrected source list from root cause 4 — the trade
  // press that actually carries sustainability executive moves, including the
  // two vertical outlets that catch departures the ESG press misses.
  //
  // Every url below returned HTTP 200 with items when this profile was
  // committed. Three candidates were dropped: one 404, two 403.
  feeds: {
    days: 30,
    sources: [
      { name: 'Trellis', url: 'https://trellis.net/feed/' },
      { name: 'ESG Dive', url: 'https://www.esgdive.com/feeds/news/' },
      { name: 'CSO Futures', url: 'https://www.csofutures.com/feed/' },
      { name: 'ESG Today', url: 'https://www.esgtoday.com/feed/' },
      { name: 'ESG News', url: 'https://www.esgnews.com/feed/' },
      { name: 'edie', url: 'https://www.edie.net/feed/' },
      { name: 'Responsible Investor', url: 'https://www.responsible-investor.com/feed/' },
      { name: 'Sustainable Tech Partner', url: 'https://sustainabletechpartner.com/feed/' },
      { name: 'HR Dive', url: 'https://www.hrdive.com/feeds/news/' },
      // Vertical trade press — catches moves the ESG outlets never report
      { name: 'Packaging Dive', url: 'https://www.packagingdive.com/feeds/news/' },
      { name: 'Food Dive', url: 'https://www.fooddive.com/feeds/news/' },
    ],
    // Matched against headline and standfirst before anything reaches a model.
    // Weighted to MOVEMENT words rather than topic words: a feed full of
    // sustainability news is useless here unless someone is leaving, being
    // promoted, being recruited or being restructured.
    terms: [
      'sustainability officer', 'chief sustainability', 'head of sustainability',
      'head of esg', 'esg lead', 'sustainability director', 'head of climate',
      'responsible investment', 'head of impact',
      'steps down', 'stepping down', 'departs', 'departure', 'exits', 'leaves',
      'resigns', 'succeed', 'successor', 'promoted', 'promotion', 'appoint',
      'hire', 'hiring', 'recruit', 'vacancy', 'job cuts', 'layoff', 'restructur',
      'reorganis', 'eliminat', 'executive moves', 'people moves',
      'csrd', 'uk srs', 'issb', 'ifrs s1', 'ifrs s2', 'sdr',
    ],
  },

  // ── Government procurement portals ─────────────────────────────────────────
  // A public body stating in writing that it intends to buy recruitment or
  // search services, with a closing date. Narrower and more valuable than the
  // vendor profile's equivalent, because the notice names the service being
  // bought rather than implying it.
  tenders: {
    days: 90,
    maxPages: 10,
    terms: [
      'executive search', 'recruitment services', 'recruitment framework',
      'interim management', 'interim resource', 'supply of personnel',
      'talent acquisition', 'head of sustainability', 'sustainability recruitment',
      'leadership assessment', 'market mapping', 'pay benchmarking',
      'non-executive director recruitment', 'board appointments',
    ],
    // CPV: recruitment and personnel services. Narrow on purpose — the broad
    // business-services codes match almost any public contract.
    cpvPrefixes: ['79600', '79610', '79611', '79620', '79621', '79630'],
  },

  // ── Account Watch ──────────────────────────────────────────────────────────
  accountWatch: {
    focus:
      'A fresh, dated reason to contact an organisation already held — a leadership change in or around the sustainability function, a restructure, a newly created team, a reporting obligation they have just come into scope for, or a public commitment that implies people they do not yet have.',
    signalTypes: [
      'A departure, promotion or appointment anywhere in or adjacent to this organisation\'s sustainability, ESG or climate function',
      'A restructure, team change or growth announcement affecting this organisation',
      'A new reporting obligation, assurance requirement or compliance scope change stated to apply to this organisation',
      'A new sustainability commitment, target or strategy this organisation has published that implies capability it must staff',
      'A competitor search firm publicly placing a role at this organisation — defensive, flag it',
    ],
    batchSize: 4,
    windowDays: 30,
  },

  // ── Scoring ────────────────────────────────────────────────────────────────
  // No valueFactor is declared, so the engine keeps its default — Multi-Service
  // Potential, 25 points for a signal that opens two or more of the four
  // capabilities. That is the right measure here and the wrong one for a vendor
  // whose revenue sits in a single line; the nvidia profile overrides it with
  // deal scale for exactly that reason.
  scoring: {
    floor: 6,
    guidance: [
      'AN OPEN SEAT OUTRANKS EVERYTHING. A departure with no named successor, or a vacated seat behind an internal promotion, is the most valuable signal this system can produce. Score it above any appointment, however senior.',
      'A FILLED ROLE IS NOT A LEAD. Score an appointment 5 or below unless the source states a backfill vacancy or further hiring. It is not a near-miss; it is the absence of an opportunity.',
      'A POSTING WITH AN AGENCY NAMED IS A DEAD LEAD. Score it 0-3 and say which agency holds it in the review reason. The mandate is gone; the only value left is competitive intelligence.',
      'THE WINNABLE UNIVERSE IS MID-MARKET. Prioritise PE- and VC-backed companies, scale-ups, mid-tier consultancies and engineering firms below the Big Four, cleantech and climate tech, asset managers and infrastructure funds building ESG capability, B Corps, and organisations newly in CSRD or UK SRS scope. These build a function for the first time and have no incumbent search agreement.',
      'A MEGA-CAP SCORES DOWN unless the signal is a departure or a restructure. FTSE 100 majors, global oil and gas, the Big Four and global banks have in-house talent teams and incumbent panels, so general activity at one of them is not an opportunity.',
      'URGENCY IS REAL HERE, NOT NOTIONAL. A vacancy is contested by rival firms within days. Treat a signal from the last week as materially more valuable than one from last month, and treat an expired job posting as worthless however good the role was.',
      'A SIGNAL THAT OPENS TWO OR MORE CAPABILITIES IS WORTH MORE THAN A BIGGER SIGNAL CONFINED TO ONE. A vacant seat with a reporting deadline behind it opens interim cover AND a permanent search. A function being rebuilt after a restructure opens advisory as well as hiring. Say so when you see one.',
      'NEVER SCORE AN INFERRED HIRING NEED. If the source does not state a departure, a vacancy, a posting, a restructure, a new remit or stated hiring, the correct score is 0 and the correct action is to drop it.',
      'SECTOR COMMENTARY IS NOT A LEAD. "Demand for sustainability talent is rising" names nobody and scores 3 or below, however well sourced it is.',
    ],
  },
};
