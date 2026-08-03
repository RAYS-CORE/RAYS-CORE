#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colors ──────────────────────────────────────────────────────
CYAN='\033[0;36m'
VIOLET='\033[0;35m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Default Ports ───────────────────────────────────────────────
DEFAULT_FASTAPI_PORT=8000
DEFAULT_NEXTJS_PORT=3000

# ── Usage / Help ────────────────────────────────────────────────
show_help() {
  echo ""
  echo -e "${BOLD}RAYS DeckForge — Development Server${RESET}"
  echo ""
  echo -e "Usage: ${CYAN}./start-dev.sh${RESET} [options]"
  echo ""
  echo "Options:"
  echo "  --fastapi-port PORT   Set the FastAPI backend port (default: ${DEFAULT_FASTAPI_PORT})"
  echo "  --nextjs-port PORT    Set the Next.js frontend port (default: ${DEFAULT_NEXTJS_PORT})"
  echo "  --skip-install        Skip dependency installation checks"
  echo "  --help                Show this help message"
  echo ""
  echo "Environment variables (also settable in .env):"
  echo "  FASTAPI_PORT          Same as --fastapi-port"
  echo "  NEXTJS_PORT           Same as --nextjs-port"
  echo ""
  echo "Examples:"
  echo "  ./start-dev.sh"
  echo "  ./start-dev.sh --fastapi-port 9000 --nextjs-port 4000"
  echo "  ./start-dev.sh --skip-install"
  echo ""
  exit 0
}

# ── Parse CLI Arguments ────────────────────────────────────────
SKIP_INSTALL=false
CLI_FASTAPI_PORT=""
CLI_NEXTJS_PORT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --fastapi-port)
      CLI_FASTAPI_PORT="$2"
      shift 2
      ;;
    --nextjs-port)
      CLI_NEXTJS_PORT="$2"
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    --help|-h)
      show_help
      ;;
    *)
      echo -e "${RED}Unknown option: $1${RESET}"
      echo "Run './start-dev.sh --help' for usage information."
      exit 1
      ;;
  esac
done

# ── Load .env ───────────────────────────────────────────────────
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

# CLI args > env vars > defaults
FASTAPI_PORT=${CLI_FASTAPI_PORT:-${FASTAPI_PORT:-$DEFAULT_FASTAPI_PORT}}
NEXTJS_PORT=${CLI_NEXTJS_PORT:-${NEXTJS_PORT:-$DEFAULT_NEXTJS_PORT}}
export NEXT_PUBLIC_URL="http://localhost:${NEXTJS_PORT}"

# ── Cleanup ─────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${VIOLET}Stopping RAYS DeckForge services...${RESET}"
  kill $FASTAPI_PID $NEXTJS_PID 2>/dev/null || true
  pkill -f "uvicorn server:app" 2>/dev/null || true
  pkill -f "next dev" 2>/dev/null || true
  echo -e "${GREEN}✓ All services stopped.${RESET}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# ── Banner ──────────────────────────────────────────────────────
echo -e "${CYAN}"
cat "$SCRIPT_DIR/scripts/deckforge-ascii.txt" 2>/dev/null || echo "RAYS DeckForge"
echo -e "${RESET}"
echo -e "${DIM}Local-first AI presentation engine${RESET}"
echo ""

# ── Prerequisite Checks ────────────────────────────────────────
echo -e "${VIOLET}Checking prerequisites...${RESET}"

check_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo -e "${RED}✗ $1 is required but not found.${RESET}"
    if [ -n "$2" ]; then
      echo -e "  ${DIM}Install: $2${RESET}"
    fi
    exit 1
  fi
  echo -e "  ${GREEN}✓${RESET} $1 found"
}

check_command uv "https://docs.astral.sh/uv/getting-started/installation/"
check_command node "https://nodejs.org/"
check_command npm "(bundled with Node.js)"

# ── Port Conflict Check ────────────────────────────────────────
check_port() {
  local port=$1
  local service=$2
  if command -v lsof >/dev/null 2>&1; then
    if lsof -i :"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo -e "${YELLOW}⚠  Port $port is already in use ($service). You may get a bind error.${RESET}"
      echo -e "  ${DIM}Use --${service}-port to specify a different port.${RESET}"
    fi
  elif command -v ss >/dev/null 2>&1; then
    if ss -tlnp | grep -q ":$port "; then
      echo -e "${YELLOW}⚠  Port $port is already in use ($service). You may get a bind error.${RESET}"
      echo -e "  ${DIM}Use --${service}-port to specify a different port.${RESET}"
    fi
  fi
}

check_port "$FASTAPI_PORT" "fastapi"
check_port "$NEXTJS_PORT" "nextjs"

