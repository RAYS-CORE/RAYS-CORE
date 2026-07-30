import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

let resolvedImageMagickBinaryPath = process.platform === "win32" ? "magick" : "convert";

function canExecute(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, {
    stdio: "pipe",
    windowsHide: true,
  });
  return result.status === 0;
}

function runCommand(command: string, args: string[]): string | null {
  const result = spawnSync(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return null;

  const stdout = (result.stdout ?? "").trim();
  return stdout.length > 0 ? stdout : null;
}

function getWindowsInstallRootCandidates(): string[] {
  const roots = new Set<string>();

  if (process.env.LOCALAPPDATA) roots.add(process.env.LOCALAPPDATA);
  if (process.env.ProgramFiles) roots.add(process.env.ProgramFiles);
  if (process.env["ProgramFiles(x86)"]) {
    roots.add(process.env["ProgramFiles(x86)"] as string);
  }
  roots.add(path.join(os.homedir(), "AppData", "Local"));

  return Array.from(roots);
}

export function getWindowsImageMagickInstallDir(): string {
  const localAppData =
    process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  return path.join(localAppData, "RAYS DeckForge", "runtime", "imagemagick");
}

function collectWindowsImageMagickBinaryCandidates(): string[] {
  const candidates: string[] = [
    path.join(getWindowsImageMagickInstallDir(), "magick.exe"),
  ];

  for (const root of getWindowsInstallRootCandidates()) {
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || !/^ImageMagick/i.test(entry.name)) {
          continue;
        }
        candidates.push(path.join(root, entry.name, "magick.exe"));
      }
    } catch {
      continue;
    }
  }

  return candidates;
}

function resolveBrewCommandPath(): string | null {
  const candidates = ["brew", "/opt/homebrew/bin/brew", "/usr/local/bin/brew"];
  for (const candidate of candidates) {
    if (canExecute(candidate, ["--version"])) {
      return candidate;
    }
  }
  return null;
}

function collectDarwinBrewImageMagickCandidates(): string[] {
  const candidates: string[] = [
    "/opt/homebrew/bin/magick",
    "/usr/local/bin/magick",
    "/opt/homebrew/opt/imagemagick/bin/magick",
    "/usr/local/opt/imagemagick/bin/magick",
  ];

  const brewCommand = resolveBrewCommandPath();
  if (!brewCommand) {
    return candidates;
  }

  const brewPrefix = runCommand(brewCommand, ["--prefix", "imagemagick"]);
  if (brewPrefix) {
    candidates.push(path.join(brewPrefix, "bin", "magick"));
  }

  const brewCellar = runCommand(brewCommand, ["--cellar", "imagemagick"]);
  if (brewCellar && fs.existsSync(brewCellar)) {
    try {
      const versions = fs
        .readdirSync(brewCellar, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) =>
          b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" })
        );

      for (const version of versions) {
        candidates.push(path.join(brewCellar, version, "bin", "magick"));
      }
    } catch {
      // Ignore cellar enumeration errors and continue with other candidates.
    }
  }

  return candidates;
}

function resolveImageMagickBinaryPath(): string | null {
  const commandCandidates = process.platform === "win32" ? ["magick"] : ["magick", "convert"];
  for (const candidate of commandCandidates) {
    if (canExecute(candidate, ["-version"])) {
      return candidate;
    }
  }

  if (process.platform === "win32") {
    for (const candidate of collectWindowsImageMagickBinaryCandidates()) {
      if (fs.existsSync(candidate) && canExecute(candidate, ["-version"])) {
        return candidate;
      }
    }
    return null;
  }

  if (process.platform === "darwin") {
    for (const candidate of collectDarwinBrewImageMagickCandidates()) {
      if (fs.existsSync(candidate) && canExecute(candidate, ["-version"])) {
        return candidate;
      }
    }
  }

  const unixCandidates = [
    "/opt/homebrew/bin/magick",
    "/usr/local/bin/magick",
    "/opt/local/bin/magick",
    "/usr/bin/magick",
    "/usr/local/bin/convert",
    "/usr/bin/convert",
  ];

  for (const candidate of unixCandidates) {
    if (fs.existsSync(candidate) && canExecute(candidate, ["-version"])) {
      return candidate;
    }
  }

  return null;
}

export function isImageMagickInstalled(): boolean {
  const resolved = resolveImageMagickBinaryPath();
  if (!resolved) return false;

  resolvedImageMagickBinaryPath = resolved;
  return true;
}

export function getImageMagickBinaryPath(): string {
  return resolvedImageMagickBinaryPath;
}

export function getImageMagickDownloadUrl(): string {
  if (process.platform === "win32") {
    return "https://github.com/ImageMagick/ImageMagick/releases/download/7.1.2-18/ImageMagick-7.1.2-18-Q16-HDRI-x64-dll.exe";
  }
  if (process.platform === "darwin") {
    return "https://brew.sh/";
  }
  return "https://imagemagick.org/script/download.php#linux";
}

export function getImageMagickManualInstallCommands(): string[] {
  if (process.platform === "win32") {
    return [
      "Download and run the installer:",
      getImageMagickDownloadUrl(),
      "Recommended install path:",
      getWindowsImageMagickInstallDir(),
    ];
  }

  if (process.platform === "darwin") {
    return [
      "Install Homebrew:",
      '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      "Install ImageMagick:",
      "brew install imagemagick",
      "Verify detected binary path:",
      "brew --prefix imagemagick",
    ];
  }

  return [
    "Install ImageMagick:",
    "sudo apt-get update",
    "sudo apt-get install -y imagemagick",
  ];
}
