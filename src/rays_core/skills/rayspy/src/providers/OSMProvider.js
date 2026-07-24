/**
 * Fetches roads and buildings from OpenStreetMap via Overpass API.
 * Returns GeoJSON-style data for rendering.
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export class OSMProvider {
  constructor() {
    this._cache = new Map();
  }

  /**
   * Fetch roads and buildings for a bounding box.
   * @param {number} south
   * @param {number} west
   * @param {number} north
   * @param {number} east
   * @returns {Promise<{roads: any[], buildings: any[]}>}
   */
  async fetchCityData(south, west, north, east) {
    const key = `${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)}`;
    if (this._cache.has(key)) return this._cache.get(key);

    const bbox = `${south},${west},${north},${east}`;
    const query = `
[out:json][timeout:25];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"](${bbox});
  way["building"](${bbox});
);
out body;
>;
out skel qt;
`;
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = await res.json();
      const result = this._parse(json);
      this._cache.set(key, result);
      return result;
    } catch (e) {
      console.warn('[OSMProvider] fetch failed:', e.message);
      return { roads: [], buildings: [] };
    }
  }

  _parse(json) {
    // Build node lookup
    const nodes = {};
    for (const el of json.elements) {
      if (el.type === 'node') nodes[el.id] = [el.lon, el.lat];
    }

    const roads     = [];
    const buildings = [];

    for (const el of json.elements) {
      if (el.type !== 'way' || !el.nodes) continue;
      const coords = el.nodes.map(id => nodes[id]).filter(Boolean);
      if (coords.length < 2) continue;

      if (el.tags?.highway) {
        roads.push({
          id:     el.id,
          type:   el.tags.highway,
          coords, // [[lon,lat], ...]
        });
      } else if (el.tags?.building) {
        buildings.push({
          id:      el.id,
          type:    el.tags.building,
          levels:  parseInt(el.tags['building:levels'] || '3', 10),
          coords,  // polygon ring
        });
      }
    }
    return { roads, buildings };
  }

  clearCache() { this._cache.clear(); }
}
