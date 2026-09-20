import { cctvProxiedFeedUrl } from '../worldview/cctvFeed.js';
import {
  countCountries,
  fetchOpenEagleEyeCatalog,
} from './globalCctv.js';

/** Small worldwide fallback if registry fetch fails. */
export const CCTV_CATALOG = [
  {
    id: 'oee-tfl-00001.09731',
    country: 'GB',
    city: 'London',
    label: 'A1 Barnet Wy / Barnet Ln',
    lon: -0.25442,
    lat: 51.6433,
    feedUrl:
      'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.09731.jpg',
    source: 'TfL London',
  },
  {
    id: 'cam-674',
    cameraId: '674',
    country: 'US',
    city: 'Austin',
    label: 'Cesar Chavez St / I-35 SVRD',
    lon: -97.735786,
    lat: 30.260996,
    source: 'City of Austin Mobility',
    austin: true,
  },
].map(enrichCamera);

export function enrichCamera(cam) {
  let feedUrl = cam.feedUrl || cam.url || null;
  if (cam.austin && cam.cameraId) {
    feedUrl = cctvProxiedFeedUrl(cam.cameraId);
  }
  return {
    ...cam,
    feedUrl,
    snapshotUrl: feedUrl,
    pageUrl:
      cam.pageUrl ||
      (cam.austin
        ? 'https://data.mobility.austin.gov/traffic-cameras'
        : cam.feedUrl),
  };
}

async function fetchAustinSupplement() {
  try {
    const res = await fetch(
      '/austin-data/resource/b4k4-adkb.json?$limit=120&$where=camera_status%3D%27TURNED_ON%27'
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return rows
      .map((row) => {
        const loc = row.location?.coordinates;
        const lon = loc?.[0];
        const lat = loc?.[1];
        const cameraId = String(row.camera_id || '').trim();
        if (!cameraId || lon == null || lat == null) return null;
        return enrichCamera({
          id: `atx-${cameraId}`,
          cameraId,
          country: 'US',
          city: 'Austin',
          label: (row.location_name || `Camera ${cameraId}`).trim(),
          lon: Number(lon),
          lat: Number(lat),
          heading: 180,
          pitch: -10,
          fov: 45,
          rangeM: 600,
          source: 'Austin open data',
          austin: true,
          status: row.camera_status,
        });
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Worldwide mesh: Open Eagle Eye + Austin proxy feeds where applicable. */
export async function fetchWorldCctvCatalog(onProgress) {
  try {
    const global = await fetchOpenEagleEyeCatalog(onProgress);
    const austin = await fetchAustinSupplement();
    const byKey = new Map();

    for (const cam of global) {
      byKey.set(cam.id, cam);
    }
    for (const cam of austin) {
      byKey.set(cam.id, cam);
    }

    const merged = [...byKey.values()];
    const nCountries = countCountries(merged);
    onProgress?.(
      `CCTV mesh · ${merged.length} nodes · ${nCountries} countries`
    );
    return { cameras: merged, countries: nCountries };
  } catch (e) {
    console.warn('World CCTV load failed:', e);
    onProgress?.('CCTV fallback catalog');
    return { cameras: CCTV_CATALOG, countries: countCountries(CCTV_CATALOG) };
  }
}

/** @deprecated use fetchWorldCctvCatalog */
export async function fetchAustinOpenData() {
  const { cameras } = await fetchWorldCctvCatalog();
  return cameras;
}
