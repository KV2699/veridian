// Fixture signals for DRY_RUN, generated from whichever profile is loaded.
// Clearly synthetic on purpose: these must never be mistakable for real
// collected intelligence in a briefing or a demo.
export function fixtureSignals(profile) {
  const now = new Date().toISOString();
  const make = (category, company, type, text) => ({
    company, signal_type: type,
    summary: `FIXTURE — ${text}`,
    url: `https://example.com/fixture/${category}`,
    url_key: `example.com/fixture/${category}`,
    date: null, relevance_score: 8, category,
    source_title: 'Fixture result', found_via: 'dry run', collected_at: now,
    verified: true, needs_review: false,
  });

  return [
    ...profile.collectors.map((c) =>
      make(c.key, 'Example Corp', 'Fixture Signal', `example ${c.key} signal for the ${profile.name} profile.`)),
    { ...make('account', profile.roster?.[0] ?? 'Example Account', 'Fixture Signal', 'example account signal.'), is_account: true },
  ];
}
