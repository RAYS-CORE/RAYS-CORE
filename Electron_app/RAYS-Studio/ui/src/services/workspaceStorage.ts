import { PROVIDER_SETTINGS_KEY, RECENT_WORKSPACES_KEY, TOOL_SETTINGS_KEY } from "./appStorage";

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
  colorMode: "light" | "dark" | "system";
  theme: "nous" | "midnight" | "ember" | "mono" | "cyberpunk" | "slate";
};

export function loadAppearanceSettings(): AppearanceSettings {
  try {
    const raw = localStorage.getItem("rays-appearance-settings");
    if (!raw) return { colorMode: "dark", theme: "midnight" };
    const parsed = JSON.parse(raw);
    return {
      colorMode: parsed.colorMode ?? "dark",
      theme: parsed.theme ?? "midnight",
    };
  } catch {
    return { colorMode: "dark", theme: "midnight" };
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

export type ToolSettings = Record<string, string>;

export function loadToolSettings(): ToolSettings {
  try {
    const raw = localStorage.getItem(TOOL_SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ToolSettings;
  } catch {
    return {};
  }
}

export function saveToolSettings(settings: ToolSettings): void {
  localStorage.setItem(TOOL_SETTINGS_KEY, JSON.stringify(settings));
}

export type MemorySettings = {
  memoryEnabled: boolean;
  userProfileEnabled: boolean;
  memoryCharLimit: number;
  userCharLimit: number;
  provider: string;
  compressionEnabled: boolean;
  compressionThreshold: number;
  protectLastN: number;
};

const defaultMemorySettings: MemorySettings = {
  memoryEnabled: false,
  userProfileEnabled: false,
  memoryCharLimit: 2200,
  userCharLimit: 1375,
  provider: "builtin",
  compressionEnabled: true,
  compressionThreshold: 15250,
  protectLastN: 4,
};

export function loadMemorySettings(): MemorySettings {
  try {
    const raw = localStorage.getItem("rays-memory-settings");
    if (!raw) return { ...defaultMemorySettings };
    const parsed = JSON.parse(raw);
    return { ...defaultMemorySettings, ...parsed };
  } catch {
    return { ...defaultMemorySettings };
  }
}

export function saveMemorySettings(settings: MemorySettings): void {
  localStorage.setItem("rays-memory-settings", JSON.stringify(settings));
}

export type WorkspaceSettings = {
  workingDirectory: string;
  codeExecutionMode: "project" | "strict";
  persistentShell: boolean;
  envPassthrough: string;
  fileReadLimit: number;
};

const defaultWorkspaceSettings: WorkspaceSettings = {
  workingDirectory: "~",
  codeExecutionMode: "project",
  persistentShell: false,
  envPassthrough: "",
  fileReadLimit: 40000,
};

export function loadWorkspaceSettings(): WorkspaceSettings {
  try {
    const raw = localStorage.getItem("rays-workspace-settings");
    if (!raw) return { ...defaultWorkspaceSettings };
    const parsed = JSON.parse(raw);
    return { ...defaultWorkspaceSettings, ...parsed };
  } catch {
    return { ...defaultWorkspaceSettings };
  }
}

export function saveWorkspaceSettings(settings: WorkspaceSettings): void {
  localStorage.setItem("rays-workspace-settings", JSON.stringify(settings));
}
