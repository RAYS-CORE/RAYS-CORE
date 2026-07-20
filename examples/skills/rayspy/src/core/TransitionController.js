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

    if (!imageryLayers) return;
    const baseLayer = typeof imageryLayers.get === 'function' ? imageryLayers.get(0) : imageryLayers[0];
    if (!baseLayer) return;

    // Keep satellite imagery fully visible at all stages
    this._animateAlpha(baseLayer, 1.0);
  }

  /**
   * Called every frame during TRANSITION stage.
   * Keeps satellite imagery fully visible.
   */
  updateTransition(alt, imageryLayers) {
    if (this._stage !== STAGES.TRANSITION) return;
    if (!imageryLayers) return;
    const baseLayer = typeof imageryLayers.get === 'function' ? imageryLayers.get(0) : imageryLayers[0];
    if (!baseLayer) return;
    baseLayer.alpha = 1.0;
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
