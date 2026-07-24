/**
 * worldview/ui.js — RAYSpy dashboard UI (v2 tile-grid layout)
 * Matches the reference screenshot: top bar with logo+search+clock,
 * glossy colored tile grid on the right (OPS/INTEL/ASSETS tabs),
 * bottom icon toolbar. The Cesium 3D globe is untouched — it renders
 * in #cesiumContainer behind this overlay, and the globe area here is
 * fully transparent / pointer-events:none so all camera interaction
 * (scroll zoom, drag rotate, click) passes straight through to Cesium.
 */
export function mountWorldviewUI(viewer, handlers) {
  injectStyles();

  const overlay = document.createElement('div');
  overlay.id = 'worldview-overlay';
  overlay.innerHTML = buildHTML();
  document.getElementById('worldview-app').appendChild(overlay);

  // ── Clock ──────────────────────────────────────────────────────────
  (function tick() {
    const n = new Date();
    const el = overlay.querySelector('#wv-clock');
    if (el) el.textContent = n.toISOString().slice(0, 16).replace('T', ' ') + 'Z';
    setTimeout(tick, 1000);
  })();

  // ── Search ─────────────────────────────────────────────────────────
  const searchWrap  = overlay.querySelector('#searchWrap');
  const searchBtn   = overlay.querySelector('#searchBtn');
  const searchInput = overlay.querySelector('#wv-search-input');
  searchBtn.addEventListener('click', () => {
    const open = searchWrap.classList.toggle('open');
    if (open) setTimeout(() => searchInput.focus(), 320);
  });
  document.addEventListener('click', e => {
    if (!searchWrap.contains(e.target)) searchWrap.classList.remove('open');
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      handlers.onSearch?.(q);
      const frame = overlay.querySelector('.browser-frame');
      const urlBar = overlay.querySelector('.browser-url');
      if (frame && q) {
        const url = /^https?:\/\//i.test(q) ? q : `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        frame.src = url;
        if (urlBar) urlBar.textContent = q.slice(0, 18);
      }
      searchWrap.classList.remove('open');
    }
    if (e.key === 'Escape') searchWrap.classList.remove('open');
  });

  // ── Tabs (OPS / INTEL / ASSETS / RUN) ────────────────────────────
  const tilesWrapEl = overlay.querySelector('.tiles-wrap');
  const runPanelEl = overlay.querySelector('#run-panel');
  overlay.querySelectorAll('.rs-tab').forEach(t => t.addEventListener('click', () => {
    overlay.querySelectorAll('.rs-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const isRun = t.dataset.panel === 'run';
    if (tilesWrapEl) tilesWrapEl.style.display = isRun ? 'none' : '';
    if (runPanelEl) runPanelEl.style.display = isRun ? 'flex' : 'none';
  }));

  // ── RUN tab: start/poll the rays_investigate MCP pipeline ─────────
  // Talks to the same rays_investigate tool that Claude/Cursor/an
  // Ollama-based MCP client would call from the command line - just
  // bridged over HTTP by proxy-server.mjs so the browser can reach it.
  // Each log entry already carries a pre-formatted `paragraph` (see
  // mcp/src/logging/logFormatter.mjs) labeled with its source
  // component, so the log window renders identically to what a
  // cmd-connected host sees on stderr.
  (function setupRunTab() {
    const runBtn = overlay.querySelector('#run-btn');
    const queryInput = overlay.querySelector('#run-query');
    const roundsInput = overlay.querySelector('#run-rounds');
    const statusEl = overlay.querySelector('#run-status');
    const logWindowEl = overlay.querySelector('#run-log-window');
    const downloadBtn = overlay.querySelector('#run-download-btn');
    if (!runBtn) return;

    let pollTimer = null;
    let latestData = null;

    function downloadReport() {
      if (!latestData) return;
      const name = latestData.targetName || latestData.investigationId || 'investigation';
      const a = document.createElement('a');
      a.href = `/rayspy-mcp/report?investigationId=${encodeURIComponent(name)}&format=txt`;
      a.download = `rayspy-report-${name}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    downloadBtn?.addEventListener('click', downloadReport);

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[c]));
    }

    function renderLogs(logs) {
      logWindowEl.innerHTML = (logs || [])
        .map((entry) => `<p class="run-log-entry">${escapeHtml(entry.paragraph || JSON.stringify(entry))}</p>`)
        .join('');
      logWindowEl.scrollTop = logWindowEl.scrollHeight;
    }

    function stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      runBtn.disabled = false;
      runBtn.textContent = 'run investigation';
    }

    async function pollStatus(investigationId) {
      try {
        const res = await fetch(`/rayspy-mcp/status?investigationId=${encodeURIComponent(investigationId)}`);
        const data = await res.json();
        if (data.error) {
          statusEl.textContent = `error: ${data.error}`;
          stopPolling();
          return;
        }
        statusEl.textContent =
          `status: ${data.status} | round ${data.round}/${data.maxRounds} | ` +
          `evidence: ${data.evidenceCount} | hypotheses: ${data.hypotheses?.length ?? 0}`;
        renderLogs(data.logs);
        latestData = data;
        downloadBtn.style.display = (['complete', 'aborted'].includes(data.status)) ? '' : 'none';
        if (['complete', 'aborted', 'awaiting_guidance'].includes(data.status)) stopPolling();
      } catch (err) {
        statusEl.textContent = `error: ${err.message}`;
        stopPolling();
      }
    }

    runBtn.addEventListener('click', async () => {
      const query = queryInput.value.trim();
      if (!query) {
        statusEl.textContent = 'enter a target name first (e.g. John Smith).';
        return;
      }
      const maxRounds = Math.max(1, Math.min(10, parseInt(roundsInput.value, 10) || 3));

      runBtn.disabled = true;
      runBtn.textContent = 'running…';
      statusEl.textContent = 'starting investigation…';
      logWindowEl.innerHTML = '';
      downloadBtn.style.display = 'none';
      latestData = null;

      try {
        const res = await fetch('/rayspy-mcp/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, maxRounds }),
        });
        const data = await res.json();
        if (data.error) {
          statusEl.textContent = `error: ${data.error}`;
          stopPolling();
          return;
        }
        statusEl.textContent = `status: ${data.status} | investigation: ${data.investigationId}`;
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(() => pollStatus(data.investigationId), 1000);
        pollStatus(data.investigationId);
      } catch (err) {
        statusEl.textContent = `error: ${err.message}`;
        stopPolling();
      }
    });
  })();

  // ── Bottom toolbar ────────────────────────────────────────────────
  overlay.querySelectorAll('[data-tool]').forEach(el => el.addEventListener('click', () => {
    overlay.querySelectorAll('[data-tool]').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
  }));

  // ── Data layer tiles (toggle real layers via main.js handlers) ──────
  overlay.querySelectorAll('[data-toggle]').forEach(tile => {
    tile.addEventListener('click', () => {
      handlers.onLayerToggle?.(tile.dataset.toggle);
    });
  });

  // ── DEM toggle (bottom toolbar) ─────────────────────────────────────
  overlay.querySelector('#btn-dem')?.addEventListener('click', e => {
    const tile = e.currentTarget;
    const on = !tile.classList.contains('active');
    tile.classList.toggle('active', on);
    handlers.onToggleDem?.(on);
  });

  // ── Panoptic / style tiles ──────────────────────────────────────────
  overlay.querySelector('#btn-panoptic')?.addEventListener('click', e => {
    const tile = e.currentTarget;
    const on = !tile.classList.contains('on');
    tile.classList.toggle('on', on);
    handlers.onPanoptic?.(on);
  });

  // Bloom / sharpen / hud / clean-ui — visual filter toggles on the Cesium canvas
  const canvasEl = () => document.querySelector('#cesiumContainer canvas');
  const activeFx = { bloom: false, sharpen: false, viewMode: 'normal' };

  function applyFx() {
    const c = canvasEl();
    if (!c) return;
    const parts = ['drop-shadow(0 0 12px #22d3ee88)'];
    if (activeFx.bloom)   parts.push('brightness(1.15) saturate(1.2)');
    if (activeFx.sharpen) parts.push('contrast(1.25)');
    if (activeFx.viewMode === 'crt')   parts.push('contrast(1.35) saturate(0.8) brightness(0.95)');
    if (activeFx.viewMode === 'anime') parts.push('saturate(1.65) contrast(1.15) brightness(1.05)');
    if (activeFx.viewMode === 'nvg')   parts.push('grayscale(1) brightness(1.35) sepia(1) hue-rotate(70deg) saturate(5) contrast(1.1)');
    if (activeFx.viewMode === 'flir')  parts.push('grayscale(1) invert(1) sepia(1) hue-rotate(180deg) saturate(6) contrast(1.35) brightness(1.05)');
    if (activeFx.viewMode === 'noir')  parts.push('grayscale(1) contrast(1.3) brightness(0.95)');
    if (activeFx.viewMode === 'snow')  parts.push('brightness(1.2) contrast(0.92) saturate(0.55)');
    c.style.filter = parts.join(' ');
  }
  overlay.querySelector('#btn-bloom')?.addEventListener('click', e => {
    activeFx.bloom = !activeFx.bloom;
    e.currentTarget.classList.toggle('on', activeFx.bloom);
    applyFx();
  });
  overlay.querySelector('#btn-sharpen')?.addEventListener('click', e => {
    activeFx.sharpen = !activeFx.sharpen;
    e.currentTarget.classList.toggle('on', activeFx.sharpen);
    applyFx();
  });

  // View mode cycle tile — press repeatedly:
  // normal -> anime -> crt -> nvg -> flir -> noir -> snow -> normal -> …
  const VIEW_MODES = ['normal', 'anime', 'crt', 'nvg', 'flir', 'noir', 'snow'];
  let viewModeIndex = 0;
  overlay.querySelector('#btn-viewmode')?.addEventListener('click', e => {
    viewModeIndex = (viewModeIndex + 1) % VIEW_MODES.length;
    const mode = VIEW_MODES[viewModeIndex];
    activeFx.viewMode = mode;
    applyFx();

    // CSS overlay classes handle every non-normal treatment now — same
    // proven mechanism CRT/Anime already used, no shader pipeline involved.
    const panel = overlay.querySelector('.globe-panel');
    panel?.classList.remove('fx-crt', 'fx-anime', 'fx-nvg', 'fx-flir', 'fx-noir', 'fx-snow');
    if (mode !== 'normal') panel?.classList.add(`fx-${mode}`);

    const tile = e.currentTarget;
    tile.classList.toggle('on', mode !== 'normal');
    const valueEl = tile.querySelector('#wv-viewmode-value');
    if (valueEl) valueEl.textContent = mode === 'normal' ? 'NRM' : mode.toUpperCase();
  });
  // ── PART 3: manual "3D City" button ────────────────────────────────
  // Independent toggle (no data-tool grouping) so it never interferes with
  // the Measure/Draw/Location/Track/Filter/Export/Layers mutually-exclusive
  // tool selection below. Purely tells main.js/HoloCity to show or hide the
  // Cesium Ion OSM 3D buildings tileset; camera and viewer are untouched.
  overlay.querySelector('#btn-3d-city')?.addEventListener('click', e => {
    const tile = e.currentTarget;
    const on = !tile.classList.contains('active');
    tile.classList.toggle('active', on);
    handlers.onToggle3DCity?.(on);
  });

  overlay.querySelector('#btn-hud')?.addEventListener('click', e => {
    const on = e.currentTarget.classList.toggle('on');
    overlay.querySelectorAll('.hud-tl,.hud-tr,.hud-bl,.hud-br,.g-status').forEach(el => {
      el.style.display = on ? 'none' : '';
    });
  });
  overlay.querySelector('#btn-clean-ui')?.addEventListener('click', e => {
    const on = e.currentTarget.classList.toggle('on');
    overlay.querySelector('.rs-top').style.display = on ? 'none' : '';
    overlay.querySelector('.right-panel').style.display = on ? 'none' : '';
    overlay.querySelector('.rs-bot').style.display = on ? 'none' : '';
  });

  // Style preset row (NRM / etc.)
  overlay.querySelectorAll('.style-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      overlay.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const label = overlay.querySelector('#wv-style-label');
      if (label) label.textContent = chip.dataset.style.toUpperCase();
    });
  });

  // ── CCTV sub-panel ─────────────────────────────────────────────────
  overlay.querySelector('#cctv-coverage')?.addEventListener('click', e => {
    e.target.classList.toggle('active');
    handlers.onCctvCoverage?.(e.target.classList.contains('active'));
  });
  overlay.querySelector('#cctv-fov-wedges')?.addEventListener('click', e => {
    e.target.classList.toggle('active');
    handlers.onCctvFovWedges?.(e.target.classList.contains('active'));
  });
  overlay.querySelector('#cctv-projection')?.addEventListener('click', e => {
    e.target.classList.toggle('active');
    handlers.onCctvProjection?.(e.target.classList.contains('active'));
  });
  overlay.querySelector('#cctv-select')?.addEventListener('change', e => {
    handlers.onCctvSelect?.(e.target.value);
  });
  overlay.querySelector('#cctv-prev')?.addEventListener('click', () => handlers.onCctvAction?.('prev'));
  overlay.querySelector('#cctv-next')?.addEventListener('click', () => handlers.onCctvAction?.('next'));
  overlay.querySelector('#cctv-nearest')?.addEventListener('click', () => handlers.onCctvAction?.('nearest'));

  // ── ui object returned to main.js ────────────────────────────────
  const detailEl = overlay.querySelector('#wv-detail');

  const ui = {
    overlay,
    detailEl,

    setLayerOn(layerId, on) {
      overlay.querySelectorAll(`[data-toggle="${layerId}"]`).forEach(t => t.classList.toggle('on', on));
    },

    setLayerCount(layerId, count) {
      const el = overlay.querySelector(`[data-count="${layerId}"]`);
      if (el) el.textContent = count;
    },

    setSummary(text) {
      const el = overlay.querySelector('#wv-summary');
      if (el) el.textContent = text;
    },

    setDemOn(on) {
      const tile = overlay.querySelector('#btn-dem');
      if (tile) tile.classList.toggle('active', !!on);
    },

    /** PART 3: reflect 3D City tileset state on the button (e.g. on failure). */
    setCity3DOn(on) {
      const tile = overlay.querySelector('#btn-3d-city');
      if (tile) tile.classList.toggle('active', !!on);
    },

    setLocation(loc, landmark) {
      const locEl = overlay.querySelector('#wv-loc');
      const lmEl  = overlay.querySelector('#wv-landmark');
      if (locEl) locEl.textContent = loc || '—';
      if (lmEl)  lmEl.textContent  = landmark || '—';
    },

    setLandmark(loc, landmark) { ui.setLocation(loc, landmark); },

    setDetail(detail) {
      if (!detailEl) return;
      if (!detail) { detailEl.innerHTML = ''; return; }
      const rows = Object.entries(detail)
        .filter(([k, v]) => typeof v !== 'object' && typeof v !== 'function')
        .map(([k, v]) => `<div class="dt-row"><span class="dt-k">${k}</span><span class="dt-v">${v}</span></div>`)
        .join('');
      detailEl.innerHTML = `<div class="dt-title">${detail.title || detail.camera?.label || 'INTEL'}</div>${rows}`;
    },

    setSpyTrack(detail) {
      const el = overlay.querySelector('#wv-spy-track');
      if (el && detail) el.textContent = `TRACKING: ${detail.title || detail.camera?.label || '—'}`;
    },

    clearSpyTrack() {
      const el = overlay.querySelector('#wv-spy-track');
      if (el) el.textContent = '';
    },

    populateCctvSelect(cameras, selectedId) {
      const sel = overlay.querySelector('#cctv-select');
      if (!sel) return;
      sel.innerHTML = '<option value="">— pick camera —</option>' +
        cameras.map(c => `<option value="${c.id}"${c.id === selectedId ? ' selected' : ''}>${c.label || c.id}</option>`).join('');
    },

    stopCctvFeeds() {
      overlay.querySelectorAll('.wv-cctv-feed-img').forEach(img => { img.src = ''; });
    },

    syncCctvSliders(calibration) {
      // No calibration sliders in this v2 layout — no-op
    },

    updateCctvPreview(detail) {
      const img = overlay.querySelector('#wv-cctv-preview-img');
      if (img && detail?.feedUrl) { img.src = detail.feedUrl; img.style.display = 'block'; }
    },
  };

  return ui;
}

function buildHTML() {
  return `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css">
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<div class="rs" id="app">

  <div class="rs-top">
    <div class="search-wrap" id="searchWrap">
      <div class="search-input-wrap">
        <input class="rs-search" id="wv-search-input" placeholder="SEARCH LOCATION, ASSET OR INTEL...">
      </div>
      <div class="search-icon-btn" id="searchBtn"><i class="ti ti-search"></i></div>
    </div>
    <div class="rs-tr">REC <span id="wv-clock">--</span> &nbsp;|&nbsp; ORB:<span>LIVE</span> &nbsp;|&nbsp; STYLE:<span id="wv-style-label">NORMAL</span></div>
  </div>

  <div class="rs-main">
    <div class="globe-panel">
      <div class="hud-tl"></div><div class="hud-tr"></div>
      <div class="hud-bl"></div><div class="hud-br"></div>
      <div class="g-status" id="wv-summary">No DEM · Esri imagery + OSM</div>
      <div class="g-status-bottom"><span id="wv-spy-track"></span></div>
      <div class="g-loc-row">
        <span>Location: <b id="wv-loc">—</b></span>
        <span>Landmark: <b id="wv-landmark">—</b></span>
      </div>
    </div>

    <div class="right-panel">
      <div class="rs-panel-brand">
        <p class="brand-title">RAYSPY</p>
        <p class="brand-subtitle">tactical intelligence system</p>
      </div>

      <div class="rs-tabs">
        <div class="rs-tab active" data-panel="ops">OPS</div>
        <div class="rs-tab" data-panel="intel">INTEL</div>
        <div class="rs-tab" data-panel="assets">ASSETS</div>
        <div class="rs-tab" data-panel="run">RUN</div>
      </div>

      <div id="run-panel" class="run-panel" style="display:none">
        <div class="run-controls">
          <input id="run-query" class="run-input" type="text" placeholder="target name (e.g. John Smith)" />
          <input id="run-rounds" class="run-rounds" type="number" min="1" max="10" value="3" title="max rounds" />
          <button id="run-btn" class="run-btn" type="button">run investigation</button>
        </div>
        <div class="run-hint">enter a name only — the MCP pipeline discovers emails, handles, locations, and other identifiers itself via the OSINT agents across multiple rounds.</div>
        <div id="run-status" class="run-status">idle — enter a name and press run.</div>
        <button id="run-download-btn" class="run-download-btn" type="button" style="display:none">download report</button>
        <div id="run-log-window" class="run-log-window"></div>
      </div>

      <div class="tiles-wrap">
      <div class="tiles">
        <div class="tile t-flights grey" data-toggle="flights">
          <div class="ton"></div>
          <div class="tv" data-count="flights">0</div>
          <div class="tl">Live Flights</div>
          <div class="ts">OpenSky Network</div>
        </div>
        <div class="tile t-alerts scarlet">
          <div class="ton"></div>
          <div class="tv sm">34</div>
          <div class="tl">Alerts</div>
        </div>
        <div class="tile t-sats green" data-toggle="satellites">
          <div class="ton"></div>
          <div class="tv sm" data-count="satellites"></div>
          <div class="tl">Satellites</div>
          <div class="ts">CelesTrak</div>
        </div>
        <div class="tile t-mil mustard" data-toggle="military">
          <div class="tv sm" data-count="military"></div>
          <div class="tl">Mil Flt</div>
          <div class="ts">adsb.lol</div>
        </div>
        <div class="tile t-cctv green" data-toggle="cctv">
          <div class="ton"></div>
          <div class="tv sm" data-count="cctv"></div>
          <div class="tl">CCTV Net</div>
          <div class="ts">OpenEagleEye</div>
        </div>
        <div class="tile t-traffic grey">
          <div class="ton"></div>
          <div class="tv-row">
            <div><div class="tv sm">7,392</div><div class="tl">Traffic Idx</div></div>
            <div><div class="tv sm">ON</div><div class="tl">Flow</div></div>
          </div>
        </div>
        <div class="tile t-bloom scarlet" id="btn-bloom"><div class="tl">Bloom</div></div>
        <div class="tile t-sharp grey" id="btn-sharpen"><div class="tl">Sharpen</div></div>
        <div class="tile t-pan green" id="btn-panoptic">
          <div class="ton"></div>
          <div class="tv md">50%</div>
          <div class="tl">Panoptic</div>
          <div class="ts">Density</div>
        </div>
        <div class="tile t-browser browser-tile">
          <div class="browser-chrome">
            <span class="browser-dot"></span><span class="browser-dot"></span><span class="browser-dot"></span>
            <span class="browser-url">browser uplink</span>
          </div>
          <iframe class="browser-frame" src="about:blank" title="Browser uplink" sandbox="allow-scripts allow-same-origin"></iframe>
        </div>
        <div class="tile t-hud grey" id="btn-hud"><div class="tl">HUD</div></div>
        <div class="tile t-clean mustard" id="btn-clean-ui"><div class="tl">Clean UI</div></div>
        <div class="tile t-alts scarlet talert"><div class="ton"></div><div class="tv sm">34</div><div class="tl">Active Alts</div></div>
        <div class="tile t-wx grey" data-toggle="weather"><div class="tl">Weather</div></div>
        <div class="tile t-style prow">
          <div class="style-chip active" data-style="normal"><span>NRM</span></div>
        </div>
        <div class="tile t-quake mustard" data-toggle="earthquakes">
          <div class="tv sm" data-count="earthquakes"></div>
          <div class="tl">Earthquakes</div><div class="ts">USGS 24H</div>
        </div>
        <div class="tile t-bike grey" data-toggle="bikeshare" style="opacity:.5"><div class="tl">Bikeshare</div><div class="ts">Offline</div></div>
        <div class="tile t-viewmode blue" id="btn-viewmode">
          <div class="ton"></div>
          <div class="tv sm" id="wv-viewmode-value">NRM</div>
          <div class="tl">View Mode</div>
          <div class="ts">Anime/CRT/NVG/FLIR/NOIR/SNOW</div>
        </div>
        <div class="tile t-orb green" data-toggle="orbital"><div class="tl">Orbital</div><div class="ts">Mode</div></div>
        <div class="tile t-cctv-bar prow">
          <button class="wv-chip active" id="cctv-coverage" type="button">COVERAGE ON</button>
          <button class="wv-chip active" id="cctv-fov-wedges" type="button">FOV WEDGES</button>
          <button class="wv-chip" id="cctv-projection" type="button">PROJECTION</button>
        </div>
        <div class="tile t-cctv-nav prow">
          <button class="wv-chip" id="cctv-prev" type="button">◀ PREV</button>
          <button class="wv-chip" id="cctv-nearest" type="button">NEAREST</button>
          <button class="wv-chip" id="cctv-next" type="button">NEXT ▶</button>
        </div>
      </div>
      </div>

      <select id="cctv-select" class="wv-select cctv-select-compact"></select>
      <img id="wv-cctv-preview-img" class="wv-cctv-feed-img" style="width:100%;margin-top:4px;display:none" />

      <div id="wv-detail" class="wv-detail"></div>
    </div>
  </div>

  <div class="rs-bot">
    <div class="rs-tool" id="btn-3d-city" title="Toggle realistic 3D buildings"><i class="ti ti-building-skyscraper t-icon"></i><span class="t-label">3D City</span></div>
    <div class="rs-tool" id="btn-dem" title="Toggle terrain elevation (DEM)"><i class="ti ti-mountain t-icon"></i><span class="t-label">DEM</span></div>
    <div class="rs-tool" data-tool="measure"><i class="ti ti-ruler t-icon"></i><span class="t-label">Measure</span></div>
    <div class="rs-tool" data-tool="draw"><i class="ti ti-pencil t-icon"></i><span class="t-label">Draw</span></div>
    <div class="rs-tool" data-tool="location"><i class="ti ti-map-pin t-icon"></i><span class="t-label">Location</span></div>
    <div class="rs-tool active" data-tool="track"><i class="ti ti-radar t-icon"></i><span class="t-label">Track</span></div>
    <div class="rs-tool" data-tool="filter"><i class="ti ti-filter t-icon"></i><span class="t-label">Filter</span></div>
    <div class="rs-tool" data-tool="export"><i class="ti ti-upload t-icon"></i><span class="t-label">Export</span></div>
    <div class="rs-tool" data-tool="layers"><i class="ti ti-layout-grid t-icon"></i><span class="t-label">Layers</span></div>
  </div>
</div>
  `;
}

function injectStyles() {
  if (document.getElementById('rs-ui-css')) return;
  const s = document.createElement('style');
  s.id = 'rs-ui-css';
  s.textContent = `
:root{
  --bg-page:#0B0D14; --bg-header:#0F1219; --bg-map:#12151F; --bg-panel:#0F1219;
  --tile-bg:#1A1F2E; --border-subtle:rgba(255,255,255,0.06); --border-subtle-2:rgba(255,255,255,0.05);
  --border-subtle-3:rgba(255,255,255,0.1);
  --accent:#D946EF; --accent-border:rgba(217,70,239,0.3); --accent-border-strong:rgba(217,70,239,0.35);
  --accent-border-soft:rgba(217,70,239,0.25);
  --status-green:#4ADE80; --status-green-border:rgba(74,222,128,0.35); --status-green-border-strong:rgba(74,222,128,0.4);
  --status-red:#F87171; --status-red-border:rgba(239,68,68,0.35);
  --status-amber:#F59E0B; --status-amber-border:rgba(245,158,11,0.35);
  --status-blue:#60A5FA; --status-blue-border:rgba(96,165,250,0.35);
  --text-primary:#E5E7EB; --text-secondary:#9CA3AF; --text-muted:#6B7280; --text-faint:#4B5563;
  --font-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  --font-mono:'Share Tech Mono',monospace;
}
*{box-sizing:border-box;}
#worldview-overlay{position:absolute;inset:0;z-index:10;pointer-events:none;display:flex;flex-direction:column;background:transparent;}
.rs{position:absolute;inset:0;display:flex;flex-direction:column;pointer-events:none;font-family:var(--font-sans);color:var(--text-secondary);}

.rs-top{pointer-events:auto;background:var(--bg-header);border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;padding:0 16px;height:38px;gap:12px;flex-shrink:0;justify-content:space-between;}
.search-wrap{position:relative;display:flex;align-items:center;margin-right:auto;}
.search-icon-btn{width:28px;height:28px;border-radius:50%;border:1px solid var(--accent-border-strong);background:#12151F;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;z-index:2;transition:border-color .2s,background .2s;}
.search-icon-btn:hover{border-color:var(--accent);background:rgba(217,70,239,0.08);}
.search-icon-btn i{font-size:14px;color:var(--accent);}
.search-input-wrap{overflow:hidden;width:0;transition:width .35s cubic-bezier(.4,0,.2,1),opacity .3s;opacity:0;position:absolute;left:34px;}
.search-wrap.open .search-input-wrap{width:240px;opacity:1;}
.rs-search{width:240px;background:#12151F;border:1px solid var(--accent-border);color:var(--text-primary);font-family:var(--font-mono);font-size:10px;padding:5px 10px;letter-spacing:.05em;outline:none;border-radius:4px;}
.rs-search::placeholder{color:var(--text-muted);}
.rs-tr{font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);letter-spacing:.05em;white-space:nowrap;}
.rs-tr span{color:var(--status-green);}

.rs-main{display:flex;flex:1;min-height:0;position:relative;pointer-events:none;gap:0;}

.globe-panel{flex:1.7;position:relative;overflow:hidden;pointer-events:none;background:transparent;}
.hud-tl{position:absolute;top:12px;left:12px;width:18px;height:18px;border-top:2px solid var(--status-red);border-left:2px solid var(--status-red);z-index:5;}
.hud-tr{position:absolute;top:12px;right:12px;width:18px;height:18px;border-top:2px solid var(--status-green);border-right:2px solid var(--status-green);z-index:5;}
.hud-bl{position:absolute;bottom:52px;left:12px;width:18px;height:18px;border-bottom:2px solid var(--status-red);border-left:2px solid var(--status-red);z-index:5;}
.hud-br{position:absolute;bottom:52px;right:12px;width:18px;height:18px;border-bottom:2px solid var(--status-green);border-right:2px solid var(--status-green);z-index:5;}
.g-status{position:absolute;bottom:34px;left:0;right:0;font-family:var(--font-mono);font-size:9px;color:var(--text-muted);text-align:center;letter-spacing:.08em;z-index:5;}
.g-status-bottom{position:absolute;bottom:20px;left:12px;font-family:var(--font-mono);font-size:9px;color:var(--text-secondary);z-index:5;}
.g-loc-row{position:absolute;top:38px;left:12px;display:flex;gap:16px;font-family:var(--font-mono);font-size:9px;color:var(--text-muted);z-index:5;}
.g-loc-row b{color:var(--text-primary);font-weight:400;}
.globe-panel.fx-crt::before{content:'';position:absolute;inset:-2%;pointer-events:none;z-index:3;opacity:.22;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");background-size:180px 180px;animation:rs-crt-static .2s steps(2) infinite;}
.globe-panel.fx-crt::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:4;background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.06) 0 1px,transparent 1px 3px);mix-blend-mode:overlay;animation:rs-crt-flicker 2.6s steps(30) infinite;}
@keyframes rs-crt-static{0%{transform:translate(0,0);}33%{transform:translate(-2%,1%);}66%{transform:translate(1%,-2%);}100%{transform:translate(-1%,2%);}}
@keyframes rs-crt-flicker{0%,100%{opacity:1;}8%{opacity:.85;}9%{opacity:1;}47%{opacity:.9;}48%{opacity:1;}72%{opacity:.82;}73%{opacity:1;}}
.globe-panel.fx-anime::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:4;box-shadow:inset 0 0 90px rgba(217,70,239,0.28);}
.globe-panel.fx-nvg::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:4;box-shadow:inset 0 0 110px rgba(0,0,0,0.55),inset 0 0 40px rgba(80,255,120,0.18);}
.globe-panel.fx-flir::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:4;box-shadow:inset 0 0 100px rgba(0,0,0,0.35);}
.globe-panel.fx-noir::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:4;box-shadow:inset 0 0 110px rgba(0,0,0,0.5);}
.globe-panel.fx-snow::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:4;background:rgba(210,230,255,0.06);box-shadow:inset 0 0 90px rgba(255,255,255,0.25);}

