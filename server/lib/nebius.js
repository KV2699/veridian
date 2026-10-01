// Nebius Token Factory client.
//
// Token Factory exposes an OpenAI-compatible surface, so this is a thin
// fetch wrapper rather than a vendor SDK. Two model tiers are used:
//   ULTRA — deep synthesis (Agent 5 QA verification, Agent 6 briefing)
//   FAST  — per-source summarisation inside the four collectors
//
// Model IDs come from the environment, never hardcoded: run `npm run models`
// (or GET /api/models) to print the exact Nemotron strings your account serves.

import { log } from './log.js';

const BASE = (process.env.NEBIUS_BASE_URL || 'https://api.studio.nebius.com/v1').replace(/\/$/, '');

export const MODELS = {
  get ultra() { return process.env.NEBIUS_MODEL_ULTRA || 'nvidia/llama-3.1-nemotron-70b-instruct'; },
  get fast() { return process.env.NEBIUS_MODEL_FAST || process.env.NEBIUS_MODEL_ULTRA || 'nvidia/llama-3.1-nemotron-nano-8b-v1'; },
};

function requireKey() {
  const key = process.env.NEBIUS_API_KEY;
  if (!key) throw new Error('NEBIUS_API_KEY is not set — copy .env.example to .env and add your Nebius key');
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
      const wait = 1200 * 2 ** (attempt - 1);
      log.warn(`Nebius retry ${attempt}/${retries} in ${wait}ms — ${lastErr.message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 400);
        // 4xx other than 429 will not fix themselves — fail fast.
        if (res.status !== 429 && res.status < 500) {
          throw Object.assign(new Error(`Nebius ${res.status}: ${detail}`), { fatal: true });
        }
        throw new Error(`Nebius ${res.status}: ${detail}`);
      }
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? '';
      if (!text.trim()) throw new Error('Nebius returned an empty completion');
      return { text, model, usage: data.usage ?? null };
    } catch (err) {
      if (err.fatal) throw err;
      lastErr = err;
    }
  }
  throw new Error(`Nebius request failed after ${retries + 1} attempts — ${lastErr.message}`);
}

/**
 * Chat completion whose reply must parse as JSON.
 * Nemotron occasionally wraps JSON in prose or a fenced block even when asked
 * not to, so the first balanced JSON value in the reply is extracted.
 */
export async function completeJSON(opts) {
  const { text, model, usage } = await complete({ ...opts, json: true });
  return { data: extractJSON(text), model, usage, raw: text };
}

export function extractJSON(text) {
  const cleaned = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through to scanning */ }

  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error(`No JSON found in model reply: ${text.slice(0, 180)}`);
  const open = cleaned[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) {
      return JSON.parse(cleaned.slice(start, i + 1));
    }
  }
  throw new Error(`Unbalanced JSON in model reply: ${text.slice(0, 180)}`);
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
