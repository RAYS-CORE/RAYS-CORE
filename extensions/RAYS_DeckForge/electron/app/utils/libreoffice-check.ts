/**
 * libreoffice-check.ts
 *
 * Checks whether LibreOffice is available on the host machine before the
 * main BrowserWindow is created. LibreOffice is required for creating custom
 * templates from uploaded PPTX files.
 *
 * If not found, shows a branded installer window that lets the user download
 * and install LibreOffice with a real-time progress UI.
 */

import { BrowserWindow, ipcMain, app } from "electron";
import { exec } from "child_process";
import * as util from "util";
import * as fs from "fs";
import * as path from "path";
import { baseDir } from "./constants";

const execAsync = util.promisify(exec);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result returned by {@link isLibreOfficeInstalled}. */
interface LibreOfficeCheckResult {
  installed: boolean;
  /** The raw version string from `soffice --version`, when available. */
  version?: string;
  /** The resolved absolute path (or bare command name) of the soffice binary. */
  path?: string;
}

export type LibreOfficeStatus =
  | "checking"
  | "installed"
  | "missing"
  | "installing";

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

/**
 * Reads a directory and returns the names of all entries whose names match
 * `pattern`.  Returns an empty array if the directory cannot be read.
 */
function scanDir(dir: string, pattern: RegExp): string[] {
  try {
    return fs.readdirSync(dir).filter((entry) => pattern.test(entry));
  } catch {
    return [];
  }
}

/**
 * Returns an ordered list of absolute paths to try for the `soffice` binary
 * on the current platform.
 *
 * Instead of hard-coding version numbers, parent directories are scanned with
 * a regex so any past or future LibreOffice version is automatically found.
 * Fixed (non-versioned) paths are still included first so the common case
 * resolves instantly.
 *
 * Detection strategy per platform:
 *  Windows  – scan Program Files (64-bit & 32-bit) for /^LibreOffice(\s[\d.]+)?$/i,
 *             plus per-user LOCALAPPDATA / APPDATA locations.
 *  macOS    – scan /Applications and ~/Applications for /^LibreOffice[\s\d.]*\.app$/i,
 *             plus Homebrew (Intel & Apple Silicon) and MacPorts fixed paths.
 *  Linux    – fixed distro/local/snap/flatpak paths, then scan /opt for
 *             /^libreoffice[\d.]*$/i, and ~/.local for user installs.
 */
function getCandidatePaths(): string[] {
  const platform = process.platform;

  // -------------------------------------------------------------------------
  // Windows
  // -------------------------------------------------------------------------
  if (platform === "win32") {
    const pf      = process.env["ProgramFiles"]      ?? "C:\\Program Files";
    const pf86    = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    const local   = process.env["LOCALAPPDATA"]       ?? "";
    const appData = process.env["APPDATA"]            ?? "";

    // Matches "LibreOffice", "LibreOffice 7", "LibreOffice 24.8", etc.
    const loPattern = /^LibreOffice(\s[\d.]+)?$/i;

    const paths: string[] = [];

    // Scan both Program Files roots for any LibreOffice installation folder.
    for (const root of [pf, pf86]) {
      for (const entry of scanDir(root, loPattern)) {
        paths.push(`${root}\\${entry}\\program\\soffice.exe`);
      }
    }

    // Per-user installs
    if (local) {
      paths.push(
        `${local}\\Programs\\LibreOffice\\program\\soffice.exe`,
        `${local}\\LibreOffice\\program\\soffice.exe`,
      );
    }
    if (appData) {
      paths.push(`${appData}\\LibreOffice\\program\\soffice.exe`);
    }

    return paths;
  }

  // -------------------------------------------------------------------------
  // macOS
  // -------------------------------------------------------------------------
  if (platform === "darwin") {
    const home = process.env["HOME"] ?? "";

    // Matches "LibreOffice.app", "LibreOffice 7.app", "LibreOffice 24.8.app", etc.
    const bundlePattern = /^LibreOffice[\s\d.]*\.app$/i;
    const macosRelative = "Contents/MacOS/soffice";

    const paths: string[] = [];

    // Scan /Applications and ~/Applications for any LibreOffice bundle.
    const appDirs = ["/Applications"];
    if (home) appDirs.push(`${home}/Applications`);

    for (const appDir of appDirs) {
      for (const bundle of scanDir(appDir, bundlePattern)) {
        paths.push(`${appDir}/${bundle}/${macosRelative}`);
      }
    }

    // Homebrew – Intel Macs
    paths.push(
      "/usr/local/bin/soffice",
      "/usr/local/lib/libreoffice/program/soffice",
    );

    // Homebrew – Apple Silicon (M-series)
    paths.push(
      "/opt/homebrew/bin/soffice",
      "/opt/homebrew/lib/libreoffice/program/soffice",
    );

    // MacPorts
    paths.push("/opt/local/bin/soffice");

    return paths;
  }

  // -------------------------------------------------------------------------
  // Linux
  // -------------------------------------------------------------------------
  const home = process.env["HOME"] ?? "";

  const paths: string[] = [
    // Distro packages (Debian/Ubuntu, Fedora, Arch, openSUSE, …)
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/usr/lib/libreoffice/program/soffice",
    "/usr/lib64/libreoffice/program/soffice",

    // Manual / local installs
    "/usr/local/bin/soffice",
    "/usr/local/lib/libreoffice/program/soffice",

    // Snap – classic and strict confinement
    "/snap/bin/soffice",
    "/snap/bin/libreoffice",
    "/var/lib/snapd/snap/bin/soffice",
    "/var/lib/snapd/snap/bin/libreoffice",

    // Flatpak – system-wide
    "/var/lib/flatpak/exports/bin/org.libreoffice.LibreOffice",
    "/var/lib/flatpak/app/org.libreoffice.LibreOffice/current/active/export/bin/libreoffice",
  ];

  // Scan /opt for any versioned tarball directory, e.g. libreoffice7.6,
  // libreoffice24.8, libreoffice (plain symlink), etc.
  // Matches "libreoffice", "libreoffice7", "libreoffice7.6", "libreoffice24.2", …
  const optPattern = /^libreoffice[\d.]*$/i;
  for (const entry of scanDir("/opt", optPattern)) {
    paths.push(`/opt/${entry}/program/soffice`);
  }

  // Flatpak – per-user and ~/.local installs
  if (home) {
    paths.push(
      `${home}/.local/share/flatpak/exports/bin/org.libreoffice.LibreOffice`,
      `${home}/.local/share/flatpak/app/org.libreoffice.LibreOffice/current/active/export/bin/libreoffice`,
      `${home}/.local/bin/soffice`,
      `${home}/.local/lib/libreoffice/program/soffice`,
    );
  }

  return paths;
}

