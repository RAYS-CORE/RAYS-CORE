import * as Cesium from 'cesium';
import { STAGES } from './core/ZoomController.js';

const EARTH_R = 6_378_137; // WGS84 equatorial radius, meters
const SHELL_H = 18_000;    // particle/grid shell floats slightly above terrain

/**
 * HoloGlobe3D — true 3D holographic globe, built from real Cesium primitives
 * (not a flat screen-space overlay), so it rotates/zooms/orbits exactly like
 * a physical object as the camera moves. Visual language (particle field,
 * lat/lon grid, rim glow, equatorial energy beam, streaking "satellites")
 * is ported from the supplied RAY SPY canvas animation, but reprojected
 * onto the real globe surface in lat/lon/height instead of screen-space x/y.
 *
 * Visible (full opacity) only in ORBITAL stage; fades out smoothly as the
 * camera descends into REGIONAL/TRANSITION so Cesium's real imagery + the
 * existing HoloCity 3D city/street system (Mapillary etc.) take over.
 *
 * Self-contained: adds its own primitives to the scene, touches no existing
 * UI/buttons/toggles, and never intercepts camera/mouse input.
 */
export class HoloGlobe3D {
  constructor(viewer) {
    this.viewer  = viewer;
    this._points = null;        // Cesium.PointPrimitiveCollection
    this._lines  = null;        // Cesium.PolylineCollection (graticule)
    this._beam   = null;        // equatorial energy beam entity
    this._rim    = null;        // rim-glow ellipsoid entity
    this._streaks = [];         // small moving "satellite" points
    this._particles = [];       // backing data for point primitives
    this._t      = 0;
    this._opacity = 1;
    this._targetOpacity = 1;
    this._rafId  = null;
    this._mounted = false;
  }

  mount() {
    if (this._mounted) return;
    this._mounted = true;
    this._buildGraticule();
    this._buildParticles();
    this._buildRim();
    this._buildBeam();
    this._buildStreaks();
    this._loop();
  }

  /** Call from ZoomController's onStage callback. */
  setStage(stage) {
    this._targetOpacity = stage === STAGES.ORBITAL ? 1 : 0;
  }

