import * as Cesium from 'cesium';

/**
 * RoadRenderer — Holographic 3D road network.
 *
 * 3D UPGRADES over the flat version:
 *  1. Dual-layer elevation — every road is drawn TWICE:
 *       • Ground layer  (z = 1 m)  — wide diffuse glow, anchors to terrain
 *       • Elevated lane (z = 12 m) — narrower, brighter "data stream" that
 *         floats above, giving strong 3-D depth when the camera tilts.
 *  2. Tiered heights by road type — motorways/trunks render their elevated
 *     lane at 25 m (overpass feel), primary at 18 m, secondary at 12 m,
 *     residential at 6 m.  Viewing the city from an angle immediately
 *     reads the road hierarchy in 3-D space.
 *  3. Animated arrow flow on primary+ roads — PolylineArrowMaterialProperty
 *     gives a directional "data flowing" appearance.
 *  4. Intersection node beacons — wherever two road endpoints are close,
 *     a glowing PointGraphics beacon is placed at the elevated height,
 *     making junctions pop as bright 3-D nodes.
 *  5. Vertical drop lines at road endpoints — thin pillars from ground to
 *     the elevated lane at each road's start/end, so the lift is always
 *     visually grounded.
 */

const ROAD_WIDTHS = {
  motorway:      9,
  trunk:         8,
  primary:       7,
  secondary:     5,
  tertiary:      4,
  residential:   3,
  unclassified:  3,
};

// Elevated lane heights per road class (metres)
const ROAD_ELEV = {
  motorway:      25,
  trunk:         25,
  primary:       18,
  secondary:     12,
  tertiary:      8,
  residential:   6,
  unclassified:  6,
};

// Which road types get the arrow-flow treatment
const ARROW_TYPES = new Set(['motorway', 'trunk', 'primary', 'secondary']);

export class RoadRenderer {
  constructor(viewer) {
    this.viewer    = viewer;
    this._entities = [];
    this._visible  = false;
    this._alpha    = 1.0;

    // Intersection node tracking: key = "lon_lat" → elevation
    this._nodes    = new Map();
  }

