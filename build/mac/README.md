# RAYS-CORE macOS Build Instructions

## Existing Build Configuration
All build scripts and configurations are already in place in the repository.

### Key Files (Untouched, Existing)
- `Electron_app/RAYS-Studio/build-dmg.sh` - macOS build script
- `Electron_app/RAYS-Studio/desktop/package.json` - electron-builder configuration
- `Electron_app/RAYS-Studio/desktop/pyinstaller/rays-bridge.spec` - PyInstaller spec for backend

## Build Command
Run this command in the project root on a macOS machine:

```bash
cd Electron_app/RAYS-Studio
./build-dmg.sh
```

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm

### Output
The built .dmg and zip files will be located in:
`Electron_app/RAYS-Studio/desktop/release/`