# ── Dependency Installation ─────────────────────────────────────
if [ "$SKIP_INSTALL" = false ]; then
  echo ""
  echo -e "${VIOLET}Ensuring dependencies are installed...${RESET}"

  # Root node_modules
  if [ ! -d "$SCRIPT_DIR/node_modules" ] || [ "$SCRIPT_DIR/package.json" -nt "$SCRIPT_DIR/node_modules/.package-lock.json" ] 2>/dev/null; then
    echo -e "  ${CYAN}▸${RESET} Installing root npm packages..."
    (cd "$SCRIPT_DIR" && npm install --no-audit --no-fund 2>&1 | tail -1)
    echo -e "  ${GREEN}✓${RESET} Root npm packages installed"
  else
    echo -e "  ${GREEN}✓${RESET} Root npm packages up to date"
  fi

  # Next.js node_modules
  if [ ! -d "$SCRIPT_DIR/servers/nextjs/node_modules" ] || [ "$SCRIPT_DIR/servers/nextjs/package.json" -nt "$SCRIPT_DIR/servers/nextjs/node_modules/.package-lock.json" ] 2>/dev/null; then
    echo -e "  ${CYAN}▸${RESET} Installing Next.js npm packages..."
    (cd "$SCRIPT_DIR/servers/nextjs" && npm install --no-audit --no-fund 2>&1 | tail -1)
    echo -e "  ${GREEN}✓${RESET} Next.js npm packages installed"
  else
    echo -e "  ${GREEN}✓${RESET} Next.js npm packages up to date"
  fi

  # FastAPI Python deps
  echo -e "  ${CYAN}▸${RESET} Syncing Python dependencies..."
  (cd "$SCRIPT_DIR/servers/fastapi" && uv sync --quiet 2>&1)
  echo -e "  ${GREEN}✓${RESET} Python dependencies synced"

  # Puppeteer Chrome browser
  if [ -d "$SCRIPT_DIR/presentation-export" ]; then
    if [ ! -d "$SCRIPT_DIR/presentation-export/node_modules" ]; then
      echo -e "  ${CYAN}▸${RESET} Installing presentation-export npm packages..."
      (cd "$SCRIPT_DIR/presentation-export" && npm install --no-audit --no-fund 2>&1 | tail -1)
      echo -e "  ${GREEN}✓${RESET} presentation-export npm packages installed"
    fi
  fi

  # Liteparse dependencies
  if [ -d "$SCRIPT_DIR/resources/document-extraction" ]; then
    if [ ! -d "$SCRIPT_DIR/resources/document-extraction/node_modules" ]; then
      echo -e "  ${CYAN}▸${RESET} Installing document-extraction npm packages..."
      (cd "$SCRIPT_DIR/resources/document-extraction" && npm install --no-audit --no-fund 2>&1 | tail -1)
      echo -e "  ${GREEN}✓${RESET} document-extraction npm packages installed"
    fi
  fi

  # Check for Puppeteer Chrome in common cache locations
  PUPPETEER_CHROME_FOUND=false
  for dir in "$HOME/.cache/puppeteer" "$SCRIPT_DIR/node_modules/puppeteer" "$SCRIPT_DIR/servers/nextjs/node_modules/puppeteer"; do
    if [ -d "$dir" ] && find "$dir" -name "chrome" -type f -executable 2>/dev/null | head -1 | grep -q .; then
      PUPPETEER_CHROME_FOUND=true
      break
    fi
  done

  if [ "$PUPPETEER_CHROME_FOUND" = false ]; then
    echo -e "  ${CYAN}▸${RESET} Installing Puppeteer Chrome browser..."
    npx -y puppeteer browsers install chrome 2>&1 | tail -1 || true
    echo -e "  ${GREEN}✓${RESET} Puppeteer Chrome installed"
  else
    echo -e "  ${GREEN}✓${RESET} Puppeteer Chrome available"
  fi

  echo ""
else
  echo -e "${DIM}Skipping dependency checks (--skip-install)${RESET}"
  echo ""
fi

# ── Port Display ────────────────────────────────────────────────
echo -e "${CYAN}▸${RESET} FastAPI backend  → http://localhost:${FASTAPI_PORT}"
echo -e "${CYAN}▸${RESET} Next.js frontend → http://localhost:${NEXTJS_PORT}"
echo ""

# Export auth bypass flag for both backend and frontend
export DISABLE_AUTH="${DISABLE_AUTH:-true}"

# ── FastAPI ─────────────────────────────────────────────────────
echo -e "${VIOLET}Starting FastAPI backend...${RESET}"
cd "$SCRIPT_DIR/servers/fastapi"
export APP_DATA_DIRECTORY="${APP_DATA_DIRECTORY:-$SCRIPT_DIR/app_data}"
export TEMP_DIRECTORY="${TEMP_DIRECTORY:-$SCRIPT_DIR/app_data/temp}"
export USER_CONFIG_PATH="${USER_CONFIG_PATH:-$SCRIPT_DIR/app_data/userConfig.json}"
export LITEPARSE_RUNNER_PATH="$SCRIPT_DIR/resources/document-extraction/liteparse_runner.mjs"
mkdir -p "$APP_DATA_DIRECTORY" "$TEMP_DIRECTORY"

uv run uvicorn server:app --host 0.0.0.0 --port "$FASTAPI_PORT" --reload &
FASTAPI_PID=$!

sleep 2

# ── Next.js ─────────────────────────────────────────────────────
echo -e "${VIOLET}Starting Next.js frontend...${RESET}"
cd "$SCRIPT_DIR/servers/nextjs"
export NEXT_PUBLIC_FAST_API="http://localhost:${FASTAPI_PORT}"
export FAST_API_INTERNAL_URL="http://localhost:${FASTAPI_PORT}"
export DISABLE_AUTH="${DISABLE_AUTH:-true}"

PORT=$NEXTJS_PORT npm run dev &
NEXTJS_PID=$!

echo ""
echo -e "${GREEN}✓ RAYS DeckForge is running${RESET}"
echo -e "${DIM}Backend:  http://localhost:${FASTAPI_PORT}/docs${RESET}"
echo -e "${DIM}Frontend: http://localhost:${NEXTJS_PORT}${RESET}"
echo ""
echo -e "${DIM}Press Ctrl+C to stop all servers${RESET}"

wait
