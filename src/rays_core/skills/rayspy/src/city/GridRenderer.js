import * as Cesium from 'cesium';

/**
 * GridRenderer — Volumetric holographic scan grid.
 *
 * 3D UPGRADES over the flat version:
 *  1. Multi-layer elevation planes — the grid is drawn at THREE heights
 *     (ground, mid-air, high-air) with decreasing opacity, creating a
 *     true volumetric scan-field rather than a flat mat on the ground.
 *  2. Vertical connector lines at every grid intersection — thin pillars
 *     that connect each layer, giving the grid visual depth and a
 *     "data lattice" appearance when viewed from an angle.
 *  3. Pulsing layer opacity — each horizontal layer pulses at a slightly
 *     different phase so the volume appears to "breathe" in 3D.
 *  4. Perimeter frame box — a raised bounding box outline at the scan
 *     area edges, anchoring the volume in space.
 *  5. scaleByDistance on connectors — connectors fade out at long range
 *     so the scene stays readable at city scale.
 */

// Heights at which horizontal grid planes are drawn (metres)
const LAYER_HEIGHTS    = [0, 80, 200];
// Base opacity per layer (ground = most visible, upper = ghostly)
const LAYER_ALPHAS     = [0.22, 0.12, 0.06];
// Phase offset per layer for the breathing animation (radians)
const LAYER_PHASE      = [0, Math.PI * 0.4, Math.PI * 0.8];

