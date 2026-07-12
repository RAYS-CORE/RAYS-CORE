/**
 * Intel panel that slides in from the right when a building is target-locked.
 * Shows building info + nearest Mapillary street image.
 * Injects into the existing wv-dock-right > tab-intel pane.
 */
export class IntelPanel {
  constructor(mapillaryProvider) {
    this._mapillary = mapillaryProvider;
    this._panel     = null;
    this._visible   = false;
  }

  /**
   * Mount the panel into the existing Intel tab pane.
   * Call once after DOM is ready.
   */
  mount() {
    // Re-use the existing intel tab pane
    this._panel = document.getElementById('tab-intel');
    if (!this._panel) {
      console.warn('[IntelPanel] #tab-intel not found');
      return;
    }
  }

  /**
   * Show building intel + street view.
   * Switches UI to the INTEL tab automatically.
   */
  async showBuilding(lon, lat, buildingId, osmTags = {}) {
    if (!this._panel) return;

    // Switch to INTEL tab
    this._switchToIntelTab();

    // Show loading state
    this._panel.innerHTML = `
      <div class="rsp-intel-panel">
        <div class="rsp-intel-header">
          <span class="rsp-intel-icon">⌖</span>
          <div>
            <div class="rsp-intel-title">TARGET ACQUIRED</div>
            <div class="rsp-intel-coords">${lat.toFixed(5)}° N, ${lon.toFixed(5)}° E</div>
          </div>
        </div>
        <div class="rsp-intel-section">
          <div class="rsp-intel-label">STRUCTURE</div>
          <div class="rsp-intel-value">${osmTags.building || 'BUILDING'}</div>
        </div>
        ${osmTags['building:levels'] ? `
        <div class="rsp-intel-section">
          <div class="rsp-intel-label">FLOORS</div>
          <div class="rsp-intel-value">${osmTags['building:levels']}</div>
        </div>` : ''}
        ${osmTags.name ? `
        <div class="rsp-intel-section">
          <div class="rsp-intel-label">DESIGNATION</div>
          <div class="rsp-intel-value">${osmTags.name}</div>
        </div>` : ''}
        <div class="rsp-intel-section">
          <div class="rsp-intel-label">OSM REF</div>
          <div class="rsp-intel-value">${buildingId || '—'}</div>
        </div>
        <div class="rsp-intel-divider"></div>
        <div class="rsp-intel-label">STREET INTELLIGENCE</div>
        <div id="rsp-street-view" class="rsp-street-loading">
          <div class="rsp-street-spinner"></div>
          SCANNING STREET IMAGERY…
        </div>
        <button class="rsp-intel-close" id="rsp-intel-close">✕ CLEAR TARGET</button>
      </div>
    `;

    document.getElementById('rsp-intel-close')?.addEventListener('click', () => this.hide());

    // Load street view async
    this._loadStreetView(lon, lat);
    this._visible = true;
  }

  async _loadStreetView(lon, lat) {
    const container = document.getElementById('rsp-street-view');
    if (!container) return;

    const result = await this._mapillary.nearest(lat, lon);

    if (!result) {
      container.innerHTML = `<div class="rsp-street-none">NO STREET IMAGERY AVAILABLE</div>`;
      return;
    }

    if (result.noToken || !result.thumbUrl) {
      container.innerHTML = `
        <div class="rsp-street-link">
          <div class="rsp-street-none">⚠ MAPILLARY TOKEN NOT CONFIGURED</div>
          <a href="${result.url}" target="_blank" rel="noopener" class="rsp-street-open-btn">
            ↗ OPEN IN MAPILLARY
          </a>
          <div class="rsp-intel-hint">Add VITE_MAPILLARY_TOKEN to .env for embedded imagery</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="rsp-street-img-wrap">
        <img
          src="${result.thumbUrl}"
          alt="Street view"
          class="rsp-street-img"
          onload="this.classList.add('loaded')"
        />
        <div class="rsp-street-meta">
          <span class="rsp-street-angle">HDG ${Math.round(result.angle)}°</span>
          <a href="${result.url}" target="_blank" rel="noopener" class="rsp-street-open">↗</a>
        </div>
        <div class="rsp-street-scan"></div>
      </div>
    `;
  }

  _switchToIntelTab() {
    // Click the INTEL tab button in the existing UI
    const tabs = document.querySelectorAll('.wv-right-tabs button');
    tabs.forEach(btn => {
      if (btn.dataset.tab === 'intel') btn.click();
    });
  }

  hide() {
    if (!this._panel) return;
    this._panel.innerHTML = `<div id="wv-detail-panel"></div>`;
    this._visible = false;
    // Switch back to OPS tab
    const tabs = document.querySelectorAll('.wv-right-tabs button');
    tabs.forEach(btn => {
      if (btn.dataset.tab === 'controls') btn.click();
    });
  }

  get visible() { return this._visible; }
}
