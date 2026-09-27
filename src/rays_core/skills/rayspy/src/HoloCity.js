import * as Cesium from 'cesium';
import { ZoomController, STAGES } from './core/ZoomController.js';
import { GlobeStyler }            from './core/GlobeStyler.js';
import { TransitionController }   from './core/TransitionController.js';
import { GridRenderer }           from './city/GridRenderer.js';
import { RoadRenderer }           from './city/RoadRenderer.js';
import { BuildingRenderer }       from './city/BuildingRenderer.js';
import { TargetLock }             from './intel/TargetLock.js';
import { IntelPanel }             from './intel/IntelPanel.js';
import { OSMProvider }            from './providers/OSMProvider.js';
import { MapillaryProvider }      from './providers/MapillaryProvider.js';
import { ScanlineEffect }         from './effects/ScanlineEffect.js';

/**
 * Shows a full-screen view-transition flash overlay with a label.
 * Appears instantly, holds briefly, then fades out — total ~1.4s.
 * Non-blocking: the Cesium camera and all layers continue normally underneath.
 */
function showViewTransition(label) {
  // Remove any previous overlay still fading
  const old = document.getElementById('rsp-view-transition');
  if (old) old.remove();

  const el = document.createElement('div');
  el.id = 'rsp-view-transition';
  el.style.cssText = `
    position: fixed; inset: 0; z-index: 500;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: rgba(0, 8, 20, 0.82);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.25s ease;
  `;
  el.innerHTML = `
    <div style="
      font-family:'Share Tech Mono','Orbitron',monospace;
      font-size: clamp(18px, 3vw, 32px);
      letter-spacing: 0.35em;
      color: #22d3ee;
      text-shadow: 0 0 18px #22d3ee, 0 0 40px #22d3ee88;
      text-transform: uppercase;
      text-align: center;
    ">${label}</div>
    <div style="
      margin-top: 18px;
      width: clamp(180px, 30vw, 340px);
      height: 3px;
      background: rgba(34,211,238,0.15);
      border: 1px solid rgba(34,211,238,0.3);
      overflow: hidden;
      position: relative;
    ">
      <div style="
        position: absolute; inset: 0;
        background: linear-gradient(90deg, transparent, #22d3ee, transparent);
        animation: rsp-vt-scan 0.9s ease-in-out forwards;
      "></div>
    </div>
  `;

  // Inject the scan keyframe once
  if (!document.getElementById('rsp-vt-style')) {
    const s = document.createElement('style');
    s.id = 'rsp-vt-style';
    s.textContent = `
      @keyframes rsp-vt-scan {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `;
    document.head.appendChild(s);
  }

  document.body.appendChild(el);

  // Fade in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { el.style.opacity = '1'; });
  });

  // Hold 900ms then fade out and remove
  setTimeout(() => {
    el.style.transition = 'opacity 0.4s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 420);
  }, 900);
}

export class HoloCity {
  constructor(viewer, options = {}) {
    this.viewer        = viewer;
    this._osmBuildings = options.osmBuildings ?? null;
    this._holoGlobe3D  = options.holoGlobe3D ?? null;
    this._stage         = null;
    this._loadedCenter  = null;
    this._loading       = false;
    this._clickHandler  = null;
    this._hudEl         = null;
    this._atmosphereEl  = null;
    this._frameCount    = 0;
    this._hasRealBuildings = false;

    // ── PART 3: manual "3D City" button state ─────────────────────
    // null  = fully automatic (zoom-stage driven, original behavior)
    // true  = user forced the OSM 3D buildings tileset ON
    // false = user forced the OSM 3D buildings tileset OFF
    this._manualOverride   = null;
    this._buildingFadeRaf   = null;
    this._buildingFadeAlpha = 0;
  }

