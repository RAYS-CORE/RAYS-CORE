/**
 * setup-dependencies.ts
 *
 * Single installer window that ensures LibreOffice, Chrome (Puppeteer), and
 * ImageMagick are
 * available before the user starts creating presentations. Runs checks, then
 * if any are missing shows one installer that runs dependency setup steps
 * in sequence (each with Install / Skip).
 */

import { BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import { baseDir } from "./constants";
import { isLibreOfficeInstalled } from "./libreoffice-check";
import {
  isChromeInstalled,
  type SetupStatus,
} from "./puppeteer-check";
import { isImageMagickInstalled } from "./imagemagick-check";

export type { SetupStatus };

/** Set by checkDependenciesBeforeWindow; read by setup installer IPC. */
let currentSetupStatus: SetupStatus | null = null;

export function getSetupStatus(): SetupStatus | null {
  return currentSetupStatus;
}

/**
 * Checks LibreOffice, Chrome and ImageMagick. If all are present, returns
 * immediately. If any are missing, opens one installer window that runs each
 * missing setup step in sequence. Returns true only when all required dependencies
 * are installed; false when the installer is closed/skipped before completion.
 */
export async function checkDependenciesBeforeWindow(): Promise<boolean> {
  const [loResult, chromeInstalled, imageMagickInstalled] = await Promise.all([
    isLibreOfficeInstalled(),
    isChromeInstalled(),
    Promise.resolve(isImageMagickInstalled()),
  ]);

  const needsLibreOffice = !loResult.installed;
  const needsChrome = !chromeInstalled;
  const needsImageMagick = !imageMagickInstalled;

  if (!needsLibreOffice && !needsChrome && !needsImageMagick) {
    return true;
  }

  currentSetupStatus = {
    needsLibreOffice,
    needsChrome,
    needsImageMagick,
  };

  await showSetupInstallerWindow();

  // Re-check after installer closes; setup can only proceed when all
  // required dependencies are actually installed.
  const [postLoResult, postChromeInstalled, postImageMagickInstalled] = await Promise.all([
    isLibreOfficeInstalled(),
    isChromeInstalled(),
    Promise.resolve(isImageMagickInstalled()),
  ]);

  currentSetupStatus = null;
  return postLoResult.installed && postChromeInstalled && postImageMagickInstalled;
}

/**
 * Opens the unified setup installer window (LibreOffice then Chrome).
 * Resolves when the window is closed.
 */
function showSetupInstallerWindow(): Promise<void> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 520,
      height: 600,
      resizable: false,
      center: true,
      title: "RAYS DeckForge – Setup required",
      icon: path.join(
        baseDir,
        "resources/ui/assets/images/deckforge_icon.png"
      ),
      webPreferences: {
        webSecurity: false,
        contextIsolation: true,
        nodeIntegration: false,
        // Keep preload runtime consistent with the main window in packaged builds.
        sandbox: false,
        preload: path.join(__dirname, "../preloads/setup-installer.js"),
      },
    });

    win.setMenuBarVisibility(false);

    win.loadFile(
      path.join(baseDir, "resources/ui/setup-installer/index.html")
    );

    const onDone = () => {
      if (!win.isDestroyed()) win.close();
    };
    ipcMain.once("setup:done", onDone);

    win.on("closed", () => {
      ipcMain.removeListener("setup:done", onDone);
      resolve();
    });
  });
}
