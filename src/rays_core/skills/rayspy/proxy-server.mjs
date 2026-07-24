import { HttpsProxyAgent } from 'https-proxy-agent';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Real OSINT tool data by default (shells out to CLIs / hits live APIs).
// Set OSINT_MOCK=1 for fast deterministic stub data (same as `npm test`).
if (process.env.OSINT_MOCK === undefined) process.env.OSINT_MOCK = '0';

// Tools that use fetch (serp.mjs, overpassTurbo.mjs) read HTTPS_PROXY
// or HTTP_PROXY from the environment automatically via _proxy.mjs.
// Set these in your shell before starting the server if behind a corporate proxy:
//   export HTTPS_PROXY=http://proxy:port   (Linux/macOS)
//   $env:HTTPS_PROXY='http://proxy:port'   (PowerShell)

// Point spiderfoot.mjs at the cloned SpiderFoot checkout.
// Use 'python' on Windows (python3 is not available).
const SF_PY = 'C:\\Users\\KIIT\\Documents\\rayspy_with_mcp\\spiderfoot\\sf.py';
if (!process.env.SPIDERFOOT_SF_PY) {
  process.env.SPIDERFOOT_SF_PY = SF_PY;
}
if (!process.env.SPIDERFOOT_PYTHON) {
  process.env.SPIDERFOOT_PYTHON = 'python';
}

// Point insightface.mjs at the Python face-detection sidecar.
const INSIGHTFACE_SCRIPT_PATH = 'C:\\Users\\KIIT\\Documents\\rayspy_with_mcp\\scripts\\insightface_sidecar.py';
if (!process.env.INSIGHTFACE_SCRIPT) {
  process.env.INSIGHTFACE_SCRIPT = INSIGHTFACE_SCRIPT_PATH;
}

// Point personMatcher.mjs at the Python person search + face cross-match sidecar.
const PERSON_MATCHER_SCRIPT_PATH = 'C:\\Users\\KIIT\\Documents\\rayspy_with_mcp\\scripts\\person_matcher_sidecar.py';
if (!process.env.PERSON_MATCHER_SCRIPT) {
  process.env.PERSON_MATCHER_SCRIPT = PERSON_MATCHER_SCRIPT_PATH;
}

// Point at the full 14-stage face search pipeline (replaces person_matcher for new flows).
const FACE_SEARCH_PIPELINE_SCRIPT_PATH = 'C:\\Users\\KIIT\\Documents\\rayspy_with_mcp\\scripts\\face_search_pipeline.py';
if (!process.env.FACE_SEARCH_PIPELINE_SCRIPT) {
  process.env.FACE_SEARCH_PIPELINE_SCRIPT = FACE_SEARCH_PIPELINE_SCRIPT_PATH;
}

