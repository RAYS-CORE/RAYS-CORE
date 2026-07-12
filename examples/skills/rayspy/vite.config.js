import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium/')
  },
  server: {
    proxy: {
      '/geocode': {
        target: 'http://localhost:5176',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/geocode/, '/geocode'),
      },
      '/rayspy-mcp': {
        target: 'http://localhost:5176',
        changeOrigin: true,
      },
      '/cam-proxy': {
        target: 'http://localhost:5176',
        changeOrigin: true,
      },
      '/celestrak': {
        target: 'https://celestrak.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/celestrak/, ''),
      },
      '/opensky': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/opensky/, ''),
      },
      '/adsb': {
        target: 'https://api.adsb.lol',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/adsb/, ''),
        timeout: 25000,
      },
      '/adsb-fi': {
        target: 'https://opendata.adsb.fi/api',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/adsb-fi/, ''),
        timeout: 25000,
      },
      '/austin-data': {
        target: 'https://data.austintexas.gov',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/austin-data/, ''),
      },
      '/cctv': {
        target: 'https://cctv.austinmobility.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/cctv/, ''),
        headers: {
          Referer: 'https://data.mobility.austin.gov/',
        },
      },
      '/openeagle': {
        target: 'https://raw.githubusercontent.com/stuchapin909/Open-Eagle-Eye/master',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/openeagle/, ''),
      },
    },
  },
});
