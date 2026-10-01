// AGENT 3 — Competitive Collector
// Hyperscaler and challenger moves. Read for displacement openings: a
// competitor's constraint or price move is a reason to call an account.
import { runCollector } from './collector-base.js';

export const config = {
  number: 3,
  name: 'Competitive Collector',
  category: 'competitive',
  focus: 'Competitive landscape in AI compute — hyperscaler moves, new GPU cloud entrants, and consolidation that shifts where enterprise AI workloads land.',
  signalTypes: [
    'AWS, Google Cloud, Azure or Oracle AI infrastructure announcement, capacity build, or custom silicon move',
    'New GPU cloud or neocloud entrant, regional launch, or capacity expansion',
    'Open-source model release that shifts the build-vs-buy calculation',
    'Enterprise AI market consolidation, merger, shutdown, or withdrawal',
    'Compute supply constraint, allocation change, or export-control development',
  ],
  queries: [
    'AWS Google Azure AI infrastructure announcement capacity GPU',
    'new GPU cloud provider launch neocloud expansion region',
    'AI infrastructure company shut down consolidation merger',
    'GPU supply constraint allocation shortage export controls',
    'hyperscaler custom AI chip Trainium TPU Maia announcement',
  ],
};

export default async function collectCompetitive(ctx) {
  return runCollector(config, ctx);
}
