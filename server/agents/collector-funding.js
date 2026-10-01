// AGENT 1 — Funding Collector
// Money moving in AI infrastructure: who raised, who is buying, who partnered.
import { runCollector } from './collector-base.js';

export const config = {
  number: 1,
  name: 'Funding Collector',
  category: 'funding',
  focus: 'Capital and procurement events in AI infrastructure — GPU cloud funding rounds, enterprise AI purchasing, and partnerships in the Nebius and NVIDIA ecosystems.',
  signalTypes: [
    'New GPU cloud or AI infrastructure funding round (seed through growth, and debt facilities for compute)',
    'Enterprise AI procurement or committed-spend announcement',
    'Nebius or Token Factory partnership, customer win, or capacity deal',
    'NVIDIA investment, strategic stake, or ecosystem fund participation',
    'Acquisition of an AI infrastructure or AI tooling company',
  ],
  queries: [
    'GPU cloud provider funding round raised AI infrastructure',
    'Nebius Token Factory partnership customer announcement',
    'NVIDIA investment stake AI infrastructure startup',
    'enterprise AI compute procurement deal signed contract',
    'AI infrastructure acquisition acquired data center GPU company',
  ],
};

export default async function collectFunding(ctx) {
  return runCollector(config, ctx);
}