  init() {
    // providers
    this._osm       = new OSMProvider();
    this._mapillary = new MapillaryProvider();

    // renderers
    this._grid      = new GridRenderer(this.viewer);
    this._roads     = new RoadRenderer(this.viewer);
    this._buildings = new BuildingRenderer(this.viewer);

    // intel
    this._targetLock = new TargetLock(this.viewer, (lon, lat, h, id) => {
      this._intel.showBuilding(lon, lat, id);
    });
    this._intel = new IntelPanel(this._mapillary);
    this._intel.mount();

    // effects
    this._scanline = new ScanlineEffect();
    this._scanline.mount();

    // globe styler + imagery transition
    this._globeStyle = new GlobeStyler(this.viewer);
    this._transition = new TransitionController(this.viewer);

    // zoom controller
    this._zoom = new ZoomController(this.viewer, {
      onStage:    (s, p, a) => this._onStage(s, p, a),
      onAltitude: (a)       => this._onAltitude(a),
    });
    this._zoom.start();

    // click handler for target lock
    this._installClickHandler();

    // HUD badge
    this._mountHUD();

    // inject intel panel CSS
    this._injectCSS();

    console.log('[HoloCity] initialized');
  }

  /** Called from main.js once Cesium Ion OSM 3D buildings tileset is ready. */
  setOsmBuildings(tileset) {
    this._osmBuildings = tileset;
    this._hasRealBuildings = !!tileset;
    if (tileset) this._styleOsmBuildings(tileset);
    if (tileset && this._stage) this._syncOsmBuildings(this._stage);
  }

  /**
   * Holographic cyan tint on Cesium Ion OSM 3D buildings (demo HTML style).
   * `alphaFactor` (0..1) scales every condition's alpha uniformly, which is
   * how the manual "3D City" button fades the tileset in/out smoothly
   * without changing its color scheme or touching `tileset.show` mid-fade.
   */
  _styleOsmBuildings(tileset, alphaFactor = 1) {
    const a = (v) => Math.max(0, Math.min(1, v * alphaFactor));
    tileset.style = new Cesium.Cesium3DTileStyle({
      color: {
        conditions: [
          ['${feature["cesium#estimatedHeight"]} > 80', `color('#00e5ff', ${a(0.92)})`],
          ['${feature["cesium#estimatedHeight"]} > 30', `color('#00c8e8', ${a(0.88)})`],
          ['true', `color('#00a8cc', ${a(0.82)})`],
        ],
      },
      show: true,
    });
  }

  getStage() { return this._stage ?? STAGES.ORBITAL; }

  /**
   * Cesium Ion 3D buildings — visible from TRANSITION downward.
   * Skipped entirely while the user's manual "3D City" button
   * (see `setManualCityBuildings`) is actively overriding visibility,
   * so the two controls never fight each other.
   */
  _syncOsmBuildings(stage) {
    if (!this._osmBuildings) return;
    if (this._manualOverride !== null) return;
    const show = stage >= STAGES.TRANSITION;
    this._osmBuildings.show = show;
  }

  // ─── PART 3: MANUAL "3D CITY" BUTTON ──────────────────────────────────────
  /**
   * Toggle the Cesium Ion OSM 3D Buildings tileset on/off on demand,
   * independent of the automatic zoom-stage reveal above. Fades smoothly,
   * never touches the camera, and never reloads the viewer.
   * Returns false if no 3D buildings tileset is available to toggle
   * (e.g. no VITE_CESIUM_TOKEN was supplied), true otherwise.
   */
  setManualCityBuildings(show) {
    if (!this._osmBuildings) return false;
    this._manualOverride = show;
    this._fadeOsmBuildings(show);
    return true;
  }

  /** Returns true/false if manually overridden, or null if automatic. */
  getManualCityBuildingsState() { return this._manualOverride; }

  /** Smoothly fades the OSM 3D buildings tileset's opacity in or out. */
  _fadeOsmBuildings(show) {
    const tileset = this._osmBuildings;
    if (!tileset) return;
    if (this._buildingFadeRaf) {
      cancelAnimationFrame(this._buildingFadeRaf);
      this._buildingFadeRaf = null;
    }

    // Must stay `show = true` throughout the fade (both directions) so the
    // GPU actually renders the intermediate alpha values; only flip to
    // `show = false` once a fade-out has fully completed.
    tileset.show = true;

    const from = this._buildingFadeAlpha;
    const to   = show ? 1 : 0;
    const t0   = performance.now();
    const dur  = 500;

    const step = () => {
      const p = Math.min((performance.now() - t0) / dur, 1);
      const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p; // ease-in-out
      const alpha = from + (to - from) * eased;
      this._buildingFadeAlpha = alpha;
      this._styleOsmBuildings(tileset, alpha);

      if (p < 1) {
        this._buildingFadeRaf = requestAnimationFrame(step);
      } else {
        this._buildingFadeRaf = null;
        if (!show) tileset.show = false;
      }
    };
    this._buildingFadeRaf = requestAnimationFrame(step);
  }

