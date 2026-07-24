/**
 * Adds a subtle CSS scanline overlay to the Cesium canvas during CITY/STREET stages.
 * Uses a lightweight CSS pseudo-element — no post-process overhead.
 */
export class ScanlineEffect {
  constructor() {
    this._el = null;
  }

  mount() {
    if (this._el) return;
    this._el = document.createElement('div');
    this._el.id = 'rsp-scanline-overlay';
    this._el.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 50;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0, 212, 255, 0.015) 2px,
        rgba(0, 212, 255, 0.015) 4px
      );
      opacity: 0;
      transition: opacity 1.2s ease;
    `;
    document.body.appendChild(this._el);
  }

  setOpacity(v) {
    if (!this._el) this.mount();
    this._el.style.opacity = String(Math.min(v, 0.6));
  }

  hide() {
    if (this._el) this._el.style.opacity = '0';
  }

  destroy() {
    if (this._el) { this._el.remove(); this._el = null; }
  }
}
