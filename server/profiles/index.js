// Profile loader. A profile is the whole strategy of a deployment: who you
// sell to, what counts as a signal, which way each signal points, how fast it
// goes stale, and which accounts you already hold. The pipeline is generic.
//
// PROFILE=<key> in .env sets the default; the dashboard and /api/run can
// select either profile per run, and each one keeps its own data directory so
// two markets never merge into one register.
//
// Two profiles ship, deliberately chosen to be opposites rather than variants:
//
//   nvidia       a vendor selling into the AI infrastructure market. An
//                appointment is a LEAD. Commercial value is DEAL SCALE,
//                because revenue is concentrated in one line and breadth
//                measures nothing.
//   exec-search  an ESG executive search firm. The same appointment is a DEAD
//                LEAD. Commercial value is MULTI-SERVICE breadth, the engine
//                default, because breadth genuinely varies signal to signal.
//
// That pair is the proof of concept: identical code, identical agents,
// opposite readings of the identical event. A third market means writing a
// third file — see profiles/README.md for the questions it must answer.
import nvidia from './nvidia.js';
import execSearch from './exec-search.js';

const PROFILES = { nvidia, 'exec-search': execSearch };

export const DEFAULT_PROFILE = process.env.PROFILE || 'nvidia';

export const profileKeys = () => Object.keys(PROFILES);

export function loadProfile(key = DEFAULT_PROFILE) {
  const profile = PROFILES[key];
  if (!profile) {
    throw new Error(`Unknown profile "${key}" — available: ${Object.keys(PROFILES).join(', ')}`);
  }
  return profile;
}

export const listProfiles = () =>
  Object.values(PROFILES).map(({ key, name, description, market, roster = [], collectors = [], practiceAreas = [], scoring = {} }) =>
    ({
      key,
      name,
      description,
      market: market ?? null,
      accounts: roster.length,
      collectors: collectors.length,
      practice_areas: practiceAreas.length,
      // Named so the dashboard can show WHAT each configuration measures,
      // which is the difference a reader should notice between the two.
      value_factor: scoring.valueFactor?.name ?? 'Multi-Service Potential',
      is_default: key === DEFAULT_PROFILE,
    }));
