require("dotenv").config();
import { app, BrowserWindow, globalShortcut, shell } from "electron";
import path from "path";
import fs from "fs";
import { findUnusedPorts, killProcess, setupEnv, setUserConfig } from "./utils";
import { startFastApiServer, startNextJsServer } from "./utils/servers";
import { ChildProcessByStdio } from "child_process";
import { appDataDir, baseDir, ensureDirectoriesExist, fastapiDir, isDev, localhost, nextjsDir, tempDir, userConfigPath, userDataDir } from "./utils/constants";
import { setupIpcHandlers } from "./ipc";
import { ipcMain } from "electron";
import { setupLibreOfficeInstallHandlers } from "./ipc/libreoffice_install_handlers";
import { setupSetupInstallHandlers } from "./ipc/setup_install_handlers";
import { checkDependenciesBeforeWindow } from "./utils/setup-dependencies";
import { getSofficePath, isLibreOfficeInstalled } from "./utils/libreoffice-check";
import { getPuppeteerExecutablePath, isChromeInstalled } from "./utils/puppeteer-check";
import { getLiteParseRunnerPath } from "./utils/liteparse-check";
import { getImageMagickBinaryPath, isImageMagickInstalled } from "./utils/imagemagick-check";
// Update checker disabled for local-first deployment

// Linux Chromium requires chrome-sandbox to be root-owned mode 4755; unpacked
// dist/linux-unpacked builds usually lack that. Disable sandbox only when invalid.
if (process.platform === "linux") {
  try {
    const sandboxPath = path.join(path.dirname(process.execPath), "chrome-sandbox");
    if (fs.existsSync(sandboxPath)) {
      const st = fs.statSync(sandboxPath);
      const hasSetuid = (st.mode & 0o4777) === 0o4755;
      const rootOwned = st.uid === 0;
      if (!(hasSetuid && rootOwned)) {
        app.commandLine.appendSwitch("no-sandbox");
      }
    } else {
      app.commandLine.appendSwitch("no-sandbox");
    }
  } catch {
    app.commandLine.appendSwitch("no-sandbox");
  }
  // Fall back to /tmp instead of shared memory to avoid Chromium crashes
  // on systems where /dev/shm is unavailable/misconfigured.
  app.commandLine.appendSwitch("disable-dev-shm-usage");
}

var win: BrowserWindow | undefined;
var fastApiProcess: ChildProcessByStdio<any, any, any> | undefined;
var nextjsProcess: any;
let isStopping = false;
const startupStatus: Record<string, string> = {
  libreoffice: "checking",
  puppeteer: "checking",
  imagemagick: "checking",
};

function resolveExportConverterPath(appRoot: string): string | undefined {
  const pyDir = path.join(appRoot, "resources", "export", "py");
  const candidates = [
    path.join(pyDir, `convert-${process.platform}-${process.arch}`),
    path.join(pyDir, `convert-${process.platform}-${process.arch}.exe`),
    path.join(pyDir, `convert-${process.platform}`),
    path.join(pyDir, `convert-${process.platform}.exe`),
    path.join(pyDir, "convert"),
    path.join(pyDir, "convert.exe"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function resolveElectronDisableAuth(): string {
  const raw = (
    process.env.ELECTRON_DISABLE_AUTH ?? process.env.DISABLE_AUTH
  )?.trim().toLowerCase();
  if (!raw) {
    return "true";
  }
  if (["0", "false", "no", "off"].includes(raw)) {
    return "false";
  }
  if (["1", "true", "yes", "on"].includes(raw)) {
    return "true";
  }
  return "true";
}

// Allow renderer to query initial startup status as soon as it loads.
ipcMain.handle("startup:get-status", () => startupStatus);

// Sentry removed — local-first deployment

app.commandLine.appendSwitch('gtk-version', '3');

// Work around Chromium/Electron GPU compositor issues that can cause
// startup white screens on some Linux/driver combinations.
app.disableHardwareAcceleration();

// Mitigate "Unable to move the cache: Access is denied" on Windows (Chromium disk cache).
// Use explicit cache paths and remove stale old_* dirs that cause move failures.
if (process.platform === "win32") {
  const ud = app.getPath("userData");
  const cacheBase = path.join(ud, "Cache");
  const gpuCacheBase = path.join(ud, "GPUCache");
  app.setPath("cache", cacheBase);
  app.commandLine.appendSwitch("disk-cache-dir", cacheBase);
  try {
    [cacheBase, gpuCacheBase].forEach((dir) => {
      if (fs.existsSync(dir)) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory() && e.name.startsWith("old_")) {
            fs.rmSync(path.join(dir, e.name), { recursive: true, force: true });
          }
        }
      }
    });
  } catch {
    /* ignore cleanup errors */
  }
}

