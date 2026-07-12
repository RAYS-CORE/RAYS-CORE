import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const cesiumSrc = join(root, 'node_modules', 'cesium', 'Build', 'Cesium');
const publicDir = join(root, 'public', 'cesium');

const dirs = ['Workers', 'Assets', 'ThirdParty', 'Widgets'];

function copyDir(src, dest) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

if (!existsSync(cesiumSrc)) {
  console.error('Cesium build not found at', cesiumSrc);
  process.exit(1);
}

for (const d of dirs) {
  copyDir(join(cesiumSrc, d), join(publicDir, d));
}

console.log('Cesium static files copied to public/cesium/');