.right-panel{pointer-events:auto;width:360px;background:var(--bg-panel);border-left:1px solid var(--accent-border-soft);display:flex;flex-direction:column;overflow:hidden;z-index:5;padding:0;}

.rs-panel-brand{padding:14px 14px 10px;border-bottom:1px solid var(--border-subtle);flex-shrink:0;text-align:center;}
.brand-title{font-size:18px;font-weight:500;color:var(--accent);letter-spacing:.15em;margin:0;font-family:var(--font-sans);}
.brand-subtitle{font-size:9px;color:var(--text-muted);letter-spacing:.1em;margin:2px 0 0;text-transform:lowercase;}

.rs-tabs{display:flex;gap:8px;border-bottom:1px solid var(--border-subtle);padding:0 14px 8px;flex-shrink:0;font-size:10px;letter-spacing:.08em;}
.rs-tab{padding:0 2px 6px;text-align:left;font-family:var(--font-sans);font-size:10px;letter-spacing:.08em;color:var(--text-muted);cursor:pointer;border-bottom:1px solid transparent;transition:color .2s,border-color .2s;text-transform:lowercase;flex:0 0 auto;}
.rs-tab.active{color:var(--text-primary);border-bottom:1px solid var(--accent);}
.rs-tab:hover:not(.active){color:var(--text-secondary);}

