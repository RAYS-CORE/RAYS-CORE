/** Inline SVG icons for flight billboards (top-down aircraft). */

function svgUri(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const PLANE_ICON = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <path fill="#7df9c6" stroke="#0a1a12" stroke-width="1.2"
    d="M16 2 L18 12 L28 14 L18 16 L20 28 L16 24 L12 28 L14 16 L4 14 L14 12 Z"/>
</svg>`);

export const PLANE_ICON_MIL = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <path fill="#ffb347" stroke="#331a00" stroke-width="1.2"
    d="M16 2 L18 12 L28 14 L18 16 L20 28 L16 24 L12 28 L14 16 L4 14 L14 12 Z"/>
</svg>`);
