<p align="center">
  <strong style="font-size: 2em;">🔷 RAYS DeckForge</strong>
</p>

<p align="center">
  <em>Local-first AI presentation generation engine — part of the RAYS ecosystem</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-Apache%202.0-blue?style=flat" alt="Apache2.0" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat" alt="Platform" />
  <img src="https://img.shields.io/badge/Default_LLM-Ollama-green?style=flat" alt="Ollama" />
</p>

---

# RAYS DeckForge

**RAYS DeckForge** is a local-first, self-hosted AI presentation generation engine. It generates professional presentations from prompts or uploaded documents, with full PPTX and PDF export capabilities.

### ✨ Key Principles

- **Local-first** — No cloud dependencies, no forced subscriptions
- **Ollama-native** — Default to local LLM inference, zero API keys required
- **Self-hosted** — Full control over your data and models
- **Enterprise-ready** — Deploy internally for your team
- **Extensible** — Custom templates, themes, and providers

---

## 🎛 Features

- **AI Slide Generation** — Generate complete presentations from prompts or documents
- **Custom Templates & Themes** — Create unlimited designs with HTML/Tailwind CSS
- **AI Template Generation** — Create templates from existing PowerPoint documents
- **Multi-Provider Support** — Ollama (default), OpenAI, Gemini, Anthropic, Azure, custom endpoints
- **Export** — PowerPoint (PPTX) and PDF with professional formatting
- **Built-In MCP Server** — Generate presentations over Model Context Protocol
- **Presentation Memory** — Local Mem0-based context system
- **Image Generation** — DALL-E 3, Gemini Flash, Pexels, Pixabay, ComfyUI, Open WebUI
- **Rich Media** — Icons, charts, and custom graphics
- **Tauri Desktop App** — Rust-powered native desktop application (Windows, macOS, Linux)
- **API Service** — RESTful API for programmatic presentation generation

---

## ⚡ Quick Start

### Prerequisites

