// Profile loader. PROFILE=<key> in .env selects which business this deployment
// is running for; everything strategy-shaped lives in the profile file.
import nvidia from './nvidia.js';

const PROFILES = { nvidia };

export function loadProfile(key = process.env.PROFILE || 'nvidia') {
  const profile = PROFILES[key];
  if (!profile) {
    throw new Error(`Unknown profile "${key}" — available: ${Object.keys(PROFILES).join(', ')}`);
  }
  return profile;
}

export const listProfiles = () =>
  Object.values(PROFILES).map(({ key, name, description, roster = [], collectors = [] }) =>
    ({ key, name, description, accounts: roster.length, collectors: collectors.length }));
