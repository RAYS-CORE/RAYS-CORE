import * as Cesium from 'cesium';

/**
 * Watches camera altitude and emits stage changes.
 * Stage 1 (ORBITAL)  : > 500 000 m
 * Stage 2 (REGIONAL) : 50 000 – 500 000 m
 * Stage 3 (TRANSITION): 5 000 – 50 000 m
 * Stage 4 (CITY)     : 500 – 5 000 m
 * Stage 5 (STREET)   : < 500 m
 */
export const STAGES = {
  ORBITAL:    1,
  REGIONAL:   2,
  TRANSITION: 3,
  CITY:       4,
  STREET:     5,
};

export const STAGE_THRESHOLDS = [
  { stage: STAGES.ORBITAL,    min: 500_000,  max: Infinity },
  { stage: STAGES.REGIONAL,   min: 80_000,   max: 500_000 },
  { stage: STAGES.TRANSITION, min: 8_000,    max: 80_000  },
  { stage: STAGES.CITY,       min: 600,      max: 8_000   },
  { stage: STAGES.STREET,     min: 0,        max: 600     },
];

export class ZoomController {
  constructor(viewer, callbacks = {}) {
    this.viewer    = viewer;
    this.callbacks = callbacks; // { onStage, onAltitude }
    this._stage    = null;
    this._raf      = null;
    this._running  = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    const tick = () => {
      if (!this._running) return;
      this._checkAltitude();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  getAltitude() {
    const scene = this.viewer.scene;
    const cam = scene.camera;

    // True "zoom level" is the distance from the camera to whatever point
    // on the globe is at the center of the screen — NOT the camera's own
    // height above the ellipsoid at its own lat/lon. The latter stays huge
    // even when the camera is pitched down close to a city, which is why
    // CITY/STREET stages never triggered before.
    const canvas = scene.canvas;
    const center = new Cesium.Cartesian2(
      canvas.clientWidth / 2,
      canvas.clientHeight / 2
    );

    let target = null;
    try {
      // pickEllipsoid is cheap and reliable with EllipsoidTerrainProvider
      target = cam.pickEllipsoid(center, scene.globe.ellipsoid);
    } catch (_) { /* ignore */ }

    if (target) {
      return Cesium.Cartesian3.distance(cam.positionWC, target);
    }

    // Camera is pointed at the sky / off the limb of the globe (common at
    // very high altitude or steep angles) — fall back to straight height
    // above the ellipsoid at the camera's own position.
    const carto = Cesium.Cartographic.fromCartesian(cam.positionWC);
    return carto ? carto.height : Infinity;
  }

  getStage() { return this._stage; }

  _checkAltitude() {
    const alt = this.getAltitude();
    if (this.callbacks.onAltitude) this.callbacks.onAltitude(alt);

    let newStage = STAGES.ORBITAL;
    for (const t of STAGE_THRESHOLDS) {
      if (alt <= t.max && alt > t.min) { newStage = t.stage; break; }
      if (alt <= t.min && t === STAGE_THRESHOLDS[STAGE_THRESHOLDS.length - 1]) {
        newStage = STAGES.STREET;
      }
    }

    if (newStage !== this._stage) {
      const prev = this._stage;
      this._stage = newStage;
      if (this.callbacks.onStage) this.callbacks.onStage(newStage, prev, alt);
    }
  }
}
