// PROFILE — NVIDIA ecosystem BD
//
// A profile is the whole strategy of a Signal Bureau deployment in one file:
// who you sell to, what counts as a signal, which way each signal points, how
// fast it goes stale, and which accounts you already hold.
//
// Everything here is a judgement call that cannot be derived from a product
// description. Changing business means writing a new profile, not retraining
// anything — see profiles/README.md for the questions a new profile must answer.

export default {
  key: 'nvidia',
  name: 'NVIDIA Ecosystem',
  description:
    'BD intelligence for selling into, alongside, or in service of the NVIDIA AI infrastructure ecosystem — GPU cloud, sovereign AI programmes, enterprise AI buildouts, and the supply chain underneath them.',

  // ── Practice areas — grouped by where the money actually comes from ───────
  // These are revenue lines, not a product catalogue. That distinction decides
  // whether the scoring works at all.
  //
  // An earlier version split accelerated compute, networking and managed cloud
  // into three areas. They are overwhelmingly sold in the same deal — the
  // interconnect is part of the cluster, and managed cloud is that same
  // capacity bought a different way — so almost every infrastructure signal
  // ticked all three, scored the multi-service bonus, and landed in the top
  // band. Two thirds of one live week came out "Critical", which makes the
  // ranking useless.
  //
  // Grouped this way, "multi-service" means what it should: a genuine
  // cross-sell into a different budget, signed by a different person. The most
  // valuable of those is infrastructure plus software — the recurring, high
  // margin attach on top of a hardware deal.
  //
  // NOTE: partner and ecosystem programmes are deliberately NOT listed here.
  // They are a route to a conversation, not a thing anyone buys, and counting
  // them as an area inflated every score they touched.
  practiceAreas: [
    {
      key: 'compute',
      name: 'Accelerated Compute',
      description: 'GPU systems, instances and managed capacity — DGX, HGX, DGX Cloud. The single largest revenue line. Almost every infrastructure signal points here.',
    },
    {
      key: 'networking',
      name: 'Networking',
      description: 'InfiniBand, Spectrum-X Ethernet, NVLink and BlueField DPUs. A separately reported revenue line with its own competitors — count it when the signal concerns cluster scale, interconnect or fabric, not merely because GPUs are involved.',
    },
    {
      key: 'software',
      name: 'AI Enterprise Software',
      description: 'Per-GPU licensing, NIM microservices, NeMo and model-building services. A separate budget and a separate signature from the hardware, bought as a recurring subscription — the highest-value cross-sell on top of an infrastructure deal.',
    },
    {
      key: 'omniverse',
      name: 'Omniverse & Digital Twin',
      description: 'Simulation, digital twin and industrial visualisation. Bought by manufacturing and engineering teams, not by the infrastructure buyer.',
    },
    {
      key: 'automotive',
      name: 'Automotive',
      description: 'DRIVE platform and in-vehicle compute. An entirely separate buyer on a multi-year design cycle.',
    },
    {
      key: 'edge',
      name: 'Edge & Embedded',
      description: 'Jetson and IGX for on-device inference. Separate buyer, typically robotics, medical devices or industrial systems.',
    },
  ],

  // ── Signal polarity ────────────────────────────────────────────────────────
  // The question no onboarding form can answer, stated explicitly so the
  // collectors and the verifier both read events the same way round.
  //
  // For an executive search firm, a filled role is a lost mandate. Here it is
  // the opposite: a newly appointed AI leader is a budget holder with a 90-day
  // mandate to show progress. That inversion is the difference between a
  // pipeline and an empty week.
  polarity: [
    'A NEW appointment into an AI/infrastructure leadership role is a LEAD — new budget holder, ~90-day window to make contact.',
    'A DEPARTURE with no named successor is a STALL signal on an existing account, not a new opportunity — it means the buying decision has lost its owner.',
    'An announced capacity, power or supply commitment is a LEADING indicator — the purchase decision follows it by 12-24 months, so early contact beats late.',
    'A competitor silicon win (Trainium, TPU, MTIA, Maia, AMD Instinct) at a named account is a DEFENSIVE signal — that account is at risk, flag it rather than celebrating the market news.',
  ],

  // ── Accounts you already hold (Account Watch) ─────────────────────────────
  // Your Tab 1. These are never returned as new prospects; they are swept
  // separately each week for a fresh reason to make contact.
  //
  // ⚠️  DEMONSTRATION ROSTER — replace before relying on this.
  // These are publicly announced NVIDIA ecosystem companies, chosen because
  // their partnerships are a matter of public record. They are NOT anyone's
  // real client list, and nothing confidential was used to build it. Swap in
  // your own accounts and this becomes a real relationship tracker; leave it
  // and it is watching strangers who happen to be in the right market.
  roster: [
    // Neoclouds — GPU capacity as a business
    'CoreWeave', 'Nebius', 'Lambda Labs', 'Crusoe Energy',
    // Hyperscalers
    'Microsoft Azure', 'Oracle Cloud Infrastructure',
    // Systems and channel
    'Dell Technologies', 'Supermicro', 'Hewlett Packard Enterprise', 'Lenovo',
    // Colocation and power
    'Equinix', 'Digital Realty',
  ],

  // Never registered as prospects. The business running this is not its own
  // lead, and a competitor is intelligence rather than an opportunity.
  exclusions: ['NVIDIA', 'NVIDIA Corporation'],

  // Names a normaliser cannot reconcile on its own — acronyms and brands that
  // belong to a parent. Left side is what the press writes; right side is the
  // organisation it should register under.
  aliases: {
    AWS: 'Amazon Web Services',
    'Amazon Web Services (AWS)': 'Amazon Web Services',
    GCP: 'Google Cloud',
    'Google Cloud Platform': 'Google Cloud',
    'Microsoft Azure': 'Microsoft',
    Azure: 'Microsoft',
    Alphabet: 'Google',
    'Meta Platforms': 'Meta',
    HPE: 'Hewlett Packard Enterprise',
    'Oracle Cloud Infrastructure': 'Oracle',
    OCI: 'Oracle',
    TSMC: 'Taiwan Semiconductor Manufacturing Company',
    SMCI: 'Supermicro',
    'Super Micro Computer': 'Supermicro',
  },

  // ── Collectors ─────────────────────────────────────────────────────────────
  // Four discovery collectors. Queries are deliberately event-shaped: each one
  // hunts something that gets PUBLISHED on a date, never an inferred state.
  // "Which companies need more GPUs" is unanswerable; "who announced a
  // datacentre power agreement" is a document that exists.
  collectors: [
    {
      key: 'capital',
      name: 'Capital & Sovereign Collector',
      focus:
        'Money committed to AI compute — private funding of GPU cloud and AI infrastructure, hyperscaler capex guidance, and government-funded national AI programmes. Capital commitment precedes procurement, so this is the earliest reliable demand signal.',
      signalTypes: [
        'GPU cloud, neocloud or AI infrastructure funding round, or debt facility raised against compute',
        'Hyperscaler or large enterprise capital expenditure guidance or commitment naming AI infrastructure',
        'Sovereign or national AI programme: government-funded AI factory, national compute initiative, or public supercomputer procurement, with a named country and budget',
        'NVIDIA or NVentures investment, strategic stake, or ecosystem fund participation in a named company',
        'Acquisition of an AI infrastructure, GPU cloud or AI tooling company',
      ],
      queries: [
        'GPU cloud AI infrastructure funding round raised billion',
        'sovereign AI national programme government compute investment announced',
        'hyperscaler capital expenditure guidance AI infrastructure data center spending',
        'NVIDIA investment stake AI infrastructure company announced',
        'neocloud Series B Series C raised AI compute capacity',
        'national AI factory supercomputer government funding announced',
        'AI infrastructure acquisition acquired data center operator',
        'private credit debt facility GPU financing announced',
      ],
      windowDays: 30,
    },
    {
      key: 'infrastructure',
      name: 'Infrastructure & Supply Collector',
      focus:
        'The physical constraints on GPU deployment — power, land, cooling, and semiconductor supply. Power is the binding constraint on AI compute, so a power or siting agreement is a demand signal 12-24 months ahead of the order it implies.',
      signalTypes: [
        'Datacentre power purchase agreement, grid interconnection approval, or on-site generation deal tied to AI or high-density compute',
        'New AI datacentre site announcement, campus expansion, or megawatt capacity commitment with a named operator',
        'Advanced packaging (CoWoS) or high-bandwidth memory capacity, allocation, or supply agreement',
        'Server ODM or OEM order, manufacturing expansion, or AI system production commitment',
        'Announced supply constraint, allocation change, or lead-time shift affecting AI compute',
      ],
      queries: [
        'AI data center power purchase agreement megawatt announced',
        'new AI data center campus gigawatt site announced operator',
        'HBM CoWoS advanced packaging capacity supply agreement allocation',
        'AI server production order ODM manufacturing expansion announced',
        'data centre grid connection substation approval AI campus',
        'liquid cooling contract AI data center deployment announced',
        'nuclear SMR power agreement data center signed',
        'colocation operator AI capacity expansion lease signed',
      ],
      windowDays: 30,
    },
    {
      key: 'competitive',
      name: 'Competitive Displacement Collector',
      focus:
        'Threats to NVIDIA share of an account — custom silicon programmes, AMD and alternative accelerator wins, and inference-cost pressure. Read defensively: a named company adopting alternative silicon is an account at risk, not neutral market news.',
      signalTypes: [
        'Named company deploying or committing to custom AI silicon (Trainium, TPU, MTIA, Maia) or AMD Instinct at scale',
        'Custom accelerator programme launched, expanded, cancelled or scaled back at a named company',
        'Alternative inference hardware win, benchmark claim, or enterprise deployment announcement',
        'Open-source or framework development that reduces CUDA lock-in at a named organisation',
        'Export control, trade restriction, or regulatory decision that changes which market can be sold to',
      ],
      queries: [
        'company deploying Trainium TPU MTIA custom AI chip at scale',
        'AMD Instinct MI deployment enterprise win announced',
        'custom AI accelerator programme expanded cancelled company',
        'AI chip export controls restriction policy decision announced',
        'inference chip startup deployment enterprise customer announced',
        'hyperscaler custom silicon tape out production announced',
        'company switching GPU vendor migration announced',
        'AI networking ethernet infiniband deployment win announced',
      ],
      windowDays: 30,
    },
    {
      key: 'opportunity',
      name: 'Enterprise Opportunity Collector',
      focus:
        'Named, dated openings a person can act on this week — an enterprise standing up AI infrastructure, an open procurement, or a newly appointed AI leader with budget and a mandate. Per this profile\'s polarity rules, a NEW appointment is the lead.',
      signalTypes: [
        'Enterprise announcing an AI factory, on-premise AI buildout, or named AI infrastructure budget',
        'NEW appointment of a Chief AI Officer, Head of AI Infrastructure, VP Compute or equivalent — the appointment itself is the lead',
        'Published RFP, tender or procurement notice for AI compute, GPU capacity, or ML platform',
        'Research institution, national lab or university announcing a funded AI compute programme',
        'AI infrastructure conference or summit with an open call for speakers or partners and a stated deadline',
      ],
      queries: [
        'enterprise AI factory on-premise AI infrastructure buildout announced',
        'appointed chief AI officer head of AI infrastructure VP compute',
        'RFP tender AI compute GPU procurement notice published',
        'national lab university funded AI supercomputer programme announced',
        'bank insurer manufacturer AI infrastructure investment announced',
        'telecom operator AI data center edge compute programme',
        'healthcare pharma AI compute cluster deployment announced',
        'automotive manufacturer AI compute platform partnership announced',
      ],
      windowDays: 30,
    },
  ],

  // ── Roster sweep (enumerated coverage) ─────────────────────────────────────
  // Walks the organisations already in the register and reports a result for
  // every one, including "no signal found". This is what makes coverage
  // auditable: after a sweep you know which names were checked and which are
  // quiet, rather than only what happened to surface.
  rosterSweep: {
    batchSize: 8,
    windowDays: 30,
    maxOrganisations: 120,
  },

  // ── Official feeds (zero-hallucination discovery) ──────────────────────────
  // Publisher-written headlines with their own urls and dates. Nothing here is
  // scraped and nothing is inferred, which is why this path has never produced
  // a misattributed claim. All verified reachable; a feed that fails is skipped.
  feeds: {
    // Wider than the search window on purpose: feeds are cheap, carry no
    // hallucination risk, and a three-week view builds the prospect register
    // far faster than a seven-day one.
    days: 30,
    sources: [
      { name: 'NVIDIA Newsroom', url: 'https://nvidianews.nvidia.com/releases.xml' },
      { name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com/feed/' },
      { name: 'HPCwire', url: 'https://www.hpcwire.com/feed/' },
      { name: 'Data Center Dynamics', url: 'https://www.datacenterdynamics.com/en/rss/' },
      { name: 'Data Center Knowledge', url: 'https://www.datacenterknowledge.com/rss.xml' },
      { name: 'The Register', url: 'https://www.theregister.com/headlines.atom' },
      { name: 'ESG Dive', url: 'https://www.esgdive.com/feeds/news/' },
      { name: 'Trellis', url: 'https://trellis.net/feed/' },
    ],
    // Applied to headline and standfirst before anything reaches a model, so a
    // general-tech feed costs nothing when it is carrying unrelated news.
    terms: [
      'ai', 'gpu', 'nvidia', 'data cent', 'datacent', 'compute', 'inference',
      'accelerat', 'supercomput', 'hpc', 'cluster', 'megawatt', 'gigawatt',
      'model', 'training', 'hbm', 'cuda', 'sovereign', 'neocloud',
    ],
  },

  // ── Government procurement portals ─────────────────────────────────────────
  // A buyer stating in public, in writing, what they intend to spend and by
  // when. Every field is copied from the notice; no model supplies a fact.
  tenders: {
    days: 60,
    maxPages: 10,
  },

  // ── Account Watch (Agent 5) ────────────────────────────────────────────────
  accountWatch: {
    focus:
      'Fresh, dated reasons to contact an organisation you already hold — expansion, leadership change, earnings commentary, competitive encroachment, or a public commitment you can respond to.',
    signalTypes: [
      'Capacity expansion, new site, or announced growth at this organisation',
      'Leadership change in an infrastructure, AI or procurement role at this organisation',
      'Earnings or public commentary naming AI infrastructure spend or capacity plans',
      'A competitor or alternative silicon win at this organisation (defensive — flag it)',
      'Partnership, customer win or public commitment this organisation has announced',
    ],
    // The roster is swept in batches rather than one query per account, so the
    // cost stays flat as the roster grows.
    batchSize: 4,
    windowDays: 30,
  },

  // ── Scoring ────────────────────────────────────────────────────────────────
  // Guidance handed to the verifier. Deliberately prose, not weights: the
  // numeric floor is enforced in code, the judgement is enforced by instruction.
  scoring: {
    floor: 6,

    // The 25-point commercial-value factor. The original methodology measures
    // breadth — could this prospect buy more than one service? Here revenue is
    // concentrated in one line, so breadth separates almost nothing; measured
    // on a live week it put a 2GW campus and a 4.5MW site on the same score.
    // Deal scale is what actually decides how much money is in a signal.
    valueFactor: {
      key: 'deal_scale',
      name: 'Deal Scale',
      points: { mega: 25, large: 15, standard: 5, unknown: 0 },
      guidance: [
        'mega — the source states something at the scale of a gigawatt or more of capacity, tens of thousands of accelerators, or a commitment above roughly $1bn.',
        'large — hundreds of megawatts, thousands of accelerators, or a commitment in the hundreds of millions.',
        'standard — a named deployment, site or purchase smaller than that, or one whose size is given but modest.',
        'unknown — the source states no size at all. Use this rather than guessing; an unstated size scores nothing.',
      ],
    },
    guidance: [
      'Revenue potential decides everything. A signal implying thousands of GPUs outranks a well-written story about a small deployment, every time.',
      'AI Infrastructure is where the money is — treat a credible infrastructure signal as more valuable than an equally well-sourced signal in any other area.',
      'A signal that reaches software on top of infrastructure is the most valuable kind there is: it is recurring revenue attached to a deal that is already happening. Say so when you see one.',
      'A capital, power or supply commitment outranks a product announcement, because it implies a purchase decision that has already been funded.',
      'A named organisation taking a dated action always outranks a market trend, however well sourced the trend is.',
      'A defensive signal (competitor win at a held account) scores as highly as an offensive one — losing an account costs more than winning a small one.',
      'An ecosystem or developer story with no named buyer is background, not a lead. Score it 5 or below.',
      'A signal that opens a conversation across two or more practice areas is worth more than a larger signal confined to one — multi-service accounts are stickier and cheaper to serve.',
    ],
  },
};
