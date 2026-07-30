import { net } from "electron";
import { app, BrowserWindow } from "electron";
import { isDev } from "./constants";

/**
 * Version check URL — GitHub raw version.json (no API required).
 * Override with UPDATE_SERVER_URL for local testing.
 */
const VERSION_JSON_URL =
  process.env.UPDATE_SERVER_URL ||
  "https://raw.githubusercontent.com/rays/deckforge/refs/heads/main/electron/version.json";

const CURRENT_VERSION = app.getVersion();
const WEBSITE_DOWNLOAD_URL = "https://rays.deckforge.local/download";

/** Maximum number of fetch attempts (polls). */
const MAX_ATTEMPTS = 3;

/** Wait 2 minutes after load before first poll (10s in dev for testing). */
const INITIAL_DELAY_MS = isDev ? 10 * 1_000 : 2 * 60 * 1_000;

/** 1 minute between poll attempts (5s in dev for testing). */
const POLL_INTERVAL_MS = isDev ? 5 * 1_000 : 1 * 60 * 1_000;

/** Short delay before injecting banner to allow React/Next.js to mount. */
const INJECT_DELAY_MS = isDev ? 500 : 1_000;

function log(msg: string): void {
  const line = `[UpdateChecker] ${msg}\n`;
  process.stderr.write(line);
}

interface VersionResponse {
  version: string;
  message?: string;
  downloads?: {
    linux: string;
    mac: string;
    windows: string;
  };
}

/**
 * Simple semver comparison that strips pre-release labels for numeric comparison.
 * Returns true if `remote` is strictly newer than `current`.
 */
