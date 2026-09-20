import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';
import { HttpsProxyAgent } from 'https-proxy-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rayspyRoot = path.resolve(__dirname, '../../');

// OSINT configuration
if (process.env.OSINT_MOCK === undefined) process.env.OSINT_MOCK = '0';

const SF_PY = path.join(rayspyRoot, 'spiderfoot', 'sf.py');
if (!process.env.SPIDERFOOT_SF_PY) {
  process.env.SPIDERFOOT_SF_PY = SF_PY;
}
if (!process.env.SPIDERFOOT_PYTHON) {
  process.env.SPIDERFOOT_PYTHON = process.platform === 'win32' ? 'python' : 'python3';
}

const INSIGHTFACE_SCRIPT_PATH = path.join(rayspyRoot, 'scripts', 'insightface_sidecar.py');
if (!process.env.INSIGHTFACE_SCRIPT) {
  process.env.INSIGHTFACE_SCRIPT = INSIGHTFACE_SCRIPT_PATH;
}

const PERSON_MATCHER_SCRIPT_PATH = path.join(rayspyRoot, 'scripts', 'person_matcher_sidecar.py');
if (!process.env.PERSON_MATCHER_SCRIPT) {
  process.env.PERSON_MATCHER_SCRIPT = PERSON_MATCHER_SCRIPT_PATH;
}

const FACE_SEARCH_PIPELINE_SCRIPT_PATH = path.join(rayspyRoot, 'scripts', 'face_search_pipeline.py');
if (!process.env.FACE_SEARCH_PIPELINE_SCRIPT) {
  process.env.FACE_SEARCH_PIPELINE_SCRIPT = FACE_SEARCH_PIPELINE_SCRIPT_PATH;
}

const mcpModulePath = path.join(rayspyRoot, 'mcp', 'src', 'mcpTool.mjs');
let mcpHandle = null;

async function getMcpHandle() {
  if (!mcpHandle) {
    const mod = await import(mcpModulePath);
    mcpHandle = mod.handle;
  }
  return mcpHandle;
}

function parseMcpResult(result) {
  const body = JSON.parse(result.content[0].text);
  return { ok: !result.isError, body };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, obj) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(obj));
}

const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

function proxyHttps(req, res, targetUrl, extraHeaders = {}) {
  const parsed = new URL(targetUrl);
  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: req.method,
    agent,
    headers: {
      'User-Agent': 'RAYSpy/1.0 (spatial intelligence console)',
      ...extraHeaders,
    },
  };
  const requestModule = parsed.protocol === 'http:' ? http : https;
  const proxyReq = requestModule.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': '*',
    });
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
  req.pipe(proxyReq);
}

export function rayspyMcpProxy() {
  return {
    name: 'rayspy-mcp-provider',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');

        if (url.pathname === '/rayspy-mcp/start' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const handle = await getMcpHandle();
            const { ok, body: result } = parseMcpResult(
              await handle({ action: 'start', query: body.query, maxRounds: body.maxRounds })
            );
            sendJson(res, ok ? 200 : 400, result);
          } catch (err) {
            sendJson(res, 400, { error: err.message });
          }
          return;
        }

        if (url.pathname === '/rayspy-mcp/status' && req.method === 'GET') {
          try {
            const investigationId = url.searchParams.get('investigationId');
            const handle = await getMcpHandle();
            const { ok, body } = parseMcpResult(
              await handle({ action: 'status', investigationId })
            );
            sendJson(res, ok ? 200 : 400, body);
          } catch (err) {
            sendJson(res, 500, { error: err.message });
          }
          return;
        }

        if (url.pathname === '/rayspy-mcp/guidance' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const handle = await getMcpHandle();
            const { ok, body: result } = parseMcpResult(
              await handle({ action: 'guidance', investigationId: body.investigationId, guidance: body.guidance })
            );
            sendJson(res, ok ? 200 : 400, result);
          } catch (err) {
            sendJson(res, 400, { error: err.message });
          }
          return;
        }

        if (url.pathname === '/rayspy-mcp/abort' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const handle = await getMcpHandle();
            const { ok, body: result } = parseMcpResult(
              await handle({ action: 'abort', investigationId: body.investigationId })
            );
            sendJson(res, ok ? 200 : 400, result);
          } catch (err) {
            sendJson(res, 400, { error: err.message });
          }
          return;
        }

        if (url.pathname === '/rayspy-mcp/report' && req.method === 'GET') {
          const investigationId = url.searchParams.get('investigationId');
          const format = url.searchParams.get('format') || 'txt';
          if (!investigationId) {
            sendJson(res, 400, { error: 'investigationId required' });
            return;
          }
          const targetName = investigationId.toLowerCase().replace(/\s+/g, '_');
          if (format === 'json') {
            const jsonPath = path.resolve(rayspyRoot, `${targetName}_investigation_raw.json`);
            if (!fs.existsSync(jsonPath)) { sendJson(res, 404, { error: 'report not found' }); return; }
            res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${targetName}_investigation_raw.json"` });
            fs.createReadStream(jsonPath).pipe(res);
          } else {
            const txtPath = path.resolve(rayspyRoot, `${targetName}_investigation_report.txt`);
            if (!fs.existsSync(txtPath)) { sendJson(res, 404, { error: 'report not found' }); return; }
            res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Disposition': `attachment; filename="${targetName}_investigation_report.txt"` });
            fs.createReadStream(txtPath).pipe(res);
          }
          return;
        }

        if (url.pathname === '/rayspy-mcp/face-search' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const handle = await getMcpHandle();
            const { ok, body: result } = parseMcpResult(
              await handle({
                action: 'face_search',
                name: body.name,
                referenceImage: body.referenceImage,
                matchThreshold: body.matchThreshold,
                nameSearch: body.nameSearch,
                quality: body.quality,
                dedup: body.dedup,
              })
            );
            sendJson(res, ok ? 200 : 400, result);
          } catch (err) {
            sendJson(res, 400, { error: err.message });
          }
          return;
        }

        if (req.url.startsWith('/cam-proxy')) {
          const parsed = new URL(req.url, 'http://localhost');
          const target = parsed.searchParams.get('url');
          if (!target || !/^https?:\/\//i.test(target)) {
            res.writeHead(400);
            res.end('Invalid camera url');
            return;
          }
          proxyHttps(req, res, target);
          return;
        }

        next();
      });
    },
  };
}