.run-panel{flex:1;min-height:0;padding:8px 14px;display:flex;flex-direction:column;gap:8px;overflow:hidden;pointer-events:auto;}
.run-controls{display:flex;gap:6px;flex-shrink:0;}
.run-input{flex:1;min-width:0;background:#12151F;border:1px solid var(--accent-border);color:var(--text-primary);font-family:var(--font-mono);font-size:10px;padding:6px 8px;border-radius:6px;outline:none;}
.run-input::placeholder{color:var(--text-muted);}
.run-rounds{width:44px;background:#12151F;border:1px solid var(--accent-border);color:var(--text-primary);font-family:var(--font-mono);font-size:10px;padding:6px 4px;border-radius:6px;outline:none;text-align:center;}
.run-hint{flex-shrink:0;font-family:var(--font-sans);font-size:8px;color:var(--text-muted);line-height:1.4;letter-spacing:.02em;}
.run-btn{flex-shrink:0;background:rgba(217,70,239,0.12);border:1px solid var(--accent-border-strong);color:var(--accent);font-family:var(--font-sans);font-size:9px;letter-spacing:.04em;text-transform:lowercase;padding:0 12px;border-radius:6px;cursor:pointer;transition:background .15s;}
.run-btn:hover:not(:disabled){background:rgba(217,70,239,0.2);}
.run-btn:disabled{opacity:.6;cursor:default;}
.run-status{flex-shrink:0;font-family:var(--font-mono);font-size:9px;color:var(--text-secondary);letter-spacing:.03em;padding:2px 0;border-bottom:1px solid var(--border-subtle);padding-bottom:6px;}
.run-download-btn{flex-shrink:0;align-self:flex-start;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.4);color:#4ADE80;font-family:var(--font-sans);font-size:9px;letter-spacing:.04em;text-transform:lowercase;padding:5px 12px;border-radius:6px;cursor:pointer;transition:background .15s;}
.run-download-btn:hover{background:rgba(34,197,94,0.2);}
.run-log-window{flex:1;min-height:0;overflow-y:auto;border:1px solid var(--accent-border-soft);border-radius:6px;background:var(--bg-page);padding:8px;}
.run-log-entry{font-family:var(--font-mono);font-size:9px;line-height:1.5;color:var(--text-secondary);margin:0 0 8px;padding-bottom:8px;border-bottom:1px solid var(--border-subtle-2);word-break:break-word;}
.run-log-entry:last-child{margin-bottom:0;border-bottom:none;}

.tiles-wrap{flex:1;min-height:0;padding:0 14px 8px;overflow:hidden;}
.tiles{
  height:100%;
  display:grid;
  grid-template-columns:repeat(6,minmax(0,1fr));
  grid-template-rows:repeat(8,minmax(0,1fr));
  gap:6px;
  border:1px solid var(--accent-border-soft);
  border-radius:6px;
  padding:6px;
  background:var(--bg-page);
  overflow:hidden;
}

.tile{border-radius:6px;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;padding:6px;cursor:pointer;position:relative;overflow:hidden;user-select:none;border:1px solid var(--border-subtle);background:var(--tile-bg);transition:filter .12s ease,border-color .12s ease;min-height:0;min-width:0;}
.tile::before,.tile::after{content:none;}
.tile:hover{filter:brightness(1.08);}
.tile.on{outline:1px solid var(--accent);outline-offset:-1px;border-color:var(--accent-border-strong);}

.t-flights{grid-column:1/3;grid-row:1/4;}
.t-alerts{grid-column:3/4;grid-row:1/2;border-color:var(--status-red-border);}
.t-sats{grid-column:4/5;grid-row:1/3;border-color:var(--status-green-border);}
.t-mil{grid-column:5/7;grid-row:1/2;border-color:var(--status-amber-border);}
.t-cctv{grid-column:3/5;grid-row:2/3;border-color:var(--status-green-border);}
.t-traffic{grid-column:5/7;grid-row:2/4;}
.t-dem{grid-column:1/2;grid-row:4/5;border-color:var(--status-amber-border);}
.t-bloom{grid-column:2/3;grid-row:4/5;border-color:var(--status-red-border);}
.t-sharp{grid-column:3/4;grid-row:3/4;}
.t-pan{grid-column:4/6;grid-row:3/6;border-color:var(--status-green-border-strong);}
.t-browser{grid-column:6/7;grid-row:3/9;padding:0;justify-content:stretch;align-items:stretch;cursor:default;overflow:hidden;border-color:var(--border-subtle-3);}
.t-hud{grid-column:1/2;grid-row:5/6;}
.t-clean{grid-column:2/3;grid-row:5/6;border-color:var(--status-amber-border);}
.t-alts{grid-column:3/4;grid-row:4/5;border-color:var(--status-red-border);}
.t-style{grid-column:1/2;grid-row:6/7;}
.t-wx{grid-column:2/3;grid-row:6/7;}
.t-quake{grid-column:3/5;grid-row:5/6;border-color:var(--status-amber-border);}
.t-orb{grid-column:1/3;grid-row:7/9;border-color:var(--status-green-border);}
.t-bike{grid-column:3/5;grid-row:6/7;opacity:.55;}
.t-viewmode{grid-column:3/4;grid-row:7/9;border-color:var(--status-blue-border);}
.t-cctv-bar{grid-column:4/7;grid-row:7/8;flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:4px;padding:4px 6px;cursor:default;border-top:1px solid var(--border-subtle);}
.t-cctv-nav{grid-column:4/7;grid-row:8/9;flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:4px;padding:4px 6px;cursor:default;}

.tl{font-size:8px;font-weight:500;letter-spacing:.02em;text-transform:lowercase;color:var(--text-secondary);line-height:1.1;z-index:3;}
.ts{font-size:7px;color:var(--text-muted);text-transform:lowercase;line-height:1;z-index:3;}
.tv{font-size:15px;font-weight:500;line-height:1;color:var(--text-primary);font-family:var(--font-sans);z-index:3;}
.scarlet .tv,.t-alerts .tv,.t-alts .tv,.t-bloom .tv{color:var(--status-red);}
.green .tv,.t-sats .tv,.t-cctv .tv,.t-pan .tv,.t-orb .tv{color:var(--status-green);}
.mustard .tv,.t-mil .tv,.t-dem .tv,.t-quake .tv,.t-clean .tv{color:var(--status-amber);}
.blue .tv,.t-viewmode .tv{color:var(--status-blue);}
.tv.sm{font-size:13px;}.tv.md{font-size:16px;}
.tv-row{display:flex;justify-content:space-between;width:100%;gap:4px;z-index:3;}
.ton{display:none;}
.talert{animation:rs-alertglow 1.2s ease-in-out infinite;}
@keyframes rs-alertglow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.12)}}

