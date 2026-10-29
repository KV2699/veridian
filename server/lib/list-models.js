#!/usr/bin/env node
// Prints the model IDs this Nebius account can call, Nemotron/NVIDIA first.
// Run this before trusting the model strings in .env:  npm run models
import 'dotenv/config';
import { listModels, MODELS } from './nebius.js';

const ids = await listModels();
const nvidia = ids.filter((id) => /nvidia|nemotron/i.test(id));

console.log(`\n${ids.length} models available on this Nebius account.\n`);
console.log('NVIDIA / Nemotron models:');
if (nvidia.length) nvidia.forEach((id) => console.log(`  ${id}`));
else console.log('  (none found — check your account has NVIDIA models enabled)');

console.log('\nCurrently configured in .env:');
for (const [tier, id] of [['ULTRA', MODELS.ultra], ['SUPER', MODELS.fast]]) {
  console.log(`  ${tier.padEnd(5)} ${id}  ${ids.includes(id) ? '✓ available' : '✗ NOT in the list above — fix .env'}`);
}
console.log('');
