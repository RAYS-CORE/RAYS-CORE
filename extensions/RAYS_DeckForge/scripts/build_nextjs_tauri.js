import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'servers', 'nextjs', 'app', 'api');
const tempApiDir = path.join(rootDir, 'servers', 'nextjs', 'app', '_api');

let renamed = false;

try {
  // 1. Clean previous build directory to prevent stale typescript definitions from causing errors
  const buildDir = path.join(rootDir, 'servers', 'nextjs', '.next-build');
  if (fs.existsSync(buildDir)) {
    console.log(`[Tauri Build] Cleaning previous build cache at ${buildDir}…`);
    fs.rmSync(buildDir, { recursive: true, force: true });
  }

  // 2. Temporarily rename dynamic API routes folder to private folder (_api)
  if (fs.existsSync(apiDir)) {
    console.log(`[Tauri Build] Temporarily renaming ${apiDir} to ${tempApiDir} to bypass static export checks…`);
    fs.renameSync(apiDir, tempApiDir);
    renamed = true;
  }

  // 2. Trigger the Next.js static build command
  console.log('[Tauri Build] Compiling Next.js static export…');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const buildResult = spawnSync(npmCmd, ['--prefix', 'servers/nextjs', 'run', 'build'], {
    cwd: rootDir,
    env: { ...process.env, BUILD_TARGET: 'tauri' },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (buildResult.error) {
    throw buildResult.error;
  }
  if (buildResult.status !== 0) {
    throw new Error(`Next.js build failed with exit code ${buildResult.status}`);
  }

  console.log('[Tauri Build] ✓ Next.js static export compiled successfully.');
} catch (error) {
  console.error('[Tauri Build] ✗ Error during static export compilation:', error.message);
  process.exitCode = 1;
} finally {
  // 3. Always restore the API routes directory so Electron/Git remains untouched
  if (renamed && fs.existsSync(tempApiDir)) {
    console.log(`[Tauri Build] Restoring ${tempApiDir} back to ${apiDir}…`);
    fs.renameSync(tempApiDir, apiDir);
    console.log('[Tauri Build] ✓ API routes folder successfully restored.');
  }
}
