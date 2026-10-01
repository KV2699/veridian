// Console logger shaped for the demo video: every agent announces itself,
// reports progress, and prints its own wall-clock duration.

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', indigo: '\x1b[38;5;99m',
};

const ts = () => new Date().toISOString().slice(11, 19);

export const log = {
  banner(text) {
    const bar = '─'.repeat(Math.max(0, 62 - text.length));
    console.log(`\n${C.indigo}${C.bold}╭─ ${text} ${bar}${C.reset}`);
  },
  agent(n, name) {
    console.log(`\n${C.cyan}${C.bold}▶ AGENT ${n}/7 — ${name}${C.reset}`);
  },
  step(msg) { console.log(`  ${C.dim}${ts()}${C.reset} ${msg}`); },
  ok(msg) { console.log(`  ${C.green}✓${C.reset} ${msg}`); },
  warn(msg) { console.log(`  ${C.yellow}!${C.reset} ${msg}`); },
  error(msg) { console.log(`  ${C.red}✗${C.reset} ${msg}`); },
  done(name, ms, detail = '') {
    const s = (ms / 1000).toFixed(1);
    console.log(`  ${C.green}${C.bold}✓ ${name} complete${C.reset} ${C.dim}(${s}s)${C.reset}${detail ? ' — ' + detail : ''}`);
  },
  total(ms) {
    console.log(`\n${C.indigo}${C.bold}╰─ Pipeline complete in ${(ms / 1000).toFixed(1)}s${C.reset}\n`);
  },
};

// Wrap an agent so timing + status are captured uniformly for the dashboard.
export async function timed(n, name, fn) {
  log.agent(n, name);
  const started = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - started;
    log.done(name, ms, result?.summary ?? '');
    return { agent: name, index: n, status: 'success', ms, startedAt: new Date(started).toISOString(), ...result };
  } catch (err) {
    const ms = Date.now() - started;
    log.error(`${name} failed after ${(ms / 1000).toFixed(1)}s — ${err.message}`);
    return { agent: name, index: n, status: 'error', ms, startedAt: new Date(started).toISOString(), error: err.message };
  }
}
