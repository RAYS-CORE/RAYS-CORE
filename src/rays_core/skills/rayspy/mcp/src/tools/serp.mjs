import { stableHash } from '../utils/ids.mjs';
import { simulateLatency, mockHitCount, mockHit, buildStubResult } from './_stubHelpers.mjs';
import { getProxyDispatcher } from './_proxy.mjs';

const TIMEOUT_MS = Number(process.env.SERP_TIMEOUT_MS || 15_000);

// If SERP_API_KEY is set, swap this for a real provider call (SerpAPI,
// Brave Search API, etc. - all plain HTTPS + JSON, the easiest of the
// five to run as a hosted API instead of a local scrape). Falls back to
// DuckDuckGo's no-JS "lite" endpoint, which needs no API key.
const SERP_API_KEY = process.env.SERP_API_KEY;
const DDG_LITE_URL = 'https://lite.duckduckgo.com/lite/';

// DDG lite wraps result links as //duckduckgo.com/l/?uddg=<encoded-real-url>
const RESULT_RE = /<a[^>]+href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>(.*?)<\/a>/gis;

function decodeDdgUrl(href) {
  try {
    const u = new URL(href, 'https://duckduckgo.com');
    const real = u.searchParams.get('uddg');
    return real ? decodeURIComponent(real) : href;
  } catch {
    return href;
  }
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').trim();
}

async function runDdgLite(target) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const dispatcher = getProxyDispatcher();
    const res = await fetch(DDG_LITE_URL, {
      method: 'POST',
      body: `q=${encodeURIComponent(target)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
      ...(dispatcher ? { dispatcher } : {}),
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { tool: 'serp', target, status: 'error', durationMs: Date.now() - startedAt, hits: [], error: `DDG ${res.status}` };
    }

    const html = await res.text();
    const hits = [...html.matchAll(RESULT_RE)].map((m) => {
      const url = decodeDdgUrl(m[1]);
      const title = stripTags(m[2]);
      const seed = stableHash(`serp:${target}:${url}`);
      return {
        id: `serp_${seed}`,
        tool: 'serp',
        target,
        summary: title || url,
        confidence: 0.6,
        timestamp: new Date().toISOString(),
        url,
      };
    });

    return { tool: 'serp', target, status: 'ok', durationMs: Date.now() - startedAt, hits };
  } catch (err) {
    clearTimeout(timer);
    return {
      tool: 'serp',
      target,
      status: err.name === 'AbortError' ? 'timeout' : 'error',
      durationMs: Date.now() - startedAt,
      hits: [],
      error: err.message,
    };
  }
}

export async function run(target) {
  const MOCK = process.env.OSINT_MOCK === '1';
  if (MOCK) {
    const durationMs = await simulateLatency(100, 350);
    const n = mockHitCount(target, 'serp', 8);
    const hits = Array.from({ length: n }, (_, i) => mockHit(target, 'serp', i));
    return buildStubResult('serp', target, hits, durationMs);
  }
  if (SERP_API_KEY) {
    // TODO(real provider): call your chosen SERP API here with SERP_API_KEY,
    // returning the same { tool, target, status, durationMs, hits } shape.
    // Left as DDG fallback until a specific provider is chosen.
  }
  return runDdgLite(target);
}
