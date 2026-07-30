/**
 * LibreOffice download URLs for automated installation.
 * Uses direct CDN URLs (download.documentfoundation.org) — the donate URLs
 * return HTML pages instead of the actual installer on Windows.
 * Update the version when upgrading to a newer LibreOffice release.
 * See https://www.libreoffice.org/download/download-libreoffice/
 */
export const LIBREOFFICE_VERSION = "25.8.5";

const CDN_BASE = "https://download.documentfoundation.org/libreoffice/stable";

export const LIBREOFFICE_DOWNLOAD_URLS = {
  win64: `${CDN_BASE}/${LIBREOFFICE_VERSION}/win/x86_64/LibreOffice_${LIBREOFFICE_VERSION}_Win_x86-64.msi`,
  macX64: `${CDN_BASE}/${LIBREOFFICE_VERSION}/mac/x86_64/LibreOffice_${LIBREOFFICE_VERSION}_MacOS_x86-64.dmg`,
  macArm64: `${CDN_BASE}/${LIBREOFFICE_VERSION}/mac/aarch64/LibreOffice_${LIBREOFFICE_VERSION}_MacOS_aarch64.dmg`,
} as const;
