# ============================================================================
# RAYS-CORE: Windows Installer Build Script (.exe via electron-builder + NSIS)
# ============================================================================
# ZERO modifications to existing code. This script is 100% additive.
# It orchestrates the build using configuration files isolated in build/windows.
#
# Prerequisites on the build machine:
#   - Python 3.10+ (in PATH)
#   - Node.js 18+ / npm (in PATH)
#
# Usage:
#   cd build/windows
#   .\build-installer.ps1
#
# Output:
#   Electron_app/RAYS-Studio/desktop/release/*.exe
# ============================================================================

$BuildDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = (Resolve-Path (Join-Path $BuildDir "..\..")).Path
$StudioRoot = Join-Path $RepoRoot "Electron_app\RAYS-Studio"
$UIDir      = Join-Path $StudioRoot "ui"
$DesktopDir = Join-Path $StudioRoot "desktop"

Write-Host ""
Write-Host "=============================================================="
Write-Host "           RAYS-CORE: Windows Installer Build                 "
Write-Host "=============================================================="
Write-Host ""
Write-Host "  Repository root : $RepoRoot"
Write-Host "  Studio root     : $StudioRoot"
Write-Host "  UI directory    : $UIDir"
Write-Host "  Desktop dir     : $DesktopDir"
Write-Host ""

# -- Step 1: Verify prerequisites ──────────────────────────────────────────
Write-Host "[1/5] Checking prerequisites..."
try { $pyVer = (python --version 2>&1); Write-Host "  Python: $pyVer" } catch { Write-Host "Python check failed: $_"; Exit 1 }
try { $nodeVer = (node --version 2>&1); Write-Host "  Node.js: $nodeVer" } catch { Write-Host "Node.js check failed: $_"; Exit 1 }
try { $npmVer = (npm --version 2>&1); Write-Host "  npm: $npmVer" } catch { Write-Host "npm check failed: $_"; Exit 1 }

# -- Step 2: Install frontend dependencies & build UI ──────────────────────
Write-Host ""
Write-Host "[2/5] Installing UI dependencies and building frontend..."
Push-Location $UIDir
try {
    npm ci --prefer-offline 2>&1
    npm run build 2>&1
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "ERROR: UI build failed (exit code $LASTEXITCODE)"
        Exit 1
    }
    Write-Host "  UI built successfully -> $UIDir\dist"
} finally {
    Pop-Location
}

# -- Step 3: Bundle Python backend (PyInstaller) ───────────────────────────
Write-Host ""
Write-Host "[3/5] Bundling Python backend with PyInstaller..."
Push-Location $DesktopDir
try {
    $BackendOut = Join-Path $DesktopDir "resources\backend"
    $WorkDir = Join-Path $DesktopDir "resources\backend-build"
    $VenvDir = Join-Path $DesktopDir "resources\bundle-venv"

    if (Test-Path $BackendOut) { Remove-Item -Recurse -Force $BackendOut }
    if (Test-Path $WorkDir) { Remove-Item -Recurse -Force $WorkDir }
    New-Item -ItemType Directory -Force -Path $BackendOut | Out-Null

    Push-Location $RepoRoot
    try {
        if (-not (Test-Path $VenvDir)) {
            python -m venv $VenvDir 2>&1
        }
        $ActivateScript = Join-Path $VenvDir "Scripts\Activate.ps1"
        & $ActivateScript
        
        python -m pip install -q -U pip wheel 2>&1
        python -m pip install -q -e ".[studio,dev]" 2>&1
        python -m pip install -q "onnxruntime>=1.16,<2" "tokenizers>=0.15,<1" 2>&1

        $Spec = Join-Path $BuildDir "rays_backend.spec"
        pyinstaller $Spec `
          --distpath $BackendOut `
          --workpath $WorkDir `
          --noconfirm 2>&1
    } finally {
        Pop-Location
    }

    $BackendBin = Join-Path $BackendOut "rays-gui-bridge.exe"
    if (-not (Test-Path $BackendBin)) {
        Write-Host "ERROR: PyInstaller did not produce $BackendBin"
        Exit 1
    }
    $size = (Get-Item $BackendBin).Length / 1MB
    Write-Host "  Backend bundled: $BackendBin ($([math]::Round($size,1)) MB)"
} finally {
    Pop-Location
}

# -- Step 4: Fix dist HTML for Electron (file:// paths) ────────────────────
Write-Host ""
Write-Host "[4/5] Fixing dist HTML for Electron packaging..."
Push-Location $DesktopDir
try {
    node scripts/fix-dist-html.js 2>&1
    Write-Host "  HTML paths fixed for file:// loading"
} finally {
    Pop-Location
}

# -- Step 5: Build Electron installer (NSIS .exe) ──────────────────────────
Write-Host ""
Write-Host "[5/5] Building Windows installer with electron-builder..."
Push-Location $DesktopDir
try {
    npm ci --prefer-offline 2>&1
    npx electron-builder --config ../../../build/windows/electron-builder.yml --win nsis zip 2>&1
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "ERROR: electron-builder failed (exit code $LASTEXITCODE)"
        Exit 1
    }
} finally {
    Pop-Location
}

# -- Step 6: Verify output ─────────────────────────────────────────────────
Write-Host ""
$ReleaseDir = Join-Path $DesktopDir "release"
$installers = Get-ChildItem $ReleaseDir -Filter "*.exe" -ErrorAction SilentlyContinue
if ($installers.Count -eq 0) {
    Write-Host "  No .exe found in $ReleaseDir - check electron-builder logs"
} else {
    Write-Host "=============================================================="
    Write-Host "   BUILD COMPLETE - Windows Installer Ready                   "
    Write-Host "=============================================================="
    Write-Host ""
    foreach ($f in $installers) {
        $sizeMB = [math]::Round($f.Length / 1MB, 1)
        Write-Host "  -> $($f.FullName)  ($sizeMB MB)"
    }
}

# Also list zip if present
$zips = Get-ChildItem $ReleaseDir -Filter "*.zip" -ErrorAction SilentlyContinue
foreach ($z in $zips) {
    $sizeMB = [math]::Round($z.Length / 1MB, 1)
    Write-Host "  -> $($z.FullName)  ($sizeMB MB)"
}

Write-Host ""
Write-Host "Done. No existing source code was modified."