  // ─── STAGE TRANSITIONS ───────────────────────────────────────────────────
  _onStage(stage, prev, alt) {
    this._stage = stage;
    this._updateHUD(stage);
    this._globeStyle.applyStage(stage, alt);
    this._holoGlobe3D?.setStage(stage);
    this._syncOsmBuildings(stage);
    this._transition.applyStage(stage, alt, this.viewer.imageryLayers);

    // Depth-test against terrain once we're in city range
    if (stage >= STAGES.TRANSITION) {
      this.viewer.scene.globe.depthTestAgainstTerrain = true;
    }

    // ── View-transition overlay ────────────────────────────────────
    // Zooming INTO city (crossing from TRANSITION or higher → CITY/STREET)
    const enteringCity =
      (stage === STAGES.CITY || stage === STAGES.STREET) &&
      (prev === STAGES.TRANSITION || prev === STAGES.REGIONAL || prev === STAGES.ORBITAL || prev === null);
    // Zooming OUT of city (crossing from CITY/STREET → TRANSITION or higher)
    const leavingCity =
      (prev === STAGES.CITY || prev === STAGES.STREET) &&
      (stage === STAGES.TRANSITION || stage === STAGES.REGIONAL || stage === STAGES.ORBITAL);

    if (enteringCity) showViewTransition('SWITCHING TO CITY VIEW');
    if (leavingCity)  showViewTransition('SWITCHING TO WORLD VIEW');

    switch (stage) {
      case STAGES.ORBITAL:
        this._scanline.hide();
        this._grid.hide();
        this._roads.clear();
        this._buildings.clear();
        break;

      case STAGES.REGIONAL:
        this._scanline.setOpacity(0.1);
        this._grid.hide();
        this._roads.clear();
        this._buildings.clear();
        break;

      case STAGES.TRANSITION:
        this._scanline.setOpacity(0.25);
        this._loadCity(alt);
        break;

      case STAGES.CITY:
        this._scanline.setOpacity(0.35);
        this._buildings.setAlpha(this._hasRealBuildings ? 0.45 : 1.0);
        this._roads.setAlpha(1.0);
        this._grid.hide();
        this._loadCity(alt);
        break;

      case STAGES.STREET:
        this._scanline.setOpacity(0.5);
        this._buildings.setAlpha(this._hasRealBuildings ? 0.35 : 1.0);
        this._roads.setAlpha(0.8);
        break;
    }
  }

  _onAltitude(alt) {
    if (this._stage === STAGES.TRANSITION) {
      // 0 at 8000m, 1 at 80000m
      const t = Cesium.Math.clamp((alt - 8_000) / (80_000 - 8_000), 0, 1);
      const bldAlpha = this._hasRealBuildings ? (1 - t) * 0.5 : (1 - t);
      this._buildings.setAlpha(bldAlpha);
      this._roads.setAlpha(1 - t);
      this._grid.setAlpha(Math.max(0, 1 - t * 3));
      this._scanline.setOpacity((1 - t) * 0.4);
      this._transition.updateTransition(alt, this.viewer.imageryLayers);
    }
  }

  // ─── CITY DATA ────────────────────────────────────────────────────────────
  async _loadCity(alt) {
    if (this._loading) return;

    // Get camera center on globe
    const canvas = this.viewer.canvas;
    const ray = this.viewer.camera.getPickRay(
      new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)
    );
    const hit = this.viewer.scene.globe.pick(ray, this.viewer.scene);
    if (!hit) return;

    const carto = Cesium.Cartographic.fromCartesian(hit);
    const lon   = Cesium.Math.toDegrees(carto.longitude);
    const lat   = Cesium.Math.toDegrees(carto.latitude);

    // Don't reload same area
    if (this._loadedCenter) {
      const [ll, llt] = this._loadedCenter;
      if (Math.abs(lon - ll) < 0.015 && Math.abs(lat - llt) < 0.015) return;
    }