/**
 * Detects the Linux distro from /etc/os-release and returns the install
 * command for LibreOffice, or null if the distro is not supported.
 *
 * Exported so that libreoffice_install_handlers.ts can reuse it.
 */
export function getLinuxInstallCommand(): { cmd: string; args: string[] } | null {
  const osReleasePaths = ["/etc/os-release", "/usr/lib/os-release"];
  let id = "";
  let idLike = "";

  for (const p of osReleasePaths) {
    try {
      const content = fs.readFileSync(p, "utf-8");
      for (const line of content.split("\n")) {
        const m = line.match(/^ID=(.+)$/);
        if (m) id = m[1].replace(/^["']|["']$/g, "").trim().toLowerCase();
        const m2 = line.match(/^ID_LIKE=(.+)$/);
        if (m2) idLike = m2[1].replace(/^["']|["']$/g, "").trim().toLowerCase();
      }
      if (id) break;
    } catch {
      continue;
    }
  }

  const ids = `${id} ${idLike}`;
  if (ids.includes("ubuntu") || ids.includes("debian") || ids.includes("pop") || ids.includes("linuxmint")) {
    return { cmd: "apt", args: ["install", "-y", "libreoffice"] };
  }
  if (ids.includes("fedora") || ids.includes("rhel") || ids.includes("centos") || ids.includes("rocky")) {
    return { cmd: "dnf", args: ["install", "-y", "libreoffice"] };
  }
  if (ids.includes("arch")) {
    return { cmd: "pacman", args: ["-S", "--noconfirm", "libreoffice-still"] };
  }
  if (ids.includes("opensuse") || ids.includes("suse")) {
    return { cmd: "zypper", args: ["install", "-y", "libreoffice"] };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Resolved path – populated by successful detection
// ---------------------------------------------------------------------------

/**
 * The resolved LibreOffice executable path discovered at startup.
 * Empty until a successful detection populates it.
 */
let resolvedSofficePath = "";

/**
 * Returns the resolved LibreOffice executable path found during startup detection.
 *
 * Pass as the `SOFFICE_PATH` env var to the FastAPI subprocess so Python
 * code can invoke the exact binary rather than relying on `PATH`.
 */
export function getSofficePath(): string | undefined {
  return resolvedSofficePath || undefined;
}

function setResolvedSofficePath(candidate?: string): void {
  if (!candidate) {
    return;
  }
  resolvedSofficePath = candidate;
}

function firstNonEmptyLine(value: string): string | undefined {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

async function getVersionForBinary(binaryPath: string): Promise<string | undefined> {
  try {
    const quoted = `"${binaryPath}"`;
    const { stdout } = await execAsync(`${quoted} --version`, {
      timeout: 8_000,
      windowsHide: (process.platform as string) === "win32",
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function resolveLibreOfficeFromPath(): Promise<string | undefined> {
  if (process.platform === "win32") {
    try {
      const { stdout } = await execAsync("where soffice.exe", {
        timeout: 8_000,
        windowsHide: true,
      });
      return firstNonEmptyLine(stdout);
    } catch {
      return undefined;
    }
  }

  try {
    const { stdout } = await execAsync("command -v soffice || command -v libreoffice", {
      timeout: 8_000,
      windowsHide: false,
    });
    const resolved = firstNonEmptyLine(stdout);
    if (!resolved) {
      return undefined;
    }
    if (path.isAbsolute(resolved)) {
      return resolved;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Core detection logic
// ---------------------------------------------------------------------------

/**
 * Attempts to detect LibreOffice by:
 *  1. Checking well-known installation paths for the binary (fast, no shell).
 *  2. Falling back to resolving the binary from PATH.
 *
 * Returns an object indicating whether LibreOffice was found and, when it
 * was, the version string reported by the binary.
 */
export async function isLibreOfficeInstalled(): Promise<LibreOfficeCheckResult> {
  // --- Step 1: check well-known paths synchronously (no exec overhead) ---
  for (const candidate of getCandidatePaths()) {
    if (fs.existsSync(candidate)) {
      setResolvedSofficePath(candidate);
      // On Windows, avoid probing with "--version" because some LibreOffice
      // builds open a transient console window for this command.
      if (process.platform === "win32") {
        return { installed: true, path: candidate };
      }

      // Binary found at a known location – try to get the version string.
      const version = await getVersionForBinary(candidate);
      if (version) {
        return { installed: true, version, path: candidate };
      }
      // Binary exists but failed to execute – still treat as installed.
      return { installed: true, path: candidate };
    }
  }

  // --- Step 2: try the PATH-based command ---
  const pathBinary = await resolveLibreOfficeFromPath();
  if (!pathBinary) {
    return { installed: false };
  }

  setResolvedSofficePath(pathBinary);
  const version = await getVersionForBinary(pathBinary);
  return { installed: true, version, path: pathBinary };
}

// ---------------------------------------------------------------------------
// Installer window
// ---------------------------------------------------------------------------

/**
 * Opens a branded 520×400 installer window that lets the user download and
 * install LibreOffice with a live progress UI.
 *
 * Returns a Promise that resolves once the window is closed (either by the
 * user skipping or after a successful install).
 */
async function showLibreOfficeInstallerWindow(): Promise<void> {
  return new Promise<void>((resolve) => {
    const win = new BrowserWindow({
      width: 520,
      height: 560,
      resizable: false,
      center: true,
      title: "RAYS DeckForge – Install LibreOffice",
      icon: path.join(baseDir, "resources/ui/assets/images/deckforge_icon.png"),
      webPreferences: {
        webSecurity: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        preload: path.join(__dirname, "../preloads/libreoffice-installer.js"),
      },
    });

    win.setMenuBarVisibility(false);

    const htmlPath = path.join(
      baseDir,
      "resources/ui/libreoffice-installer/index.html"
    );
    win.loadFile(htmlPath);

    // lo:skip is sent by the renderer when the user clicks "Skip" or after
    // a successful install (the success state auto-sends skip after 2 s).
    const onSkip = () => {
      if (!win.isDestroyed()) win.close();
    };
    ipcMain.once("lo:skip", onSkip);

    win.on("closed", () => {
      // Remove the listener in case the window was closed by the OS (title-bar X)
      ipcMain.removeListener("lo:skip", onSkip);
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Checks for LibreOffice. When absent, shows a branded installer window that
 * lets the user install it. Never blocks app startup — always returns `true`.
 *
 * Call this function **before** creating the main `BrowserWindow`.
 *
 * @returns Always `true` – the application should always proceed.
 */
export async function checkLibreOfficeBeforeWindow(
  onStatus?: (status: LibreOfficeStatus) => void
): Promise<boolean> {
  onStatus?.("checking");
  let result = await isLibreOfficeInstalled();

  if (result.installed) {
    if (result.path) {
      resolvedSofficePath = result.path;
    }
    console.log(
      `[LibreOffice] Detected: ${result.version ?? "(version unknown)"} at ${resolvedSofficePath}`
    );
    onStatus?.("installed");
    return true;
  }

  console.warn("[LibreOffice] Not found – showing installer window.");
  onStatus?.("missing");
  onStatus?.("installing");
  await showLibreOfficeInstallerWindow();

  // Re-detect after the window closes (install may have succeeded)
  result = await isLibreOfficeInstalled();
  if (result.installed && result.path) {
    resolvedSofficePath = result.path;
    console.log(`[LibreOffice] Detected after install: ${resolvedSofficePath}`);
    onStatus?.("installed");
  } else {
    onStatus?.("missing");
  }

  // Always proceed – never block the app
  return true;
}
