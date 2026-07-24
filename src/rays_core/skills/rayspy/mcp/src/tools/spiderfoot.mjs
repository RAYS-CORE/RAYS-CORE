import { runCommand } from './_shell.mjs';
import { simulateLatency, mockHitCount, mockHit, buildStubResult } from './_stubHelpers.mjs';

const PYTHON_BIN = process.env.SPIDERFOOT_PYTHON || 'python3';
const SF_PY = process.env.SPIDERFOOT_SF_PY; // absolute path to sf.py in a SpiderFoot checkout
const TIMEOUT_MS = Number(process.env.SPIDERFOOT_TIMEOUT_MS || 180_000);

// Conservative default module sets per target type - avoids loading
// SpiderFoot's full module tree (which needs a much heavier dependency
// install) for a quick, generic lookup. Override with SPIDERFOOT_MODULES.
const DEFAULT_MODULES = {
  USERNAME: 'sfp_github,sfp_accounts,sfp_socialprofiles',
  EMAILADDR: 'sfp_emailrep,sfp_hunter,sfp_gravatar,sfp_breachdirectory',
  DOMAIN_NAME: 'sfp_dnsresolve,sfp_whois,sfp_sslcert,sfp_subdomain',
  INTERNET_NAME: 'sfp_dnsresolve,sfp_whois,sfp_sslcert,sfp_subdomain',
  IP_ADDRESS: 'sfp_dnsresolve,sfp_whois',
};

function modulesFor(targetType) {
  return process.env.SPIDERFOOT_MODULES || DEFAULT_MODULES[targetType] || 'sfp_dnsresolve,sfp_whois';
}

/**
 * Runs the real SpiderFoot CLI (`sf.py`) against a generic target -
 * a domain, IP, email, or username. Requires SPIDERFOOT_SF_PY to point
 * at `sf.py` inside a SpiderFoot checkout (see mcp/README.md setup).
 * `target` here is always a generic entity string, never bound to a
 * specific named person or a fixed workflow. Set OSINT_MOCK=1 for
 * deterministic stub data (used by the smoke test).
 */
export async function run(target, { targetType = 'DOMAIN_NAME' } = {}) {
  const MOCK = process.env.OSINT_MOCK === '1';
  if (MOCK) {
    const durationMs = await simulateLatency(80, 300);
    const n = mockHitCount(target, `spiderfoot:${targetType}`, 5);
    const hits = Array.from({ length: n }, (_, i) => mockHit(target, 'spiderfoot', i));
    return buildStubResult('spiderfoot', target, hits, durationMs);
  }

  if (!SF_PY) {
    return {
      tool: 'spiderfoot',
      target,
      status: 'error',
      durationMs: 0,
      hits: [],
      error: 'SPIDERFOOT_SF_PY not set. Point it at sf.py in a SpiderFoot checkout (see mcp/README.md).',
    };
  }

  const modules = modulesFor(targetType);
  const result = await runCommand(
    PYTHON_BIN,
    [SF_PY, '-s', target, '-t', targetType, '-m', modules, '-o', 'json', '-q'],
    { timeoutMs: TIMEOUT_MS }
  );

  if (result.spawnError) {
    return {
      tool: 'spiderfoot',
      target,
      status: 'error',
      durationMs: result.durationMs,
      hits: [],
      error: `Failed to start SpiderFoot (${PYTHON_BIN} ${SF_PY}): ${result.stderr.slice(0, 300)}`,
    };
  }

  let parsed = [];
  try {
    parsed = JSON.parse(result.stdout);
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    // SpiderFoot prints non-JSON status lines alongside -q sometimes;
    // treat unparsable output as zero structured hits rather than erroring.
    parsed = [];
  }

  const hits = parsed.map((row, i) => ({
    id: `spiderfoot_${target}_${i}`,
    tool: 'spiderfoot',
    target,
    summary: row.data || row.module || JSON.stringify(row).slice(0, 120),
    confidence: 0.65,
    timestamp: row.generated ? new Date(Number(row.generated) * 1000).toISOString() : new Date().toISOString(),
    module: row.module,
  }));

  return {
    tool: 'spiderfoot',
    target,
    status: result.timedOut ? 'timeout' : 'ok',
    durationMs: result.durationMs,
    hits,
  };
}
