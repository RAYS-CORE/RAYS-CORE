/** Near-live CCTV via Austin Mobility snapshot URLs (refreshed every ~2s). */
export function cctvProxiedFeedUrl(cameraId) {
  if (!cameraId) return null;
  return `/cctv/image/${cameraId}.jpg`;
}

export class CctvFeedPlayer {
  constructor(container) {
    this.container = container;
    this._timer = null;
    this._baseUrl = null;
    this._img = null;
  }

  play(baseUrl, { label = '' } = {}) {
    this.stop();
    if (!baseUrl || !this.container) return;

    this._baseUrl = baseUrl;
    this.container.innerHTML = '';
    this.container.classList.add('wv-cctv-feed-active');

    const chrome = document.createElement('div');
    chrome.className = 'wv-cctv-feed-chrome';
    chrome.innerHTML = `<span class="wv-cctv-live-badge">● LIVE</span>
      <span class="wv-cctv-feed-label">${label}</span>`;

    this._img = document.createElement('img');
    this._img.className = 'wv-cctv-feed-img';
    this._img.alt = 'CCTV live feed';
    this._img.referrerPolicy = 'no-referrer';

    this.container.appendChild(chrome);
    this.container.appendChild(this._img);

    this._img.onerror = () => {
      if (this._img.dataset.retried) {
        this._img.alt = 'Feed unavailable — try another camera';
        this._img.classList.add('wv-cctv-feed-error');
        return;
      }
      this._img.dataset.retried = '1';
      if (this._baseUrl.startsWith('http')) {
        this._img.src = `/cam-proxy?url=${encodeURIComponent(this._baseUrl)}&_=${Date.now()}`;
      }
    };

    const tick = () => {
      if (!this._img || !this._baseUrl) return;
      this._img.classList.remove('wv-cctv-feed-error');
      this._img.src = `${this._baseUrl}?_=${Date.now()}`;
    };
    tick();
    this._timer = setInterval(tick, 2000);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._baseUrl = null;
    this._img = null;
    if (this.container) {
      this.container.classList.remove('wv-cctv-feed-active');
      this.container.innerHTML =
        '<span class="wv-cctv-preview-placeholder">Select a triangulation node</span>';
    }
  }
}
