import { runCommand } from './_shell.mjs';
import { stableHash } from '../utils/ids.mjs';
import { simulateLatency, mockHitCount, mockHit, buildStubResult } from './_stubHelpers.mjs';

const SHERLOCK_BIN = process.env.SHERLOCK_BIN || 'sherlock';
const PER_SITE_TIMEOUT_S = process.env.SHERLOCK_SITE_TIMEOUT_S || '10';
const OVERALL_TIMEOUT_MS = Number(process.env.SHERLOCK_TIMEOUT_MS || 60_000);

const URL_RE = /https?:\/\/\S+/g;

/**
 * Runs the real Sherlock CLI (`pip install sherlock-project`).
 * `target` is a generic username - not tied to any specific pipeline.
 * Requires network egress to whichever sites Sherlock checks.
 * Set OSINT_MOCK=1 to use deterministic stub data instead (used by
 * the smoke test so it stays fast and doesn't need network/installed tools).
 */
export async function run(target) {
  const MOCK = process.env.OSINT_MOCK === '1';
  if (MOCK) {
    const durationMs = await simulateLatency(60, 260);
    const n = mockHitCount(target, 'sherlock', 6);
    const hits = Array.from({ length: n }, (_, i) => mockHit(target, 'sherlock', i));
    return buildStubResult('sherlock', target, hits, durationMs);
  }

  const result = await runCommand(
    SHERLOCK_BIN,
    [target, '--print-found', '--timeout', PER_SITE_TIMEOUT_S],
    { timeoutMs: OVERALL_TIMEOUT_MS }
  );

  if (result.spawnError) {
    return {
      tool: 'sherlock',
      target,
      status: 'error',
      durationMs: result.durationMs,
      hits: [],
      error: `sherlock binary not found or failed to start (${SHERLOCK_BIN}). Install with: pip install sherlock-project`,
    };
  }

  const urls = [...new Set((result.stdout.match(URL_RE) ?? []))];
  const hits = urls.map((url) => {
    const seed = stableHash(`sherlock:${target}:${url}`);
    return {
      id: `sherlock_${seed}`,
      tool: 'sherlock',
      target,
      summary: `Sherlock found "${target}" registered at ${url}`,
      confidence: 0.75,
      timestamp: new Date().toISOString(),
      url,
    };
  });

  return {
    tool: 'sherlock',
    target,
    status: result.timedOut ? 'timeout' : 'ok',
    durationMs: result.durationMs,
    hits,
  };
}
