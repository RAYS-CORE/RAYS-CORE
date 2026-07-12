/**
 * Captures a short demo sequence: orbital → city → street in NYC.
 * Run while dev server is up: node scripts/capture-demo.mjs
 */
import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'demo-preview');
const URL = 'http://127.0.0.1:5173/?skipBoot=1';

const STEPS = [
  { name: '01-orbital', wait: 6000, fly: null },
  { name: '02-regional', wait: 3000, fly: { lon: -74.006, lat: 40.7128, h: 120000, pitch: -35, dur: 0 } },
  { name: '03-transition', wait: 4500, fly: { lon: -74.006, lat: 40.7128, h: 25000, pitch: -40, dur: 2.5 } },
  { name: '04-city-3d', wait: 5500, fly: { lon: -74.006, lat: 40.7128, h: 2500, pitch: -35, dur: 2.5 } },
  { name: '05-street', wait: 5500, fly: { lon: -74.006, lat: 40.7128, h: 450, pitch: -20, dur: 2.5 } },
];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function flyTo(page, { lon, lat, h, pitch, dur }) {
  await page.evaluate(
    ({ lon, lat, h, pitch, dur }) =>
      new Promise((resolve) => {
        const { viewer, Cesium } = window.__rayspy || {};
        if (!viewer || !Cesium) { resolve(false); return; }
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, h),
          orientation: {
            pitch: Cesium.Math.toRadians(pitch),
            heading: 0,
            roll: 0,
          },
          duration: dur,
          complete: resolve,
        });
        if (dur === 0) resolve(true);
      }),
    { lon, lat, h, pitch, dur }
  );
}

async function main() {
  const pw = await import('playwright').catch(() => null);
  if (!pw) {
    console.error('Install playwright: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });
  const videoDir = join(OUT, 'video-tmp');
  await mkdir(videoDir, { recursive: true });

  const browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__rayspy?.viewer, { timeout: 60000 });

  for (const step of STEPS) {
    if (step.fly) await flyTo(page, step.fly);
    await sleep(step.wait);
    const path = join(OUT, `${step.name}.png`);
    await page.screenshot({ path, type: 'png', timeout: 120000 });
    console.log('Captured', step.name);
  }

  await context.close();
  await browser.close();

  // Playwright saves webm when context closes
  const webmFiles = (await readdir(videoDir)).filter((f) => f.endsWith('.webm'));
  if (webmFiles.length) {
    const src = join(videoDir, webmFiles[0]);
    const dest = join(OUT, 'rayspy-3d-city-demo.webm');
    await copyFile(src, dest);
    console.log('Demo video:', dest);
  } else {
    console.log('No video file — PNG frames saved in', OUT);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