const createWindow = () => {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false, // Reveal once the launch screen has painted to avoid a blank flash.
    backgroundColor: "#0a0a0f",
    icon: path.join(baseDir, "resources/ui/assets/images/deckforge_icon.png"),
    webPreferences: {
        webSecurity: false,
        // Ensure a known preload path and explicit isolation settings so
        // the `contextBridge` API is exposed reliably to renderer pages.
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        preload: (() => {
          const p = path.join(__dirname, 'preloads/index.js');
          try {
            if (!fs.existsSync(p)) {
              console.warn(`[DeckForge] Preload not found at ${p}`);
            }
          } catch (e) {
            console.warn('[DeckForge] Failed to stat preload path', e);
          }
          return p;
        })(),
    },
  });

  // Open external links (e.g. "Download update") in the system browser so the user
  // sees download progress and can manage downloads normally.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  win.once("ready-to-show", () => {
    if (!win || win.isDestroyed()) {
      return;
    }
    win.show();
    win.focus();
  });
};

function registerDevToolsShortcuts(): void {
  const accelerators = ["CommandOrControl+Shift+I", "F12"];
  for (const accelerator of accelerators) {
    const registered = globalShortcut.register(accelerator, () => {
      if (!win || win.isDestroyed()) {
        return;
      }
      win.webContents.toggleDevTools();
    });
    if (!registered) {
      console.warn(`[DeckForge] Failed to register ${accelerator} for DevTools`);
    }
  }
}

