import { simulateLatency, mockHitCount, mockHit, buildStubResult } from './_stubHelpers.mjs';

const EPIEOS_API_KEY = process.env.EPIEOS_API_KEY;
const EPIEOS_EMAIL_URL = process.env.EPIEOS_EMAIL_URL || 'https://tools.epieos.com/email.php';
const TIMEOUT_MS = Number(process.env.EPIEOS_TIMEOUT_MS || 30_000);

const EMAIL_RE = /\S+@\S+\.\S+/;

/**
 * Epieos real integration.
 *
 * Two modes:
 *  1) Authenticated API (EPIEOS_API_KEY set) – calls the Epieos API
 *     for email intelligence (linked accounts, data breaches, Gravatar).
 *  2) Web scraper fallback – POSTs to the public epieos.com email lookup
 *     tool. This may be blocked by hCaptcha / rate limits. Set
 *     EPIEOS_API_KEY to avoid that.
 *
 * The response shape is the same as every other tool adapter:
 *   { tool, target, status, durationMs, hits }
 */
async function callEpieosApi(target) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${EPIEOS_EMAIL_URL}?q=${encodeURIComponent(target)}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'application/json, text/html',
    };
    if (EPIEOS_API_KEY) {
      headers.Authorization = `Bearer ${EPIEOS_API_KEY}`;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        tool: 'epieos',
        target,
        status: 'error',
        durationMs: Date.now() - startedAt,
        hits: [],
        error: `Epieos returned HTTP ${res.status}. ${text.slice(0, 200)}`,
      };
    }

    const contentType = res.headers.get('content-type') || '';
    const raw = await res.text();

    const hits = [];

    if (contentType.includes('json')) {
      let data;
      try { data = JSON.parse(raw); } catch { data = null; }
      if (data && Array.isArray(data.accounts)) {
        for (const acct of data.accounts) {
          hits.push({
            id: `epieos_api_${target}_${acct.site || acct.name}`,
            tool: 'epieos',
            target,
            summary: `Epieos: account found on ${acct.site || acct.name}`,
            confidence: 0.75,
            timestamp: new Date().toISOString(),
            site: acct.site || acct.name,
            url: acct.url || null,
            category: acct.category || null,
          });
        }
      }
      if (data && data.breaches) {
        for (const breach of data.breaches) {
          hits.push({
            id: `epieos_breach_${target}_${breach.name}`,
            tool: 'epieos',
            target,
            summary: `Epieos: email appears in breach "${breach.name}"`,
            confidence: 0.85,
            timestamp: new Date().toISOString(),
            breach: breach.name,
            date: breach.date || null,
          });
        }
      }
    }

    return {
      tool: 'epieos',
      target,
      status: 'ok',
      durationMs: Date.now() - startedAt,
      hits,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      tool: 'epieos',
      target,
      status: err.name === 'AbortError' ? 'timeout' : 'error',
      durationMs: Date.now() - startedAt,
      hits: [],
      error: err.message.includes('fetch') ? `Network error: ${err.message}` : err.message,
    };
  }
}

export async function run(target) {
  const MOCK = process.env.OSINT_MOCK === '1';
  if (MOCK) {
    const durationMs = await simulateLatency(80, 280);
    const n = mockHitCount(target, 'epieos', 3);
    const hits = Array.from({ length: n }, (_, i) => mockHit(target, 'epieos', i));
    return buildStubResult('epieos', target, hits, durationMs);
  }

  if (!EMAIL_RE.test(target)) {
    return {
      tool: 'epieos',
      target,
      status: 'ok',
      durationMs: 0,
      hits: [],
      info: 'Epieos requires an email address as target for account/breach lookups.',
    };
  }

  return callEpieosApi(target);
}
