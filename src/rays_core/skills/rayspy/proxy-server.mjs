import { HttpsProxyAgent } from 'https-proxy-agent';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { localProviderPlugins } from './server/providers/local.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Real OSINT tool data by default (shells out to CLIs / hits live APIs).
// Set OSINT_MOCK=1 for fast deterministic stub data (same as `npm test`).
if (process.env.OSINT_MOCK === undefined) process.env.OSINT_MOCK = '0';

// Tools that use fetch (serp.mjs, overpassTurbo.mjs) read HTTPS_PROXY
// or HTTP_PROXY from the environment automatically via _proxy.mjs.
const SF_PY = path.join(__dirname, 'spiderfoot', 'sf.py');
if (!process.env.SPIDERFOOT_SF_PY) {
  process.env.SPIDERFOOT_SF_PY = SF_PY;
}
if (!process.env.SPIDERFOOT_PYTHON) {
  process.env.SPIDERFOOT_PYTHON = process.platform === 'win32' ? 'python' : 'python3';
}

const INSIGHTFACE_SCRIPT_PATH = path.join(__dirname, 'scripts', 'insightface_sidecar.py');
if (!process.env.INSIGHTFACE_SCRIPT) {
  process.env.INSIGHTFACE_SCRIPT = INSIGHTFACE_SCRIPT_PATH;
}

const PERSON_MATCHER_SCRIPT_PATH = path.join(__dirname, 'scripts', 'person_matcher_sidecar.py');
if (!process.env.PERSON_MATCHER_SCRIPT) {
  process.env.PERSON_MATCHER_SCRIPT = PERSON_MATCHER_SCRIPT_PATH;
}

const FACE_SEARCH_PIPELINE_SCRIPT_PATH = path.join(__dirname, 'scripts', 'face_search_pipeline.py');
if (!process.env.FACE_SEARCH_PIPELINE_SCRIPT) {
  process.env.FACE_SEARCH_PIPELINE_SCRIPT = FACE_SEARCH_PIPELINE_SCRIPT_PATH;
}

let mcpHandle = null;
try {
  const mcpMod = await import('./mcp/src/mcpTool.mjs');
  mcpHandle = mcpMod.handle;
} catch (err) {
  console.warn('[proxy-server] MCP tool import warning:', err.message);
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
  const isHttps = parsed.protocol === 'https:';
  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: req.method,
    agent,
    headers: {
      'User-Agent': 'RAYSpy/1.0 (spatial intelligence console)',
      ...extraHeaders,
    },
  };
  const requestModule = isHttps ? https : http;
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

