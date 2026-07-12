import * as Cesium from 'cesium';

const USGS_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';

export class EarthquakeLayer {
  constructor(viewer) {
    this.viewer = viewer;
    this.dataSource = new Cesium.CustomDataSource('earthquakes');
    viewer.dataSources.add(this.dataSource);
    this.visible = false;
  }

  async enable() {
    this.setVisible(true);
    const res = await fetch(USGS_URL);
    if (!res.ok) throw new Error(`USGS ${res.status}`);
    const geo = await res.json();
    this.dataSource.entities.removeAll();

    for (const f of geo.features || []) {
      const [lon, lat] = f.geometry?.coordinates || [];
      const mag = f.properties?.mag ?? 0;
      if (lat == null || lon == null) continue;
      const size = Math.max(6, Math.min(18, mag * 3));
      this.dataSource.entities.add({
        id: `eq-${f.id}`,
        name: f.properties?.title || 'Earthquake',
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
        point: {
          pixelSize: size,
          color: mag >= 5 ? Cesium.Color.RED : Cesium.Color.ORANGE,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.6),
          outlineWidth: 1,
        },
      });
    }
  }

  disable() {
    this.setVisible(false);
    this.dataSource.entities.removeAll();
  }

  setVisible(show) {
    this.visible = show;
    this.dataSource.show = show;
  }

  get count() {
    return this.dataSource.entities.values.length;
  }
}
