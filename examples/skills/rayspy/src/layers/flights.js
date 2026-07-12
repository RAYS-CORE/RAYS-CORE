import * as Cesium from 'cesium';
import { PLANE_ICON, PLANE_ICON_MIL } from './flightIcons.js';
import { formatFlightTag } from '../worldview/spyHud.js';

const POLL_MS = 12000;
const MAX_AIRCRAFT = 2500;
const TRAIL_MAX = 80;
const FETCH_TIMEOUT_MS = 22000;

/** Military ADS-B feeds (tried in order). */
const MILITARY_FEEDS = [
  { base: '/adsb', label: 'adsb.lol' },
  { base: '/adsb-fi', label: 'adsb.fi' },
];

const ICAO = 0;
const CALL = 1;
const LON = 6;
const LAT = 5;
const ALT = 7;
const ON_GROUND = 8;
const VELOCITY = 9;
const TRUE_TRACK = 10;
const VERT_RATE = 11;
const ORIGIN = 2;

function altitudeMeters(altFt) {
  return (altFt ?? 0) * 0.3048;
}

export class FlightLayer {
  constructor(viewer, { military = false } = {}) {
    this.viewer = viewer;
    this.military = military;
    this.dataSource = new Cesium.CustomDataSource(
      military ? 'military-flights' : 'live-flights'
    );
    this.pathSource = new Cesium.CustomDataSource(
      military ? 'military-flight-paths' : 'live-flight-paths'
    );
    viewer.dataSources.add(this.dataSource);
    viewer.dataSources.add(this.pathSource);
    this.byIcao = new Map();
    this.visible = false;
    this.selectedIcao = null;
    this._pathEntity = null;
    this._pollTimer = null;
    this._milFeedBase = '/adsb';
    this._milFeedLabel = 'adsb.lol';
    this.lastError = null;
    this.color = military
      ? Cesium.Color.fromCssColorString('#ffb347')
      : Cesium.Color.fromCssColorString('#7df9c6');
  }

  async enable() {
    this.dataSource.show = true;
    this.pathSource.show = true;
    this.visible = true;
    if (this._pollTimer) return;
    await this.refresh();
    this._pollTimer = setInterval(() => this.refresh(), POLL_MS);
  }