.browser-tile{background:#12151F;}
.browser-chrome{display:flex;align-items:center;gap:4px;padding:4px 6px;background:rgba(0,0,0,.35);border-bottom:1px solid var(--border-subtle);width:100%;flex-shrink:0;z-index:4;}
.browser-dot{width:4px;height:4px;border-radius:50%;background:var(--text-faint);}
.browser-url{font-family:var(--font-mono);font-size:8px;color:var(--text-secondary);letter-spacing:.04em;margin-left:2px;text-transform:lowercase;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1;}
.browser-frame{flex:1;width:100%;height:100%;border:none;background:#060a10;min-height:0;max-height:100%;pointer-events:auto;display:block;}

.prow{justify-content:flex-start;align-items:center;background:var(--tile-bg);}
.style-chip{display:flex;align-items:center;justify-content:center;width:28px;height:18px;border-radius:4px;background:transparent;border:1px solid var(--border-subtle-3);cursor:pointer;transition:all .15s;}
.style-chip span{font-size:8px;font-weight:500;color:var(--text-secondary);}
.style-chip.active{background:rgba(217,70,239,0.12);border-color:var(--accent-border-strong);}
.style-chip.active span{color:var(--accent);}

.cctv-select-compact{margin:6px 14px 0;flex-shrink:0;width:calc(100% - 28px);}
.wv-chip{padding:3px 8px;border:1px solid var(--accent-border-strong);border-radius:4px;background:transparent;color:var(--accent);font-family:var(--font-sans);font-size:9px;letter-spacing:.04em;cursor:pointer;transition:all .2s;text-transform:lowercase;line-height:1.3;}
.wv-chip.active{color:var(--accent);border-color:var(--accent-border-strong);background:rgba(217,70,239,0.08);}
.wv-chip:not(.active){color:var(--text-secondary);border-color:var(--border-subtle-3);}
.wv-chip:hover{color:var(--text-primary);border-color:var(--accent-border);}
.wv-select{width:100%;background:#12151F;border:1px solid var(--accent-border);color:var(--text-primary);font-family:var(--font-mono);font-size:9px;padding:6px 8px;outline:none;flex-shrink:0;border-radius:6px;}
.wv-detail{padding:6px 14px;font-family:var(--font-mono);font-size:8px;color:var(--text-muted);border-top:1px solid var(--border-subtle);flex-shrink:0;max-height:56px;overflow-y:auto;}
.dt-title{color:var(--text-primary);font-size:9px;letter-spacing:.08em;margin-bottom:4px;}
.dt-row{display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid var(--border-subtle-2);}
.dt-k{color:var(--text-muted);}.dt-v{color:var(--text-secondary);}

.rs-bot{pointer-events:auto;background:var(--bg-header);border-top:1px solid var(--border-subtle-2);display:flex;justify-content:center;gap:28px;padding:10px;flex-shrink:0;align-items:center;margin:0 14px 10px;border-radius:8px;border:1px solid var(--border-subtle-2);}
.rs-tool{display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 10px;cursor:pointer;position:relative;border-radius:6px;transition:background .15s;}
.rs-tool::after{display:none;}
.t-icon{font-size:16px;color:var(--text-secondary);transition:color .15s;}
.t-label{font-family:var(--font-sans);font-size:9px;letter-spacing:.02em;color:var(--text-muted);text-transform:lowercase;transition:color .15s;}
.rs-tool.active{background:var(--tile-bg);}
.rs-tool.active .t-icon,.rs-tool:hover .t-icon{color:var(--accent);}
.rs-tool.active .t-label,.rs-tool:hover .t-label{color:var(--text-primary);}
  `;
  document.head.appendChild(s);
}
