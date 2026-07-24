import { runCommand } from './_shell.mjs';
import { stableHash } from '../utils/ids.mjs';
import { simulateLatency, mockHitCount, mockHit, buildStubResult } from './_stubHelpers.mjs';

const HOLEHE_BIN = process.env.HOLEHE_BIN || 'holehe';
const TIMEOUT_MS = Number(process.env.HOLEHE_TIMEOUT_MS || 60_000);

// holehe prints one line per site checked: "[+] site.com" (used),
// "[-] site.com" (not used), "[x] site.com" (rate limited / error).
// It also prints a legend line "[+] Email used, [-] Email not used, [x]
// Rate limit" which itself starts with "[+]" - the domain-shape check
// below excludes it.
const FOUND_RE = /^\[\+\]\s*(\S+)\s*$/gm;
const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

/**
 * Runs the real Holehe CLI (`pip install holehe`).
 * `target` is a generic email address - not tied to any specific pipeline.
 * Set OSINT_MOCK=1 for deterministic stub data (used by the smoke test).
 */
export async function run(target) {
  const MOCK = process.env.OSINT_MOCK === '1';
  if (MOCK) {
    const durationMs = await simulateLatency(50, 200);
    const n = mockHitCount(target, 'holehe', 4);
    const hits = Array.from({ length: n }, (_, i) => mockHit(target, 'holehe', i));
    return buildStubResult('holehe', target, hits, durationMs);
  }

  const result = await runCommand(HOLEHE_BIN, [target], { timeoutMs: TIMEOUT_MS });

  if (result.spawnError) {
    return {
      tool: 'holehe',
      target,
      status: 'error',
      durationMs: result.durationMs,
      hits: [],
      error: `holehe binary not found or failed to start (${HOLEHE_BIN}). Install with: pip install holehe`,
    };
  }

  const sites = [...result.stdout.matchAll(FOUND_RE)]
    .map((m) => m[1].trim())
    .filter((s) => DOMAIN_RE.test(s));
  const hits = sites.map((site) => {
    const seed = stableHash(`holehe:${target}:${site}`);
    return {
      id: `holehe_${seed}`,
      tool: 'holehe',
      target,
      summary: `Holehe: an account exists on ${site} for this email`,
      confidence: 0.8,
      timestamp: new Date().toISOString(),
      site,
    };
  });

  return {
    tool: 'holehe',
    target,
    status: result.timedOut ? 'timeout' : 'ok',
    durationMs: result.durationMs,
    hits,
  };
}