  disable() {
    this.visible = false;
    this.dataSource.show = false;
    this.pathSource.show = false;
    this.clearSelection();
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  async refresh() {
    if (!this.visible) return;
    try {
      const states = this.military
        ? await this._fetchMilitary()
        : await this._fetchOpenSky();
      this._syncEntities(states);
      if (this.military) {
        this.lastError = null;
      }
    } catch (e) {
      this.lastError = e;
      console.warn(
        `${this.military ? 'Military' : 'Flight'} refresh failed:`,
        e.message || e
      );
      if (this.military && this.byIcao.size === 0) {
        throw e;
      }
    }
  }

  async _fetchJson(url) {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async _fetchOpenSky() {
    const res = await fetch('http://localhost:5176/opensky/api/states/all');
    if (!res.ok) throw new Error(`OpenSky ${res.status}`);
    const json = await res.json();
    return this._parseStates(json.states || []);
  }

  _parseMilitaryList(json) {
    const list = json?.ac || json?.aircraft || json;
    if (!Array.isArray(list)) return [];
    return list
      .map((ac) => ({
        icao: (ac.hex || ac.icao || '').toLowerCase(),
        call: (ac.flight || ac.callsign || ac.r || '').trim(),
        lat: ac.lat,
        lon: ac.lon,
        alt: ac.alt_geom ?? ac.alt_baro ?? ac.altitude,
        onGround: ac.alt_geom === 0 || ac.ground,
        trueTrack: ac.track ?? ac.true_track,
        velocity: ac.gs ?? ac.speed,
      }))
      .filter((s) => s.icao && s.lat != null && s.lon != null);
  }

  async _fetchMilitary() {
    let lastErr = null;
    for (const feed of MILITARY_FEEDS) {
      try {
        const json = await this._fetchJson(`${feed.base}/v2/mil`);
        const parsed = this._parseMilitaryList(json);
        this._milFeedBase = feed.base;
        this._milFeedLabel = feed.label;
        return parsed;
      } catch (e) {
        lastErr = e;
        console.warn(`Military feed ${feed.label}:`, e.message || e);
      }
    }
    throw new Error(
      lastErr?.message
        ? `Military feeds unreachable (${lastErr.message})`
        : 'Military feeds unreachable'
    );
  }

  _parseStates(states) {
    const out = [];
    for (const s of states) {
      if (!s || s[LAT] == null || s[LON] == null) continue;
      out.push({
        icao: String(s[ICAO] || '').toLowerCase(),
        call: String(s[CALL] || '').trim(),
        lat: s[LAT],
        lon: s[LON],
        alt: s[ALT],
        onGround: s[ON_GROUND],
        velocity: s[VELOCITY],
        trueTrack: s[TRUE_TRACK],
        vertRate: s[VERT_RATE],
        origin: s[ORIGIN],
      });
    }
    return out;
  }

  _defaultGraphics() {
    return {
      point: {
        pixelSize: 4,
        color: this.color.withAlpha(0.85),
        outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
        outlineWidth: 1,
        scaleByDistance: new Cesium.NearFarScalar(5e4, 1.2, 8e6, 0.35),
      },
    };
  }

  _syncEntities(states) {
    let list = states.filter((s) => !s.onGround && s.alt != null);
    if (list.length > MAX_AIRCRAFT) {
      const step = Math.ceil(list.length / MAX_AIRCRAFT);
      list = list.filter((_, i) => i % step === 0);
    }

    const active = new Set();
    for (const s of list) {
      active.add(s.icao);
      const altM = altitudeMeters(s.alt);
      const pos = Cesium.Cartesian3.fromDegrees(s.lon, s.lat, altM);
      let entry = this.byIcao.get(s.icao);

      if (!entry) {
        const label = s.call || s.icao.toUpperCase();
        const entity = this.dataSource.entities.add({
          id: `flight-${s.icao}`,
          name: label,
          position: new Cesium.ConstantPositionProperty(pos),
          ...this._defaultGraphics(),
        });
        entry = {
          entity,
          call: label,
          icao: s.icao,
          lat: s.lat,
          lon: s.lon,
          alt: s.alt,
          velocity: s.velocity,
          trueTrack: s.trueTrack,
          vertRate: s.vertRate,
          origin: s.origin,
          trail: [],
        };
        this.byIcao.set(s.icao, entry);
      } else {
        const prop = entry.entity.position;
        if (prop?.setValue) prop.setValue(pos);
        else entry.entity.position = new Cesium.ConstantPositionProperty(pos);
        entry.call = s.call || entry.call;
        entry.lat = s.lat;
        entry.lon = s.lon;
        entry.alt = s.alt;
        entry.velocity = s.velocity;
        entry.trueTrack = s.trueTrack;
        entry.vertRate = s.vertRate;
        entry.origin = s.origin;

        if (this.selectedIcao === s.icao) {
          entry.trail.push(Cesium.Cartesian3.clone(pos));
          if (entry.trail.length > TRAIL_MAX) entry.trail.shift();
          this._updateTrailPolyline(entry.trail);
          if (entry.entity.billboard) {
            entry.entity.billboard.rotation = this._headingRotation(entry);
          }
        }
      }

      if (this.selectedIcao !== s.icao) {
        this._applyDefaultAppearance(entry);
      }
    }

    for (const [icao, entry] of this.byIcao) {
      if (!active.has(icao)) {
        this.dataSource.entities.remove(entry.entity);
        this.byIcao.delete(icao);
        if (this.selectedIcao === icao) this.clearSelection();
      }
    }
  }

  _applyDefaultAppearance(entry) {
    const e = entry.entity;
    e.billboard = undefined;
    if (!e.point) {
      Object.assign(e, this._defaultGraphics());
    } else {
      e.point.show = true;
      e.point.pixelSize = 4;
      e.point.color = this.color.withAlpha(0.85);
    }
  }

  _headingRotation(entry) {
    const track = entry.trueTrack;
    if (track == null || !Number.isFinite(track)) return 0;
    return Cesium.Math.toRadians(track);
  }

  _applySelectedAppearance(entry) {
    const e = entry.entity;
    if (e.point) e.point.show = false;

    const icon = this.military ? PLANE_ICON_MIL : PLANE_ICON;
    e.billboard = {
      image: icon,
      width: this.military ? 38 : 30,
      height: this.military ? 38 : 30,
      rotation: this._headingRotation(entry),
      alignedAxis: Cesium.Cartesian3.UNIT_Z,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      scaleByDistance: new Cesium.NearFarScalar(1e4, 1.4, 6e6, 0.45),
    };
  }

  _updateTrailPolyline(positions) {
    if (!positions || positions.length < 2) return;

    if (!this._pathEntity) {
      this._pathEntity = this.pathSource.entities.add({
        id: `flight-path-${this.selectedIcao}`,
        polyline: {
          positions: [...positions],
          width: this.military ? 5 : 4,
          arcType: Cesium.ArcType.GEODESIC,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.35,
            taperPower: 0.5,
            color: this.color.withAlpha(0.95),
          }),
        },
      });
    } else {
      this._pathEntity.polyline.positions = [...positions];
    }
  }

