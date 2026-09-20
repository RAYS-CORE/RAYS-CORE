import * as Cesium from 'cesium';

/**
 * Screen-space spy tag + optional military target reticle, anchored to map picks.
 */
export class SpyHud {
  constructor(viewer, mountEl) {
    this.viewer = viewer;
    this.el = document.createElement('div');
    this.el.className = 'wv-spy-hud-root';
    this.el.innerHTML = `
      <div class="wv-spy-reticle" id="wv-spy-reticle" hidden>
        <span class="wv-reticle-corner wv-rc-tl"></span>
        <span class="wv-reticle-corner wv-rc-tr"></span>
        <span class="wv-reticle-corner wv-rc-bl"></span>
        <span class="wv-reticle-corner wv-rc-br"></span>
      </div>
      <div class="wv-spy-tag" id="wv-spy-tag" hidden></div>
    `;
    mountEl.appendChild(this.el);
    this.reticle = this.el.querySelector('#wv-spy-reticle');
    this.tag = this.el.querySelector('#wv-spy-tag');
    this._target = null;
    this._onPostRender = () => this._update();
    viewer.scene.postRender.addEventListener(this._onPostRender);
  }

  /**
   * @param {Cesium.Entity} entity
   * @param {{ tag: string, military?: boolean }} opts
   */
  track(entity, { tag, military = false }) {
    this._target = { entity, tag, military };
    this.tag.textContent = tag;
    this.tag.hidden = false;
    this.reticle.hidden = !military;
    this.el.classList.toggle('wv-spy-mil', military);
  }

  clear() {
    this._target = null;
    this.tag.hidden = true;
    this.reticle.hidden = true;
    this.el.classList.remove('wv-spy-mil');
  }

  destroy() {
    this.viewer.scene.postRender.removeEventListener(this._onPostRender);
    this.el.remove();
  }

  _update() {
    if (!this._target?.entity?.position) {
      this.tag.hidden = true;
      this.reticle.hidden = true;
      return;
    }

    const time = this.viewer.clock.currentTime;
    const pos = this._target.entity.position.getValue(time);
    if (!pos) {
      this.tag.hidden = true;
      this.reticle.hidden = true;
      return;
    }

    const scene = this.viewer.scene;
    const screen =
      Cesium.SceneTransforms.wgs84ToWindowCoordinates?.(scene, pos) ??
      Cesium.SceneTransforms.worldToWindowCoordinates(scene, pos);

    if (
      !screen ||
      !Number.isFinite(screen.x) ||
      !Number.isFinite(screen.y) ||
      screen.x < 0 ||
      screen.y < 0 ||
      screen.x > this.viewer.canvas.clientWidth ||
      screen.y > this.viewer.canvas.clientHeight
    ) {
      this.tag.hidden = true;
      this.reticle.hidden = true;
      return;
    }

    const { tag, military } = this._target;
    this.tag.hidden = false;
    this.tag.style.left = `${screen.x}px`;
    this.tag.style.top = `${screen.y - (military ? 58 : 48)}px`;

    if (military) {
      this.reticle.hidden = false;
      this.reticle.style.left = `${screen.x}px`;
      this.reticle.style.top = `${screen.y}px`;
    } else {
      this.reticle.hidden = true;
    }
  }
}

export function formatFlightTag(entry, icao) {
  const call = (entry.call || icao).trim().toUpperCase() || icao.toUpperCase();
  const altFt = entry.alt ?? 0;
  const fl = Math.round(altFt / 100);
  const kts =
    entry.velocity != null ? Math.round(entry.velocity * 1.944) : null;
  const parts = [call, `FL${fl}`];
  if (kts != null) parts.push(`${kts} kts`);
  return parts.join(' • ');
}

export function formatSatelliteTag(detail) {
  const alt = detail.fields?.find(([k]) => k === 'Altitude')?.[1] ?? '';
  return `${detail.title} • ${alt}`;
}

export function formatCctvTag(detail) {
  return `${detail.title} • ${detail.camera?.city || detail.subtitle}`;
}
