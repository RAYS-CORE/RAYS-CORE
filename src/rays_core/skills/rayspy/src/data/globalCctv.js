/** Worldwide public cameras from Open Eagle Eye registry (direct JPEG URLs). */

const REGISTRY_URL = '/openeagle/cameras.json';
const CACHE_KEY = 'rayspy-world-cctv-v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

const MAX_TOTAL = 2000;
const PER_COUNTRY_CAP = {
  US: 280,
  CA: 90,
  GB: 70,
  HK: 45,
  ZA: 45,
  FI: 40,
  AU: 40,
  NZ: 35,
  BR: 35,
  JP: 35,
  DE: 35,
  FR: 35,
  IT: 30,
  ES: 30,
  NL: 30,
  CH: 30,
  SE: 30,
  NO: 30,
  PL: 30,
  IN: 30,
  SG: 28,
  MX: 28,
  default: 22,
};

function pseudoHeading(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export function mapRegistryCamera(raw) {
  const lat = raw.coordinates?.lat;
  const lon = raw.coordinates?.lng;
  if (lat == null || lon == null || !raw.url) return null;

  const country = (raw.country || 'XX').toUpperCase();
  const city = (raw.city || country).trim();
  const label = (raw.name || raw.location || raw.id).replace(/\s+/g, ' ').trim();

  return {
    id: `oee-${raw.id}`,
    cameraId: raw.id,
    country,
    city,
    label,
    lon: Number(lon),
    lat: Number(lat),
    heading: pseudoHeading(String(raw.id)),
    pitch: -10,
    fov: 45,
    rangeM: 600,
    source: 'Open Eagle Eye',
    category: raw.category || 'traffic',
    feedUrl: raw.url,
    pageUrl: raw.url,
    status: raw.verified ? 'verified' : 'unverified',
  };
}

export function sampleWorldwide(cameras) {
  const eligible = cameras
    .filter(
      (raw) =>
        raw.verified &&
        raw.url &&
        raw.coordinates?.lat != null &&
        raw.coordinates?.lng != null
    )
    .map(mapRegistryCamera)
    .filter(Boolean);

  const byCountry = new Map();
  for (const cam of eligible) {
    const cc = cam.country || 'XX';
    if (!byCountry.has(cc)) byCountry.set(cc, []);
    byCountry.get(cc).push(cam);
  }

  const picked = [];
  const countries = [...byCountry.keys()].sort();

  for (const cc of countries) {
    const list = byCountry.get(cc);
    const cap = PER_COUNTRY_CAP[cc] ?? PER_COUNTRY_CAP.default;
    const take = Math.min(cap, list.length);
    const step = Math.max(1, Math.floor(list.length / take));
    let added = 0;
    for (let i = 0; i < list.length && added < take; i += step) {
      picked.push(list[i]);
      added++;
    }
  }

  picked.sort((a, b) =>
    a.country.localeCompare(b.country) || a.city.localeCompare(b.city)
  );

  return picked.slice(0, MAX_TOTAL);
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, cameras } = JSON.parse(raw);
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return cameras;
  } catch {
    return null;
  }
}

function writeCache(cameras) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: Date.now(), cameras })
    );
  } catch {
    /* quota */
  }
}

export async function fetchOpenEagleEyeCatalog(onProgress) {
  const cached = readCache();
  if (cached?.length) {
    onProgress?.(`CCTV cache · ${cached.length} nodes`);
    return cached;
  }

  onProgress?.('Loading worldwide CCTV registry…');
  const res = await fetch(REGISTRY_URL);
  if (!res.ok) throw new Error(`Open Eagle Eye registry HTTP ${res.status}`);

  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('Invalid registry format');

  onProgress?.(`Sampling ${rows.length.toLocaleString()} public cameras…`);
  const sampled = sampleWorldwide(rows);
  writeCache(sampled);
  return sampled;
}

export function countCountries(cameras) {
  return new Set(cameras.map((c) => c.country)).size;
}
