import * as Cesium from 'cesium';

/**
 * BuildingRenderer — Holographic 3D city buildings.
 *
 * 3D UPGRADES over the flat version:
 *  1. Corner pillar polylines  — bright vertical lines at every polygon vertex,
 *     running from ground to roof. These define the 3-D silhouette clearly.
 *  2. Per-floor horizontal rings — a glowing ring every FLOOR_HEIGHT_M metres,
 *     giving visible floor stratification and depth cues.
 *  3. Diagonal facade cross-braces — one X-brace per wall face, making each
 *     face read as a distinct 3-D plane rather than a flat fill.
 *  4. Rooftop centroid beacon — a pulsing PointGraphics at the roof centre.
 *  5. Animated pulse — the scan line now sweeps vertically from 0 → height,
 *     resetting each cycle, rather than just modulating overall opacity.
 */

const FLOOR_HEIGHT_M  = 3.5;
const PILLAR_COLOR    = new Cesium.Color(0.0, 1.0, 1.0, 1.0);
const BODY_FILL_COLOR = new Cesium.Color(0.0, 0.55, 0.75, 0.38);
const FLOOR_COLOR     = new Cesium.Color(0.0, 0.85, 1.0, 0.55);
const SCAN_COLOR      = new Cesium.Color(0.4, 1.0, 1.0, 0.9);
const BEACON_COLOR    = new Cesium.Color(0.0, 1.0, 1.0, 1.0);

/** Returns the 2-D centroid of a polygon given as [[lon,lat], …] */
function centroid2D(coords) {
  let lon = 0, lat = 0;
  for (const [lo, la] of coords) { lon += lo; lat += la; }
  return [lon / coords.length, lat / coords.length];
}

export class BuildingRenderer {
  constructor(viewer) {
    this.viewer     = viewer;
    this._entities  = [];   // { entity, kind, height? }
    this._visible   = false;
    this._alpha     = 1.0;
    this._pulse     = 0;    // global glow pulse (0..2π)
    this._scan      = 0;    // per-frame scan line progress (0..1)
    this._rafId     = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  render(buildings) {
    this.clear();
    if (!buildings?.length) return;

    for (const bld of buildings) {
      if (!bld.coords || bld.coords.length < 3) continue;

      const height   = Math.max((bld.levels || 3) * FLOOR_HEIGHT_M, 9);
      const coords   = bld.coords;
      const n        = coords.length;

      try {
        // ── 1. Solid body polygon ──────────────────────────────────────────
        const positions = coords.map(([lo, la]) =>
          Cesium.Cartesian3.fromDegrees(lo, la)
        );

        this._add({
          id: `holo-building-${bld.id}`,
          polygon: {
            hierarchy:      new Cesium.PolygonHierarchy(positions),
            height:         0,
            extrudedHeight: height,
            material:       new Cesium.ColorMaterialProperty(BODY_FILL_COLOR),
            outline:        true,
            outlineColor:   PILLAR_COLOR,
            outlineWidth:   1.5,
            closeTop:       true,
            closeBottom:    false,
          },
        }, 'body', height);

        // ── 2. Corner pillar polylines (vertical, ground → roof) ───────────
        for (let i = 0; i < n; i++) {
          const [lo, la] = coords[i];
          this._add({
            id: `holo-pillar-${bld.id}-${i}`,
            polyline: {
              positions: [
                Cesium.Cartesian3.fromDegrees(lo, la, 0),
                Cesium.Cartesian3.fromDegrees(lo, la, height),
              ],
              width: 2,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.5,
                color:     PILLAR_COLOR,
              }),
            },
          }, 'pillar', height);
        }

        // ── 3. Roof outline (closed loop at height) ────────────────────────
        const roofPts = [
          ...coords.map(([lo, la]) => Cesium.Cartesian3.fromDegrees(lo, la, height)),
          Cesium.Cartesian3.fromDegrees(coords[0][0], coords[0][1], height),
        ];
        this._add({
          id: `holo-roof-${bld.id}`,
          polyline: {
            positions: roofPts,
            width:     2.5,
            material:  new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.35,
              color:     new Cesium.Color(0, 1.0, 1.0, 0.95),
            }),
          },
        }, 'roof', height);

