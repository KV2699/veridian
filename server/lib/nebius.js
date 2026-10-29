// Nebius Token Factory client.
//
// Token Factory exposes an OpenAI-compatible surface, so this is a thin
// fetch wrapper rather than a vendor SDK. Two model tiers are used:
//   ULTRA — deep synthesis (Agent 5 QA verification, Agent 6 briefing)
//   SUPER — per-source summarisation inside the four collectors
//
// Model IDs come from the environment: run `npm run models` (or GET /api/models)
// to print the exact Nemotron strings your account serves.
//
// The DEFAULTS below must name the models this project actually benchmarked and
// selected, because they are what a reader who clones the repo and supplies only
// an API key will run. They previously defaulted to the older llama-3.1-nemotron
// family, so a fresh clone silently executed a different model from the one the
// README, the submission and the measurements all describe. A default that
// contradicts the documentation is worse than no default.

import { log } from './log.js';

const BASE = (process.env.NEBIUS_BASE_URL || 'https://api.studio.nebius.com/v1').replace(/\/$/, '');

export const MODELS = {
  get ultra() { return process.env.NEBIUS_MODEL_ULTRA || 'nvidia/Nemotron-3-Ultra-550b-a55b'; },
  get fast() { return process.env.NEBIUS_MODEL_FAST || 'nvidia/nemotron-3-super-120b-a12b'; },
  // `super` is the name used in the docs, the dashboard and the briefing; `fast`
  // is the original internal name and is kept so existing call sites still work.
  get super() { return this.fast; },
};

// ── Concurrency limiter ──────────────────────────────────────────────────────
// Five collectors run in parallel, each issuing batched extraction calls. Under
// that load Nebius throttles by returning HTTP 200 with an EMPTY completion
// rather than a 429 — which looks like a model failure and is not one. A
// semaphore caps simultaneous requests so throughput stays inside the limit.
//
// Raise NEBIUS_CONCURRENCY if your account has more headroom; lower it if you
// still see empty completions.
// Running total of what this process has spent at Nebius. Inference is metered
// and there is no usage endpoint on an inference key, so unless the system
// counts its own tokens the only record is a bill at the end of the month —
// and no way to tell which part of the pipeline caused it.
export const tokens = { prompt: 0, completion: 0, calls: 0, byTier: {} };

export function recordUsage(tier, usage) {
  if (!usage) return;
  tokens.calls++;
  tokens.prompt += usage.prompt_tokens ?? 0;
  tokens.completion += usage.completion_tokens ?? 0;
  const t = (tokens.byTier[tier] ??= { prompt: 0, completion: 0, calls: 0 });
  t.calls++;
  t.prompt += usage.prompt_tokens ?? 0;
  t.completion += usage.completion_tokens ?? 0;
}

export const resetTokens = () => {
  tokens.prompt = 0; tokens.completion = 0; tokens.calls = 0; tokens.byTier = {};
};

const MAX_CONCURRENT = Math.max(1, Number(process.env.NEBIUS_CONCURRENCY) || 2);
let active = 0;
const waiting = [];

async function withSlot(fn) {
  if (active >= MAX_CONCURRENT) await new Promise((resolve) => waiting.push(resolve));
  active++;
  try { return await fn(); }
  finally {
    active--;
    waiting.shift()?.();
  }
}

function requireKey() {
  const key = (process.env.NEBIUS_API_KEY ?? '').trim();
  if (!key) throw new Error('NEBIUS_API_KEY is not set — copy .env.example to .env and add your Nebius key');
  if (/^your_|_key$/i.test(key)) {
    throw new Error('NEBIUS_API_KEY is still the .env.example placeholder — paste your real key from studio.nebius.com');
  }
  return key;
}

/**
 * One chat completion against Nebius Token Factory.
 * @param {{system?:string, user:string, tier?:'ultra'|'fast', maxTokens?:number,
 *          temperature?:number, json?:boolean, retries?:number}} opts
 * @returns {Promise<{text:string, model:string, usage:object|null}>}
 */