  // ─── GRATICULE (lat/lon grid lines), real 3D polylines on the shell ───
  _buildGraticule() {
    this._lines = new Cesium.PolylineCollection();
    const steps = 18;

    // Latitude rings
    for (let i = 0; i <= steps; i++) {
      const lat = (i / steps) * 180 - 90;
      const positions = [];
      for (let j = 0; j <= 120; j++) {
        const lon = (j / 120) * 360 - 180;
        positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, SHELL_H));
      }
      this._lines.add({
        positions,
        width: 1,
        material: Cesium.Material.fromType('Color', {
          color: new Cesium.Color(0, 0.7, 1.0, 0.10),
        }),
      });
    }

    // Longitude meridians
    for (let i = 0; i < steps; i++) {
      const lon = (i / steps) * 360 - 180;
      const positions = [];
      for (let j = 0; j <= 80; j++) {
        const lat = (j / 80) * 180 - 90;
        positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, SHELL_H));
      }
      this._lines.add({
        positions,
        width: 1,
        material: Cesium.Material.fromType('Color', {
          color: new Cesium.Color(0, 0.62, 1.0, 0.07),
        }),
      });
    }

    this.viewer.scene.primitives.add(this._lines);
  }

  // ─── PARTICLE FIELD — real 3D points scattered over the sphere ───
  _buildParticles() {
    this._points = new Cesium.PointPrimitiveCollection();

    for (let i = 0; i < 280; i++) {
      const lat = (Math.random() * 180) - 90;
      const lon = (Math.random() * 360) - 180;
      const bright = Math.random();
      const isThreat = bright > 0.7;
      const baseColor = isThreat
        ? new Cesium.Color(1, 0.24, 0.24, 0.85)
        : new Cesium.Color(0, 0.86, 1.0, 0.85);

      const pt = this._points.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, SHELL_H + Math.random() * 4000),
        pixelSize: 1.5 + Math.random() * 3,
        color: baseColor,
        outlineWidth: 0,
      });

      this._particles.push({
        primitive: pt,
        baseColor,
        flickerSeed: Math.random() * 10,
        lonDrift: (Math.random() - 0.5) * 0.004, // deg/frame slow drift
      });
    }

    this.viewer.scene.primitives.add(this._points);
  }

  // ─── RIM GLOW — translucent ellipsoid shell just above the surface ───
  _buildRim() {
    this._rim = this.viewer.entities.add({
      id: 'holo3d-rim',
      position: Cesium.Cartesian3.fromDegrees(0, 0, 0),
      ellipsoid: {
        radii: new Cesium.Cartesian3(
          EARTH_R + SHELL_H * 1.6,
          EARTH_R + SHELL_H * 1.6,
          EARTH_R + SHELL_H * 1.6
        ),
        material: new Cesium.ColorMaterialProperty(
          new Cesium.Color(0, 0.6, 1.0, 0.035)
        ),
        outline: false,
        fill: true,
      },
    });
  }

  // ─── EQUATORIAL ENERGY BEAM — pulsing band around the equator ───
  _buildBeam() {
    const positions = [];
    for (let j = 0; j <= 240; j++) {
      const lon = (j / 240) * 360 - 180;
      positions.push(Cesium.Cartesian3.fromDegrees(lon, 0, SHELL_H + 2000));
    }
    this._beam = this.viewer.entities.add({
      id: 'holo3d-beam',
      polyline: {
        positions,
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: new Cesium.Color(1.0, 0.12, 0.12, 0.55),
        }),
      },
    });
  }

  // ─── STREAKS — fast-moving "satellite" points skimming the shell ───
  _buildStreaks() {
    for (let i = 0; i < 14; i++) {
      const lat = (Math.random() - 0.5) * 70;
      const startLon = Math.random() * 360 - 180;
      const dir = Math.random() > 0.5 ? 1 : -1;
      const speed = (0.03 + Math.random() * 0.05) * dir; // deg/frame

      const entity = this.viewer.entities.add({
        id: `holo3d-streak-${i}`,
        position: Cesium.Cartesian3.fromDegrees(startLon, lat, SHELL_H + 6000),
        point: {
          pixelSize: 2.5,
          color: new Cesium.Color(0, 0.78, 1.0, 0.7),
        },
      });
      this._streaks.push({ entity, lat, lon: startLon, speed });
    }
  }

  // ─── ANIMATION LOOP ───
  _loop() {
    this._rafId = requestAnimationFrame(() => this._loop());

    // Ease opacity toward target — smooth cross-fade with real imagery/city.
    this._opacity += (this._targetOpacity - this._opacity) * 0.05;
    const show = this._opacity > 0.01;

    this._lines.show  = show;
    this._points.show = show;
    if (this._rim)  this._rim.show  = show;
    if (this._beam) this._beam.show = show;
    for (const s of this._streaks) s.entity.show = show;

    if (!show) return; // skip the per-frame math while fully hidden

    this._t += 0.01;
    const t = this._t;
    const op = this._opacity;

    // Animate graticule line opacity with the global fade
    for (let i = 0; i < this._lines.length; i++) {
      const line = this._lines.get(i);
      const baseAlpha = i <= 18 ? 0.10 : 0.07;
      line.material.uniforms.color = new Cesium.Color(0, 0.7, 1.0, baseAlpha * op);
    }

    // Animate particle flicker + slow longitudinal drift (re-derive position)
    for (const p of this._particles) {
      const flicker = 0.5 + 0.5 * Math.sin(t * 6 + p.flickerSeed);
      const c = p.baseColor;
      p.primitive.color = new Cesium.Color(c.red, c.green, c.blue, c.alpha * (0.5 + 0.5 * flicker) * op);
    }

    // Pulse the equatorial beam
    if (this._beam) {
      const beamAlpha = (0.35 + 0.2 * Math.sin(t * 1.4)) * op;
      this._beam.polyline.material = new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.25,
        color: new Cesium.Color(1.0, 0.12, 0.12, beamAlpha),
      });
    }

    // Rim glow breathing
    if (this._rim) {
      const rimAlpha = (0.025 + 0.02 * Math.sin(t * 0.8)) * op;
      this._rim.ellipsoid.material = new Cesium.ColorMaterialProperty(
        new Cesium.Color(0, 0.6, 1.0, rimAlpha)
      );
    }

    // Move streaks along longitude, wrapping at ±180°
    for (const s of this._streaks) {
      s.lon += s.speed;
      if (s.lon > 180) s.lon -= 360;
      if (s.lon < -180) s.lon += 360;
      s.entity.position = Cesium.Cartesian3.fromDegrees(s.lon, s.lat, SHELL_H + 6000);
      s.entity.point.color = new Cesium.Color(0, 0.78, 1.0, 0.7 * op);
    }
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._lines)  this.viewer.scene.primitives.remove(this._lines);
    if (this._points) this.viewer.scene.primitives.remove(this._points);
    if (this._rim)  this.viewer.entities.remove(this._rim);
    if (this._beam) this.viewer.entities.remove(this._beam);
    for (const s of this._streaks) this.viewer.entities.remove(s.entity);
    this._mounted = false;
  }
}
