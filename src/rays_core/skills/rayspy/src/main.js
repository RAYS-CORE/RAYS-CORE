import * as Cesium from 'cesium';
import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { mountLoadingScreen } from './LoadingScreen.js';
import { HoloGlobe3D } from './HoloGlobe3D.js';
import { HoloCity } from './HoloCity.js';
import { STAGES } from './core/ZoomController.js';

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

let sceneComponents = null;

// Pre-warm the 3D application in the background while the signature loading sequence plays
const startPromise = application.start()
  .then((components) => {
    sceneComponents = components;
    return components;
  })
  .catch((error) => {
    console.error("RAYSpy initialization failed:", error);
    const loaderStatus = document.querySelector('#loading-screen .loader-status');
    if (loaderStatus) {
      loaderStatus.textContent = `Error: ${describeError(error)}`;
      loaderStatus.style.color = '#ff4444';
    }
    throw error;
  });

// Mount the signature RAYSpy holographic loading screen
mountLoadingScreen(startPromise).then(() => {
  const loader = document.querySelector('#loading-screen');
  if (loader && !loader.classList.contains('hidden')) {
    loader.classList.add('hidden');
  }

  if (sceneComponents?.scene?.viewer) {
    initEnhancedFeatures(sceneComponents.scene.viewer, sceneComponents);
  }
});

/**
 * Attaches Swamantak's 3D holographic globe, city shaders, and tactical dive telemetry
 * into the main active Cesium viewer.
 */