// In-process bridge to the same rays_investigate tool the stdio MCP
// server (mcp/src/index.mjs) exposes to Claude/Cursor/Ollama/etc. This
// lets the dashboard's "run" tab (Run button + log window) drive the
// exact same pipeline over a couple of plain HTTP routes, no separate
// MCP transport needed since we're already in the same Node process.
const { handle: mcpHandle } = await import('./mcp/src/mcpTool.mjs');

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
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // ── "run" tab bridge: dashboard <-> rays_investigate MCP tool ────────
  if (url.pathname === '/rayspy-mcp/start' && req.method === 'POST') {
    readJsonBody(req)
      .then(async (body) => {
        const { ok, body: result } = parseMcpResult(
          await mcpHandle({ action: 'start', query: body.query, maxRounds: body.maxRounds })
        );
        sendJson(res, ok ? 200 : 400, result);
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
    return;
  }
  if (url.pathname === '/rayspy-mcp/status' && req.method === 'GET') {
    const investigationId = url.searchParams.get('investigationId');
    mcpHandle({ action: 'status', investigationId })
      .then((result) => {
        const { ok, body } = parseMcpResult(result);
        sendJson(res, ok ? 200 : 400, body);
      })
      .catch((err) => sendJson(res, 500, { error: err.message }));
    return;
  }
  if (url.pathname === '/rayspy-mcp/guidance' && req.method === 'POST') {
    readJsonBody(req)
      .then(async (body) => {
        const { ok, body: result } = parseMcpResult(
          await mcpHandle({ action: 'guidance', investigationId: body.investigationId, guidance: body.guidance })
        );
        sendJson(res, ok ? 200 : 400, result);
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
    return;
  }
  if (url.pathname === '/rayspy-mcp/abort' && req.method === 'POST') {
    readJsonBody(req)
      .then(async (body) => {
        const { ok, body: result } = parseMcpResult(
          await mcpHandle({ action: 'abort', investigationId: body.investigationId })
        );
        sendJson(res, ok ? 200 : 400, result);
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
    return;
  }
  if (url.pathname === '/rayspy-mcp/report' && req.method === 'GET') {
    // Serve the saved TXT report for download
    const investigationId = url.searchParams.get('investigationId');
    const format = url.searchParams.get('format') || 'txt';
    if (!investigationId) {
      sendJson(res, 400, { error: 'investigationId required' });
      return;
    }
    const targetName = investigationId.toLowerCase().replace(/\s+/g, '_');
    if (format === 'json') {
      const jsonPath = path.resolve(__dirname, `${targetName}_investigation_raw.json`);
      if (!fs.existsSync(jsonPath)) { sendJson(res, 404, { error: 'report not found' }); return; }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${targetName}_investigation_raw.json"` });
      fs.createReadStream(jsonPath).pipe(res);
    } else {
      const txtPath = path.resolve(__dirname, `${targetName}_investigation_report.txt`);
      if (!fs.existsSync(txtPath)) { sendJson(res, 404, { error: 'report not found' }); return; }
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Disposition': `attachment; filename="${targetName}_investigation_report.txt"` });
      fs.createReadStream(txtPath).pipe(res);
    }
    return;
  }

  // ── Standalone face search endpoint ────────────────────────────────
  if (url.pathname === '/rayspy-mcp/face-search' && req.method === 'POST') {
    readJsonBody(req)
      .then(async (body) => {
        const { ok, body: result } = parseMcpResult(
          await mcpHandle({
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
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
    return;
  }

  if (req.url.startsWith('/opensky/')) {
    proxyHttps(req, res, 'https://opensky-network.org' + req.url.replace(/^\/opensky/, ''));
  } else if (req.url.startsWith('/adsb-fi/')) {
    proxyHttps(
      req,
      res,
      'https://opendata.adsb.fi/api' + req.url.replace(/^\/adsb-fi/, '')
    );
  } else if (req.url.startsWith('/adsb/')) {
    proxyHttps(req, res, 'https://api.adsb.lol' + req.url.replace(/^\/adsb/, ''));
  } else if (req.url.startsWith('/celestrak/')) {
    proxyHttps(req, res, 'https://celestrak.org' + req.url.replace(/^\/celestrak/, ''));
  } else if (req.url.startsWith('/geocode/')) {
    proxyHttps(
      req,
      res,
      'https://nominatim.openstreetmap.org' + req.url.replace(/^\/geocode/, ''),
      { Referer: 'http://localhost:5173' }
    );
  } else if (req.url.startsWith('/austin-data/')) {
    proxyHttps(
      req,
      res,
      'https://data.austintexas.gov' + req.url.replace(/^\/austin-data/, '')
    );
  } else if (req.url.startsWith('/cctv/')) {
    proxyHttps(
      req,
      res,
      'https://cctv.austinmobility.io' + req.url.replace(/^\/cctv/, ''),
      { Referer: 'https://data.mobility.austin.gov/' }
    );
  } else if (req.url.startsWith('/openeagle/')) {
    proxyHttps(
      req,
      res,
      'https://raw.githubusercontent.com/stuchapin909/Open-Eagle-Eye/master' +
        req.url.replace(/^\/openeagle/, '')
    );
  } else if (req.url.startsWith('/cam-proxy')) {
    const parsed = new URL(req.url, 'http://localhost');
    const target = parsed.searchParams.get('url');
    if (!target || !/^https?:\/\//i.test(target)) {
      res.writeHead(400);
      res.end('Invalid camera url');
      return;
    }
    proxyHttps(req, res, target);
  } else {
    // Serve static files from dist/ fallback
    const basePath = path.join(__dirname, 'dist');
    const safeSuffix = path.normalize(url.pathname).replace(/^(\.\.(\/|\\|$))+/, '');
    const targetPath = path.join(basePath, safeSuffix === '/' ? 'index.html' : safeSuffix);
    
    fs.stat(targetPath, (err, stats) => {
      if (err || !stats.isFile()) {
        const indexPath = path.join(basePath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          fs.createReadStream(indexPath).pipe(res);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      } else {
        const ext = path.extname(targetPath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(targetPath).pipe(res);
      }
    });
  }
});

function proxyHttps(req, res, targetUrl, extraHeaders = {}) {
  const parsed = new URL(targetUrl);
  const options = {
    hostname: parsed.hostname,
    port: 443,
    path: parsed.pathname + parsed.search,
    method: req.method,
    agent,
    headers: {
      'User-Agent': 'RAYSpy/1.0 (educational project)',
      ...extraHeaders,
    },
  };
  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end(JSON.stringify({ error: err.message }));
  });
  req.pipe(proxyReq);
}

const PORT = 5176;
server.listen(PORT, () => {
  console.error(`Proxy server running on http://localhost:${PORT}`);
});