export async function complete({
  system, user, tier = 'ultra', maxTokens = 2000,
  temperature = 0.3, json = false, retries = 2,
}) {
  const key = requireKey();
  const model = MODELS[tier];
  const body = {
    model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
    max_tokens: maxTokens,
    temperature,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  };

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) {
      // Jitter matters: without it, several throttled callers retry in lockstep
      // and reproduce the same burst that caused the throttling.
      const wait = Math.round(1500 * 2 ** (attempt - 1) * (1 + Math.random()));
      log.warn(`Nebius retry ${attempt}/${retries} in ${wait}ms — ${lastErr.message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
    try {
      const res = await withSlot(() => fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      }));
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 400);
        // 4xx other than 429 will not fix themselves — fail fast.
        if (res.status !== 429 && res.status < 500) {
          throw Object.assign(new Error(`Nebius ${res.status}: ${detail}`), { fatal: true });
        }
        throw new Error(`Nebius ${res.status}: ${detail}`);
      }
      const data = await res.json();
      const choice = data.choices?.[0];
      const text = choice?.message?.content ?? '';
      if (!text.trim()) {
        // Two very different causes wear the same empty reply, so name which:
        //   length — the model spent its whole budget before answering
        //   anything else — usually throttling under concurrency
        const why = choice?.finish_reason === 'length'
          ? 'the model hit max_tokens before producing an answer — raise maxTokens, or use a model that does not reason at length'
          : 'usually throttling under concurrency — lower NEBIUS_CONCURRENCY';
        throw new Error(`Nebius returned an empty completion (finish_reason=${choice?.finish_reason ?? 'none'}) — ${why}`);
      }
      recordUsage(tier, data.usage);
      return { text, model, usage: data.usage ?? null, finishReason: choice?.finish_reason ?? null };
    } catch (err) {
      if (err.fatal) throw err;
      lastErr = err;
    }
  }
  throw new Error(`Nebius request failed after ${retries + 1} attempts — ${lastErr.message}`);
}

/**
 * Chat completion whose reply must parse as JSON.
 *
 * Reasoning-tuned models (Nemotron Lightning among them) routinely narrate
 * before answering — "Let me analyze the search results..." — and may ignore
 * response_format entirely. Two defences:
 *   1. extractJSON scans the whole reply for the best JSON candidate rather
 *      than trusting the first bracket it sees (prose is full of brackets).
 *   2. If that fails, one repair call hands the prose back and asks for JSON
 *      only. Cheaper and far more reliable than failing the batch.
 */
export async function completeJSON(opts) {
  const { text, model, usage, finishReason } = await complete({ ...opts, json: true });
  const expect = opts.expectKey;

  // Truncated output is the dangerous case: it often still contains a smaller
  // well-formed fragment, which a lenient parser will happily accept as the
  // whole answer. A live run silently lost 46 of 79 verification verdicts that
  // way. Refuse it, and let the caller retry with a smaller workload.
  if (finishReason === 'length') {
    throw Object.assign(
      new Error('Nebius reply was truncated at max_tokens — the result is incomplete and cannot be trusted'),
      { truncated: true },
    );
  }

  try {
    return { data: extractJSON(text, expect), model, usage, raw: text, repaired: false };
  } catch (firstErr) {
    log.warn(`reply was not valid JSON, attempting repair — ${firstErr.message}`);
    const { text: fixed } = await complete({
      tier: opts.tier,
      temperature: 0,
      maxTokens: opts.maxTokens ?? 2000,
      json: true,
      retries: 1,
      system: 'You convert text into JSON. Output the JSON value only. No explanation, no preamble, no reasoning, no code fence. Your entire reply must start with { or [ and end with } or ].',
      user: `Extract the JSON from the following text and return it alone. If the text contains no usable data, return ${expect ? `{"${expect}":[]}` : '{}'}.

${text.slice(0, 6000)}`,
    });
    // A failed repair throws, and the caller treats the batch as lost.
    return { data: extractJSON(fixed, expect), model, usage, raw: text, repaired: true };
  }
}

/**
 * Pull a JSON value out of a model reply.
 * Scans every balanced candidate and prefers one that parses AND carries the
 * expected key, so a stray "[News]" in the narration cannot win over the real
 * payload further down the reply.
 */
export function extractJSON(text, expectKey) {
  const cleaned = String(text ?? '')
    .replace(/```(?:json)?/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();

  const candidates = [];
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch !== '{' && ch !== '[') continue;
    const value = balancedFrom(cleaned, i);
    if (value === null) continue;
    try { candidates.push(JSON.parse(value)); } catch { /* not this one */ }
  }

  if (!candidates.length) {
    throw new Error(`No JSON found in model reply: ${cleaned.slice(0, 140)}`);
  }

  // Prefer a candidate with the expected key and a non-empty array in it,
  // then any candidate with the key, then the largest parseable object.
  if (expectKey) {
    const withData = candidates.find((c) => Array.isArray(c?.[expectKey]) && c[expectKey].length);
    if (withData) return withData;
    const withKey = candidates.find((c) => c && expectKey in c);
    if (withKey) return withKey;
    // A bare array is a common shape when the model drops the wrapper.
    const bare = candidates.find((c) => Array.isArray(c) && c.length && typeof c[0] === 'object');
    if (bare) return { [expectKey]: bare };
  }

  return candidates.sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length)[0];
}

// Returns the balanced JSON substring starting at `start`, or null.
function balancedFrom(s, start) {
  const open = s[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

/** List the models this Nebius account can call — used to verify Nemotron IDs. */
export async function listModels() {
  const res = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${requireKey()}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Nebius ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { data = [] } = await res.json();
  return data.map((m) => m.id).sort();
}
