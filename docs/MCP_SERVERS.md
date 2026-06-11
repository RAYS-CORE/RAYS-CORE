# MCP servers (agent orchestrator)

RAYS connects to [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers so the **default agent orchestrator** can use external tools — browsers, GitHub, databases, 3D apps, and anything else that exposes an MCP server over stdio.

This path is separate from **`/code`**. MCP is only used when you type a normal prompt (no slash command). The coding pipeline is unchanged.

---

## How it works

1. On each orchestration run, RAYS reads your MCP config and **spawns** selected servers as child processes (`command` + `args`) when the planner needs them.
2. RAYS speaks MCP over that process’s **stdin/stdout** (stdio transport).
3. At connect time, RAYS calls `list_tools` and registers every tool under `server_name/tool_name`.
4. The planner may select one or more MCP servers for your prompt.
5. For each planned MCP step, a **dynamic sub-agent** loops: it chooses tools, calls them, reads results, and exits when its spawn objective is met (up to `mcp_subagent_max_turns` in `config.yaml`, default 25).

Use **`/mcp`** inside RAYS to see which servers are configured and whether each one connected.

---

## RAYS format vs Claude / Cursor

RAYS does **not** use Claude Desktop’s `claude_desktop_config.json` or Claude Code’s `claude mcp add` format directly.

| Client | Config shape | Server list key |
|--------|----------------|-----------------|
| **RAYS** | `mcp_servers` array of objects | `name`, `command`, `args`, `env`, … |
| Claude Desktop | `mcpServers` object keyed by name | `command`, `args`, `env` |
| Claude Code CLI | `claude mcp add …` → `~/.claude.json` | same idea, different file |
| Cursor | `.cursor/mcp.json` | `mcpServers` object |

The **fields** (`command`, `args`, `env`) are the same idea; only the **wrapper** differs. Copy the *server entry* into RAYS’s `mcp_servers` array.

If a server works in another client but fails in RAYS, the usual causes are **not** wrong JSON shape:

1. **Backend not running** — many MCP servers are only a bridge; the real app or service must also be up (see that server’s docs).
2. **`command` not on PATH** when `rays` is launched from a GUI — use the full path from `which <command>`.
3. **Two clients at once** — don’t run the same MCP server in RAYS and another client simultaneously (each spawns its own child process).

---

## Where to configure servers

Configs are **merged** by server `name`. Later sources override earlier ones for the same `name`.

| Priority (low → high) | Location | Scope | When to use |
|----------------------|----------|--------|-------------|
| 1 | `mcp_servers:` in `config.yaml` | RAYS install / shared defaults | Org-wide defaults you ship with RAYS; lowest priority |
| 2 | `~/.rays/mcp.json` | **Global** — all projects on this machine | **Recommended** for personal servers (GitHub, browsers, etc.) |
| 3 | `<project>/.rays/mcp.json` | **Project** — one repo only | Overrides global for that repo; commit if the team shares it |

### JSON files (`~/.rays/mcp.json` and `<project>/.rays/mcp.json`)

Each file uses this shape:

```json
{
  "mcp_servers": [
    {
      "name": "my-server",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/root"],
      "description": "Short text the planner sees when choosing capabilities",
      "env": {
        "API_TOKEN": "${MY_API_TOKEN}"
      },
      "enabled": true,
      "quiet": true
    }
  ]
}
```

You can also use a **top-level JSON array** (no wrapper object); RAYS treats it as `mcp_servers`.

### YAML (`config.yaml`)

Same fields as JSON, under `mcp_servers:` (list). Merged **first**; overridden by `~/.rays/mcp.json` and then `<project>/.rays/mcp.json`.

```yaml
mcp_servers:
  - name: my-server
    description: "What this server does for the planner"
    command: /full/path/to/executable   # use `which` if PATH is unreliable
    args:
      - arg-one
      - arg-two
    env:
      API_TOKEN: "${MY_API_TOKEN}"
    enabled: true
    quiet: false   # set false while debugging connection errors
```

Use **global JSON** for one-off personal setup; use **project `.rays/mcp.json`** when the server is tied to that repo (custom script path, team-shared); use **`config.yaml`** only if you want defaults baked into your RAYS config package.

---

## Server entry reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique id used in plans and tool names (`github/create_issue`). Use lowercase, no spaces. |
| `command` | Yes | Executable to start the MCP server. Prefer **absolute path** (`which npx`, `which uvx`) if `rays` is started from a GUI or a minimal PATH. |
| `args` | No | Argument list (strings). Default `[]`. |
| `env` | No | Extra environment variables merged on top of your shell env. Values like `${VAR}` are expanded from the environment when RAYS connects. |
| `description` | No | Human-readable summary shown to the capability-selection model. Write what the server is *for*, not how to install it. |
| `enabled` | No | Set `false` to skip this server without deleting the entry. Default `true`. |
| `quiet` | No | If `true`, redirect the child process stderr to `/dev/null`. Default follows `mcp_quiet_stderr` in `config.yaml` (default `true`). Set `false` when debugging a failing server. |
| `transport` | No | Only **`stdio`** is supported today. Other values produce a clear error. |

---

## Examples

### GitHub (official MCP server)

```json
{
  "mcp_servers": [
    {
      "name": "github",
      "description": "GitHub API: issues, PRs, repos, file contents",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  ]
}
```

Export `GITHUB_TOKEN` in your shell before starting RAYS.

### Project-local server

For a server that only applies to one repo (e.g. a custom script in that repo):

```json
{
  "mcp_servers": [
    {
      "name": "internal-api",
      "description": "Company internal API mock for integration tests",
      "command": "python",
      "args": ["tools/mcp_server.py"],
      "env": {
        "API_BASE": "http://localhost:8080"
      }
    }
  ]
}
```

Save as `<your-repo>/.rays/mcp.json`. Paths in `args` are relative to the **current working directory** when you launch `rays` (usually the repo root).

### More examples

See [`examples/mcp/`](../examples/mcp/) for additional server templates (e.g. Blender). Server-specific setup (addons, ports, credentials) belongs in each example file and in [TROUBLESHOOTING.md](./TROUBLESHOOTING.md), not in this guide.

---

## Tool naming and policy

- Qualified name: **`server_name/tool_name`** (e.g. `github/create_issue`).
- Results are passed verbatim to the next sub-agent (truncated at ~12k characters per result for context limits).

### `mcp_tool_policy` in `config.yaml`

```yaml
mcp_tool_policy:
  deny:
    - "my-server/*delete*"
    - "*/drop_database"
  require_confirmation:
    - "github/*create*"
    - "*/write_*"
```

| Pattern | Effect |
|---------|--------|
| `deny` | Tool never runs; sub-agent receives an error string. |
| `require_confirmation` | In **ask** mode (`/mode ask`), RAYS prompts before calling. In **autonomous** mode (`/mode auto`), confirmation is skipped. |

Patterns use shell-style `fnmatch` and can match either the full qualified name or the bare tool name.

---

## Execution modes

Same as the coding pipeline:

- **`/mode ask`** (default): MCP tools matching `require_confirmation` need approval.
- **`/mode auto`**: MCP tools run without per-tool prompts (still respects `deny`).

---

## Planner behavior (what to expect)

You do **not** list individual MCP tool calls in config. The planner only decides:

- which **servers** to use,
- **spawn_reason** per step,
- optional **phase**: `discover` (read state), `act` (mutate), `verify`.

The MCP sub-agent then picks tools from the live catalog until done. The same server may appear twice in one plan (e.g. discover then act).

---

## Verifying and debugging

### Check status

```text
/mcp
```

Shows each configured server, connection status, and tool names when connected.

### Server fails to connect (stdio)

1. Run the same `command` + `args` manually in a terminal; fix “command not found” — use absolute path in config.
2. Set `"quiet": false` on that server entry and restart RAYS to see stderr from the child process.
3. Confirm env vars are set **before** launching RAYS (`echo $GITHUB_TOKEN`).

### Connected but tools fail

Often the stdio child is running while the **backend** (browser, desktop app, API) is not. Check that server’s documentation and [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

### Tool returns errors in the UI

The sub-agent sees the full error text. After repeated backend failures, RAYS stops the MCP step (see `mcp_connection_error_limit` and `mcp_backend_failure_max_turns` in `config.yaml`) instead of looping on “thinking” lines. If validation still fails, the orchestrator may **re-plan** (up to 3 loops).

### Transcript and detail view

During orchestration:

- **Ctrl+T** — full transcript (thinking + tool lines)
- **Ctrl+U** — toggle compact vs detailed tool result previews

---

## Limitations (current release)

- **stdio only** — no HTTP/SSE MCP endpoints yet.
- Servers are started when the planner selects them and stay up for the RAYS session; RAYS shuts down MCP children on exit.
- Tool schemas are passed to the model at connect time; very large schemas may be truncated in the planner catalog.
- MCP is not available in `/code` or `/chat` modes.

---

## Related

- [SKILLS.md](./SKILLS.md) — local workspace skills (often planned before MCP steps)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — orchestrator flow
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — server-specific fixes (e.g. Blender addon connection)
