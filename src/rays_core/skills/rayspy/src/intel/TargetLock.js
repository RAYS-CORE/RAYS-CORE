import * as Cesium from 'cesium';

/**
 * JARVIS-style target lock on a clicked building.
 * Expanding orange ring → vertical beam → building glow → intel panel open.
 */
export class TargetLock {
  constructor(viewer, onLocked) {
    this.viewer    = viewer;
    this.onLocked  = onLocked; // callback(lon, lat, height, buildingId)
    this._entities = [];
    this._rafId    = null;
    this._active   = false;
  }

  /**
   * Fire target lock at world position.
   */
  lock(lon, lat, height = 30, buildingId = null) {
    this.clear();
    this._active = true;

    const scene    = this.viewer.scene;
    const entities = this.viewer.entities;

    const center = Cesium.Cartesian3.fromDegrees(lon, lat, height / 2);
    const ground = Cesium.Cartesian3.fromDegrees(lon, lat, 0);

    // ── Ring 1: expanding orange ring ──
    const ring1 = entities.add({
      id:       `tl-ring1-${Date.now()}`,
      position: ground,
      ellipse: {
        semiMajorAxis:  new Cesium.CallbackProperty(() => this._ringR1, false),
        semiMinorAxis:  new Cesium.CallbackProperty(() => this._ringR1, false),
        height:         1,
        outline:        true,
        outlineColor:   Cesium.Color.fromCssColorString('#FF8C00').withAlpha(0.9),
        outlineWidth:   3,
        fill:           false,
        granularity:    Cesium.Math.toRadians(2),
      },
    });

    // ── Ring 2: secondary pulsing ring ──
    const ring2 = entities.add({
      id:       `tl-ring2-${Date.now()}`,
      position: ground,
      ellipse: {
        semiMajorAxis:  new Cesium.CallbackProperty(() => this._ringR2, false),
        semiMinorAxis:  new Cesium.CallbackProperty(() => this._ringR2, false),
        height:         1,
        outline:        true,
        outlineColor:   Cesium.Color.fromCssColorString('#FFD700').withAlpha(0.6),
        outlineWidth:   2,
        fill:           false,
        granularity:    Cesium.Math.toRadians(2),
      },
    });

    // ── Vertical beam ──
    const beam = entities.add({
      id:       `tl-beam-${Date.now()}`,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, height / 2),
      cylinder: {
        length:          new Cesium.CallbackProperty(() => this._beamH, false),
        topRadius:       1,
        bottomRadius:    1,
        material:        Cesium.Color.fromCssColorString('#00D4FF').withAlpha(0),
        outline:         false,
      },
    });

    // ── Corner brackets (HUD corners) ──
    const brackets = this._addBrackets(lon, lat, height);

    this._entities = [ring1, ring2, beam, ...brackets];

    // Animation state
    this._ringR1 = 5;
    this._ringR2 = 5;
    this._beamH  = 0;
    this._phase  = 0; // 0=rings expand, 1=beam rise, 2=locked

    const startTime = performance.now();
    const RING_DUR  = 600;
    const BEAM_DUR  = 500;
    const LOCK_DUR  = 300;

    const tick = () => {
      if (!this._active) return;
      const t = performance.now() - startTime;

      if (t < RING_DUR) {
        // Phase 0: rings expand from 5→80m
        const p = t / RING_DUR;
        this._ringR1 = 5 + p * 75;
        this._ringR2 = 5 + p * 55;
      } else if (t < RING_DUR + BEAM_DUR) {
        // Phase 1: beam rises
        this._ringR1 = 80;
        this._ringR2 = 60;
        const p = (t - RING_DUR) / BEAM_DUR;
        this._beamH  = p * height * 2;
        // Update beam alpha
        if (beam.cylinder?.material) {
          beam.cylinder.material = Cesium.Color.fromCssColorString('#00D4FF')
            .withAlpha(p * 0.55);
        }
      } else if (t < RING_DUR + BEAM_DUR + LOCK_DUR) {
        // Phase 2: rings snap inward to lock
        const p = (t - RING_DUR - BEAM_DUR) / LOCK_DUR;
        this._ringR1 = 80 - p * 40;
        this._ringR2 = 60 - p * 20;
      } else {
        // Done
        this._ringR1 = 40;
        this._ringR2 = 40;
        this._beamH  = height * 2;
        this._rafId  = null;
        if (this.onLocked) this.onLocked(lon, lat, height, buildingId);
        return;
      }

      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _addBrackets(lon, lat, height) {
    const offsets = [[1,1],[1,-1],[-1,1],[-1,-1]];
    const deg = 0.0003;
    return offsets.map(([dx, dy], i) => {
      return this.viewer.entities.add({
        id:       `tl-bracket-${i}-${Date.now()}`,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights([
            lon + dx*deg, lat + dy*deg, height + 2,
            lon + dx*deg*0.4, lat + dy*deg, height + 2,
            lon + dx*deg*0.4, lat + dy*deg, height + 2,
          ]),
          width:    3,
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString('#FF8C00').withAlpha(0.85)
          ),
        },
      });
    });
  }

  clear() {
    this._active = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    for (const e of this._entities) {
      try { this.viewer.entities.remove(e); } catch (_) {}
    }
    this._entities = [];
  }

  get active() { return this._active; }
}
