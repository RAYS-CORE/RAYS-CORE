import * as Cesium from 'cesium';

/**
 * Enhances Cesium's atmosphere for a holographic orbital look.
 */
export class AtmosphereEffect {
  constructor(viewer) {
    this.viewer = viewer;
    this._applied = false;
  }

  apply() {
    if (this._applied) return;
    const scene = this.viewer.scene;

    // Deeper blue atmosphere tint
    scene.skyAtmosphere.hueShift        = 0.04;
    scene.skyAtmosphere.saturationShift = 0.3;
    scene.skyAtmosphere.brightnessShift = 0.1;

    // Ground atmosphere — cyan-tinted limb
    scene.globe.atmosphereHueShift        = 0.05;
    scene.globe.atmosphereSaturationShift = 0.4;
    scene.globe.atmosphereBrightnessShift = 0.1;

    this._applied = true;
  }

  reset() {
    const scene = this.viewer.scene;
    scene.skyAtmosphere.hueShift        = 0;
    scene.skyAtmosphere.saturationShift = 0;
    scene.skyAtmosphere.brightnessShift = 0;
    scene.globe.atmosphereHueShift        = 0;
    scene.globe.atmosphereSaturationShift = 0;
    scene.globe.atmosphereBrightnessShift = 0;
    this._applied = false;
  }
}