function initEnhancedFeatures(viewer, components) {
  let holoGlobe3D = null;
  let holoCity = null;

  try {
    holoGlobe3D = new HoloGlobe3D(viewer);
    holoGlobe3D.mount();
  } catch (err) {
    console.warn('[RAYSpy] HoloGlobe3D mount failed:', err);
  }

  try {
    holoCity = new HoloCity(viewer, {
      holoGlobe3D,
      osmBuildings: components.scene.tileset,
    });
    holoCity.init();
  } catch (err) {
    console.warn('[RAYSpy] HoloCity init failed:', err);
  }

  // Double-stage tactical dive and street-level reverse geocoding on empty globe click
  try {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement) => {
      // If HoloCity is at city/street level, let HoloCity handle building picks
      if (holoCity && typeof holoCity.getStage === 'function' && holoCity.getStage() >= STAGES.CITY) {
        return;
      }

      const cartesian = viewer.scene.pickPosition(movement.position);
      if (!Cesium.defined(cartesian)) return;

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lon = Cesium.Math.toDegrees(carto.longitude);
      const lat = Cesium.Math.toDegrees(carto.latitude);

      // Pulse highlight if a 3D feature is clicked
      const picked = viewer.scene.pick(movement.position);
      let pulseListener = null;
      let currentFeature = null;
      const stopPulse = () => {
        if (pulseListener) { pulseListener(); pulseListener = null; }
        if (currentFeature) {
          try { currentFeature.color = Cesium.Color.WHITE; } catch (_) {}
          currentFeature = null;
        }
      };

      if (picked && picked.getProperty) {
        currentFeature = picked;
        const t0 = performance.now();
        pulseListener = viewer.scene.postRender.addEventListener(() => {
          if (!currentFeature) return;
          const k = 0.5 + 0.5 * Math.sin(((performance.now() - t0) / 1000) * 3.2);
          try {
            currentFeature.color = new Cesium.Color(0.13 + 0.7 * k, 0.83, 0.93, 0.55 + 0.35 * k);
          } catch (_) {}
        });
      }

      // Tactical Dive HUD
      let hudEl = document.getElementById('rsp-dive-hud');
      if (!hudEl) {
        hudEl = document.createElement('div');
        hudEl.id = 'rsp-dive-hud';
        hudEl.style.cssText = `
          position:fixed; top:16px; left:50%; transform:translateX(-50%);
          min-width:260px; padding:10px 14px; pointer-events:none; z-index:200;
          background:rgba(0,8,20,0.85); border:1px solid #22d3ee88;
          box-shadow:0 0 20px #22d3ee44,inset 0 0 12px #22d3ee22;
          color:#22d3ee; font-family:'JetBrains Mono',monospace;
          font-size:10px; letter-spacing:.12em; display:none;
        `;
        hudEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span id="rsp-dive-stage" style="text-shadow:0 0 6px #22d3ee">◉ ENGAGING</span>
            <span id="rsp-dive-tiles" style="opacity:.75">TILES: STREAMING</span>
          </div>
          <div style="height:4px;background:#22d3ee22;border:1px solid #22d3ee55;overflow:hidden">
            <div id="rsp-dive-bar" style="height:100%;width:8%;background:linear-gradient(90deg,#22d3ee,#67e8f9,#fff);box-shadow:0 0 10px #22d3ee;transition:width 250ms ease-out"></div>
          </div>
        `;
        document.body.appendChild(hudEl);
      }

      const stageEl = hudEl.querySelector('#rsp-dive-stage');
      const barEl   = hudEl.querySelector('#rsp-dive-bar');
      const setHud = (stage, pct) => {
        if (stageEl) stageEl.textContent = '◉ ' + stage;
        if (barEl)   barEl.style.width = pct + '%';
      };

      hudEl.style.display = 'block';
      setHud('DESCENDING · 3 KM', 15);

      // Street level indicator
      let labelEl = document.getElementById('rsp-street-label');
      if (!labelEl) {
        labelEl = document.createElement('div');
        labelEl.id = 'rsp-street-label';
        labelEl.style.cssText = `
          position:fixed; left:24px; bottom:72px; pointer-events:none; z-index:200;
          color:#e0f7ff; font-family:'JetBrains Mono',monospace;
          text-shadow:0 0 8px #22d3eeaa,0 0 2px #000;
          opacity:0; transform:translateY(8px);
          transition:opacity 700ms ease-out,transform 700ms ease-out;
        `;
        document.body.appendChild(labelEl);
      }
      labelEl.style.opacity = '0';
      labelEl.style.transform = 'translateY(8px)';
      labelEl.innerHTML = '';

      // Reverse geocode via Nominatim proxy
      const geoPromise = fetch(`/geocode/reverse?lat=${lat}&lon=${lon}&format=json`)
        .then(r => r.json())
        .then(data => {
          const a = data.address || {};
          const street = a.road || a.pedestrian || a.footway || data.display_name?.split(',')[0] || 'Unknown Target Sector';
          const district = a.neighbourhood || a.suburb || a.city_district || a.town || a.city || a.county || '';
          return { street, district };
        })
        .catch(() => null);

      // Fly to intermediate approach altitude (3 km)
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat - 0.01, 3000),
        orientation: {
          heading: 0.0,
          pitch: Cesium.Math.toRadians(-55),
          roll: 0.0,
        },
        duration: 2.2,
        complete: async () => {
          setHud('TACTICAL TARGET ACQUISITION · 450 M', 60);

          // Fly to street level (450 m)
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lon, lat - 0.0035, 450),
            orientation: {
              heading: Cesium.Math.toRadians(20),
              pitch: Cesium.Math.toRadians(-20),
              roll: 0.0,
            },
            duration: 2.2,
            complete: async () => {
              setHud('ARRIVED', 100);
              const loc = await geoPromise;
              if (loc && labelEl) {
                labelEl.innerHTML = `
                  <div style="font-size:10px;letter-spacing:.25em;color:#22d3ee;margin-bottom:4px">▸ STREET-LEVEL UPLINK</div>
                  <div style="font-size:20px;font-weight:600;line-height:1.1">${loc.street}</div>
                  ${loc.district ? `<div style="font-size:11px;letter-spacing:.18em;opacity:.85;margin-top:2px">${loc.district.toUpperCase()}</div>` : ''}
                `;
                requestAnimationFrame(() => setTimeout(() => {
                  labelEl.style.opacity = '1';
                  labelEl.style.transform = 'translateY(0)';
                }, 60));
              }
              setTimeout(() => { if (hudEl) hudEl.style.display = 'none'; }, 600);
              setTimeout(() => stopPulse(), 2000);
            },
          });
        },
      });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Double-click returns to orbital perspective
    handler.setInputAction(() => {
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
  } catch (err) {
    console.warn('[RAYSpy] Dive handler registration error:', err);
  }

  window.__rayspy = {
    viewer,
    Cesium,
    holoGlobe3D,
    holoCity,
    application,
    components,
  };
}

export { application };
