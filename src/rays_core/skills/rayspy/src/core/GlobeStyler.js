import * as Cesium from 'cesium';
import { STAGES } from './ZoomController.js';

/**
 * GlobeStyler — reverted to a no-op pass-through.
 * The globe stays as plain Esri imagery + OSM the whole time (as it
 * originally was) regardless of zoom stage. No holographic base color,
 * no atmosphere/fog overrides. Kept as a class (rather than deleted) so
 * HoloCity.js doesn't need its import/usage removed.
 */
export class GlobeStyler {
  constructor(viewer) {
    this.viewer = viewer;
    this.globe  = viewer.scene.globe;
  }

  applyStage(_stage, _alt) {
    // Intentionally does nothing — globe keeps its default real-imagery look.
  }
}
