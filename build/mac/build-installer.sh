#!/usr/bin/env bash
# ============================================================================
# RAYS-CORE: macOS Installer Build Script (.dmg via electron-builder)
# ============================================================================
# ZERO modifications to existing code. This script is 100% additive.
# It orchestrates the build using configuration files isolated in build/mac.
#
# Prerequisites on the build machine:
#   - Python 3.10+ (as python3 in PATH)
#   - Node.js 18+ / npm (in PATH)
#
# Usage:
#   cd build/mac
#   chmod +x build-installer.sh && ./build-installer.sh
#
# Output:
#   Electron_app/RAYS-Studio/desktop/release/*.dmg
# ============================================================================
set -euo pipefail

BUILD_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$BUILD_DIR/../.." && pwd)"
STUDIO_ROOT="$REPO_ROOT/Electron_app/RAYS-Studio"
UI_DIR="$STUDIO_ROOT/ui"
DESKTOP_DIR="$STUDIO_ROOT/desktop"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          RAYS-CORE: macOS Installer Build (.dmg)            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Repository root : $REPO_ROOT"
echo "  Studio root     : $STUDIO_ROOT"
echo "  UI directory    : $UI_DIR"
echo "  Desktop dir     : $DESKTOP_DIR"
echo ""

# ── Step 1: Verify prerequisites ──────────────────────────────────────────
echo "[1/5] Checking prerequisites..."
python3 --version || { echo "ERROR: Python 3 not found"; exit 1; }
node --version    || { echo "ERROR: Node.js not found"; exit 1; }
npm --version     || { echo "ERROR: npm not found"; exit 1; }

# ── Step 2: Install frontend dependencies & build UI ──────────────────────
echo ""
echo "[2/5] Installing UI dependencies and building frontend..."
cd "$UI_DIR"
npm ci --prefer-offline 2>/dev/null || npm install
npm run build
echo "  UI built successfully -> $UI_DIR/dist"

# ── Step 3: Bundle Python backend (PyInstaller) ───────────────────────────
echo ""
echo "[3/5] Bundling Python backend with PyInstaller..."
cd "$DESKTOP_DIR"

BACKEND_OUT="$DESKTOP_DIR/resources/backend"
WORK_DIR="$DESKTOP_DIR/resources/backend-build"
VENV_DIR="$DESKTOP_DIR/resources/bundle-venv"

rm -rf "$BACKEND_OUT" "$WORK_DIR"
mkdir -p "$BACKEND_OUT"

cd "$REPO_ROOT"

if [[ ! -d "$VENV_DIR" ]]; then
  python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"

pip install -q -U pip wheel
pip install -q -e ".[studio,dev]"
pip install -q "onnxruntime>=1.16,<2" "tokenizers>=0.15,<1"

pyinstaller "$BUILD_DIR/rays_backend.spec" \
  --distpath "$BACKEND_OUT" \
  --workpath "$WORK_DIR" \
  --noconfirm

BACKEND_BIN="rays-gui-bridge"
if [[ -f "$BACKEND_OUT/rays-gui-bridge.exe" ]]; then
  BACKEND_BIN="rays-gui-bridge.exe"
fi

if [[ ! -f "$BACKEND_OUT/$BACKEND_BIN" ]]; then
  echo "ERROR: PyInstaller did not produce $BACKEND_OUT/$BACKEND_BIN" >&2
  exit 1
fi

chmod +x "$BACKEND_OUT/$BACKEND_BIN" 2>/dev/null || true
echo "  Backend bundled: $BACKEND_OUT/$BACKEND_BIN"

# ── Step 4: Fix dist HTML for Electron (file:// paths) ────────────────────
echo ""
echo "[4/5] Fixing dist HTML for Electron packaging..."
cd "$DESKTOP_DIR"
node scripts/fix-dist-html.js
echo "  HTML paths fixed for file:// loading"

# ── Step 5: Build Electron installer (.dmg) ───────────────────────────────
echo ""
echo "[5/5] Building macOS installer with electron-builder..."
cd "$DESKTOP_DIR"
npm ci --prefer-offline 2>/dev/null || npm install

npx electron-builder --config ../../../build/mac/electron-builder.yml --mac dmg zip

# ── Step 6: Verify output ─────────────────────────────────────────────────
echo ""
RELEASE_DIR="$DESKTOP_DIR/release"
DMG_FILES=$(find "$RELEASE_DIR" -name "*.dmg" 2>/dev/null | head -5)
if [[ -z "$DMG_FILES" ]]; then
    echo "⚠ No .dmg found in $RELEASE_DIR — check electron-builder logs"
else
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  ✅ BUILD COMPLETE — macOS Installer Ready                 ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    for f in $DMG_FILES; do
        SIZE=$(du -h "$f" | cut -f1)
        echo "  → $f  ($SIZE)"
    done
fi

ZIP_FILES=$(find "$RELEASE_DIR" -name "*.zip" 2>/dev/null | head -5)
for z in $ZIP_FILES; do
    SIZE=$(du -h "$z" | cut -f1)
    echo "  → $z  ($SIZE)"
done

echo ""
echo "Done. No existing source code was modified."