async function startServers(fastApiPort: number, nextjsPort: number) {
  try {
    const disableAuthForElectron = resolveElectronDisableAuth();
    const sofficePath = getSofficePath();
    const exportPackageRoot = path.join(baseDir, "resources", "export");
    const exportConverterPath = resolveExportConverterPath(baseDir);
    const fastApi = await startFastApiServer(
      fastapiDir,
      fastApiPort,
      {
        DEBUG: isDev ? "True" : "False",
        CAN_CHANGE_KEYS: process.env.CAN_CHANGE_KEYS,
        LLM: process.env.LLM,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        OPENAI_MODEL: process.env.OPENAI_MODEL,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        GOOGLE_MODEL: process.env.GOOGLE_MODEL,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
        OLLAMA_URL: process.env.OLLAMA_URL,
        OLLAMA_MODEL: process.env.OLLAMA_MODEL,
        CUSTOM_LLM_URL: process.env.CUSTOM_LLM_URL,
        CUSTOM_LLM_API_KEY: process.env.CUSTOM_LLM_API_KEY,
        CUSTOM_MODEL: process.env.CUSTOM_MODEL,
        PEXELS_API_KEY: process.env.PEXELS_API_KEY,
        PIXABAY_API_KEY: process.env.PIXABAY_API_KEY,
        IMAGE_PROVIDER: process.env.IMAGE_PROVIDER,
        DISABLE_IMAGE_GENERATION: process.env.DISABLE_IMAGE_GENERATION,
        EXTENDED_REASONING: process.env.EXTENDED_REASONING,
        TOOL_CALLS: process.env.TOOL_CALLS,
        DISABLE_THINKING: process.env.DISABLE_THINKING,
        WEB_GROUNDING: process.env.WEB_GROUNDING,
        DATABASE_URL: process.env.DATABASE_URL,
        DISABLE_ANONYMOUS_TRACKING: process.env.DISABLE_ANONYMOUS_TRACKING,
        COMFYUI_URL: process.env.COMFYUI_URL,
        COMFYUI_WORKFLOW: process.env.COMFYUI_WORKFLOW,
        DALL_E_3_QUALITY: process.env.DALL_E_3_QUALITY,
        GPT_IMAGE_1_5_QUALITY: process.env.GPT_IMAGE_1_5_QUALITY,
        APP_DATA_DIRECTORY: appDataDir,
        FASTAPI_PUBLIC_URL: process.env.NEXT_PUBLIC_FAST_API,
        TEMP_DIRECTORY: tempDir,
        USER_CONFIG_PATH: userConfigPath,
        MIGRATE_DATABASE_ON_STARTUP: "True",
        DISABLE_AUTH: disableAuthForElectron,
        // Resolved by libreoffice-check.ts at startup when available; lets
        // Python invoke the exact binary path instead of relying on PATH.
        ...(sofficePath && {
          SOFFICE_PATH: sofficePath,
        }),
        IMAGEMAGICK_BINARY: getImageMagickBinaryPath(),
        LITEPARSE_RUNNER_PATH: getLiteParseRunnerPath(),
        // Use Electron's embedded runtime for LiteParse so parsing does not
        // depend on a system-wide Node installation.
        LITEPARSE_NODE_BINARY: process.execPath,
        ELECTRON_RUN_AS_NODE: "1",
        EXPORT_PACKAGE_ROOT: exportPackageRoot,
        EXPORT_RUNTIME_DIR: exportPackageRoot,
        ...(exportConverterPath && {
          BUILT_PYTHON_MODULE_PATH: exportConverterPath,
        }),
      },
      isDev,
    );
    fastApiProcess = fastApi.process;
    await fastApi.ready;

    const puppeteerExecutablePath = await getPuppeteerExecutablePath();
    const nextjs = await startNextJsServer(
      nextjsDir,
      nextjsPort,
      {
        NEXT_PUBLIC_FAST_API: process.env.NEXT_PUBLIC_FAST_API,
        FAST_API_INTERNAL_URL: process.env.NEXT_PUBLIC_FAST_API,
        TEMP_DIRECTORY: process.env.TEMP_DIRECTORY,
        NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
        NEXT_PUBLIC_USER_CONFIG_PATH: process.env.NEXT_PUBLIC_USER_CONFIG_PATH,
        USER_CONFIG_PATH: process.env.NEXT_PUBLIC_USER_CONFIG_PATH,
        APP_DATA_DIRECTORY: appDataDir,
        DISABLE_AUTH: disableAuthForElectron,
        EXPORT_PACKAGE_ROOT: exportPackageRoot,
        DECKFORGE_APP_ROOT: baseDir,
        ...(exportConverterPath && {
          BUILT_PYTHON_MODULE_PATH: exportConverterPath,
        }),
        ...(puppeteerExecutablePath && {
          PUPPETEER_EXECUTABLE_PATH: puppeteerExecutablePath,
        }),
      },
      isDev,
    )
    nextjsProcess = nextjs.process;
    await nextjs.ready;
  } catch (error) {
    console.error("Server startup error:", error);
  }
}

async function stopServers() {
  if (fastApiProcess?.pid) {
    console.log("Force killing FastAPI...");
    try {
      await killProcess(fastApiProcess.pid, "SIGKILL");
    } catch (error) {
      console.error("Failed to force kill FastAPI:", error);
    }
    fastApiProcess = undefined;
  }
  if (nextjsProcess) {
    if ("pid" in nextjsProcess && nextjsProcess.pid) {
      console.log("Force killing NextJS...");
      try {
        await killProcess(nextjsProcess.pid, "SIGKILL");
      } catch (error) {
        console.error("Failed to force kill NextJS:", error);
      }
    } else if (typeof nextjsProcess.close === "function") {
      console.log("Closing NextJS...");
      nextjsProcess.close();
    }
    nextjsProcess = undefined;
  }
}

async function forceQuitApp(exitCode = 0) {
  if (isStopping) return;
  isStopping = true;
  globalShortcut.unregisterAll();
  // Update checker disabled
  try {
    await stopServers();
  } finally {
    app.exit(exitCode);
  }
}

