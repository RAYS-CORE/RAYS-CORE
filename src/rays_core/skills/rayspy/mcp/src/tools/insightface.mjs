import { runCommand } from './_shell.mjs';
import { simulateLatency, mockHitCount, mockHit, buildStubResult } from './_stubHelpers.mjs';

const PYTHON_BIN = process.env.INSIGHTFACE_PYTHON || process.env.SPIDERFOOT_PYTHON || 'python3';
const INSIGHTFACE_SCRIPT = process.env.INSIGHTFACE_SCRIPT;
const TIMEOUT_MS = Number(process.env.INSIGHTFACE_TIMEOUT_MS || 120_000);

const IMAGE_URL_RE = /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;
const LOCAL_IMAGE_RE = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;

export async function run(target) {
  const MOCK = process.env.OSINT_MOCK === '1';
  if (MOCK) {
    const durationMs = await simulateLatency(150, 500);
    const n = mockHitCount(target, 'insightface', 3);
    const hits = Array.from({ length: n }, (_, i) => ({
      ...mockHit(target, 'insightface', i),
      matchScore: 0.5 + (i % 5) / 10,
    }));
    return buildStubResult('insightface', target, hits, durationMs);
  }

  if (!IMAGE_URL_RE.test(target) && !LOCAL_IMAGE_RE.test(target)) {
    return {
      tool: 'insightface',
      target,
      status: 'ok',
      durationMs: 0,
      hits: [],
      info: 'InsightFace requires an image URL (.jpg/.png/.gif/.webp) as target for face detection. ' +
            'Pass a direct image URL to detect and analyze faces.',
    };
  }

  if (!INSIGHTFACE_SCRIPT) {
    return {
      tool: 'insightface',
      target,
      status: 'error',
      durationMs: 0,
      hits: [],
      error: 'INSIGHTFACE_SCRIPT not set. Point it at a Python script that uses the InsightFace library. ' +
            'Example: INSIGHTFACE_SCRIPT=/path/to/insightface_sidecar.py. ' +
            'See mcp/.env.example. Set OSINT_MOCK=1 to use stub data without the script.',
    };
  }

  const result = await runCommand(
    PYTHON_BIN,
    [INSIGHTFACE_SCRIPT, '--input', target, '--output-format', 'json'],
    { timeoutMs: TIMEOUT_MS }
  );

  if (result.spawnError) {
    return {
      tool: 'insightface',
      target,
      status: 'error',
      durationMs: result.durationMs,
      hits: [],
      error: `Failed to start InsightFace script: ${result.stderr.slice(0, 300)}`,
    };
  }

  let parsed = [];
  try {
    parsed = JSON.parse(result.stdout);
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    return {
      tool: 'insightface',
      target,
      status: 'error',
      durationMs: result.durationMs,
      hits: [],
      error: `InsightFace script returned invalid JSON. stderr: ${result.stderr.slice(0, 200)}`,
    };
  }

  const hits = parsed.map((face, i) => ({
    id: `insightface_${target}_${i}`,
    tool: 'insightface',
    target,
    summary: face.label || `Face #${i + 1} detected in image`,
    confidence: face.confidence ?? 0.7,
    timestamp: new Date().toISOString(),
    matchScore: face.match_score ?? face.confidence ?? 0.5,
    gender: face.gender ?? null,
    age: face.age ?? null,
    bbox: face.bbox ?? null,
  }));

  return {
    tool: 'insightface',
    target,
    status: result.timedOut ? 'timeout' : 'ok',
    durationMs: result.durationMs,
    hits,
  };
}
