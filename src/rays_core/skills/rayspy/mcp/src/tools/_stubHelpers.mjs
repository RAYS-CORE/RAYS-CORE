import { stableHash } from '../utils/ids.mjs';

/**
 * Every real tool integration (SpiderFoot, Sherlock, Holehe, SERP,
 * InsightFace, Epieos, Overpass Turbo) will eventually shell out to a
 * CLI, hit a REST API, or call a local model. Until those are wired
 * in, each stub here returns the SAME response shape a real adapter
 * would: { tool, target, hits, status, durationMs }. Swap the body of
 * `run()` in each tools/*.mjs file for a real call and nothing else
 * in the pipeline needs to change - that's the point of the adapter
 * layer (Figure 3).
 */
export async function simulateLatency(min = 40, max = 220) {
  const ms = min + (Math.random() * (max - min));
  await new Promise((resolve) => setTimeout(resolve, ms));
  return Math.round(ms);
}

/** Deterministic-ish pseudo-random hit count so smoke tests are stable. */
export function mockHitCount(target, tool, max = 4) {
  return stableHash(`${tool}:${target}`) % (max + 1);
}

export function mockHit(target, tool, i) {
  const seed = stableHash(`${tool}:${target}:${i}`);
  return {
    id: `${tool}_${seed}`,
    tool,
    target,
    summary: `${tool} mock hit #${i} for "${target}"`,
    confidence: 0.4 + (seed % 60) / 100, // 0.4 - 0.99
    timestamp: new Date(Date.now() - (seed % 1000) * 3600_000).toISOString(),
  };
}

export function buildStubResult(tool, target, hits, durationMs, status = 'ok') {
  return { tool, target, status, durationMs, hits };
}
