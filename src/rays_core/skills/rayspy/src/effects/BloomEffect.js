import * as Cesium from 'cesium';

/**
 * Manages Cesium post-process bloom for holographic entity glow.
 * Bloom is only applied to the cyan entities (buildings, roads).
 */
export class BloomEffect {
  constructor(viewer) {
    this.viewer  = viewer;
    this._stage  = null;
    this._active = false;
  }

  enable() {
    if (this._active) return;
    try {
      const bloom = this.viewer.scene.postProcessStages.bloom;
      if (bloom) {
        bloom.enabled   = true;
        bloom.uniforms.contrast   = 128;
        bloom.uniforms.brightness = -0.3;
        bloom.uniforms.glowOnly   = false;
        this._active = true;
      }
    } catch (e) {
      console.warn('[BloomEffect] bloom unavailable:', e.message);
    }
  }

  disable() {
    if (!this._active) return;
    try {
      const bloom = this.viewer.scene.postProcessStages.bloom;
      if (bloom) bloom.enabled = false;
    } catch (_) {}
    this._active = false;
  }

  setIntensity(v) {
    try {
      const bloom = this.viewer.scene.postProcessStages.bloom;
      if (bloom?.enabled) {
        bloom.uniforms.contrast   = 80 + v * 80;
        bloom.uniforms.brightness = -0.4 + v * 0.2;
      }
    } catch (_) {}
  }
}