        // ── 4. Per-floor horizontal rings ──────────────────────────────────
        const floorCount = Math.floor(height / FLOOR_HEIGHT_M);
        for (let f = 1; f <= floorCount; f++) {
          const fh = f * FLOOR_HEIGHT_M;
          if (fh >= height) break;
          const floorPts = [
            ...coords.map(([lo, la]) => Cesium.Cartesian3.fromDegrees(lo, la, fh)),
            Cesium.Cartesian3.fromDegrees(coords[0][0], coords[0][1], fh),
          ];
          this._add({
            id: `holo-floor-${bld.id}-${f}`,
            polyline: {
              positions: floorPts,
              width:     1,
              material:  new Cesium.ColorMaterialProperty(
                new Cesium.Color(0.0, 0.85, 1.0, 0.35)
              ),
            },
          }, 'floor', height);
        }

        // ── 5. Diagonal cross-braces on each wall face ─────────────────────
        // One X per wall: two diagonals from (corner, ground) to (next corner, roof)
        for (let i = 0; i < n; i++) {
          const [lo0, la0] = coords[i];
          const [lo1, la1] = coords[(i + 1) % n];

          // Diagonal A: bottom-left → top-right
          this._add({
            id: `holo-brace-a-${bld.id}-${i}`,
            polyline: {
              positions: [
                Cesium.Cartesian3.fromDegrees(lo0, la0, 0),
                Cesium.Cartesian3.fromDegrees(lo1, la1, height),
              ],
              width: 0.8,
              material: new Cesium.ColorMaterialProperty(
                new Cesium.Color(0.0, 0.9, 1.0, 0.22)
              ),
            },
          }, 'brace');

          // Diagonal B: top-left → bottom-right
          this._add({
            id: `holo-brace-b-${bld.id}-${i}`,
            polyline: {
              positions: [
                Cesium.Cartesian3.fromDegrees(lo0, la0, height),
                Cesium.Cartesian3.fromDegrees(lo1, la1, 0),
              ],
              width: 0.8,
              material: new Cesium.ColorMaterialProperty(
                new Cesium.Color(0.0, 0.9, 1.0, 0.22)
              ),
            },
          }, 'brace');
        }

        // ── 6. Rooftop centroid beacon ─────────────────────────────────────
        const [clo, cla] = centroid2D(coords);
        this._add({
          id: `holo-beacon-${bld.id}`,
          position: Cesium.Cartesian3.fromDegrees(clo, cla, height + 2),
          point: {
            pixelSize:        5,
            color:            BEACON_COLOR,
            outlineColor:     new Cesium.Color(1, 1, 1, 0.5),
            outlineWidth:     1,
            scaleByDistance:  new Cesium.NearFarScalar(100, 1.4, 2000, 0.3),
            translucencyByDistance: new Cesium.NearFarScalar(500, 1.0, 3000, 0.0),
          },
        }, 'beacon', height);

