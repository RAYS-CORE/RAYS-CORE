// Utility to get the FastAPI base URL
export function getFastAPIUrl(): string {
  if (typeof window !== "undefined" && window.env?.NEXT_PUBLIC_FAST_API) {
    return window.env.NEXT_PUBLIC_FAST_API;
  }

  if (process.env.NEXT_PUBLIC_FAST_API) {
    return process.env.NEXT_PUBLIC_FAST_API;
  }

  const queryFastApiUrl = getFastApiUrlFromQuery();
  if (queryFastApiUrl) {
    return queryFastApiUrl;
  }

  // Web runtime: route backend assets and APIs through current origin
  // (reverse-proxy handles /api/v1, /app_data, /static).
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://127.0.0.1:5000";
}

function getFastApiUrlFromQuery(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("fastapiUrl");
    if (!value) return null;

    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function isAbsoluteHttpUrl(path: string): boolean {
  return /^https?:\/\//i.test(path);
}

function withLeadingSlash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
}

// Utility to construct API URL for web runtime.
export function getApiUrl(path: string): string {
  if (isAbsoluteHttpUrl(path)) {
    return path;
  }

  const normalizedPath = withLeadingSlash(path);
  const isFastApiEndpoint = normalizedPath.startsWith("/api/v1/");
  const hasConfiguredFastApi = !!process.env.NEXT_PUBLIC_FAST_API;
  const hasWindowFastApi =
    typeof window !== "undefined" && !!window.env?.NEXT_PUBLIC_FAST_API;
  const hasQueryFastApi = !!getFastApiUrlFromQuery();

  // In web deployments, /api/v1 is typically reverse-proxied by the web server.
  // Keep browser requests same-origin so session cookies stay attached by default.
  // For Tauri split-port runtime and query-overrides, target FastAPI directly.
  // Server-side callers can still use configured FastAPI base URLs directly.
  if (
    isFastApiEndpoint &&
    (isTauriRuntime() || hasWindowFastApi || hasQueryFastApi)
  ) {
    return `${getFastAPIUrl()}${normalizedPath}`;
  }

  if (
    isFastApiEndpoint &&
    typeof window === "undefined" &&
    hasConfiguredFastApi
  ) {
    return `${getFastAPIUrl()}${normalizedPath}`;
  }

  return normalizedPath;
}

/**
 * getApiUrl may return a path without host (e.g. `/api/v1/...`). A single-argument
 * `new URL("/api/...")` call is invalid; use this before `new URL(..., ...)`-style
 * builds or to obtain an absolute string for `URL` + `searchParams`.
 */
export function buildAbsoluteApiRequestUrl(
  path: string,
  baseForRelative: string = typeof window !== "undefined" &&
  window.location?.origin
    ? window.location.origin
    : "http://127.0.0.1:5000"
): string {
  const resolved = getApiUrl(path);
  if (isAbsoluteHttpUrl(resolved)) {
    return resolved;
  }
  return new URL(resolved, baseForRelative).toString();
}

function hasBackendAssetPrefix(path: string): boolean {
  return path.startsWith("/static/") || path.startsWith("/app_data/");
}

// Resolve backend-served asset paths to the FastAPI origin.
export function resolveBackendAssetUrl(path?: string): string {
  if (!path) return "";

  const trimmedPath = path.trim();
  if (!trimmedPath) return "";

  if (
    trimmedPath.startsWith("data:") ||
    trimmedPath.startsWith("blob:") ||
    trimmedPath.startsWith("file:")
  ) {
    return trimmedPath;
  }

  if (isAbsoluteHttpUrl(trimmedPath)) {
    try {
      const parsed = new URL(trimmedPath);
      if (hasBackendAssetPrefix(parsed.pathname)) {
        return `${getFastAPIUrl()}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return trimmedPath;
    } catch {
      return trimmedPath;
    }
  }

  const normalizedPath = withLeadingSlash(trimmedPath);
  if (hasBackendAssetPrefix(normalizedPath)) {
    return `${getFastAPIUrl()}${normalizedPath}`;
  }

  // Handle absolute filesystem paths (e.g. /home/user/project/app_data/exports/file.pdf)
  // by extracting the relative part after app_data or static.
  const appDataMatch = trimmedPath.match(/[\/\\]app_data[\/\\](.+)$/);
  if (appDataMatch) {
    return `${getFastAPIUrl()}/app_data/${appDataMatch[1].replace(/\\/g, "/")}`;
  }

  const staticMatch = trimmedPath.match(/[\/\\]static[\/\\](.+)$/);
  if (staticMatch) {
    return `${getFastAPIUrl()}/static/${staticMatch[1].replace(/\\/g, "/")}`;
  }

  return trimmedPath;
}