function isNewerVersion(current: string, remote: string): boolean {
  const toNumbers = (v: string) =>
    v
      .replace(/[^0-9.]/g, "")
      .split(".")
      .map(Number);

  const curr = toNumbers(current);
  const rem = toNumbers(remote);
  const len = Math.max(curr.length, rem.length);

  for (let i = 0; i < len; i++) {
    const c = curr[i] ?? 0;
    const r = rem[i] ?? 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

async function fetchVersionInfo(): Promise<VersionResponse | null> {
  try {
    log(`Fetching ${VERSION_JSON_URL}...`);
    const response = await net.fetch(VERSION_JSON_URL, {
      method: "GET",
      headers: { "User-Agent": `DeckForge/${CURRENT_VERSION}` },
    });
    if (!response.ok) {
      log(`Fetch failed: HTTP ${response.status}`);
      return null;
    }
    const data = (await response.json()) as VersionResponse;
    log(`Fetched version: ${data.version}`);
    return data;
  } catch (err) {
    log(`Fetch error: ${err}`);
    return null;
  }
}

/** Pending update to re-inject on navigation (production: React/Next.js may replace DOM). */
let pendingUpdate: { version: string; downloadUrl: string; message?: string } | null = null;

/**
 * Schedules banner injection after INJECT_DELAY_MS so React/Next.js can mount first.
 * In production (.deb), the DOM may not be ready when did-finish-load fires.
 */
function scheduleBannerInjection(
  win: BrowserWindow,
  version: string,
  downloadUrl: string,
  message?: string
): void {
  pendingUpdate = { version, downloadUrl, message };
  setTimeout(() => {
    if (win.isDestroyed() || !pendingUpdate) return;
    log(`Injecting banner now`);
    injectUpdateBanner(win, pendingUpdate.version, pendingUpdate.downloadUrl, pendingUpdate.message);
  }, INJECT_DELAY_MS);
}

/** Escape HTML to prevent XSS; preserve newlines for display. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

/**
 * Injects an update banner at the bottom, aligned with the app UI.
 * Includes a "View details" overlay for changelog/message.
 */
function injectUpdateBanner(
  win: BrowserWindow,
  latest: string,
  downloadUrl: string,
  message?: string
): void {
  const hasMessage = Boolean(message && message.trim());
  const safeMessage = hasMessage ? escapeHtml(message!.trim()) : "";
  const safeMessageJson = JSON.stringify(safeMessage);
  const viewDetailsBtnHtml = hasMessage
    ? '<button id="__deckforge_view_details_btn__" style="color:#64748b;background:none;border:none;cursor:pointer;font-size:12px;padding:4px 8px;text-decoration:underline;text-underline-offset:2px;">View details</button>'
    : "";

  const script = /* js */ `
    (function () {
      if (document.getElementById('__deckforge_update_banner__')) return;

      const msgHtml = ${safeMessageJson};

      const banner = document.createElement('div');
      banner.id = '__deckforge_update_banner__';
      banner.style.cssText = [
        'position:fixed',
        'bottom:16px',
        'left:50%',
        'transform:translateX(-50%)',
        'max-width:min(560px,calc(100vw - 32px))',
        'width:100%',
        'background:rgba(255,255,255,0.95)',
        'backdrop-filter:blur(12px)',
        '-webkit-backdrop-filter:blur(12px)',
        'color:#191919',
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'padding:12px 16px',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'font-size:13px',
        'z-index:2147483646',
        'border:1px solid rgba(148,163,184,0.3)',
        'border-radius:12px',
        'box-shadow:0 4px 24px rgba(0,0,0,0.08)',
        'gap:12px',
      ].join(';');

      banner.innerHTML = \`
        <span style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
          <span style="font-size:18px;">✨</span>
          <span>
            DeckForge&nbsp;<strong style="color:#5141e5">${latest}</strong>&nbsp;is available
            &mdash;&nbsp;you have&nbsp;<strong>${CURRENT_VERSION}</strong>
          </span>
        </span>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
          ${viewDetailsBtnHtml}
          <a href="${downloadUrl}" target="_blank" style="color:#fff;text-decoration:none;background:#5141e5;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:500;white-space:nowrap;">Download update</a>
          <button onclick="document.getElementById('__deckforge_update_banner__').remove();var o=document.getElementById('__deckforge_update_overlay__');if(o)o.remove();" title="Dismiss" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:20px;line-height:1;padding:0 2px;">&times;</button>
        </div>
      \`;

      document.body.appendChild(banner);

      if (msgHtml) {
        const overlay = document.createElement('div');
        overlay.id = '__deckforge_update_overlay__';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:none;align-items:center;justify-content:center;z-index:2147483647;padding:24px;';
        overlay.onclick = function(e) { if (e.target === overlay) overlay.style.display = 'none'; };
        overlay.innerHTML = \`
          <div style="background:#fff;border-radius:16px;max-width:420px;width:100%;max-height:80vh;overflow:auto;box-shadow:0 24px 48px rgba(0,0,0,0.15);padding:24px;" onclick="event.stopPropagation()">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="margin:0;font-size:18px;font-weight:600;color:#191919;">What's new in ${latest}</h3>
              <button onclick="document.getElementById('__deckforge_update_overlay__').style.display='none'" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:24px;line-height:1;padding:0;">&times;</button>
            </div>
            <div style="color:#475569;font-size:14px;line-height:1.6;" id="__deckforge_overlay_content__"></div>
          </div>
        \`;
        document.body.appendChild(overlay);
        document.getElementById('__deckforge_overlay_content__').innerHTML = msgHtml;
        document.getElementById('__deckforge_view_details_btn__').onclick = function() {
          document.getElementById('__deckforge_update_overlay__').style.display = 'flex';
        };
      }
    })();
  `;

  win.webContents.executeJavaScript(script).catch((err) => {
    log(`Banner injection failed: ${err}`);
  });
}

/**
 * Polls for version info up to MAX_ATTEMPTS times with 1 min between attempts.
 * Stops as soon as a successful response is received or all attempts are exhausted.
 */
async function checkForUpdatesWithRetry(win: BrowserWindow): Promise<void> {
  log(`Starting check (current: ${CURRENT_VERSION})`);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (win.isDestroyed()) {
      log("Window destroyed, aborting");
      return;
    }

    log(`Attempt ${attempt}/${MAX_ATTEMPTS}`);
    const data = await fetchVersionInfo();

    if (data) {
      const newer = isNewerVersion(CURRENT_VERSION, data.version);
      log(`Remote ${data.version} vs current ${CURRENT_VERSION} -> newer? ${newer}`);
      if (newer) {
        const downloadUrl = WEBSITE_DOWNLOAD_URL;
        log(`Injecting banner for ${data.version} (after ${INJECT_DELAY_MS}ms delay)`);
        scheduleBannerInjection(win, data.version, downloadUrl, data.message);
      } else {
        log("No update needed, skipping banner");
      }
      return;
    }

    // Wait 1 minute before the next poll (skip delay after the last attempt)
    if (attempt < MAX_ATTEMPTS) {
      log(`Next poll in ${POLL_INTERVAL_MS / 1_000}s...`);
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  log("All attempts failed, no update info");
}

/**
 * Starts the update checker.
 * Waits 2 minutes after load, then polls 3 times with 1 min interval.
 * Re-injects banner on every navigation (handles Next.js client routing).
 */
export function startUpdateChecker(win: BrowserWindow): void {
  log("Registered, waiting for did-finish-load");
  let hasRunCheck = false;

  const onLoad = () => {
    if (pendingUpdate) {
      log("did-finish-load (navigation), re-injecting banner");
      scheduleBannerInjection(win, pendingUpdate.version, pendingUpdate.downloadUrl, pendingUpdate.message);
    } else if (!hasRunCheck) {
      hasRunCheck = true;
      log(`did-finish-load fired, first poll in ${INITIAL_DELAY_MS / 1_000}s`);
      setTimeout(() => {
        if (win.isDestroyed()) return;
        checkForUpdatesWithRetry(win);
      }, INITIAL_DELAY_MS);
    }
  };

  if (!win.webContents.isLoading()) {
    log(`Page already loaded, first poll in ${INITIAL_DELAY_MS / 1_000}s`);
    hasRunCheck = true;
    setTimeout(() => {
      if (win.isDestroyed()) return;
      checkForUpdatesWithRetry(win);
    }, INITIAL_DELAY_MS);
  }
  win.webContents.on("did-finish-load", onLoad);
}

export function stopUpdateChecker(): void {
  pendingUpdate = null;
}
