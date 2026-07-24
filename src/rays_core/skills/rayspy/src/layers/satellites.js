import * as satellite from 'satellite.js';
import * as Cesium from 'cesium';

export const CELESTRAK_GROUPS = [
  { id: 'stations', label: 'Stations', color: Cesium.Color.RED },
  { id: 'weather', label: 'Weather', color: Cesium.Color.CYAN },
  { id: 'gps-ops', label: 'GPS', color: Cesium.Color.LIME },
  { id: 'galileo', label: 'Galileo', color: Cesium.Color.ORANGE },
  { id: 'visual', label: 'Visual', color: Cesium.Color.YELLOW },
  { id: 'science', label: 'Science', color: Cesium.Color.MAGENTA },
];

const ORBIT_SAMPLES = 120;
const MAX_PER_GROUP = 250;
const MAX_STARLINK = 200;
const PANOPTIC_CAP = 180;

export function parseTleCatalog(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const line1 = lines[i]?.trim();
    if (!line1?.startsWith('1 ')) continue;
    const line2 = lines[i + 1]?.trim();
    if (!line2?.startsWith('2 ')) continue;
    const name = (lines[i - 1]?.trim() || `NORAD ${line1.slice(2, 7)}`).replace(
      /^0 /,
      ''
    );
    results.push({ name, line1, line2 });
    i += 1;
  }
  return results;
}

