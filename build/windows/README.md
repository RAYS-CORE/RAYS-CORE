# RAYS-CORE Windows Build Instructions

## Existing Build Configuration
All build scripts and configurations are already in place in the repository.

### Key Files (Untouched, Existing)
- `Electron_app/RAYS-Studio/build-windows.ps1` - Windows build script
- `Electron_app/RAYS-Studio/desktop/package.json` - electron-builder configuration
- `Electron_app/RAYS-Studio/desktop/pyinstaller/rays-bridge.spec` - PyInstaller spec for backend

## Build Command
Run this command in the project root on a Windows machine:

```powershell
cd Electron_app/RAYS-Studio
.\build-windows.ps1
```

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm

### Output
The built .exe and zip files will be located in:
`Electron_app/RAYS-Studio/desktop/release/`
