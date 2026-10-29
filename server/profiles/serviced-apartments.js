// PROFILE — Bob W · serviced apartments and aparthotels
//
// Ported from the operator's own "Bob W BD Tracker v2 — Revenue Intelligence
// Dashboard": six revenue streams, 25+ cities, and a scoring model identical to
// every other tracker in the set (practice fit 30 / multi-service 25 / urgency
// 25 / scale 20, banded Critical 75+).
//
// WHY THIS PROFILE IS WORTH SHIPPING. It is the furthest thing from an AI
// infrastructure vendor in the whole collection — physical hospitality, sold
// city by city — and it still fits the engine without a line of code changing.
// If the architecture generalises anywhere, it has to generalise here.
//
// TWO THINGS IT DOES THAT NO OTHER PROFILE DOES:
//
//   1. GEOGRAPHY IS PART OF THE FIT. A signal only matters if the organisation
//      is moving into, or already sits in, a city where Bob W has buildings.
//      "Cities Overlap" is a column in the original tracker, and the scoring
//      guidance below carries it.
//   2. THE WINDOW IS SHORT AND IT DECAYS. The original tracker marks every row
//      RETAIN / FREE NOW / EXPIRED, because a company opening an office books
//      its first six weeks of accommodation and then the habit sets. After that
//      the relationship is still worth having, but the commercial hook is gone.

