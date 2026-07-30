import React from "react";
import { resolveBackendAssetUrl } from "@/utils/api";

export type RemoteSvgOptions = {
  strokeColor?: string;
  fillColor?: string;
  className?: string;
  title?: string;
  color?: string;
 
};

function transformSvg(svgText: string, options: RemoteSvgOptions): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgEl = doc.querySelector("svg");
    if (!svgEl) return svgText;
    svgEl.style.outline = "none";
    svgEl.style.border = "none";
    svgEl.style.margin = "0";
    svgEl.style.padding = "0";
    svgEl.style.display = "inline-block";
    svgEl.style.verticalAlign = "middle";
    svgEl.style.overflow = "visible";
    svgEl.style.position = "relative";
    // Set only provided attributes to avoid clobbering inner shapes
    if (options.className) svgEl.setAttribute("class", options.className);
    if (options.strokeColor) svgEl.setAttribute("stroke", options.strokeColor);
    if (options.fillColor !== undefined) svgEl.setAttribute("fill", options.fillColor);

  
      const viewBox = svgEl.getAttribute("viewBox");
      let vbX = 0, vbY = 0, vbW = 0, vbH = 0;
      if (viewBox) {
        const parts = viewBox.split(/\s+/).map((n) => Number(n));
        if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
          vbX = parts[0];
          vbY = parts[1];
          vbW = parts[2];
          vbH = parts[3];
        }
      }
      // Only consider direct child rects; safer heuristic
      const rects = Array.from(svgEl.querySelectorAll("rect")).filter((r) => r.parentNode === svgEl);
      rects.forEach((r) => {
        const xAttr = r.getAttribute("x") || "0";
        const yAttr = r.getAttribute("y") || "0";
        const wAttr = r.getAttribute("width") || "";
        const hAttr = r.getAttribute("height") || "";
        const fill = r.getAttribute("fill");

        const x = Number(xAttr);
        const y = Number(yAttr);
        const w = Number(wAttr);
        const h = Number(hAttr);

        const isExactHundredPercent = wAttr === "100%" && hAttr === "100%" && (xAttr === "0" || xAttr === "0%") && (yAttr === "0" || yAttr === "0%");
        const approximatelyCoversViewBox = (
          vbW > 0 && vbH > 0 &&
          !Number.isNaN(w) && !Number.isNaN(h) &&
          Math.abs(w - vbW) <= Math.max(1, vbW * 0.02) &&
          Math.abs(h - vbH) <= Math.max(1, vbH * 0.02) &&
          Math.abs(x - vbX) <= Math.max(1, vbW * 0.02) &&
          Math.abs(y - vbY) <= Math.max(1, vbH * 0.02)
        );
        const noFill = (fill === null || fill === "none" || fill === "transparent");

        const looksLikeFrame = noFill && (isExactHundredPercent || approximatelyCoversViewBox);
        if (looksLikeFrame) {
          r.parentElement?.removeChild(r);
        }
      });
    

    return svgEl.outerHTML;
  } catch {
    return svgText;
  }
}

// Simple in-memory LRU cache for transformed SVG markup
const SVG_CACHE_LIMIT = 15;
const svgCache: Map<string, string> = new Map();

function makeCacheKey(url: string, options: RemoteSvgOptions): string {
  return [
    url,
    `sc=${options.strokeColor || ""}`,
    `fc=${options.fillColor || ""}`,
    `cls=${options.className || ""}`,
    
  ].join("|");
}

function cacheGet(key: string): string | undefined {
  const value = svgCache.get(key);
  if (value !== undefined) {
    // refresh LRU order
    svgCache.delete(key);
    svgCache.set(key, value);
  }
  return value;
}

function cacheSet(key: string, value: string) {
  if (svgCache.has(key)) svgCache.delete(key);
  svgCache.set(key, value);
  if (svgCache.size > SVG_CACHE_LIMIT) {
    const oldestKey = svgCache.keys().next().value as string | undefined;
    if (oldestKey !== undefined) svgCache.delete(oldestKey);
  }
}

export function useRemoteSvgIcon(url?: string, options: RemoteSvgOptions = {}) {
  const [svgMarkup, setSvgMarkup] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const resolvedUrl = React.useMemo(
    () => resolveBackendAssetUrl(url),
    [url]
  );

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!resolvedUrl) {
        // build simple fallback svg
        const stroke = options.strokeColor || "currentColor";
        const fill = options.fillColor ?? "none";
        const cls = options.className ? ` class=\"${options.className}\"` : "";
        setSvgMarkup(`<svg${cls} xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' stroke='${stroke}' fill='${fill}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10' fill='currentColor' opacity='0.12'></circle><path d='M8 12l3 3 5-6' fill='none'></path></svg>`);
        return;
      }
      // non-svg extensions fallback
      if (/\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(resolvedUrl)) {
        const stroke = options.strokeColor || "currentColor";
        const fill = options.fillColor ?? "none";
        const cls = options.className ? ` class=\"${options.className}\"` : "";
        setSvgMarkup(`<svg${cls} xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' stroke='${stroke}' fill='${fill}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10' fill='currentColor' opacity='0.12'></circle><path d='M8 12l3 3 5-6' fill='none'></path></svg>`);
        return;
      }

      // Cache lookup
      const cacheKey = makeCacheKey(resolvedUrl, options);
      const cached = cacheGet(cacheKey);
      if (cached) {
        setSvgMarkup(cached);
        setError(null);
        return;
      }
      try {
       
        const res = await fetch(resolvedUrl);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const ct = res.headers.get("content-type") || "";
        if (ct && !ct.includes("svg")) {
          throw new Error(`Non-SVG content: ${ct}`);
        }
        const text = await res.text();
        if (cancelled) return;
        const transformed = transformSvg(text, options);
        cacheSet(cacheKey, transformed);
        setSvgMarkup(transformed);
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load SVG");
        const stroke = options.strokeColor || "currentColor";
        const fill = options.fillColor ?? "none";
        const cls = options.className ? ` class=\"${options.className}\"` : "";
        setSvgMarkup(`<svg${cls} xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' stroke='${stroke}' fill='${fill}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10' fill='currentColor' opacity='0.12'></circle><path d='M8 12l3 3 5-6' fill='none'></path></svg>`);
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.warn("RemoteSvgIcon fetch error", e);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [resolvedUrl, options.strokeColor, options.fillColor, options.className]);

  return { svgMarkup, error };
}

export const RemoteSvgIcon: React.FC<{
  url?: string;
  strokeColor?: string;
  fillColor?: string;
  className?: string;
  title?: string;
  color?: string;
}> = ({ url, strokeColor, fillColor, className, title, color }) => {
  const resolvedUrl = resolveBackendAssetUrl(url);
  const { svgMarkup } = useRemoteSvgIcon(resolvedUrl, { strokeColor, fillColor, className, title, color });
  if (!svgMarkup) return null;
  return (
    <span
      data-path={resolvedUrl}
      role={title ? "img" : undefined}
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
      style={{ display: "inline-block", color: color }}
    />
  );
};