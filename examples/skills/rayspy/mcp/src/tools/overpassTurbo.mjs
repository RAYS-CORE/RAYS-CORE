import { simulateLatency, mockHitCount, buildStubResult } from './_stubHelpers.mjs';
import { getProxyDispatcher } from './_proxy.mjs';

const OVERPASS_URL = process.env.OVERPASS_URL || 'http://overpass-api.de/api/interpreter';
const RADIUS_M = Number(process.env.OVERPASS_RADIUS_M || 200);
const TIMEOUT_MS = Number(process.env.OVERPASS_TIMEOUT_MS || 25_000);

function buildQuery(lat, lon) {
  return `[out:json][timeout:20];
(
  node(around:${RADIUS_M},${lat},${lon})[name];
  way(around:${RADIUS_M},${lat},${lon})[name];
);
out center 20;`;
}

export async function run(target) {
  const MOCK = process.env.OSINT_MOCK === '1';
  if (MOCK) {
    const durationMs = await simulateLatency(120, 400);
    const n = mockHitCount(target, 'overpass_turbo', 5);
    const hits = Array.from({ length: n }, (_, i) => ({
      id: `overpass_turbo_${target}_${i}`,
      tool: 'overpass_turbo',
      target,
      summary: `overpass_turbo mock hit #${i} for "${target}"`,
      confidence: 0.7,
      timestamp: new Date().toISOString(),
      lat: 12.34 + i * 0.001,
      lon: 56.78 + i * 0.001,
    }));
    return buildStubResult('overpass_turbo', target, hits, durationMs);
  }

  const startedAt = Date.now();
  const [latStr, lonStr] = target.split(',').map((s) => s.trim());
  const lat = Number(latStr);
  const lon = Number(lonStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      tool: 'overpass_turbo',
      target,
      status: 'error',
      durationMs: 0,
      hits: [],
      error: `Expected "lat,lon" target, got: ${target}`,
    };
  }

  const { createRequire } = await import('node:module');
  const require_ = createRequire(import.meta.url);
  let undici;
  try { undici = require_('undici'); } catch { /* gracefully fall back below */ }

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    if (!undici) throw new Error('undici module not available');

    const dispatcher = getProxyDispatcher();
    const { statusCode, body } = await undici.request(OVERPASS_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(buildQuery(lat, lon))}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '*/*',
        'User-Agent': 'RAYSpy/1.0',
      },
      signal: abort.signal,
      ...(dispatcher ? { dispatcher } : {}),
    });
    clearTimeout(timer);

    if (statusCode !== 200) {
      return {
        tool: 'overpass_turbo',
        target,
        status: 'error',
        durationMs: Date.now() - startedAt,
        hits: [],
        error: `Overpass ${statusCode}`,
      };
    }

    const data = await body.json();
    const hits = (data.elements ?? []).map((el) => ({
      id: `overpass_${el.type}_${el.id}`,
      tool: 'overpass_turbo',
      target,
      summary: el.tags?.name ? `${el.tags.name} (${el.tags.amenity || el.tags.building || el.type})` : `Unnamed ${el.type}`,
      confidence: 0.7,
      timestamp: new Date().toISOString(),
      lat: el.lat ?? el.center?.lat,
      lon: el.lon ?? el.center?.lon,
      tags: el.tags ?? {},
    }));

    return {
      tool: 'overpass_turbo',
      target,
      status: 'ok',
      durationMs: Date.now() - startedAt,
      hits,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      tool: 'overpass_turbo',
      target,
      status: err.name === 'AbortError' ? 'timeout' : 'error',
      durationMs: Date.now() - startedAt,
      hits: [],
      error: err.message,
    };
  }
}
