import type { ProviderConfig } from "./raysSession";
import { PROVIDER_SETTINGS_KEY, RECENT_WORKSPACES_KEY } from "./appStorage";

const MAX_RECENT = 12;

export type RecentWorkspace = {
  path: string;
  lastOpenedAt: number;
};

export type StoredProviderSettings = ProviderConfig;

const defaultProvider: StoredProviderSettings = {
  provider: "ollama",
  model: "qwen3-coder:30b",
  apiKey: "",
};

function readLegacyProvider(): StoredProviderSettings | null {
  try {
    const raw = localStorage.getItem("rays-provider-settings");
    if (!raw) return null;
    return JSON.parse(raw) as StoredProviderSettings;
  } catch {
    return null;
  }
}

function readLegacyRecent(): RecentWorkspace[] | null {
  try {
    const raw = localStorage.getItem("rays-recent-workspaces");
    if (!raw) return null;
    const list = JSON.parse(raw) as RecentWorkspace[];
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

export function loadProviderSettings(): StoredProviderSettings {
  try {
    const raw = localStorage.getItem(PROVIDER_SETTINGS_KEY);
    if (!raw) {
      const legacy = readLegacyProvider();
      if (legacy) {
        saveProviderSettings(legacy);
        localStorage.removeItem("rays-provider-settings");
        return legacy;
      }
      return { ...defaultProvider };
    }
    const parsed = JSON.parse(raw) as Partial<StoredProviderSettings>;
    return {
      provider: parsed.provider ?? defaultProvider.provider,
      model: parsed.model ?? defaultProvider.model,
      apiKey: parsed.apiKey ?? "",
    };
  } catch {
    return { ...defaultProvider };
  }
}

export function saveProviderSettings(settings: StoredProviderSettings): void {
  localStorage.setItem(PROVIDER_SETTINGS_KEY, JSON.stringify(settings));
}

export function loadRecentWorkspaces(): RecentWorkspace[] {
  try {
    const raw = localStorage.getItem(RECENT_WORKSPACES_KEY);
    if (!raw) {
      const legacy = readLegacyRecent();
      if (legacy?.length) {
        localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(legacy));
        localStorage.removeItem("rays-recent-workspaces");
        return legacy.filter((w) => typeof w.path === "string" && w.path.length > 0);
      }
      return [];
    }
    const list = JSON.parse(raw) as RecentWorkspace[];
    return Array.isArray(list)
      ? list.filter((w) => typeof w.path === "string" && w.path.length > 0)
      : [];
  } catch {
    return [];
  }
}

export function rememberWorkspace(path: string): void {
  const normalized = path.trim();
  if (!normalized) return;
  const now = Date.now();
  const existing = loadRecentWorkspaces().filter((w) => w.path !== normalized);
  const next: RecentWorkspace[] = [{ path: normalized, lastOpenedAt: now }, ...existing].slice(
    0,
    MAX_RECENT
  );
  localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(next));
}

export function removeRecentWorkspace(path: string): void {
  const next = loadRecentWorkspaces().filter((w) => w.path !== path);
  localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(next));
}

/** Stable id so RAYS memory + Chroma align with this workspace across restarts. */
export function conversationIdForWorkspace(workspacePath: string): string {
  let hash = 0;
  const s = workspacePath.trim();
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return `ws_${hash.toString(16)}`;
}

export type AppearanceSettings = {
  language: string;
  colorMode: "light" | "dark" | "system";
  theme: "nous" | "midnight" | "ember" | "mono" | "cyberpunk" | "slate";
  toolCallDisplay: "product" | "technical";
};

export function loadAppearanceSettings(): AppearanceSettings {
  try {
    const raw = localStorage.getItem("rays-appearance-settings");
    if (!raw) return { language: "english", colorMode: "dark", theme: "midnight", toolCallDisplay: "technical" };
    const parsed = JSON.parse(raw);
    return {
      language: parsed.language ?? "english",
      colorMode: parsed.colorMode ?? "dark",
      theme: parsed.theme ?? "midnight",
      toolCallDisplay: parsed.toolCallDisplay ?? "technical",
    };
  } catch {
    return { language: "english", colorMode: "dark", theme: "midnight", toolCallDisplay: "technical" };
  }
}

export function saveAppearanceSettings(settings: AppearanceSettings): void {
  localStorage.setItem("rays-appearance-settings", JSON.stringify(settings));
}

export function applyAppearanceSettings(settings: AppearanceSettings) {
  const root = document.documentElement;
  
  // Remove all old theme classes
  const themeClasses = ["theme-nous", "theme-midnight", "theme-ember", "theme-mono", "theme-cyberpunk", "theme-slate"];
  themeClasses.forEach((cls) => root.classList.remove(cls));
  
  // Add current theme class
  root.classList.add(`theme-${settings.theme}`);
  
  // Handle dark/light mode
  if (settings.colorMode === "dark") {
    root.classList.add("dark");
  } else if (settings.colorMode === "light") {
    root.classList.remove("dark");
  } else {
    const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (systemIsDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}