- **Python 3.11** + [uv](https://docs.astral.sh/uv/)
- **Node.js** (LTS) + npm
- **Ollama** (recommended) — [ollama.com](https://ollama.com)

### 1. Install Dependencies

```bash
# Backend
cd servers/fastapi && uv sync

# Frontend
cd servers/nextjs && npm install
```

### 2. Configure (Optional)

The default `.env` is pre-configured for Ollama with `llama3.1:latest`. Ensure Ollama is running:

```bash
ollama pull llama3.1:latest
ollama serve
```

### 3. Start Development Servers

```bash
chmod +x start-dev.sh
./start-dev.sh
```

Or start manually:

```bash
# Terminal 1: Backend
cd servers/fastapi
uv run uvicorn server:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend
cd servers/nextjs
NEXT_PUBLIC_FAST_API=http://localhost:8000 npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 🖥 Desktop App (Tauri)

Run RAYS DeckForge as a native desktop application powered by Tauri:

### Development Mode
Ensure you have the development server running (starts Next.js frontend on port 3000 and FastAPI backend on port 8000):
```bash
./start-dev.sh
```

In a new terminal window, start the Tauri desktop client:
```bash
npm run tauri dev
```

### Production Build
Building the production application package compiles the FastAPI backend as a standalone binary sidecar and bundles it with the Next.js static frontend:

1. **Build the FastAPI backend executable:**
   ```bash
   cd servers/fastapi
   uv venv
   source .venv/bin/activate
   uv pip install pyinstaller
   uv pip install -e .
   pyinstaller server.spec
   ```
2. **Move binary to Tauri sidecar directory:**
   ```bash
   TARGET_TRIPLE=$(rustc -Vv | grep host | cut -f2 -d' ')
   mkdir -p ../../src-tauri/binaries
   cp dist/fastapi ../../src-tauri/binaries/fastapi-$TARGET_TRIPLE
   chmod +x ../../src-tauri/binaries/fastapi-$TARGET_TRIPLE
   cd ../..
   ```
3. **Compile the Tauri app installer:**
   ```bash
   npm run tauri build
   ```
   The production installers (`.dmg`, `.msi`, `.deb`, `.appimage`) will be saved in `src-tauri/target/release/bundle/`.

### ⚠️ macOS Installation Note

When installing the `.dmg` on macOS, you may see an error:

> **"RAYS DeckForge.app" is damaged and can't be opened. You should move it to the Bin.**

This happens because the app is not signed with an Apple Developer certificate. macOS Gatekeeper quarantines all unsigned apps downloaded from the internet. **The app is not actually damaged.**

**Fix:** Open Terminal and run:
```bash
xattr -cr /Applications/RAYS\ DeckForge.app
```

> **Note:** If you dragged the app to a different location, replace `/Applications/RAYS\ DeckForge.app` with the actual path. You can also type `xattr -cr ` and then drag the app onto the Terminal window to auto-fill the path.

After running the command, the app will open normally.

### ⚠️ Linux AppImage Note

On some Linux systems (especially with NVIDIA drivers, Wayland, or headless setups), WebKitGTK may fail to initialize EGL, causing this error:

```
Could not create surfaceless EGL display: EGL_BAD_ALLOC. Aborting...
```

**Fixes:** Try the following options in order:

1. **Disable DMABUF Renderer & Compositing (Recommended for NVIDIA/Wayland):**
   ```bash
   WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 ./RAYS.DeckForge_1.0.0_amd64.AppImage
   ```

2. **Force Software Rendering (Bypasses GPU driver entirely):**
   ```bash
   LIBGL_ALWAYS_SOFTWARE=1 ./RAYS.DeckForge_1.0.0_amd64.AppImage
   ```

3. **Force X11 Backend (If running on Wayland):**
   ```bash
   GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 ./RAYS.DeckForge_1.0.0_amd64.AppImage
   ```

> **Tip:** To make this permanent, you can create a desktop shortcut (`.desktop` file) or add a shell alias with the environment variables included.

---

## ⚙️ Configuration

All configuration is via environment variables in `.env`:

### LLM Provider

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM` | Provider: `ollama`, `openai`, `google`, `vertex`, `azure`, `anthropic`, `custom` | `ollama` |
| `OLLAMA_URL` | Ollama HTTP API URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Ollama model name | `llama3.1:latest` |
| `OPENAI_API_KEY` | OpenAI API key (if `LLM=openai`) | — |
| `GOOGLE_API_KEY` | Google API key (if `LLM=google`) | — |
| `ANTHROPIC_API_KEY` | Anthropic API key (if `LLM=anthropic`) | — |
| `CUSTOM_LLM_URL` | OpenAI-compatible endpoint (if `LLM=custom`) | — |

### Image Generation

| Variable | Description |
|----------|-------------|
| `IMAGE_PROVIDER` | `pexels`, `pixabay`, `gemini_flash`, `dall-e-3`, `gpt-image-1.5`, `comfyui`, `open_webui` |
| `DISABLE_IMAGE_GENERATION` | Set to `true` to skip image generation |

### System

| Variable | Description | Default |
|----------|-------------|---------|
| `DISABLE_AUTH` | Disable login requirement | `true` |
| `DATABASE_URL` | SQLAlchemy database URL | SQLite (auto) |
| `DISABLE_ANONYMOUS_TRACKING` | Disable all telemetry | `true` |

---

## 🔌 API

Generate presentations programmatically:

```bash
curl -X POST http://localhost:8000/api/v1/ppt/presentation/generate \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Introduction to Machine Learning",
    "n_slides": 5,
    "language": "English",
    "template": "general",
    "export_as": "pptx"
  }'
```

**Response:**
```json
{
  "presentation_id": "d3000f96-...",
  "path": "/app_data/d3000f96-.../Introduction_to_Machine_Learning.pptx",
  "edit_path": "/presentation?id=d3000f96-..."
}
```

Full API docs available at **http://localhost:8000/docs** when the backend is running.

---

## 🏗 Architecture

```
RAYS_DECK/
├── servers/
│   ├── fastapi/          # Python backend (presentation engine, LLM orchestration)
│   └── nextjs/           # React frontend (dashboard, editor, templates)
├── src-tauri/            # Tauri desktop configuration, Rust sources, and assets
├── presentation-export/  # PPTX/PDF export runtime
├── scripts/              # Utility scripts
└── start-dev.sh          # Local development launcher
```

### Stack

- **Backend:** FastAPI + SQLModel + Alembic
- **Frontend:** Next.js 14 + Redux Toolkit + Tailwind CSS
- **Desktop:** Tauri v2 (Rust-based shell wrapping Next.js + PyInstaller Python sidecar)
- **LLM:** Multi-provider (Ollama, OpenAI, Google, Anthropic, Azure, Custom)
- **Memory:** Mem0 OSS (local Qdrant + SQLite)
- **Export:** Puppeteer-based HTML→PPTX/PDF pipeline

---

## 📄 License

Apache 2.0 — See [LICENSE](./LICENSE)

---

<p align="center">
  <strong>RAYS DeckForge</strong> — Part of the RAYS Ecosystem
</p>
