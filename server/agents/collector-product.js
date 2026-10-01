// AGENT 2 — Product Collector
// What shipped: models, platforms, pricing. Product moves are the most
// reliable BD trigger in this market because they are always dated and public.
import { runCollector } from './collector-base.js';

export const config = {
  number: 2,
  name: 'Product Collector',
  category: 'product',
  focus: 'Product and platform releases across AI infrastructure — new models, pricing changes, and platform launches that change what a buyer can do this quarter.',
  signalTypes: [
    'New open-source or commercial model release from NVIDIA, Meta, Mistral, Qwen, DeepSeek or similar',
    'Nemotron model family release, update, or benchmark publication',
    'GPU cloud pricing change, new instance type, or capacity availability change',
    'New enterprise AI or inference platform launch, or major feature release',
    'Token Factory or inference-platform adoption announcement',
  ],
  queries: [
    'NVIDIA Nemotron model release open source announcement',
    'new open source LLM release weights Meta Mistral Qwen',
    'GPU cloud pricing change per hour H100 B200 instance',
    'enterprise AI inference platform launch announcement',
    'Nebius Token Factory new models available adoption',
  ],
};

export default async function collectProduct(ctx) {
  return runCollector(config, ctx);
}