  // ─────────────────────────────────────────────────────────────────────────
  render(roads) {
    this.clear();
    if (!roads?.length) return;

    this._nodes.clear();

    for (const road of roads) {
      if (!road.coords || road.coords.length < 2) continue;

      const rtype  = road.type || 'residential';
      const width  = ROAD_WIDTHS[rtype] ?? 3;
      const elev   = ROAD_ELEV[rtype]  ?? 6;
      const useArr = ARROW_TYPES.has(rtype);

      try {
        // ── Ground positions (z = 1 m, clamp to terrain) ──────────────────
        const groundPts = road.coords.map(([lo, la]) =>
          Cesium.Cartesian3.fromDegrees(lo, la, 1)
        );

        // ── Elevated lane positions (z = elev) ─────────────────────────────
        const elevPts = road.coords.map(([lo, la]) =>
          Cesium.Cartesian3.fromDegrees(lo, la, elev)
        );

        // 1. Ground diffuse glow layer (wide, very transparent)
        this._addEntity({
          polyline: {
            positions:    groundPts,
            width:        width * 3,
            material:     new Cesium.ColorMaterialProperty(
              new Cesium.Color(0, 0.85, 1.0, 0.10)
            ),
            clampToGround: false,
          },
        }, 'ground-glow');

        // 2. Ground core line
        this._addEntity({
          polyline: {
            positions: groundPts,
            width:     width * 0.7,
            material:  new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color:     new Cesium.Color(0, 1.0, 1.0, 0.5),
            }),
            clampToGround: false,
          },
        }, 'ground-core');

        // 3. Elevated lane — arrow flow OR glow, depending on road type
        if (useArr) {
          this._addEntity({
            polyline: {
              positions: elevPts,
              width:     width,
              material:  new Cesium.PolylineArrowMaterialProperty(
                new Cesium.Color(0, 1.0, 1.0, 0.85)
              ),
            },
          }, 'elev-arrow');
        } else {
          this._addEntity({
            polyline: {
              positions: elevPts,
              width:     width * 0.8,
              material:  new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.45,
                color:     new Cesium.Color(0, 1.0, 1.0, 0.8),
              }),
            },
          }, 'elev-glow');
        }

        // 4. Elevated wide diffuse halo
        this._addEntity({
          polyline: {
            positions: elevPts,
            width:     width * 2.5,
            material:  new Cesium.ColorMaterialProperty(
              new Cesium.Color(0, 0.9, 1.0, 0.12)
            ),
          },
        }, 'elev-halo');

        // 5. Vertical drop lines at start and end of road
        for (const idx of [0, road.coords.length - 1]) {
          const [lo, la] = road.coords[idx];
          this._addEntity({
            polyline: {
              positions: [
                Cesium.Cartesian3.fromDegrees(lo, la, 0),
                Cesium.Cartesian3.fromDegrees(lo, la, elev),
              ],
              width:    0.8,
              material: new Cesium.ColorMaterialProperty(
                new Cesium.Color(0, 0.9, 1.0, 0.3)
              ),
            },
          }, 'drop-line');

          // Track endpoint for intersection beacons
          const key = `${lo.toFixed(5)}_${la.toFixed(5)}`;
          if (!this._nodes.has(key)) {
            this._nodes.set(key, { lo, la, elev });
          }
        }

      } catch (e) { /* skip invalid road */ }
    }

    // ── 6. Intersection node beacons ───────────────────────────────────────
    // Simple heuristic: endpoints that appear more than once are intersections.
    // Build frequency map first.
    const freq = new Map();
    for (const road of roads) {
      if (!road.coords?.length) continue;
      const elev = ROAD_ELEV[road.type || 'residential'] ?? 6;
      for (const idx of [0, road.coords.length - 1]) {
        const [lo, la] = road.coords[idx];
        const key = `${lo.toFixed(4)}_${la.toFixed(4)}`;
        if (!freq.has(key)) freq.set(key, { lo, la, elev, count: 0 });
        freq.get(key).count++;
      }
    }

    for (const { lo, la, elev, count } of freq.values()) {
      if (count < 2) continue; // only true intersections
      try {
        this._addEntity({
          position: Cesium.Cartesian3.fromDegrees(lo, la, elev + 3),
          point: {
            pixelSize:    count > 3 ? 7 : 5,
            color:        new Cesium.Color(0, 1.0, 1.0, 0.9),
            outlineColor: new Cesium.Color(1, 1, 1, 0.4),
            outlineWidth: 1,
            scaleByDistance:         new Cesium.NearFarScalar(50, 1.5, 3000, 0.2),
            translucencyByDistance:  new Cesium.NearFarScalar(500, 1.0, 4000, 0.0),
          },
        }, 'node');
      } catch (_) {}
    }

    this._visible = true;
    console.log(
      `[RoadRenderer] rendered ${roads.length} roads` +
      ` (${this._entities.length} entities, ${freq.size} nodes)`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  _addEntity(def, kind) {
    const entity = this.viewer.entities.add(def);
    this._entities.push({ entity, kind });
  }

  // ─────────────────────────────────────────────────────────────────────────
  setAlpha(alpha) {
    this._alpha = Cesium.Math.clamp(alpha, 0, 1);
    const show  = this._alpha > 0.01;

    for (const { entity, kind } of this._entities) {
      entity.show = show;

      if (!show) continue;

      switch (kind) {
        case 'ground-glow':
          if (entity.polyline)
            entity.polyline.material = new Cesium.ColorMaterialProperty(
              new Cesium.Color(0, 0.85, 1.0, 0.10 * this._alpha)
            );
          break;

        case 'ground-core':
          if (entity.polyline)
            entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color:     new Cesium.Color(0, 1.0, 1.0, 0.5 * this._alpha),
            });
          break;

        case 'elev-arrow':
          if (entity.polyline)
            entity.polyline.material = new Cesium.PolylineArrowMaterialProperty(
              new Cesium.Color(0, 1.0, 1.0, 0.85 * this._alpha)
            );
          break;

        case 'elev-glow':
          if (entity.polyline)
            entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.45,
              color:     new Cesium.Color(0, 1.0, 1.0, 0.8 * this._alpha),
            });
          break;

        case 'elev-halo':
          if (entity.polyline)
            entity.polyline.material = new Cesium.ColorMaterialProperty(
              new Cesium.Color(0, 0.9, 1.0, 0.12 * this._alpha)
            );
          break;

        case 'drop-line':
          if (entity.polyline)
            entity.polyline.material = new Cesium.ColorMaterialProperty(
              new Cesium.Color(0, 0.9, 1.0, 0.3 * this._alpha)
            );
          break;

        case 'node':
          if (entity.point)
            entity.point.color = new Cesium.Color(0, 1.0, 1.0, 0.9 * this._alpha);
          break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  clear() {
    for (const { entity } of this._entities) {
      try { this.viewer.entities.remove(entity); } catch (_) {}
    }
    this._entities = [];
    this._visible  = false;
    this._alpha    = 1.0;
    this._nodes.clear();
  }

  get visible() { return this._visible; }
}
