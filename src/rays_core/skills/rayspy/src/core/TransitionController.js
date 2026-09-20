import * as Cesium from 'cesium';
import { STAGES } from './ZoomController.js';

/**
 * Manages imagery layer alpha transitions between zoom stages.
 * Stage 3 (TRANSITION): satellite fades out, grid/holographic fades in.
 */
export class TransitionController {
  constructor(viewer) {
    this.viewer    = viewer;
    this._stage    = null;
    this._raf      = null;
  }

  applyStage(stage, alt, imageryLayers) {
    if (stage === this._stage) return;
    this._stage = stage;

    // Imagery alpha — fade satellite out as we descend into city
    if (!imageryLayers || imageryLayers.length === 0) return;

    const baseLayer = imageryLayers[0];
    if (!baseLayer) return;

    switch (stage) {
      case STAGES.ORBITAL:
      case STAGES.REGIONAL:
        this._animateAlpha(baseLayer, 1.0);
        break;
      case STAGES.TRANSITION:
        // Lerp handled continuously by ZoomController altitude
        break;
      case STAGES.CITY:
        this._animateAlpha(baseLayer, 0.15);
        break;
      case STAGES.STREET:
        this._animateAlpha(baseLayer, 0.05);
        break;
    }
  }

  /**
   * Called every frame during TRANSITION stage.
   * Lerps imagery alpha based on altitude between 50 000 and 5 000.
   */
  updateTransition(alt, imageryLayers) {
    if (this._stage !== STAGES.TRANSITION) return;
    if (!imageryLayers || !imageryLayers[0]) return;
    const t = Cesium.Math.clamp((alt - 8_000) / (80_000 - 8_000), 0, 1);
    imageryLayers[0].alpha = t;
  }

  _animateAlpha(layer, target, duration = 800) {
    const start = layer.alpha;
    const diff  = target - start;
    const t0    = performance.now();
    if (this._raf) cancelAnimationFrame(this._raf);
    const tick = () => {
      const elapsed = performance.now() - t0;
      const progress = Math.min(elapsed / duration, 1);
      layer.alpha = start + diff * this._ease(progress);
      if (progress < 1) this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _ease(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }
}