export async function fetchTleGroup(groupId) {
  const url = `/celestrak/NORAD/elements/gp.php?GROUP=${encodeURIComponent(groupId)}&FORMAT=tle`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CelesTrak ${groupId}: HTTP ${res.status}`);
  return parseTleCatalog(await res.text());
}

function orbitalPeriodMinutes(satrec) {
  return (2 * Math.PI) / satrec.no;
}

function positionAt(satrec, date) {
  const pv = satellite.propagate(satrec, date);
  if (!pv?.position) return null;
  const gmst = satellite.gstime(date);
  const gd = satellite.eciToGeodetic(pv.position, gmst);
  if (!Number.isFinite(gd.latitude) || !Number.isFinite(gd.longitude)) {
    return null;
  }
  return Cesium.Cartesian3.fromRadians(
    gd.longitude,
    gd.latitude,
    (gd.height ?? 0) * 1000
  );
}

function sampleOrbitPath(satrec, startDate) {
  const periodMin = orbitalPeriodMinutes(satrec);
  const stepMin = periodMin / ORBIT_SAMPLES;
  const positions = [];
  for (let i = 0; i <= ORBIT_SAMPLES; i++) {
    const t = new Date(startDate.getTime() + i * stepMin * 60 * 1000);
    const pos = positionAt(satrec, t);
    if (pos) positions.push(pos);
  }
  return positions;
}

function noradId(line1) {
  return line1.slice(2, 7).trim();
}

export class SatelliteLayer {
  constructor(viewer) {
    this.viewer = viewer;
    this.dataSource = new Cesium.CustomDataSource('satellites');
    this.pathSource = new Cesium.CustomDataSource('satellite-path');
    viewer.dataSources.add(this.dataSource);
    viewer.dataSources.add(this.pathSource);
    this.entries = [];
    this.visible = false;
    this.panoptic = false;
    this.selectedNorad = null;
    this._tickListener = null;
    this._loaded = false;
  }

  async load(options = {}) {
    const {
      groups = CELESTRAK_GROUPS.map((g) => g.id),
      includeStarlink = false,
      onProgress,
    } = options;

    const groupColors = Object.fromEntries(
      CELESTRAK_GROUPS.map((g) => [g.id, g.color])
    );
    const seen = new Set();
    const catalog = [];
    const ids = [...groups];
    if (includeStarlink) ids.push('starlink');

    for (let i = 0; i < ids.length; i++) {
      const groupId = ids[i];
      onProgress?.(`TLE: ${groupId}`);
      try {
        let items = await fetchTleGroup(groupId);
        const cap = groupId === 'starlink' ? MAX_STARLINK : MAX_PER_GROUP;
        if (items.length > cap) items = items.slice(0, cap);
        for (const item of items) {
          const id = noradId(item.line1);
          if (seen.has(id)) continue;
          seen.add(id);
          catalog.push({ ...item, groupId, noradId: id });
        }
      } catch (e) {
        console.warn(`TLE group ${groupId}:`, e);
      }
    }

    this.clearEntities();
    const startDate = Cesium.JulianDate.toDate(this.viewer.clock.currentTime);
    let added = 0;

    for (const item of catalog) {
      let satrec;
      try {
        satrec = satellite.twoline2satrec(item.line1, item.line2);
      } catch {
        continue;
      }
      if (!satrec?.no) continue;

      const initialPos = positionAt(satrec, startDate);
      if (!initialPos) continue;

      const color =
        groupColors[item.groupId] ?? Cesium.Color.YELLOW.withAlpha(0.9);
      const pathPositions = sampleOrbitPath(satrec, startDate);
      const displayId = `SAT-${item.noradId}`;

      const entity = this.dataSource.entities.add({
        id: `sat-${item.noradId}`,
        name: item.name,
        description: `${item.name} | NORAD ${item.noradId} | ${Math.round(Cesium.Cartographic.fromCartesian(initialPos).height / 1000)} km`,
        position: new Cesium.ConstantPositionProperty(initialPos),
        point: {
          pixelSize: 6,
          color,
          outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
          outlineWidth: 1,
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.2, 2e7, 0.4),
        },
        label: {
          text: displayId,
          font: '11px Share Tech Mono, monospace',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          show: false,
        },
      });

      this.entries.push({
        name: item.name,
        noradId: item.noradId,
        groupId: item.groupId,
        displayId,
        satrec,
        entity,
        color,
        pathPositions,
      });
      added++;
    }

    this._loaded = true;
    this._attachClock();
    this._applyPanopticLabels();
    return added;
  }

  _attachClock() {
    if (this._tickListener) return;
    this.viewer.clock.shouldAnimate = true;
    if (this.viewer.clock.multiplier < 10) {
      this.viewer.clock.multiplier = 60;
    }
    this._tickListener = () => {
      if (!this.visible || !this.entries.length) return;
      const date = Cesium.JulianDate.toDate(this.viewer.clock.currentTime);
      for (const entry of this.entries) {
        const pos = positionAt(entry.satrec, date);
        if (pos) entry.entity.position.setValue(pos);
      }
    };
    this.viewer.clock.onTick.addEventListener(this._tickListener);
  }

  _hideAllPaths() {
    this.pathSource.entities.removeAll();
    for (const entry of this.entries) {
      if (entry.entity.point) {
        entry.entity.point.pixelSize = this.panoptic ? 4 : 6;
        entry.entity.point.color = entry.color;
      }
      if (entry.entity.label) entry.entity.label.show = false;
    }
  }

  select(noradId) {
    this.selectedNorad = noradId;
    this._hideAllPaths();
    const entry = this.entries.find((e) => e.noradId === noradId);
    if (!entry || entry.pathPositions.length < 2) return null;

    this.pathSource.entities.add({
      id: `sat-path-${noradId}`,
      polyline: {
        positions: entry.pathPositions,
        width: 4,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: entry.color.withAlpha(0.95),
        }),
        arcType: Cesium.ArcType.NONE,
      },
    });
    if (entry.entity.point) {
      entry.entity.point.pixelSize = 10;
      entry.entity.point.color = Cesium.Color.WHITE;
    }
    if (entry.entity.label) entry.entity.label.show = true;

    return this.getDetails(noradId);
  }

  getDetails(noradId) {
    const entry = this.entries.find((e) => e.noradId === noradId);
    if (!entry) return null;
    const date = Cesium.JulianDate.toDate(this.viewer.clock.currentTime);
    const pos = positionAt(entry.satrec, date);
    if (!pos) return null;
    const carto = Cesium.Cartographic.fromCartesian(pos);
    const altKm = Math.round(carto.height / 1000);
    const periodMin = Math.round(orbitalPeriodMinutes(entry.satrec));
    const vel = satellite.propagate(entry.satrec, date)?.velocity;
    let speedKms = '—';
    if (vel) {
      const v = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
      speedKms = `${v.toFixed(2)} km/s`;
    }

    return {
      type: 'satellite',
      typeLabel: 'SATELLITE',
      title: entry.name,
      subtitle: `${entry.displayId} · CelesTrak TLE`,
      hudTag: `${entry.displayId} • ${altKm} km`,
      trackEntity: entry.entity,
      fields: [
        ['NORAD ID', entry.noradId],
        ['Catalog ID', entry.displayId],
        ['Altitude', `${altKm} km`],
        ['Orbital period', `~${periodMin} min`],
        ['Speed (ECI)', speedKms],
        ['Latitude', Cesium.Math.toDegrees(carto.latitude).toFixed(3) + '°'],
        ['Longitude', Cesium.Math.toDegrees(carto.longitude).toFixed(3) + '°'],
        ['Group', entry.groupId || '—'],
      ],
      notes:
        'Position propagated with SGP4 from CelesTrak two-line elements. Clock ×60 for animation.',
      noradId: entry.noradId,
    };
  }

  clearSelection() {
    this.selectedNorad = null;
    this._hideAllPaths();
    this._applyPanopticLabels();
  }

  setPanoptic(on) {
    this.panoptic = on;
    this._applyPanopticLabels();
  }

  _applyPanopticLabels() {
    const showLabels = this.panoptic && !this.selectedNorad;
    const limit = PANOPTIC_CAP;
    this.entries.forEach((entry, i) => {
      if (!entry.entity.label) return;
      entry.entity.label.show =
        showLabels && i < limit && !this.selectedNorad;
    });
  }

  clearEntities() {
    this.dataSource.entities.removeAll();
    this.entries = [];
    this.selectedNorad = null;
  }

  setVisible(show) {
    this.visible = show;
    this.dataSource.show = show;
    this.pathSource.show = show;
    if (!show) this.clearSelection();
  }

  destroy() {
    if (this._tickListener) {
      this.viewer.clock.onTick.removeEventListener(this._tickListener);
    }
    this.viewer.dataSources.remove(this.dataSource, true);
    this.viewer.dataSources.remove(this.pathSource, true);
  }

  get count() {
    return this.entries.length;
  }

  get loaded() {
    return this._loaded;
  }
}