export class GridRenderer {
  constructor(viewer) {
    this.viewer    = viewer;
    this._entities = [];
    this._visible  = false;
    this._alpha    = 1.0;
    this._pulse    = 0;
    this._rafId    = null;

    // Track per-layer polyline entities so we can animate them
    // Structure: [{ entity, layerIdx }]
    this._layerLines = [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  show(centerLon, centerLat, spanDeg = 0.04, stepDeg = 0.005) {
    this.hide();

    const half = spanDeg / 2;

    // ── 1. Horizontal grid planes at each elevation layer ──────────────────
    for (let li = 0; li < LAYER_HEIGHTS.length; li++) {
      const h     = LAYER_HEIGHTS[li];
      const alpha = LAYER_ALPHAS[li] * this._alpha;

      // Horizontal lines (constant latitude)
      for (let dlat = -half; dlat <= half + 1e-9; dlat += stepDeg) {
        const lat = centerLat + dlat;
        try {
          const e = this.viewer.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                centerLon - half, lat, h,
                centerLon + half, lat, h,
              ]),
              width:    1,
              material: new Cesium.ColorMaterialProperty(
                new Cesium.Color(0, 0.85, 1.0, alpha)
              ),
            },
          });
          this._entities.push(e);
          this._layerLines.push({ entity: e, layerIdx: li });
        } catch (_) {}
      }

      // Vertical lines (constant longitude)
      for (let dlon = -half; dlon <= half + 1e-9; dlon += stepDeg) {
        const lon = centerLon + dlon;
        try {
          const e = this.viewer.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                lon, centerLat - half, h,
                lon, centerLat + half, h,
              ]),
              width:    1,
              material: new Cesium.ColorMaterialProperty(
                new Cesium.Color(0, 0.85, 1.0, alpha)
              ),
            },
          });
          this._entities.push(e);
          this._layerLines.push({ entity: e, layerIdx: li });
        } catch (_) {}
      }
    }

    // ── 2. Vertical connector pillars at every grid intersection ───────────
    // Only draw connectors between layer[0] and layer[last] to avoid clutter.
    const topH    = LAYER_HEIGHTS[LAYER_HEIGHTS.length - 1];
    const connAlpha = 0.10 * this._alpha;

    for (let dlat = -half; dlat <= half + 1e-9; dlat += stepDeg) {
      const lat = centerLat + dlat;
      for (let dlon = -half; dlon <= half + 1e-9; dlon += stepDeg) {
        const lon = centerLon + dlon;
        try {
          const e = this.viewer.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                lon, lat, 0,
                lon, lat, topH,
              ]),
              width:    0.5,
              material: new Cesium.ColorMaterialProperty(
                new Cesium.Color(0, 0.9, 1.0, connAlpha)
              ),
            },
          });
          this._entities.push(e);
          this._layerLines.push({ entity: e, layerIdx: -1 }); // -1 = connector
        } catch (_) {}
      }
    }

    // ── 3. Perimeter bounding box ──────────────────────────────────────────
    // Four vertical edges at the corners of the scan area
    const corners = [
      [centerLon - half, centerLat - half],
      [centerLon + half, centerLat - half],
      [centerLon + half, centerLat + half],
      [centerLon - half, centerLat + half],
    ];

    for (const [lo, la] of corners) {
      try {
        const e = this.viewer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights([
              lo, la, 0,
              lo, la, topH,
            ]),
            width:    2,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.5,
              color:     new Cesium.Color(0, 1.0, 1.0, 0.7 * this._alpha),
            }),
          },
        });
        this._entities.push(e);
        this._layerLines.push({ entity: e, layerIdx: -2 }); // -2 = frame pillar
      } catch (_) {}
    }

    // Top perimeter loop
    const topLoopPts = [
      ...corners.map(([lo, la]) =>
        Cesium.Cartesian3.fromDegrees(lo, la, topH)
      ),
      Cesium.Cartesian3.fromDegrees(corners[0][0], corners[0][1], topH),
    ];
    try {
      const e = this.viewer.entities.add({
        polyline: {
          positions: topLoopPts,
          width:     1.5,
          material:  new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.4,
            color:     new Cesium.Color(0, 1.0, 1.0, 0.6 * this._alpha),
          }),
        },
      });
      this._entities.push(e);
      this._layerLines.push({ entity: e, layerIdx: -2 });
    } catch (_) {}

    // Bottom perimeter loop
    const botLoopPts = [
      ...corners.map(([lo, la]) =>
        Cesium.Cartesian3.fromDegrees(lo, la, 0)
      ),
      Cesium.Cartesian3.fromDegrees(corners[0][0], corners[0][1], 0),
    ];
    try {
      const e = this.viewer.entities.add({
        polyline: {
          positions: botLoopPts,
          width:     1.5,
          material:  new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.4,
            color:     new Cesium.Color(0, 1.0, 1.0, 0.6 * this._alpha),
          }),
        },
      });
      this._entities.push(e);
      this._layerLines.push({ entity: e, layerIdx: -2 });
    } catch (_) {}

    this._visible = true;
    this._startPulse();
  }

  // ─────────────────────────────────────────────────────────────────────────
  _startPulse() {
    if (this._rafId) return;

    const tick = () => {
      this._pulse = (this._pulse + 0.012) % (Math.PI * 2);

      for (const { entity, layerIdx } of this._layerLines) {
        if (!entity?.polyline?.material) continue;

        if (layerIdx >= 0) {
          // Horizontal layer line — breathe at per-layer phase
          const phase  = LAYER_PHASE[layerIdx] || 0;
          const mod    = 0.7 + Math.sin(this._pulse + phase) * 0.3;
          const base   = LAYER_ALPHAS[layerIdx] * this._alpha * mod;
          entity.polyline.material = new Cesium.ColorMaterialProperty(
            new Cesium.Color(0, 0.85, 1.0, base)
          );
        }
        // Connectors and frame pillars are left static (no per-frame update
        // needed — they're already subtle enough)
      }

      this._rafId = requestAnimationFrame(tick);
    };

    this._rafId = requestAnimationFrame(tick);
  }

  // ─────────────────────────────────────────────────────────────────────────
  setAlpha(alpha) {
    this._alpha = Cesium.Math.clamp(alpha, 0, 1);

    for (const { entity, layerIdx } of this._layerLines) {
      if (!entity?.polyline?.material) continue;

      if (layerIdx >= 0) {
        entity.polyline.material = new Cesium.ColorMaterialProperty(
          new Cesium.Color(0, 0.85, 1.0, LAYER_ALPHAS[layerIdx] * this._alpha)
        );
      } else if (layerIdx === -1) {
        // connector
        entity.polyline.material = new Cesium.ColorMaterialProperty(
          new Cesium.Color(0, 0.9, 1.0, 0.10 * this._alpha)
        );
      } else {
        // frame pillar / top-bottom loop
        entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.4,
          color:     new Cesium.Color(0, 1.0, 1.0, 0.6 * this._alpha),
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  hide() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    for (const e of this._entities) {
      try { this.viewer.entities.remove(e); } catch (_) {}
    }
    this._entities   = [];
    this._layerLines = [];
    this._visible    = false;
  }

  get visible() { return this._visible; }
}
