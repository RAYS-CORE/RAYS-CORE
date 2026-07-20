import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './worldview.css';
import { mountWorldviewUI } from './worldview/ui.js';
import { mountBootSequence } from './BootSequence.js';
import { SatelliteLayer } from './layers/satellites.js';
import { FlightLayer } from './layers/flights.js';
import { EarthquakeLayer } from './layers/earthquakes.js';
import { CctvLayer } from './layers/cctv.js';
import { HoloCity } from './HoloCity.js';
import { HoloGlobe3D } from './HoloGlobe3D.js';
import { STAGES } from './core/ZoomController.js';

async function init() {
  const accessToken = import.meta.env.VITE_CESIUM_TOKEN;
  if (accessToken) Cesium.Ion.defaultAccessToken = accessToken;

  const viewer = new Cesium.Viewer('cesiumContainer', {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    scene3DOnly: true,
    shouldAnimate: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
  });

  viewer.useBrowserRecommendedResolution = false;
  viewer.resolutionScale = 0.85;
  viewer.scene.postProcessStages.fxaa.enabled = false;
  viewer._cesiumWidget._creditContainer.style.display = 'none';

  viewer.imageryLayers.removeAll();
  let imageryCredit = 'Satellite + map';
  let demLoaded = false;

  // ── Auto-load Cesium Ion terrain + 3D OSM buildings (no token prompt) ──
  let osmBuildings = null;
  if (accessToken) {
    try {
      viewer.terrainProvider = await Cesium.createWorldTerrainAsync({
        requestWaterMask: true,
        requestVertexNormals: true,
      });
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.globe.terrainExaggeration = 1.0;
      demLoaded = true;
      imageryCredit = 'Cesium Ion terrain + aerial';
    } catch (e) {
      console.warn('[RAYSpy] World terrain failed, using ellipsoid:', e.message);
    }
  }

  try {
    if (accessToken) {
      // ── PART 1: real satellite Earth via Cesium World Imagery ──
      // Base layer: full-resolution photographic satellite/aerial imagery
      // (forests, oceans, rivers, mountains, deserts, farmland, coastlines,
      // islands, snow, cities — everything Cesium World Imagery provides),
      // drawn fully opaque so the globe reads like Google Earth.
      const aerialLayer = viewer.imageryLayers.addImageryProvider(
        await Cesium.createWorldImageryAsync({
          style: Cesium.IonWorldImageryStyle.AERIAL,
        })
      );
      aerialLayer.alpha = 1.0;

      imageryCredit = 'Cesium World Imagery (satellite) + Reference Overlays';
    } else {
      // Fallback (no Cesium Ion token): Esri World Imagery satellite base
      const aerialLayer = viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maximumLevel: 19,
        })
      );
      aerialLayer.alpha = 1.0;
      imageryCredit = 'Esri satellite imagery + Reference Overlays';
    }

    // ── PART 2: Transparent Reference Overlays (Borders, Place Names, and Roads) ──
    // Added on top of the base satellite layer to show road maps and labels
    // with transparent backgrounds so they do not cover or wash out the Earth.
    const boundariesLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        maximumLevel: 19,
      })
    );
    boundariesLayer.alpha = 0.65; // Clear labels and borders

    const transportationLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        maximumLevel: 19,
      })
    );
    transportationLayer.alpha = 0.45; // Subtle but readable road lines
  } catch (e) {
    console.error('Imagery setup failed:', e);
  }

  // ── Cesium Ion 3D OSM buildings (real city geometry, like demo HTML) ──
  if (accessToken) {
    try {
      osmBuildings = await Cesium.createOsmBuildingsAsync();
      viewer.scene.primitives.add(osmBuildings);
      osmBuildings.show = false; // HoloCity reveals at TRANSITION stage
      console.log('[RAYSpy] Cesium OSM 3D buildings loaded');
    } catch (e) {
      console.warn('[RAYSpy] OSM 3D buildings failed:', e.message);
    }
  }

  // ── Holographic orbital globe overlay ──
  const holoGlobe3D = new HoloGlobe3D(viewer);

  // ── Holographic globe styling ──────────────────────────────────────
  const globe = viewer.scene.globe;
  globe.enableLighting = false;
  globe.depthTestAgainstTerrain = false;
  globe.showWaterEffect = false; // kill the animated sun-glare sheen over ocean; keeps real water-mask terrain shading

  // --- Holographic backdrop (keep space black, hide celestial bodies) ---
  viewer.scene.backgroundColor = Cesium.Color.BLACK;
  viewer.scene.skyBox.show = false;
  viewer.scene.sun.show = false;
  viewer.scene.moon.show = false;
  viewer.scene.skyAtmosphere.show = true;

  // --- Subtle cyan atmosphere tint (does NOT recolor the ground) ---
  const atmo = viewer.scene.skyAtmosphere;
  atmo.hueShift = -0.8;        // push atmosphere toward cyan
  atmo.saturationShift = 0.1;
  atmo.brightnessShift = -0.1;

  // Ground atmosphere — leave the Earth's real colors intact
  globe.showGroundAtmosphere = true;
  globe.atmosphereHueShift = 0;
  globe.atmosphereSaturationShift = 0;
  globe.atmosphereBrightnessShift = 0;

  // ── PART 1 (cont.): keep the satellite imagery vivid at every zoom ──
  // Cesium's ground-atmosphere haze and scene fog both scale up with
  // camera distance, which is what makes the globe look pale/white the
  // further out you zoom (it's a distance-based haze layer sitting on
  // TOP of the imagery, not the imagery itself). Dial both down so the
  // photographic Earth stays visible from orbital range too, while still
  // keeping a thin, realistic atmospheric edge at the limb.
  globe.atmosphereLightIntensity = 3.0;      // default 10.0 — less washout
  globe.lightingFadeOutDistance = 1.0e7;
  globe.lightingFadeInDistance  = 1.0e7;

  viewer.scene.fog.enabled = true;
  viewer.scene.fog.density = 0.00004;        // default 0.0002 — thinner haze
  viewer.scene.fog.minimumBrightness = 0.03;

  // --- DO NOT hue-shift imagery layers. Just a tiny contrast bump. ---
  for (let i = 0; i < viewer.imageryLayers.length; i++) {
    const layer = viewer.imageryLayers.get(i);
    layer.hue = 0;
    layer.saturation = 1.0;
    layer.brightness = 1.0;
    layer.contrast = 1.05;
    layer.gamma = 1.0;
  }

  const controller = viewer.scene.screenSpaceCameraController;
  controller.enableTranslate = true;
  controller.enableLook = true;
  controller.enableRotate = true;
  controller.enableTilt = true;
  controller.enableZoom = true;
  controller.inertiaZoom = 0.2;
  controller.inertiaSpin = 0.9;
  // Street-level zoom allowed
  controller.minimumZoomDistance = 5.0;
  controller.maximumZoomDistance = 50_000_000.0;

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(-97.74, 30.27, 2_500_000),
    orientation: {
      pitch: Cesium.Math.toRadians(-40),
      heading: 0,
      roll: 0,
    },
  });

  const satelliteLayer = new SatelliteLayer(viewer);
  const liveFlights = new FlightLayer(viewer, { military: false });
  const militaryFlights = new FlightLayer(viewer, { military: true });
  const earthquakeLayer = new EarthquakeLayer(viewer);
  const cctvLayer = new CctvLayer(viewer);

  // ── HoloCity: progressive zoom intelligence system ──
  // Runs alongside all existing layers — no conflicts.
  const holoCity = new HoloCity(viewer, { osmBuildings, holoGlobe3D });
  holoCity.init();
  if (osmBuildings) holoCity.setOsmBuildings(osmBuildings);

  let cctvLoaded = false;
  let panopticOn = true;
  satelliteLayer.setPanoptic(panopticOn);

  const ui = mountWorldviewUI(viewer, {
    onToggleDem: async (on) => {
      if (on) {
        if (demLoaded) return;
        ui.setSummary('Loading terrain…');
        try {
          if (!accessToken) throw new Error('Add VITE_CESIUM_TOKEN to .env');
          viewer.terrainProvider = await Cesium.createWorldTerrainAsync({
            requestWaterMask: true,
            requestVertexNormals: true,
          });
          globe.depthTestAgainstTerrain = true;
          globe.terrainExaggeration = 2.0;
          globe.maximumScreenSpaceError = 4.0;
          demLoaded = true;
          ui.setDemOn(true);
          ui.setSummary(`DEM on · ${imageryCredit}`);
          if (cctvLayer.visible) {
            await cctvLayer.reclampToTerrain();
          }
        } catch (e) {
          ui.setDemOn(false);
          ui.setSummary(`DEM failed: ${e.message}`);
        }
      } else {
        if (!demLoaded) return;
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        globe.depthTestAgainstTerrain = false;
        globe.terrainExaggeration = 1.0;
        demLoaded = false;
        ui.setDemOn(false);
        ui.setSummary(`No DEM · ${imageryCredit}`);
        if (cctvLayer.visible) {
          await cctvLayer.reclampToTerrain();
        }
      }
    },
    onPanoptic: (on) => {
      panopticOn = on;
      satelliteLayer.setPanoptic(on);
    },
    onSearch: async (query) => {
      if (!query?.trim()) return;
      try {
        const res = await fetch(
          `/geocode/search?q=${encodeURIComponent(query)}&format=json&limit=1`
        );
        const data = await res.json();
        if (data?.[0]) {
          const lon = parseFloat(data[0].lon);
          const lat = parseFloat(data[0].lat);
          ui.setLocation(data[0].display_name?.split(',')[0] || query, query);
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lon, lat, 120000),
            orientation: {
              pitch: Cesium.Math.toRadians(-35),
              heading: 0,
              roll: 0,
            },
          });
        }
      } catch (e) {
        console.error('Search failed:', e);
      }
    },
    onLayerToggle: async (layerId) => {
      const toggle = ui.overlay.querySelector(`[data-toggle="${layerId}"]`);
      const isOn = !toggle?.classList.contains('on');

      try {
        if (layerId === 'orbital') {
          if (isOn) {
            holoGlobe3D.mount();
          } else {
            holoGlobe3D.destroy();
          }
          ui.setLayerOn('orbital', isOn);
        }

        if (layerId === 'satellites') {
          if (isOn) {
            ui.setSummary('Loading TLE catalogs…');
            if (!satelliteLayer.loaded) {
              await satelliteLayer.load();
            }
            satelliteLayer.setVisible(true);
            satelliteLayer.setPanoptic(panopticOn);
            ui.setLayerCount('satellites', satelliteLayer.count);
          } else {
            satelliteLayer.setVisible(false);
          }
          ui.setLayerOn('satellites', isOn);
        }

        if (layerId === 'flights') {
          if (isOn) {
            await liveFlights.enable();
            ui.setLayerOn('flights', true);
          } else {
            liveFlights.disable();
            ui.setLayerOn('flights', false);
          }
          ui.setLayerCount('flights', liveFlights.count);
        }

        if (layerId === 'military') {
          if (isOn) {
            try {
              await militaryFlights.enable();
              ui.setLayerOn('military', true);
              const n = militaryFlights.count;
              ui.setLayerCount('military', n);
              ui.setSummary(
                n > 0
                  ? `Military · ${n} aircraft · ${militaryFlights._milFeedLabel}`
                  : 'Military layer on · no aircraft in feed right now'
              );
            } catch (e) {
              console.error('Military layer:', e);
              militaryFlights.disable();
              ui.setLayerOn('military', false);
              ui.setLayerCount('military', 0);
              ui.setSummary(
                `Military feed failed (adsb.lol / adsb.fi). Check network or retry. ${e.message}`
              );
            }
          } else {
            militaryFlights.disable();
            ui.setLayerOn('military', false);
          }
        }

        if (layerId === 'earthquakes') {
          if (isOn) {
            await earthquakeLayer.enable();
            ui.setLayerOn('earthquakes', true);
            ui.setLayerCount('earthquakes', earthquakeLayer.count);
          } else {
            earthquakeLayer.disable();
            ui.setLayerOn('earthquakes', false);
          }
        }

        if (layerId === 'cctv') {
          if (isOn) {
            ui.setSummary('Loading CCTV mesh…');
            if (!cctvLoaded) {
              const n = await cctvLayer.load((msg) => ui.setSummary(msg));
              cctvLoaded = true;
              ui.populateCctvSelect(cctvLayer.cameras, null);
              ui.setLayerCount('cctv', n);
            }
            cctvLayer.setVisible(true);
            ui.setLayerOn('cctv', true);
            const cc = cctvLayer.countryCount ?? '—';
            ui.setSummary(
              `CCTV mesh · ${cctvLayer.count} nodes · ${cc} countries`
            );
          } else {
            cctvLayer.setVisible(false);
            ui.setLayerOn('cctv', false);
            ui.setDetail(null);
            ui.stopCctvFeeds();
          }
        }
      } catch (e) {
        console.error(`Layer ${layerId}:`, e);
        ui.setSummary(`${layerId} failed: ${e.message}`);
        ui.setLayerOn(layerId, false);
      }
    },
    onCctvAction: (action) => {
      if (!cctvLayer.visible) return;
      let detail = null;
      if (action === 'nearest') detail = cctvLayer.selectNearest(viewer);
      if (action === 'prev') detail = cctvLayer.selectPrev();
      if (action === 'next') detail = cctvLayer.selectNext();
      if (detail) showCctvSelection(detail);
    },
    onCctvSelect: (id) => {
      const detail = cctvLayer.select(id);
      if (detail) showCctvSelection(detail);
    },
    onCctvCoverage: (on) => cctvLayer.setShowCoverage(on),
    onCctvFovWedges: (on) => cctvLayer.setShowFovWedges(on),
    onCctvProjection: (on) => cctvLayer.setShowProjection(on),
    onCctvCalibration: (patch) => {
      if (!cctvLayer.selectedId) return;
      cctvLayer.setCalibration(cctvLayer.selectedId, patch);
      const detail = cctvLayer.getDetails(cctvLayer.selectedId);
      if (detail) ui.setDetail(detail);
    },
    // ── PART 3: manual "3D City" button ─────────────────────────────
    // Toggles the Cesium Ion OSM 3D Buildings tileset on/off on demand,
    // independent of the automatic zoom-stage reveal in HoloCity. Never
    // touches the camera (position/zoom/orientation are left exactly as
    // they are) and never reloads the viewer — just a smooth show/hide.
    onToggle3DCity: (on) => {
      const ok = holoCity.setManualCityBuildings(on);
      if (!ok) {
        ui.setCity3DOn(false);
        ui.setSummary('3D City unavailable — add VITE_CESIUM_TOKEN to enable OSM 3D buildings');
      }
    },
  });

  function showCctvSelection(detail) {
    satelliteLayer.clearSelection();
    liveFlights.clearSelection();
    militaryFlights.clearSelection();
    ui.populateCctvSelect(cctvLayer.cameras, detail.camera.id);
    ui.syncCctvSliders(detail.calibration);
    ui.updateCctvPreview(detail);
    ui.setDetail(detail);
    ui.setSpyTrack(detail);
    ui.setLandmark(detail.camera.city, detail.title);
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        detail.camera.lon,
        detail.camera.lat,
        2500
      ),
      orientation: {
        pitch: Cesium.Math.toRadians(-35),
        heading: Cesium.Math.toRadians(detail.calibration.heading),
        roll: 0,
      },
      duration: 1.2,
    });
  }

  ui.setSummary(
    demLoaded
      ? `Terrain + 3D cities · ${imageryCredit} · scroll to zoom into city`
      : `No DEM · ${imageryCredit} · click object for intel panel`
  );
  ui.setDemOn(demLoaded);

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.position);
    const entity = picked?.id;
    const eid = entity?.id ?? '';

    if (String(eid).startsWith('cctv-') && !String(eid).includes('cov')) {
      const camId = cctvLayer.resolveCamIdFromEntityId(eid);
      if (!camId) return;
      const detail = cctvLayer.select(camId);
      if (detail) showCctvSelection(detail);
      return;
    }

    if (String(eid).startsWith('sat-') && !String(eid).includes('path')) {
      const norad = eid.replace('sat-', '');
      liveFlights.clearSelection();
      militaryFlights.clearSelection();
      cctvLayer.clearSelection();
      ui.stopCctvFeeds();
      satelliteLayer.select(norad);
      const detail = satelliteLayer.getDetails(norad);
      if (detail) {
        ui.setDetail(detail);
        ui.setSpyTrack(detail);
        ui.setLandmark(detail.title, `NORAD ${detail.noradId}`);
        viewer.flyTo(entity, {
          duration: 1.2,
          offset: new Cesium.HeadingPitchRange(0, -0.4, 800000),
        });
      }
      return;
    }

    if (String(eid).startsWith('flight-') && !String(eid).includes('path')) {
      const icao = eid.replace('flight-', '');
      satelliteLayer.clearSelection();
      cctvLayer.clearSelection();
      ui.stopCctvFeeds();
      const layer = militaryFlights.byIcao.has(icao) ? militaryFlights : liveFlights;
      if (layer === liveFlights) militaryFlights.clearSelection();
      else liveFlights.clearSelection();

      layer.select(icao).then((detailFromSelect) => {
        const detail = detailFromSelect || layer.getDetails(icao);
        if (detail) {
          ui.setDetail(detail);
          ui.setSpyTrack(detail);
          ui.setLandmark(detail.title, detail.icao.toUpperCase());
          viewer.flyTo(entity, {
            duration: 1,
            offset: new Cesium.HeadingPitchRange(0, -0.3, 400000),
          });
        }
      });
      return;
    }

    satelliteLayer.clearSelection();
    liveFlights.clearSelection();
    militaryFlights.clearSelection();
    cctvLayer.clearSelection();
    ui.clearSpyTrack();
    ui.setDetail(null);
    ui.stopCctvFeeds();

    // In city/street zoom stages, HoloCity handles building picks — no dive animation
    if (holoCity.getStage() >= STAGES.CITY) return;

    // Empty globe click → 2-stage animated dive with HUD + street label
    const cartesian = viewer.scene.pickPosition(movement.position);
    if (!Cesium.defined(cartesian)) return;

    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    const lon = Cesium.Math.toDegrees(carto.longitude);
    const lat = Cesium.Math.toDegrees(carto.latitude);

    // ── Building highlight pulse ──────────────────────────────────
    const divePickedFeature = viewer.scene.pick(movement.position);
    let pulseListener = null;
    let currentFeature = null;
    const stopPulse = () => {
      if (pulseListener) { pulseListener(); pulseListener = null; }
      if (currentFeature) {
        try { currentFeature.color = Cesium.Color.WHITE; } catch (_) {}
        currentFeature = null;
      }
    };
    if (divePickedFeature && divePickedFeature.getProperty) {
      currentFeature = divePickedFeature;
      const t0 = performance.now();
      pulseListener = viewer.scene.postRender.addEventListener(() => {
        if (!currentFeature) return;
        const k = 0.5 + 0.5 * Math.sin((performance.now() - t0) / 1000 * 3.2);
        try {
          currentFeature.color = new Cesium.Color(0.13 + 0.7*k, 0.83, 0.93, 0.55 + 0.35*k);
        } catch (_) {}
      });
    }

    // ── HUD (tile progress + stage label) ────────────────────────
    let hudEl = document.getElementById('rsp-dive-hud');
    if (!hudEl) {
      hudEl = document.createElement('div');
      hudEl.id = 'rsp-dive-hud';
      hudEl.style.cssText = `
        position:fixed; top:16px; left:50%; transform:translateX(-50%);
        min-width:260px; padding:10px 14px; pointer-events:none; z-index:200;
        background:rgba(0,8,20,0.82); border:1px solid #22d3ee88;
        box-shadow:0 0 20px #22d3ee44,inset 0 0 12px #22d3ee22;
        color:#22d3ee; font-family:'Share Tech Mono',monospace;
        font-size:10px; letter-spacing:.12em; display:none;
      `;
      hudEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span id="rsp-dive-stage" style="text-shadow:0 0 6px #22d3ee">◉ ENGAGING</span>
          <span id="rsp-dive-tiles" style="opacity:.75">TILES: 000</span>
        </div>
        <div style="height:4px;background:#22d3ee22;border:1px solid #22d3ee55;overflow:hidden">
          <div id="rsp-dive-bar" style="height:100%;width:8%;background:linear-gradient(90deg,#22d3ee,#67e8f9,#fff);box-shadow:0 0 10px #22d3ee;transition:width 250ms ease-out"></div>
        </div>
      `;
      document.body.appendChild(hudEl);
    }
    const stageEl = hudEl.querySelector('#rsp-dive-stage');
    const tilesEl = hudEl.querySelector('#rsp-dive-tiles');
    const barEl   = hudEl.querySelector('#rsp-dive-bar');
    const setHud = (stage, pct) => {
      if (stageEl) stageEl.textContent = '◉ ' + stage;
      if (barEl)   barEl.style.width = pct + '%';
    };
    hudEl.style.display = 'block';
    setHud('DESCENDING · 3 KM', 8);

    // ── Street label ──────────────────────────────────────────────
    let labelEl = document.getElementById('rsp-street-label');
    if (!labelEl) {
      labelEl = document.createElement('div');
      labelEl.id = 'rsp-street-label';
      labelEl.style.cssText = `
        position:fixed; left:24px; bottom:72px; pointer-events:none; z-index:200;
        color:#e0f7ff; font-family:'Share Tech Mono',monospace;
        text-shadow:0 0 8px #22d3eeaa,0 0 2px #000;
        opacity:0; transform:translateY(8px);
        transition:opacity 700ms ease-out,transform 700ms ease-out;
      `;
      document.body.appendChild(labelEl);
    }
    labelEl.style.opacity = '0';
    labelEl.style.transform = 'translateY(8px)';
    labelEl.innerHTML = '';

    // Kick off reverse geocode in parallel (Nominatim, no key needed)
    const geoPromise = fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
    ).then(r => r.json()).then(data => {
      const a = data.address || {};
      const street = a.road || a.pedestrian || a.footway || data.display_name?.split(',')[0] || 'Unknown Street';
      const district = a.neighbourhood || a.suburb || a.city_district || a.town || a.city || a.county || '';
      return { street, district };
    }).catch(() => null);

    // ── Stage 1: 3 km intermediate stop ──────────────────────────
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat - 0.01, 3000),
      orientation: {
        heading: 0.0,
        pitch: Cesium.Math.toRadians(-55),
        roll: 0.0,
      },
      duration: 2.5,
      complete: async () => {
        setHud('STREAMING TILES · CITY VIEW', 55);
        // ── Stage 2: street-level arrival ────────────────────────
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat - 0.0035, 450),
          orientation: {
            heading: Cesium.Math.toRadians(20),
            pitch: Cesium.Math.toRadians(-20),
            roll: 0.0,
          },
          duration: 2.5,
          complete: async () => {
            setHud('ARRIVED', 100);
            // Show street label
            const loc = await geoPromise;
            if (loc && labelEl) {
              labelEl.innerHTML = `
                <div style="font-size:10px;letter-spacing:.25em;color:#22d3ee;margin-bottom:4px">▸ STREET-LEVEL UPLINK</div>
                <div style="font-size:22px;font-weight:600;line-height:1.1">${loc.street}</div>
                ${loc.district ? `<div style="font-size:12px;letter-spacing:.18em;opacity:.85;margin-top:2px">${loc.district.toUpperCase()}</div>` : ''}
              `;
              requestAnimationFrame(() => setTimeout(() => {
                labelEl.style.opacity = '1';
                labelEl.style.transform = 'translateY(0)';
              }, 60));
            }
            setTimeout(() => { if (hudEl) hudEl.style.display = 'none'; }, 600);
            setTimeout(() => stopPulse(), 1800);
          },
        });
      },
    });
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction(() => {
    satelliteLayer.clearSelection();
    liveFlights.clearSelection();
    militaryFlights.clearSelection();
    cctvLayer.clearSelection();
    ui.clearSpyTrack();
    ui.setDetail(null);
    ui.stopCctvFeeds();

    // Double-click → ease back out to orbit
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(0, 20, 18_000_000),
      orientation: {
        heading: 0.0,
        pitch: -Cesium.Math.PI_OVER_TWO,
        roll: 0.0,
      },
      duration: 2.5,
    });
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  setInterval(() => {
    if (liveFlights.visible) ui.setLayerCount('flights', liveFlights.count);
    if (militaryFlights.visible) ui.setLayerCount('military', militaryFlights.count);
  }, 15000);

  // Exposed for demo capture / debugging (flyTo, stage inspection)
  window.__rayspy = { viewer, Cesium, holoCity };
}

// Run the boot sequence (scan → init → sync → loading → reveal), then
// start the real dashboard once it completes.
mountBootSequence(() => {
  init();
});
