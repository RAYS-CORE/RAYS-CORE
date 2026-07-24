import * as Cesium from 'cesium';
import { CCTV_CATALOG, fetchWorldCctvCatalog } from '../data/cctvCatalog.js';

function destinationPoint(lon, lat, headingDeg, distanceM) {
  const R = 6371000;
  const brng = Cesium.Math.toRadians(headingDeg);
  const lat1 = Cesium.Math.toRadians(lat);
  const lon1 = Cesium.Math.toRadians(lon);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceM / R) +
      Math.cos(lat1) * Math.sin(distanceM / R) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distanceM / R) * Math.cos(lat1),
      Math.cos(distanceM / R) - Math.sin(lat1) * Math.sin(lat2)
    );
  return {
    lon: Cesium.Math.toDegrees(lon2),
    lat: Cesium.Math.toDegrees(lat2),
  };
}

function normalizeGeo(cam) {
  let lon = Number(cam.lon);
  let lat = Number(cam.lat);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (Math.abs(lon) <= 90 && Math.abs(lat) > 90) {
    [lon, lat] = [lat, lon];
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lon, lat };
}

function entityKey(cam) {
  return `cctv-${String(cam.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function fixedGroundPosition(lon, lat, height = 2) {
  return new Cesium.ConstantPositionProperty(
    Cesium.Cartesian3.fromDegrees(lon, lat, height)
  );
}

function buildCalibration(cam, overrides = {}) {
  return {
    heading: overrides.heading ?? cam.heading ?? 0,
    pitch: overrides.pitch ?? cam.pitch ?? -10,
    fov: overrides.fov ?? cam.fov ?? 45,
    range: overrides.range ?? cam.rangeM ?? 600,
    height: overrides.height ?? 120,
  };
}

export class CctvLayer {
  constructor(viewer) {
    this.viewer = viewer;
    this.dataSource = new Cesium.CustomDataSource('cctv-mesh');
    this.coverageSource = new Cesium.CustomDataSource('cctv-coverage');
    viewer.dataSources.add(this.dataSource);
    viewer.dataSources.add(this.coverageSource);
    this.cameras = [];
    this._entityByCamId = new Map();
    this.visible = false;
    this.showCoverage = true;
    this.showFovWedges = true;
    this.showProjection = false;
    this.selectedId = null;
    this.index = 0;
    this.calibration = {};
    this.countryCount = 0;
    this._fovWedgeIds = [];
  }

  async load(onProgress) {
    const { cameras, countries } = await fetchWorldCctvCatalog(onProgress);
    this.cameras = cameras.length ? cameras : CCTV_CATALOG;
    this.countryCount = countries;
    this._buildEntities();
    return this.cameras.length;
  }

  _buildEntities() {
    this.dataSource.entities.removeAll();
    this.coverageSource.entities.removeAll();
    this._entityByCamId.clear();
    this._fovWedgeIds = [];

    for (const cam of this.cameras) {
      const geo = normalizeGeo(cam);
      if (!geo) continue;

      const eid = entityKey(cam);
      const entity = this.dataSource.entities.add({
        id: eid,
        name: cam.label,
        position: fixedGroundPosition(geo.lon, geo.lat, 2),
        point: {
          pixelSize: 7,
          color: Cesium.Color.LIME,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scaleByDistance: new Cesium.NearFarScalar(5e3, 1.2, 2e7, 0.4),
        },
        label: {
          text: `${cam.country || '??'}-${(cam.cameraId || cam.id).slice(-6)}`,
          font: '10px Share Tech Mono, monospace',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0,
            1_200_000
          ),
          show: false,
        },
      });

      this._entityByCamId.set(cam.id, entity);
      this._addFovWedge(cam, geo);
    }
  }

  /**
   * Small always-on FOV wedge for every camera (not just the selected one).
   * Uses cam.heading/cam.fov/cam.rangeM if the source provided them, else
   * falls back to a short, generic forward-facing wedge so every camera
   * still shows *something* even without known orientation metadata.
   * Hidden by default (showFovWedges = false) since hundreds of polygons
   * rendering globally is expensive — toggle on via setShowFovWedges(true).
   */
  _addFovWedge(cam, geo) {
    const heading = cam.heading ?? 0;
    const fov     = cam.fov ?? 60;
    // Larger, more visible ambient indicator — was capped at 80m (invisible
    // at any normal city-zoom altitude); now scales with declared range but
    // has a much higher visible floor.
    const range   = Math.max(Math.min(cam.rangeM ?? 220, 400), 150);
    const half = fov / 2;
    const positions = [Cesium.Cartesian3.fromDegrees(geo.lon, geo.lat, 1.5)];

    for (let i = 0; i <= 16; i++) {
      const h = heading - half + (fov * i) / 16;
      const p = destinationPoint(geo.lon, geo.lat, h, range);
      positions.push(Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 1.5));
    }
    positions.push(Cesium.Cartesian3.fromDegrees(geo.lon, geo.lat, 1.5));

    const wedgeId = `cctv-fov-${entityKey(cam).replace('cctv-', '')}`;
    const wedge = this.dataSource.entities.add({
      id: wedgeId,
      show: this.showFovWedges,
      position: fixedGroundPosition(geo.lon, geo.lat, 0),
      polygon: {
        hierarchy: positions,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        material: Cesium.Color.LIME.withAlpha(0.28),
        outline: true,
        outlineColor: Cesium.Color.LIME.withAlpha(0.85),
        outlineWidth: 2,
        classificationType: Cesium.ClassificationType.BOTH,
        // Only render when reasonably close — avoids thousands of wedges
        // cluttering a world-scale view, but keeps them visible at any
        // normal city/neighborhood zoom level.
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 80_000),
      },
    });
    this._fovWedgeIds.push(wedgeId);
  }

  _highlightSelection() {
    for (const [camId, entity] of this._entityByCamId) {
      const selected = camId === this.selectedId;
      if (entity.point) {
        entity.point.pixelSize = selected ? 11 : 7;
        entity.point.color = selected
          ? Cesium.Color.WHITE
          : Cesium.Color.LIME;
      }
      if (entity.label) {
        entity.label.show = selected;
      }
    }
  }

  _coverageHierarchy(cam, cal) {
    const geo = normalizeGeo(cam);
    if (!geo) return null;

    const half = cal.fov / 2;
    const positions = [];

    for (let i = 0; i <= 24; i++) {
      const h = cal.heading - half + (cal.fov * i) / 24;
      const p = destinationPoint(geo.lon, geo.lat, h, cal.range);
      positions.push(
        Cesium.Cartographic.fromDegrees(p.lon, p.lat)
      );
    }
    positions.push(Cesium.Cartographic.fromDegrees(geo.lon, geo.lat));

    return positions;
  }

  async _rebuildCoverage(cam) {
    const cal = buildCalibration(cam, this.calibration[cam.id]);
    const hierarchy = this._coverageHierarchy(cam, cal);
    const geo = normalizeGeo(cam);
    if (!hierarchy || !geo) return;

    const id = `cctv-cov-${entityKey(cam).replace('cctv-', '')}`;
    const existing = this.coverageSource.entities.getById(id);
    if (existing) this.coverageSource.entities.remove(existing);

    if (!this.showCoverage || this.selectedId !== cam.id) return;

    let worldPositions = hierarchy.map((c) =>
      Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, 0)
    );

    const terrain = this.viewer.terrainProvider;
    if (!(terrain instanceof Cesium.EllipsoidTerrainProvider)) {
      try {
        const sampled = await Cesium.sampleTerrainMostDetailed(
          terrain,
          hierarchy
        );
        worldPositions = sampled.map((c) =>
          Cesium.Cartesian3.fromRadians(
            c.longitude,
            c.latitude,
            (c.height ?? 0) + 2
          )
        );
      } catch {
        /* keep ellipsoid heights */
      }
    }

    const apex = Cesium.Cartesian3.fromDegrees(
      geo.lon,
      geo.lat,
      cal.height
    );

    this.coverageSource.entities.add({
      id,
      position: fixedGroundPosition(geo.lon, geo.lat, 0),
      polygon: {
        hierarchy: worldPositions,
        perPositionHeight: true,
        heightReference: Cesium.HeightReference.NONE,
        material: Cesium.Color.LIME.withAlpha(0.35),
        outline: true,
        outlineColor: Cesium.Color.LIME.withAlpha(0.85),
        outlineWidth: 1,
        classificationType: Cesium.ClassificationType.BOTH,
      },
      polyline: {
        positions: [apex, worldPositions[0], apex, worldPositions[12]],
        width: 1,
        arcType: Cesium.ArcType.NONE,
        material: Cesium.Color.LIME.withAlpha(0.7),
      },
    });
  }

  _refreshAllCoverage() {
    this.coverageSource.entities.removeAll();
    if (!this.showCoverage || !this.selectedId) return;
    const cam = this.cameras.find((c) => c.id === this.selectedId);
    if (cam) this._rebuildCoverage(cam);
  }

  select(id) {
    this.selectedId = id;
    this.index = Math.max(
      0,
      this.cameras.findIndex((c) => c.id === id)
    );
    this._highlightSelection();
    this._refreshAllCoverage();
    return this.getDetails(id);
  }

  clearSelection() {
    this.selectedId = null;
    this._highlightSelection();
    this._refreshAllCoverage();
  }

  setCalibration(id, patch) {
    this.calibration[id] = { ...this.calibration[id], ...patch };
    const cam = this.cameras.find((c) => c.id === id);
    if (cam && this.selectedId === id) this._rebuildCoverage(cam);
  }

  setShowCoverage(on) {
    this.showCoverage = on;
    this._refreshAllCoverage();
  }

  /** Toggle the lightweight always-on FOV wedge shown for every camera. */
  setShowFovWedges(on) {
    this.showFovWedges = on;
    for (const id of this._fovWedgeIds) {
      const e = this.dataSource.entities.getById(id);
      if (e) e.show = on;
    }
  }

  setShowProjection(on) {
    this.showProjection = on;
  }

  /** Re-clamp entity positions after terrain tiles load. */
  async reclampToTerrain() {
    const terrain = this.viewer.terrainProvider;
    if (terrain instanceof Cesium.EllipsoidTerrainProvider) return;

    const cartographics = [];
    const cams = [];
    for (const cam of this.cameras) {
      const geo = normalizeGeo(cam);
      if (!geo) continue;
      cartographics.push(Cesium.Cartographic.fromDegrees(geo.lon, geo.lat));
      cams.push(cam);
    }

    try {
      const sampled = await Cesium.sampleTerrainMostDetailed(
        terrain,
        cartographics
      );
      sampled.forEach((c, i) => {
        const entity = this._entityByCamId.get(cams[i].id);
        if (!entity?.position) return;
        entity.position = new Cesium.ConstantPositionProperty(
          Cesium.Cartesian3.fromRadians(
            c.longitude,
            c.latitude,
            (c.height ?? 0) + 2
          )
        );
      });
      if (this.selectedId) {
        const cam = this.cameras.find((c) => c.id === this.selectedId);
        if (cam) await this._rebuildCoverage(cam);
      }
    } catch (e) {
      console.warn('CCTV terrain reclamp:', e);
    }
  }

  resolveCamIdFromEntityId(entityId) {
    if (!entityId || !String(entityId).startsWith('cctv-')) return null;
    for (const cam of this.cameras) {
      if (entityKey(cam) === entityId) return cam.id;
    }
    return null;
  }

  selectNearest(viewer) {
    const carto = viewer.camera.positionCartographic;
    const here = Cesium.Cartesian3.fromRadians(
      carto.longitude,
      carto.latitude,
      carto.height
    );
    let best = null;
    let bestD = Infinity;
    for (const cam of this.cameras) {
      const geo = normalizeGeo(cam);
      if (!geo) continue;
      const p = Cesium.Cartesian3.fromDegrees(geo.lon, geo.lat, 0);
      const d = Cesium.Cartesian3.distance(here, p);
      if (d < bestD) {
        bestD = d;
        best = cam;
      }
    }
    if (best) return this.select(best.id);
    return null;
  }

  selectPrev() {
    if (!this.cameras.length) return null;
    this.index = (this.index - 1 + this.cameras.length) % this.cameras.length;
    return this.select(this.cameras[this.index].id);
  }

  selectNext() {
    if (!this.cameras.length) return null;
    this.index = (this.index + 1) % this.cameras.length;
    return this.select(this.cameras[this.index].id);
  }

  getDetails(id) {
    const cam = this.cameras.find((c) => c.id === id);
    if (!cam) return null;
    const cal = buildCalibration(cam, this.calibration[id]);
    const geo = normalizeGeo(cam);
    return {
      type: 'cctv',
      title: cam.label,
      subtitle: `${cam.city}, ${cam.country || '—'} · ${cam.source}`,
      hudTag: `${cam.label} • ${cam.city}`,
      trackEntity: this._entityByCamId.get(id) ?? null,
      fields: [
        ['Node', cam.id],
        ['Country', cam.country || '—'],
        ['City', cam.city],
        ['Category', cam.category || '—'],
        ['Lat', geo ? geo.lat.toFixed(5) : '—'],
        ['Lon', geo ? geo.lon.toFixed(5) : '—'],
        ['Heading', `${cal.heading.toFixed(1)}°`],
        ['Pitch', `${cal.pitch.toFixed(1)}°`],
        ['FOV', `${cal.fov.toFixed(1)}°`],
        ['Range', `${cal.range.toFixed(0)} m`],
        ['Height', `${cal.height.toFixed(0)} m`],
      ],
      feedUrl: cam.feedUrl,
      snapshotUrl: cam.feedUrl || cam.snapshotUrl,
      pageUrl: cam.pageUrl,
      cameraId: cam.cameraId,
      camera: cam,
      calibration: cal,
    };
  }

  setVisible(show) {
    this.visible = show;
    this.dataSource.show = show;
    this.coverageSource.show = show;
    if (!show) this.clearSelection();
  }

  get count() {
    return this.cameras.length;
  }
}
