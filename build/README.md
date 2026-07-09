# RAYS-CORE Standalone Installer Build Guide

This directory houses the deployment pipeline configurations for building self-contained, zero-configuration standalone installers for RAYS-CORE (`.exe` for Windows, `.dmg` for macOS).

> **The Absolute Zero-Modification Firewall**:
> All files in the `build/` directory are strictly **additive**. Existing core application files, logic pipelines, and Electron source code are 100% untouched.

---

## Directory Partitioning

All build-related files are partitioned cleanly by OS and isolated in this folder:

```
build/
├── README.md                      # This documentation
├── windows/
│   ├── build-installer.ps1        # Windows build orchestrator (PowerShell)
│   ├── electron-builder.yml       # Custom electron-builder configuration for Windows
│   └── rays_backend.spec          # Standalone PyInstaller spec file for the Python backend
│
└── mac/
    ├── build-installer.sh         # macOS build orchestrator (Bash)
    ├── electron-builder.yml       # Custom electron-builder configuration for macOS
    ├── entitlements.mac.plist     # Hardened runtime security entitlements for macOS
    ├── entitlements.mac.inherit.plist # Helper process entitlements for macOS
    └── rays_backend.spec          # Standalone PyInstaller spec file for the Python backend
```

---

## Build Execution Commands

### 1. Windows Standalone Installer (`.exe`)

#### Prerequisites
- **Python 3.10+** (in PATH)
- **Node.js 18+ / npm** (in PATH)

#### Compile Command
Run the following commands in an elevated PowerShell terminal on a Windows machine:

```powershell
cd build/windows
.\build-installer.ps1
```

*The final standalone executable installer (`RAYS Studio Setup *.exe`) and portable zip will be placed in `Electron_app/RAYS-Studio/desktop/release/`.*

---

### 2. macOS Standalone Installer (`.dmg`)

#### Prerequisites
- **Python 3.10+** (accessible as `python3` in PATH)
- **Node.js 18+ / npm** (in PATH)

#### Compile Command
Run the following commands in a terminal on a macOS machine:

```bash
cd build/mac
chmod +x build-installer.sh
./build-installer.sh
```

*The final standalone disk image (`RAYS Studio-*.dmg`) and portable zip will be placed in `Electron_app/RAYS-Studio/desktop/release/`.*

---

## Standalone Zero-Configuration Architecture

1. **Self-Contained Backend**: PyInstaller compiles `src/rays_core` and `ws_bridge.py` into a single standalone binary (`rays-gui-bridge` / `rays-gui-bridge.exe`) with all required Python wheels, pip packages, `onnxruntime`, and dependencies embedded.
2. **Seamless Spawning**: The packaged Electron app spawns and communicates with the bundled backend binary automatically on user machines without requiring any local Python installation or developer tools.
3. **No Global Side-Effects**: The installer packages everything cleanly, using relative paths within the installation folder.