  async select(icao) {
    this.clearSelection();
    this.selectedIcao = icao;
    const entry = this.byIcao.get(icao);
    if (!entry) return null;

    if (!entry.trail?.length) {
      const pos = entry.entity.position.getValue(
        Cesium.JulianDate.now()
      );
      if (pos) entry.trail = [Cesium.Cartesian3.clone(pos)];
    }

    this._applySelectedAppearance(entry);

    const trackPositions = await this._fetchTrack(icao);
    const positions =
      trackPositions.length >= 2 ? trackPositions : entry.trail;

    if (positions.length >= 2) {
      this._updateTrailPolyline(positions);
    } else if (entry.trail.length >= 2) {
      this._updateTrailPolyline(entry.trail);
    }

    return this.getDetails(icao, {
      pathPoints: positions.length,
      entity: entry.entity,
      tag: formatFlightTag(entry, icao),
    });
  }

  getDetails(icao, { pathPoints = 0, entity = null, tag = null } = {}) {
    const entry = this.byIcao.get(icao);
    if (!entry) return null;
    const altFt = Math.round(entry.alt ?? 0);
    const call = entry.call || icao.toUpperCase();
    const spd =
      entry.velocity != null ? `${Math.round(entry.velocity * 1.944)} kt` : '—';
    const hdg =
      entry.trueTrack != null ? `${Math.round(entry.trueTrack)}°` : '—';
    const vr =
      entry.vertRate != null
        ? `${entry.vertRate > 0 ? '+' : ''}${Math.round(entry.vertRate * 196.85)} fpm`
        : '—';

    return {
      type: 'flight',
      typeLabel: this.military ? 'MIL AIR' : 'ADS-B',
      title: call,
      subtitle: `${icao.toUpperCase()} · ${this.military ? 'adsb.lol' : 'OpenSky'}`,
      hudTag: tag || formatFlightTag(entry, icao),
      trackEntity: entity || entry.entity,
      military: this.military,
      fields: [
        ['ICAO24', icao.toUpperCase()],
        ['Callsign', call],
        ['Altitude', `FL${Math.round(altFt / 100)} (${altFt} ft)`],
        ['Ground speed', spd],
        ['Heading', hdg],
        ['Vertical rate', vr],
        ['Latitude', entry.lat?.toFixed(4) ?? '—'],
        ['Longitude', entry.lon?.toFixed(4) ?? '—'],
        ['Origin country', entry.origin || '—'],
        ['Track points', String(pathPoints)],
      ],
      notes: this.military
        ? `Military transponder feed (${this._milFeedLabel}). Not all aircraft are ADS-B equipped.`
        : 'Live state vectors from OpenSky Network. Path from ADS-B trace when available.',
      icao,
    };
  }

  async _fetchTrack(icao) {
    const bases = this.military
      ? [...new Set([this._milFeedBase, ...MILITARY_FEEDS.map((f) => f.base)])]
      : ['/adsb', '/adsb-fi'];

    for (const base of bases) {
      try {
        const data = await this._fetchJson(`${base}/v2/hex/${icao}/trace`);
        const trace = data.trace || data.path || [];
        const positions = [];
        for (const row of trace) {
          if (!Array.isArray(row) || row.length < 3) continue;
          const lat = row[1];
          const lon = row[2];
          const altFt = row[3] ?? 0;
          if (lat == null || lon == null) continue;
          positions.push(
            Cesium.Cartesian3.fromDegrees(lon, lat, altitudeMeters(altFt))
          );
        }
        if (positions.length >= 2) return positions;
      } catch {
        /* try next feed */
      }
    }
    return [];
  }

  clearSelection() {
    if (this._pathEntity) {
      this.pathSource.entities.remove(this._pathEntity);
      this._pathEntity = null;
    }
    if (this.selectedIcao) {
      const entry = this.byIcao.get(this.selectedIcao);
      if (entry) {
        entry.trail = [];
        this._applyDefaultAppearance(entry);
      }
    }
    this.selectedIcao = null;
  }

  setVisible(show) {
    if (!show) this.disable();
    else this.enable();
  }

  get count() {
    return this.byIcao.size;
  }
}