        // ── 7. Vertical scan line entity (starts hidden; pulse loop controls it)
        const scanEntity = this.viewer.entities.add({
          id:       `holo-scan-${bld.id}`,
          polyline: {
            positions: [
              ...coords.map(([lo, la]) => Cesium.Cartesian3.fromDegrees(lo, la, 0)),
              Cesium.Cartesian3.fromDegrees(coords[0][0], coords[0][1], 0),
            ],
            width:    1.5,
            material: new Cesium.ColorMaterialProperty(SCAN_COLOR),
          },
        });
        this._entities.push({ entity: scanEntity, kind: 'scan', height, coords });

      } catch (e) {
        // skip invalid polygon
      }
    }

    this._visible = true;
    this._startPulse();
    console.log(
      `[BuildingRenderer] rendered ${buildings.length} buildings` +
      ` (${this._entities.length} entities)`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  /** Convenience: add entity + track it */
  _add(def, kind, height) {
    const entity = this.viewer.entities.add(def);
    this._entities.push({ entity, kind, height });
  }

  // ─────────────────────────────────────────────────────────────────────────
  setAlpha(alpha) {
    this._alpha = Cesium.Math.clamp(alpha, 0, 1);
    const show  = this._alpha > 0.01;

    for (const e of this._entities) {
      e.entity.show = show;

      switch (e.kind) {
        case 'body':
          if (e.entity.polygon) {
            e.entity.polygon.material = new Cesium.ColorMaterialProperty(
              new Cesium.Color(0.0, 0.55, 0.75, 0.38 * this._alpha)
            );
            e.entity.polygon.outlineColor =
              new Cesium.Color(0, 1.0, 1.0, this._alpha);
          }
          break;

        case 'pillar':
        case 'roof':
          if (e.entity.polyline) {
            e.entity.polyline.material =
              new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.4,
                color:     new Cesium.Color(0, 1.0, 1.0, 0.95 * this._alpha),
              });
          }
          break;

        case 'floor':
          if (e.entity.polyline) {
            e.entity.polyline.material = new Cesium.ColorMaterialProperty(
              new Cesium.Color(0.0, 0.85, 1.0, 0.35 * this._alpha)
            );
          }
          break;

        case 'beacon':
          if (e.entity.point) {
            e.entity.point.color =
              new Cesium.Color(0, 1.0, 1.0, this._alpha);
          }
          break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  _startPulse() {
    if (this._rafId) return;

    const SCAN_SPEED = 0.008; // fraction of building height moved per frame

    const tick = () => {
      this._pulse = (this._pulse + 0.018) % (Math.PI * 2);
      this._scan  = (this._scan  + SCAN_SPEED) % 1.0;

      const glowMod    = 0.82 + Math.sin(this._pulse) * 0.18;
      const beaconMod  = 0.6  + Math.sin(this._pulse * 1.3) * 0.4;

      for (const e of this._entities) {
        if (!e.entity.show) continue;

        switch (e.kind) {
          case 'roof':
          case 'pillar':
            if (e.entity.polyline) {
              e.entity.polyline.material =
                new Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.35,
                  color:     new Cesium.Color(0, 1.0, 1.0,
                               0.95 * this._alpha * glowMod),
                });
            }
            break;

          case 'body':
            if (e.entity.polygon) {
              e.entity.polygon.outlineColor =
                new Cesium.Color(0, 1.0, 1.0, this._alpha * glowMod);
            }
            break;

          case 'beacon':
            if (e.entity.point) {
              e.entity.point.pixelSize = 5 + beaconMod * 3;
              e.entity.point.color =
                new Cesium.Color(0, 1.0, 1.0, this._alpha * beaconMod);
            }
            break;

          case 'scan':
            // Move the scan ring vertically across the building
            if (e.entity.polyline && e.coords && e.height) {
              const scanH = this._scan * e.height;
              e.entity.polyline.positions = [
                ...e.coords.map(([lo, la]) =>
                  Cesium.Cartesian3.fromDegrees(lo, la, scanH)
                ),
                Cesium.Cartesian3.fromDegrees(
                  e.coords[0][0], e.coords[0][1], scanH
                ),
              ];
              // fade near top / bottom of sweep
              const edgeFade = Math.sin(this._scan * Math.PI);
              e.entity.polyline.material = new Cesium.ColorMaterialProperty(
                new Cesium.Color(0.5, 1.0, 1.0, 0.85 * this._alpha * edgeFade)
              );
            }
            break;
        }
      }

      this._rafId = requestAnimationFrame(tick);
    };

    this._rafId = requestAnimationFrame(tick);
  }

  // ─────────────────────────────────────────────────────────────────────────
  clear() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    for (const e of this._entities) {
      try { this.viewer.entities.remove(e.entity); } catch (_) {}
    }
    this._entities = [];
    this._visible  = false;
    this._alpha    = 1.0;
    this._scan     = 0;
    this._pulse    = 0;
  }

  get visible() { return this._visible; }
}
