# Troubleshooting

## CLI / startup

### `config.yaml not found`

- Install from PyPI/Git should ship or resolve `config.yaml`. If missing, pass an explicit config:  
`rays --config /absolute/path/to/config.yaml`
- For development, run from the repository root so the bundled file is discoverable, or clone the repo locally.

### Ollama not reachable / provider warnings

- Default Ollama URL is typically `http://localhost:11434`. Start Ollama and ensure the daemon is listening before selecting the local provider in the launcher.

### Gemini / API keys

- Prefer environment variables (`GEMINI_API_KEY` or `GOOGLE_API_KEY`). Keys are intentionally not persisted in YAML.

### Import or `rays` command not found (pip/pipx)

- **pipx:** `pipx ensurepath`, open a new shell, run `rays`.
- **pip:** ensure your Python Scripts / `bin` directory is on `PATH`.

## MCP (agent orchestrator)

RAYS connects to MCP servers over **stdio**: it starts the process you configure (`command` + `args`) and talks MCP over stdin/stdout. Use the default prompt (not `/code`); MCP is handled by the agent orchestrator.

### How to configure MCP servers

See the full guide: **[MCP_SERVERS.md](./MCP_SERVERS.md)**.

Quick version:

1. Choose where to define servers (later sources **override** the same `name`):
   - `config.yaml` → `mcp_servers:` (lowest priority, install defaults)
   - `~/.rays/mcp.json` — **global**, all projects (**recommended** for Blender)
   - `<project>/.rays/mcp.json` — **project** only (highest priority)
2. RAYS uses `mcp_servers` **array** format — not Claude’s `mcpServers` object (copy the inner fields only).
3. Use absolute `command` path (`which uvx`) if connect fails from a GUI-launched terminal.
4. Example (`~/.rays/mcp.json`) — copy from [`examples/mcp/blender.json`](../examples/mcp/blender.json), set `FULL_PATH_TO_UVX`, or:

```json
{
  "mcp_servers": [
    {
      "name": "blender",
      "description": "Blender 3D scene tools",
      "command": "uvx",
      "args": ["blender-mcp"],
      "env": { "BLENDER_HOST": "localhost", "BLENDER_PORT": "9876" }
    }
  ]
}
```

4. Start `rays`, run `/mcp`, then ask in natural language.

### Skills not found / workspace missing

See **[SKILLS.md](./SKILLS.md)**. Skills live in `<project>/skills/<name>/SKILL.md` or `~/.rays/skills/<name>/SKILL.md`. Copy the template from [`examples/skills/workspace/SKILL.md`](../examples/skills/workspace/SKILL.md) if you need a `workspace` skill.

### No MCP servers / `/mcp` shows nothing configured

- Create or edit one of the config locations above with a non-empty `mcp_servers` list.
- Restart `rays` after changing JSON or YAML.

### MCP server failed to connect

- Ensure the MCP server binary is installed (`npx`, `uvx`, etc.) and the command in config is correct.
- Check required API tokens are set in the environment before starting RAYS.
- Run `/mcp` in-session to see per-server errors.

### MCP tool blocked or asks every time

- Adjust `mcp_tool_policy` in `config.yaml` (`deny`, `require_confirmation` patterns).
- Use `/mode auto` for autonomous MCP confirmation (same as coding pipeline ask/auto).

### Blender MCP: `/mcp` shows connected but tools fail

RAYS shows **stdio connected** when the `blender-mcp` child process is running. That is separate from the **Blender addon** socket on port `9876`.

Typical failure:

1. First `execute_blender_code` returns something like `Server thread stopped`.
2. Every later call returns `Could not connect to Blender`.

**Fix:**

1. In Blender: open the **Blender MCP** addon sidebar → click **Connect** (port `9876`).
2. Keep a `.blend` file open.
3. Restart `rays` or run your prompt again.

RAYS now:

- Stops after `mcp_connection_error_limit` (default `2`) failed tool calls to the Blender backend
- Stops after `mcp_backend_failure_max_turns` (default `10`) total turns once a backend error occurred
- Stops immediately on a thought-only turn after a backend error (no more repeated “thinking” lines)
- Stops after `mcp_no_tool_turn_limit` (default `3`) turns with no tool call at all
- Skips further Blender plan steps in the same run after `connection_lost`

`/mcp` may show `backend unreachable` while stdio is still up.

## CI / contributing

See **CONTRIBUTING.md** — opening a PR runs GitHub Actions (install, pytest, package build sanity) on Ubuntu, macOS, and Windows.

## Still stuck?

Open an issue with logs (no secrets): [Issues](https://github.com/markknoffler/RAYS-CORE-CLI/issues).