// Connect-compatible middleware stack to run all provider plugins from local.js
class MiddlewareStack {
  constructor() { this.stack = []; }
  use(route, fn) {
    if (typeof route === 'function') { fn = route; route = '/'; }
    if (!route.startsWith('/')) route = '/' + route;
    this.stack.push({ route, fn });
  }
  async handle(req, res, out) {
    let index = 0;
    const origUrl = req.url || '/';
    const next = async (err) => {
      if (err) {
        if (out) return out(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
      if (index >= this.stack.length) {
        if (out) return out();
        return;
      }
      const { route, fn } = this.stack[index++];
      const pathname = origUrl.split('?')[0];
      if (route === '/' || pathname === route || pathname.startsWith(route.endsWith('/') ? route : route + '/')) {
        if (route !== '/') {
          req.url = origUrl.slice(route.length) || '/';
          if (!req.url.startsWith('/')) req.url = '/' + req.url;
        }
        try {
          if (fn.length >= 3) {
            await fn(req, res, (err2) => {
              req.url = origUrl;
              next(err2);
            });
          } else {
            await fn(req, res);
            req.url = origUrl;
          }
        } catch (e) {
          req.url = origUrl;
          next(e);
        }
      } else {
        next();
      }
    };
    next();
  }
}

const middlewareStack = new MiddlewareStack();
const mockServer = { middlewares: middlewareStack };
for (const plugin of localProviderPlugins()) {
  if (plugin.configureServer) {
    plugin.configureServer(mockServer);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // ── "run" tab bridge: dashboard <-> rays_investigate MCP tool ────────
  if (url.pathname === '/rayspy-mcp/start' && req.method === 'POST') {
    if (!mcpHandle) { sendJson(res, 503, { error: 'MCP unavailable' }); return; }
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
    if (!mcpHandle) { sendJson(res, 503, { error: 'MCP unavailable' }); return; }
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
    if (!mcpHandle) { sendJson(res, 503, { error: 'MCP unavailable' }); return; }
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
    if (!mcpHandle) { sendJson(res, 503, { error: 'MCP unavailable' }); return; }
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
    if (!mcpHandle) { sendJson(res, 503, { error: 'MCP unavailable' }); return; }
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

  // ── Standalone camera proxy ─────────────────────────────────────────
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

  // ── Process through registered data provider middleware plugins ──────
  await middlewareStack.handle(req, res, async () => {
    if (res.writableEnded || res.headersSent) return;

    // ── Resilient fallbacks for data sources ──────────────────────────
    if (req.url.startsWith('/api/celestrak/')) {
      const group = req.url.replace(/^\/api\/celestrak\//, '').split('?')[0];
      proxyHttps(req, res, `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=tle`);
      return;
    }
    if (req.url.startsWith('/api/opensky')) {
      proxyHttps(req, res, 'https://opensky-network.org/api/states/all');
      return;
    }
    if (req.url.startsWith('/api/adsblol/mil') || req.url.startsWith('/api/adsb-lol/mil')) {
      proxyHttps(req, res, 'https://api.adsb.lol/v2/mil');
      return;
    }
    if (req.url.startsWith('/api/earthquakes')) {
      proxyHttps(req, res, 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
      return;
    }
    if (req.url.startsWith('/api/launches')) {
      proxyHttps(req, res, 'https://ll.thespacedevs.com/2.3.0/launches/?limit=100&mode=detailed');
      return;
    }

    // ── Legacy route fallbacks ─────────────────────────────────────────
    if (req.url.startsWith('/opensky/')) {
      proxyHttps(req, res, 'https://opensky-network.org' + req.url.replace(/^\/opensky/, ''));
      return;
    }
    if (req.url.startsWith('/adsb-fi/')) {
      proxyHttps(req, res, 'https://opendata.adsb.fi/api' + req.url.replace(/^\/adsb-fi/, ''));
      return;
    }
    if (req.url.startsWith('/adsb/')) {
      proxyHttps(req, res, 'https://api.adsb.lol' + req.url.replace(/^\/adsb/, ''));
      return;
    }
    if (req.url.startsWith('/celestrak/')) {
      proxyHttps(req, res, 'https://celestrak.org' + req.url.replace(/^\/celestrak/, ''));
      return;
    }
    if (req.url.startsWith('/geocode/')) {
      proxyHttps(
        req,
        res,
        'https://nominatim.openstreetmap.org' + req.url.replace(/^\/geocode/, ''),
        { Referer: 'http://localhost:5176' }
      );
      return;
    }
    if (req.url.startsWith('/austin-data/')) {
      proxyHttps(req, res, 'https://data.austintexas.gov' + req.url.replace(/^\/austin-data/, ''));
      return;
    }
    if (req.url.startsWith('/cctv/')) {
      proxyHttps(
        req,
        res,
        'https://cctv.austinmobility.io' + req.url.replace(/^\/cctv/, ''),
        { Referer: 'https://data.mobility.austin.gov/' }
      );
      return;
    }
    if (req.url.startsWith('/openeagle/')) {
      proxyHttps(
        req,
        res,
        'https://raw.githubusercontent.com/stuchapin909/Open-Eagle-Eye/master' +
          req.url.replace(/^\/openeagle/, '')
      );
      return;
    }

    // ── CRITICAL: Any unhandled /api/* request must return 404 JSON, NEVER index.html ──
    if (url.pathname.startsWith('/api/')) {
      res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: `Not found: ${url.pathname}` }));
      return;
    }

    // ── Static assets from dist/ directory ────────────────────────────
    const basePath = path.join(__dirname, 'dist');
    const safeSuffix = path.normalize(url.pathname).replace(/^(\.\.(\/|\\|$))+/, '');
    const targetPath = path.join(basePath, safeSuffix === '/' ? 'index.html' : safeSuffix);

    fs.stat(targetPath, (err, stats) => {
      if (err || !stats.isFile()) {
        // SPA navigation fallback: only serve index.html for HTML requests or root
        const acceptsHtml = (req.headers.accept || '').includes('text/html');
        if (acceptsHtml || url.pathname === '/') {
          const indexPath = path.join(basePath, 'index.html');
          if (fs.existsSync(indexPath)) {
            res.writeHead(200, {
              'Content-Type': 'text/html',
              'Access-Control-Allow-Origin': '*',
            });
            fs.createReadStream(indexPath).pipe(res);
            return;
          }
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      } else {
        const ext = path.extname(targetPath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.mjs': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.wasm': 'application/wasm',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.ttf': 'font/ttf',
        };
        res.writeHead(200, {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(targetPath).pipe(res);
      }
    });
  });
});

const PORT = parseInt(process.env.PORT, 10) || 5176;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`RAYSpy proxy server running on http://localhost:${PORT}`);
});
