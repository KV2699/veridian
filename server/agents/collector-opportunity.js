// AGENT 4 — Opportunity Collector
// The only collector hunting things a person can act on this week: a stated
// initiative, an open procurement, a partner programme, a CFP with a deadline.
import { runCollector } from './collector-base.js';

export const config = {
  number: 4,
  name: 'Opportunity Collector',
  category: 'opportunity',
  focus: 'Actionable BD openings — organisations that have publicly stated an AI initiative, opened a procurement, or created a partnering or speaking route in the NVIDIA ecosystem.',
  signalTypes: [
    'Company publicly announcing an AI transformation programme, AI factory, or named AI budget',
    'RFP, tender, or procurement notice for AI infrastructure, GPU capacity or ML platform work',
    'NVIDIA Inception, partner programme, or ecosystem partnering opportunity',
    'AI infrastructure conference, summit, hackathon, or open call for speakers with a date',
    'New AI leadership hire or AI function being stood up (a named owner to approach)',
  ],
  queries: [
    'enterprise announces AI transformation initiative investment programme',
    'RFP tender AI infrastructure GPU compute procurement notice',
    'NVIDIA Inception partner program AI ecosystem opportunity',
    'AI infrastructure conference 2026 call for speakers submissions',
    'appointed head of AI chief AI officer enterprise hire',
  ],
};

export default async function collectOpportunity(ctx) {
  return runCollector(config, ctx);
}