app.whenReady().then(async () => {
  // Ensure all required directories exist before starting
  ensureDirectoriesExist();

  // Register install handlers early so the unified setup window can use them
  setupLibreOfficeInstallHandlers();
  setupSetupInstallHandlers();

  // Create main window before setup so that when user skips, the main window stays open
  createWindow();
  registerDevToolsShortcuts();
  win?.loadFile(path.join(baseDir, "resources/ui/homepage/index.html"));

  // Single installer: checks LibreOffice, Chrome, and ImageMagick; if any are missing, shows one
  // window that installs them one after another. Resolves when the window closes.
  const setupCompleted = await checkDependenciesBeforeWindow();
  if (!setupCompleted) {
    // Block app usage when required setup is not completed.
    win?.destroy();
    app.quit();
    return;
  }

  // Update startup status after setup (user may have installed one or both)
  const [loResult, chromeOk, imageMagickOk] = await Promise.all([
    isLibreOfficeInstalled(),
    isChromeInstalled(),
    Promise.resolve(isImageMagickInstalled()),
  ]);
  startupStatus.libreoffice = loResult.installed ? "installed" : "missing";
  startupStatus.puppeteer = chromeOk ? "installed" : "missing";
  startupStatus.imagemagick = imageMagickOk ? "installed" : "missing";

  // Ensure the launch screen stays visible and focused during the server boot.
  win?.show();
  win?.focus();

  const sendStartupStatus = (name: string, status: string) => {
    startupStatus[name] = status;
    win?.webContents.send("startup:status", { name, status });
  };

  win?.webContents.once("did-finish-load", () => {
    sendStartupStatus("libreoffice", startupStatus.libreoffice);
    sendStartupStatus("puppeteer", startupStatus.puppeteer);
    sendStartupStatus("imagemagick", startupStatus.imagemagick);
  });

  setUserConfig({
    CAN_CHANGE_KEYS: process.env.CAN_CHANGE_KEYS,
    LLM: process.env.LLM,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GOOGLE_MODEL: process.env.GOOGLE_MODEL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    OLLAMA_URL: process.env.OLLAMA_URL,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL,
    CUSTOM_LLM_URL: process.env.CUSTOM_LLM_URL,
    CUSTOM_LLM_API_KEY: process.env.CUSTOM_LLM_API_KEY,
    CUSTOM_MODEL: process.env.CUSTOM_MODEL,
    PEXELS_API_KEY: process.env.PEXELS_API_KEY,
    PIXABAY_API_KEY: process.env.PIXABAY_API_KEY,
    IMAGE_PROVIDER: process.env.IMAGE_PROVIDER,
    DISABLE_IMAGE_GENERATION: process.env.DISABLE_IMAGE_GENERATION,
    EXTENDED_REASONING: process.env.EXTENDED_REASONING,
    TOOL_CALLS: process.env.TOOL_CALLS,
    DISABLE_THINKING: process.env.DISABLE_THINKING,
    WEB_GROUNDING: process.env.WEB_GROUNDING,
    DATABASE_URL: process.env.DATABASE_URL,
    DISABLE_ANONYMOUS_TRACKING: process.env.DISABLE_ANONYMOUS_TRACKING,
    COMFYUI_URL: process.env.COMFYUI_URL,
    COMFYUI_WORKFLOW: process.env.COMFYUI_WORKFLOW,
    DALL_E_3_QUALITY: process.env.DALL_E_3_QUALITY,
    GPT_IMAGE_1_5_QUALITY: process.env.GPT_IMAGE_1_5_QUALITY,
  })

  const [fastApiPort, nextjsPort] = await findUnusedPorts();
  console.log(`FastAPI port: ${fastApiPort}, NextJS port: ${nextjsPort}`);

  //? Setup environment variables to be used in the preloads
  setupEnv(fastApiPort, nextjsPort);
  setupIpcHandlers();

  await startServers(fastApiPort, nextjsPort);
  win?.loadURL(`${localhost}:${nextjsPort}`);

  // RAYS DeckForge — local-first, no external update polling
  process.stderr.write("[DeckForge] Ready.\n");
});

app.on("window-all-closed", async () => {
  await forceQuitApp(0);
});

app.on("before-quit", async (event) => {
  if (isStopping) return;
  event.preventDefault();
  await forceQuitApp(0);
});

app.on("will-quit", async (event) => {
  if (isStopping) return;
  event.preventDefault();
  await forceQuitApp(0);
});