export default {
  key: 'serviced-apartments',
  name: 'Serviced Apartments',
  description:
    'BD intelligence for a serviced-apartment and aparthotel operator selling across 25+ European cities — corporate rate agreements, property leases, team offsites, relocation, travel-management partnerships and production bookings.',

  market: 'serviced apartments and corporate accommodation',
  reader:
    'a business development lead at a serviced-apartment operator, who earns when a company signs a corporate rate agreement or a landlord signs a lease, and who has roughly six weeks from an office opening before booking habits set',

  sweepTerms: 'office expansion relocation headquarters travel accommodation',

  // ── The cities ────────────────────────────────────────────────────────────
  // Geography is part of the fit here, so the cities have to be NAMED. The
  // first run of this profile scored every signal below the floor, and the
  // reason was this list being absent: the verifier was told city overlap
  // mattered and given no way to test it, so it marked everything down.
  cities: [
    'Amsterdam', 'Berlin', 'Copenhagen', 'Helsinki', 'London', 'Madrid',
    'Milan', 'Stockholm', 'Tallinn', 'Vienna', 'Munich', 'Hamburg',
    'Barcelona', 'Lisbon', 'Dublin', 'Zurich', 'Paris', 'Oslo',
  ],

  // ── The six revenue streams ───────────────────────────────────────────────
  // Taken verbatim from the tracker. Each is a separate budget signed by a
  // different person — which is exactly what makes multi-service meaningful
  // here: a company that takes a corporate rate AND runs offsites AND relocates
  // staff is worth three times one that just books rooms.
  practiceAreas: [
    {
      key: 'corporate',
      name: 'Corporate Accounts',
      description: 'Corporate rate agreements for companies whose staff travel between or relocate into our cities. Opened by an office opening, a headquarters move, headcount growth, a funding round, or a company consolidating operations into cities we serve.',
    },
    {
      key: 'realestate',
      name: 'Real Estate & Leases',
      description: 'Taking buildings: leases, management agreements and partnerships with landlords, developers and REITs. Opened by a hotel or resi asset coming to market, a developer announcing a scheme, a REIT restructuring its portfolio, or an operator exiting a building.',
    },
    {
      key: 'offsites',
      name: 'Team Offsites',
      description: 'Whole-floor and multi-apartment bookings for company weeks, retreats and offsites. Opened by a distributed or hybrid company announcing gatherings, an all-hands, or a post-merger integration that needs teams in one place.',
    },
    {
      key: 'relocation',
      name: 'Relocation & Extended Stay',
      description: 'Thirty-day-plus stays for staff relocating between cities. Opened by a company moving its headquarters, opening a new market, or announcing large-scale hiring in a city where candidates will arrive from elsewhere.',
    },
    {
      key: 'tmc',
      name: 'Travel Management Partnerships',
      description: 'Distribution through travel management companies, booking platforms and corporate travel agencies. A different buyer entirely — the intermediary, not the end client. Opened by a TMC expanding its European inventory or announcing a partnership programme.',
    },
    {
      key: 'production',
      name: 'Production & Crew',
      description: 'Film, television and production crews needing weeks of accommodation in one city. Opened by a production announcing a shoot location, a studio opening a European base, or a streamer committing to local-language content in one of our markets.',
    },
  ],

  // ── Polarity ──────────────────────────────────────────────────────────────
  // The inversions here are geographic and temporal rather than role-based,
  // which is what makes this profile a genuine test of the engine.
  polarity: [
    'AN OFFICE OPENING, HEADQUARTERS MOVE OR NEW MARKET ENTRY in a city we serve is the strongest LEAD there is — staff need accommodation from week one, and the booking habit sets within about six weeks. Speed matters more than size.',
    'A COMPANY CONSOLIDATING OR EXITING A MARKET cuts both ways and the direction decides everything: consolidating INTO cities we serve is a LEAD, because travel between those cities increases. Exiting a city we serve is a DEAD LEAD on that city, however large the company.',
    'A FUNDING ROUND OR ANNOUNCED HEADCOUNT GROWTH is a LEAD — more staff in more places means more nights, and a freshly funded company has not yet signed an accommodation agreement with anyone.',
    'A HOTEL OR RESIDENTIAL ASSET COMING TO MARKET, a developer announcing a scheme, or an operator handing back a building is a LEAD for the real estate stream, not the corporate one. Different buyer, different conversation, often a longer deal.',
    'A COMPETITOR OPENING IN A CITY WE SERVE is a DEFENSIVE signal — flag it against the accounts in that city rather than treating it as an opportunity.',
    'AN ORGANISATION WITH NO PRESENCE IN ANY CITY WE SERVE IS NOT A PROSPECT, however well the event reads. Geography is part of the fit here, not a filter applied afterwards.',
    'A MERGER OR ACQUISITION is a LEAD on two streams at once — integration means people travelling between two sets of offices for months, and it usually means offsites.',
  ],

  // ⚠️  ILLUSTRATIVE ROSTER — not a client list. Replace with the CRM export.
  // These are organisations whose European footprint is a matter of public
  // record; nothing confidential was used to build this.
  roster: [
    'Wolt', 'Spotify', 'Klarna', 'Revolut', 'Bolt', 'Zalando',
    'Pandox', 'CBRE', 'JLL',
  ],

  exclusions: [
    'Bob W',
    // Competitors in extended-stay and aparthotels: intelligence, not leads.
    'Sonder', 'Staycity', 'Cheval Collection', 'The Ascott', 'Adagio',
    'Numa', 'Limehome', 'Edyn', 'Locke', 'citizenM', 'Zoku',
  ],

  aliases: {
    'Wolt Enterprises': 'Wolt',
    'DoorDash International': 'Wolt',
    'Spotify AB': 'Spotify',
    'Klarna Bank': 'Klarna',
    CBRE: 'CBRE Group',
  },

  // ── Collectors ────────────────────────────────────────────────────────────
  // Queries are written for the search layer when credits exist. With none,
  // the feed and tender collectors below carry the run on their own.
  collectors: [
    {
      key: 'expansion',
      name: 'Expansion & Relocation Collector',
      focus:
        'Companies arriving in, or growing inside, the cities we operate in. The event is always a dated, published announcement — an office opening, a headquarters move, a market entry, a funding round naming expansion, or stated hiring in a named city.',
      signalTypes: [
        'A company opening an office, hub or headquarters in a named European city',
        'A company relocating its headquarters or consolidating offices into a named city',
        'A funding round where the announcement states European expansion or hiring in named cities',
        'A company announcing large-scale hiring in a named city, implying relocation of staff',
        'A merger or acquisition creating integration travel between two named locations',
      ],
      queries: [
        'company opens new European headquarters office announced city',
        'raised funding plans European expansion hiring offices announced',
        'company relocates headquarters to announced new office',
        'opens first office in Amsterdam OR Berlin OR Helsinki OR Stockholm announced',
        'acquisition integration offices teams relocating announced',
      ],
      windowDays: 30,
    },
    {
      key: 'property',
      name: 'Property & Asset Collector',
      focus:
        'Buildings becoming available: hotel and residential assets coming to market, developers announcing schemes, REITs restructuring portfolios, and operators handing back or exiting buildings in cities we serve.',
      signalTypes: [
        'A hotel, aparthotel or residential asset brought to market, sold, or placed under review in a named city',
        'A developer announcing a scheme that includes serviced accommodation or flexible living',
        'A REIT or property owner announcing a portfolio restructure, disposal or repositioning',
        'An operator exiting, handing back or closing a building in a named city',
      ],
      queries: [
        'aparthotel OR serviced apartment asset sold acquired announced city',
        'developer announces mixed use scheme flexible living serviced accommodation',
        'REIT portfolio disposal hotel assets announced Europe',
        'hotel operator exits hands back building announced',
      ],
      windowDays: 90,
    },
  ],

  // ── Regulators and public bodies ──────────────────────────────────────────
  // Short-let and tourism licensing decides whether a building can trade at
  // all, and a licensing change is the one thing that moves a whole city's
  // supply at once. The lead is never the regulator — it is the operators and
  // landlords the decision obliges.
  regulators: {
    windowDays: 90,
    maxResults: 10,
    terms: 'short term let licensing registration scheme decision rules tourism accommodation',
    bodies: [
      { name: 'Amsterdam City Council', domain: 'amsterdam.nl', terms: 'vakantieverhuur short stay policy rules decision' },
      { name: 'Greater London Authority', domain: 'london.gov.uk', terms: 'short term lets planning accommodation policy' },
      { name: 'Scottish Government', domain: 'gov.scot', terms: 'short term lets licensing scheme decision' },
      { name: 'European Commission — tourism', domain: 'ec.europa.eu', terms: 'short term rental regulation data sharing tourism accommodation' },
    ],
  },

  excludeDomains: [
    'precedenceresearch.com', 'grandviewresearch.com', 'marketsandmarkets.com',
    'mordorintelligence.com', 'indexbox.io', 'marketbeat.com', 'simplywall.st',
    'seekingalpha.com', 'fool.com', 'tripadvisor.com', 'booking.com',
    'facebook.com', 'instagram.com', 'reddit.com', 'youtube.com',
  ],

  rosterSweep: { batchSize: 8, windowDays: 30, maxOrganisations: 48 },

  // ── Free collection layer ─────────────────────────────────────────────────
  // Nine feeds, every one fetched and confirmed to return items before it was
  // committed. This is the half of the system that costs no search credits, and
  // with no Tavily budget it is the whole of it.
  feeds: {
    days: 30,
    sources: [
      // The customers: companies opening offices, raising money and entering
      // markets. The first run of this profile read the hospitality trade press
      // instead and returned Accor, Hyatt, IHG and Rosewood — every one a
      // competitor, every one correctly scored 1-3 by the verifier. The press
      // that covers your own industry reports your rivals, not your buyers.
      { name: 'Sifted', url: 'https://sifted.eu/feed/' },
      { name: 'Tech.eu', url: 'https://tech.eu/feed/' },
      { name: 'EU-Startups', url: 'https://eu-startups.com/feed/' },
      { name: 'Silicon Canals', url: 'https://siliconcanals.com/feed/' },
      { name: 'UKTN', url: 'https://uktech.news/feed/' },
      { name: 'City AM', url: 'https://cityam.com/feed/' },
      // The landlords: assets, schemes and portfolios for the real estate stream.
      { name: 'Property Week', url: 'https://propertyweek.com/news/rss' },
      { name: 'Bisnow', url: 'https://bisnow.com/feed/' },
      { name: 'CoStar', url: 'https://costar.com/rss.xml' },
      // One hospitality source, kept deliberately: it is where a building
      // changing hands or an operator exiting a city is reported first.
      { name: 'ShortTermRentalz', url: 'https://shorttermrentalz.com/feed/' },
    ],    // Balanced on purpose. A filter weighted only to movement verbs passed 11
    // items of 145 on another profile and produced one signal; one weighted
    // only to topic nouns passed 144 of 178 and cost a fortune in extraction.
    // These pair the sector's nouns with the events that actually create demand.
    terms: [
      'opens', 'opening', 'expansion', 'expands', 'relocat', 'headquarters', 'hq',
      'new office', 'launches in', 'enters', 'market entry', 'first site',
      'raises', 'funding', 'series a', 'series b', 'series c', 'acquisition',
      'acquires', 'merger', 'hiring', 'headcount', 'jobs',
      'aparthotel', 'serviced apartment', 'extended stay', 'short term rental',
      'hotel', 'lease', 'landlord', 'developer', 'scheme', 'portfolio',
      'reit', 'asset', 'disposal', 'management agreement', 'operator',
      'corporate travel', 'business travel', 'relocation', 'offsite', 'coliving',
    ],
  },

  // Public bodies and large employers publish accommodation and travel
  // framework tenders. The buyer states what they want in writing, with a date.
  tenders: {
    days: 90,
    maxPages: 10,
    terms: [
      'accommodation', 'serviced apartments', 'hotel booking', 'temporary accommodation',
      'relocation services', 'travel management', 'corporate travel',
      'extended stay', 'short term accommodation', 'conference and accommodation',
    ],
    cpvPrefixes: ['55100', '55110', '55120', '55200', '55270', '63510', '63511', '98341'],
  },

  accountWatch: {
    focus:
      'A fresh, dated reason to contact a company or landlord already held — a new office, a funding round, an acquisition, an announced offsite, a portfolio change, or growth in a city we serve.',
    signalTypes: [
      'This organisation opening, moving or expanding an office in any city',
      'This organisation raising funding, announcing growth or announcing hiring',
      'This organisation acquiring or merging with another, implying integration travel',
      'A landlord or partner announcing a portfolio or asset change',
    ],
    batchSize: 4,
    windowDays: 30,
  },

  // ── Scoring ───────────────────────────────────────────────────────────────
  // No valueFactor declared, so the engine keeps multi-service breadth — which
  // is exactly right here. A company that can take a corporate rate AND run an
  // offsite AND relocate staff is the whole commercial thesis of the business.
  scoring: {
    floor: 6,
    guidance: [
      'THE CITIES WE SERVE ARE: Amsterdam, Berlin, Copenhagen, Helsinki, London, Madrid, Milan, Stockholm, Tallinn, Vienna, Munich, Hamburg, Barcelona, Lisbon, Dublin, Zurich, Paris and Oslo. City overlap is part of the fit, not a filter applied afterwards — an organisation moving into or already operating in one of those scores far higher than a larger organisation with no presence in any of them. Name the city in the summary.',
      'A HOTEL GROUP, APARTHOTEL BRAND OR ACCOMMODATION OPERATOR IS NOT A PROSPECT — it is a competitor. Score it 2 or below. The prospects here are the companies that NEED accommodation and the landlords who own buildings, not the people selling rooms.',
      'SPEED BEATS SIZE ON AN OFFICE OPENING. A company that opened somewhere three weeks ago is worth more than a larger one that opened a year ago, because accommodation habits set within about six weeks and then the hook is gone.',
      'A SIGNAL THAT OPENS TWO OR MORE REVENUE STREAMS IS THE MOST VALUABLE KIND. A headquarters move opens corporate rates AND relocation. A merger opens corporate AND offsites. Name both streams explicitly when you see it.',
      'A PROPERTY SIGNAL IS A DIFFERENT BUYER FROM A CORPORATE SIGNAL. An asset coming to market is a conversation with a landlord or investor about a lease, not a conversation with a travel manager about rates. Do not blend them.',
      'A COMPANY LEAVING A CITY WE SERVE IS NOT A LEAD for that city, however large it is and however well the story is sourced.',
      'A COMPETITOR OPENING NEARBY IS DEFENSIVE. Score it like any other signal, but say which held account it threatens.',
      'MARKET COMMENTARY ABOUT HOSPITALITY OR OFFICE DEMAND IS NOT A LEAD. It names no organisation taking a dated action, so it scores 3 or below however well written it is.',
    ],
  },
};
