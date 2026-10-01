// Fixture signals for DRY_RUN. Clearly synthetic on purpose: these must never
// be mistakable for real collected intelligence in a briefing or a demo.
export const FIXTURE_SIGNALS = [
  {
    company: 'Example GPU Cloud Ltd', signal_type: 'Funding Round',
    summary: 'FIXTURE — Example GPU Cloud Ltd announced a Series B to expand inference capacity.',
    url: 'https://example.com/fixture/funding-series-b', url_key: 'example.com/fixture/funding-series-b',
    date: null, relevance_score: 8, category: 'funding', source_title: 'Fixture result',
    found_via: 'dry run', collected_at: new Date().toISOString(),
  },
  {
    company: 'Example Models Inc', signal_type: 'Model Release',
    summary: 'FIXTURE — Example Models Inc released an open-weights reasoning model.',
    url: 'https://example.com/fixture/model-release', url_key: 'example.com/fixture/model-release',
    date: null, relevance_score: 7, category: 'product', source_title: 'Fixture result',
    found_via: 'dry run', collected_at: new Date().toISOString(),
  },
  {
    company: 'Example Hyperscaler', signal_type: 'Capacity Expansion',
    summary: 'FIXTURE — Example Hyperscaler announced a new AI region.',
    url: 'https://example.com/fixture/capacity', url_key: 'example.com/fixture/capacity',
    date: null, relevance_score: 7, category: 'competitive', source_title: 'Fixture result',
    found_via: 'dry run', collected_at: new Date().toISOString(),
  },
  {
    company: 'Example Enterprise Group', signal_type: 'AI Initiative',
    summary: 'FIXTURE — Example Enterprise Group announced an AI transformation programme.',
    url: 'https://example.com/fixture/initiative', url_key: 'example.com/fixture/initiative',
    date: null, relevance_score: 8, category: 'opportunity', source_title: 'Fixture result',
    found_via: 'dry run', collected_at: new Date().toISOString(),
  },
];