    this._loading = true;
    this._loadedCenter = [lon, lat];

    // Show grid placeholder while loading
    const span = alt < 20_000 ? 0.018 : 0.045;
    this._grid.show(lon, lat, span, span / 8);
    this._grid.setAlpha(0.6);

    try {
      const half = span / 2;
      const data = await this._osm.fetchCityData(
        lat - half, lon - half, lat + half, lon + half
      );
      console.log(`[HoloCity] OSM: ${data.roads.length} roads, ${data.buildings.length} buildings`);

      if (data.roads.length > 0) {
        this._roads.render(data.roads);
        this._roads.setAlpha(this._stage === STAGES.CITY ? 1.0 : 0.5);
      }
      if (data.buildings.length > 0 && !this._hasRealBuildings) {
        this._buildings.render(data.buildings);
        this._buildings.setAlpha(this._stage === STAGES.CITY ? 1.0 : 0.4);
      } else if (this._hasRealBuildings) {
        this._buildings.clear();
      }
    } catch (e) {
      console.warn('[HoloCity] OSM load failed:', e.message);
    } finally {
      this._loading = false;
    }
  }

  // ─── TARGET LOCK CLICK ────────────────────────────────────────────────────
  _installClickHandler() {
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    this._clickHandler = handler;

    handler.setInputAction((evt) => {
      const stage = this._stage;
      if (stage !== STAGES.CITY && stage !== STAGES.STREET) return;

      const picked = this.viewer.scene.pick(evt.position);
      if (!picked) return;

      let bldId = null;
      const eid = picked?.id?.id ?? picked?.id ?? '';

      if (String(eid).startsWith('holo-building-')) {
        bldId = String(eid).replace('holo-building-', '');
      } else if (picked instanceof Cesium.Cesium3DTileFeature) {
        bldId = picked.getProperty?.('id') ?? picked.getProperty?.('elementId') ?? 'osm-3d';
      } else {
        return;
      }

      const pos =
        this.viewer.scene.pickPosition(evt.position) ??
        (() => {
          const ray = this.viewer.camera.getPickRay(evt.position);
          return this.viewer.scene.globe.pick(ray, this.viewer.scene);
        })();
      if (!pos) return;

      const carto = Cesium.Cartographic.fromCartesian(pos);
      const lon   = Cesium.Math.toDegrees(carto.longitude);
      const lat   = Cesium.Math.toDegrees(carto.latitude);
      const height = Math.max(carto.height || 0, 25);

      this._targetLock.lock(lon, lat, height, bldId);
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, Math.max(height * 1.2, 350)),
        orientation: { pitch: Cesium.Math.toRadians(-30), heading: 0, roll: 0 },
        duration: 1.2,
      });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  // ─── ALPHA ANIMATION ─────────────────────────────────────────────────────
  _animateLayerAlpha(layer, target, dur = 800) {
    const start = layer.alpha;
    const diff  = target - start;
    const t0    = performance.now();
    const tick  = () => {
      const p = Math.min((performance.now() - t0) / dur, 1);
      layer.alpha = start + diff * (p < 0.5 ? 2*p*p : -1+(4-2*p)*p);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ─── HUD ─────────────────────────────────────────────────────────────────
  _mountHUD() {
    this._hudEl = document.createElement('div');
    this._hudEl.id = 'holo-stage-hud';
    this._hudEl.style.cssText = `
      position:fixed; bottom:72px; right:20px; z-index:200;
      font-family:'Share Tech Mono',monospace; font-size:10px;
      letter-spacing:0.2em; color:rgba(0,212,255,0.65);
      text-transform:uppercase; pointer-events:none; text-align:right; line-height:1.8;
      background:rgba(0,4,12,0.7); border:1px solid rgba(0,212,255,0.18);
      padding:6px 12px; border-radius:3px;
    `;
    document.body.appendChild(this._hudEl);
  }

  _updateHUD(stage) {
    if (!this._hudEl) return;
    const labels = {
      [STAGES.ORBITAL]:    '◉ ORBITAL MODE',
      [STAGES.REGIONAL]:   '◈ REGIONAL INTEL',
      [STAGES.TRANSITION]: '◆ TRANSITION',
      [STAGES.CITY]:       '⌖ CITY MODE · SCROLL TO ZOOM',
      [STAGES.STREET]:     '⊕ STREET LEVEL · CLICK BUILDING',
    };
    this._hudEl.textContent = labels[stage] || '';
  }

  // ─── INTEL CSS ───────────────────────────────────────────────────────────
  _injectCSS() {
    if (document.getElementById('holo-city-css')) return;
    const s = document.createElement('style');
    s.id = 'holo-city-css';
    s.textContent = `
      .rsp-intel-panel{padding:12px;display:flex;flex-direction:column;gap:8px;font-family:'Share Tech Mono',monospace;color:#00e5c8;font-size:11px;}
      .rsp-intel-header{display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(0,220,200,.2);padding-bottom:10px;}
      .rsp-intel-icon{font-size:20px;color:#FF8C00;animation:holo-pulse-icon 1.2s ease-in-out infinite;}
      @keyframes holo-pulse-icon{0%,100%{opacity:1}50%{opacity:.4}}
      .rsp-intel-title{font-size:12px;letter-spacing:.12em;color:#FF8C00;}
      .rsp-intel-coords{font-size:9px;color:rgba(0,220,200,.5);margin-top:2px;}
      .rsp-intel-section{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(0,220,200,.07);padding-bottom:5px;}
      .rsp-intel-label{font-size:9px;letter-spacing:.15em;color:rgba(0,220,200,.4);}
      .rsp-intel-value{font-size:10px;color:#00e5c8;text-transform:uppercase;}
      .rsp-intel-divider{border-top:1px solid rgba(0,220,200,.12);margin:2px 0;}
      .rsp-intel-hint{font-size:9px;color:rgba(0,220,200,.3);margin-top:3px;}
      .rsp-street-loading{display:flex;align-items:center;gap:8px;color:rgba(0,220,200,.45);font-size:9px;padding:10px 0;}
      .rsp-street-spinner{width:12px;height:12px;border:2px solid rgba(0,220,200,.15);border-top-color:#00e5c8;border-radius:50%;animation:holo-spin .8s linear infinite;flex-shrink:0;}
      @keyframes holo-spin{to{transform:rotate(360deg)}}
      .rsp-street-none{color:rgba(255,140,0,.65);font-size:9px;padding:6px 0;}
      .rsp-street-img-wrap{position:relative;border:1px solid rgba(0,220,200,.25);overflow:hidden;border-radius:2px;}
      .rsp-street-img{width:100%;display:block;opacity:0;transition:opacity .5s;filter:hue-rotate(180deg) saturate(.55) brightness(.9);}
      .rsp-street-img.loaded{opacity:1;}
      .rsp-street-scan{position:absolute;top:-4px;left:0;right:0;height:4px;background:linear-gradient(transparent,rgba(0,220,200,.5),transparent);animation:holo-scan 2s linear infinite;}
      @keyframes holo-scan{0%{top:-4px}100%{top:100%}}
      .rsp-street-meta{display:flex;justify-content:space-between;padding:4px 6px;background:rgba(0,16,10,.85);font-size:8px;color:rgba(0,220,200,.5);}
      .rsp-street-open{color:#00e5c8;text-decoration:none;}
      .rsp-street-open-btn{display:inline-block;margin-top:6px;padding:5px 10px;border:1px solid rgba(0,220,200,.3);color:#00e5c8;text-decoration:none;font-size:9px;letter-spacing:.12em;transition:background .2s;}
      .rsp-street-open-btn:hover{background:rgba(0,220,200,.08);}
      .rsp-intel-close{margin-top:6px;background:transparent;border:1px solid rgba(255,140,0,.35);color:#FF8C00;font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.12em;padding:5px;cursor:pointer;width:100%;transition:background .2s;}
      .rsp-intel-close:hover{background:rgba(255,140,0,.08);}
    `;
    document.head.appendChild(s);
  }

  destroy() {
    this._zoom?.stop();
    if (this._buildingFadeRaf) cancelAnimationFrame(this._buildingFadeRaf);
    this._clickHandler?.destroy();
    this._grid?.hide();
    this._roads?.clear();
    this._buildings?.clear();
    this._targetLock?.clear();
    this._scanline?.destroy();
    this._hudEl?.remove();
  }
}
