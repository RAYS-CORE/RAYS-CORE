/**
 * Finds nearby Mapillary images for a lat/lon without requiring an API key
 * by using the public tile/coverage endpoint.
 * Falls back to a deep-link if no key is configured.
 */

const MAPILLARY_API = 'https://graph.mapillary.com';

export class MapillaryProvider {
  constructor(accessToken = null) {
    this._token = accessToken || import.meta.env?.VITE_MAPILLARY_TOKEN || null;
  }

  /**
   * Find the nearest image to a lat/lon within radiusM metres.
   * Returns { imageId, thumbUrl, lat, lon, angle, url } or null.
   */
  async nearest(lat, lon, radiusM = 100) {
    if (!this._token) {
      // No token — return a deep-link to Mapillary web viewer
      return {
        imageId: null,
        thumbUrl: null,
        lat, lon,
        angle: 0,
        url: `https://www.mapillary.com/app/?lat=${lat}&lng=${lon}&z=17`,
        noToken: true,
      };
    }

    try {
      const url = `${MAPILLARY_API}/images?access_token=${this._token}` +
        `&fields=id,thumb_256_url,geometry,compass_angle` +
        `&closeto=${lon},${lat}&radius=${radiusM}&limit=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) throw new Error(`Mapillary ${res.status}`);
      const data = await res.json();
      const img  = data?.data?.[0];
      if (!img) return null;
      return {
        imageId: img.id,
        thumbUrl: img.thumb_256_url,
        lat:  img.geometry?.coordinates?.[1] ?? lat,
        lon:  img.geometry?.coordinates?.[0] ?? lon,
        angle: img.compass_angle ?? 0,
        url: `https://www.mapillary.com/app/?pKey=${img.id}&focus=photo`,
        noToken: false,
      };
    } catch (e) {
      console.warn('[MapillaryProvider]', e.message);
      return {
        imageId: null, thumbUrl: null, lat, lon, angle: 0,
        url: `https://www.mapillary.com/app/?lat=${lat}&lng=${lon}&z=17`,
        noToken: true,
      };
    }
  }
}
