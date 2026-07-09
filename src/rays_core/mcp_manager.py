"""Connect to MCP servers, discover tools, and invoke tools/call."""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import threading
from contextlib import AsyncExitStack
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from . import rays_ui
from .tool_registry import ToolDescriptor, ToolRegistry

_ENV_PATTERN = re.compile(r"\$\{(\w+)\}")


def _expand_env_value(value: Any) -> Any:
    if isinstance(value, str):
        def _repl(match: re.Match[str]) -> str:
            return os.environ.get(match.group(1), "")

        return _ENV_PATTERN.sub(_repl, value)
    if isinstance(value, dict):
        return {k: _expand_env_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_expand_env_value(v) for v in value]
    return value


def load_mcp_server_configs(
    config: Dict[str, Any], codebase_root: Path
) -> List[Dict[str, Any]]:
    """Merge mcp_servers from config.yaml, ~/.rays/mcp.json, and .rays/mcp.json."""
    merged: Dict[str, Dict[str, Any]] = {}

    def _ingest(entries: Any) -> None:
        if not isinstance(entries, list):
            return
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            name = entry.get("name")
            if not name:
                continue
            merged[name] = {**merged.get(name, {}), **entry}

    _ingest(config.get("mcp_servers", []))

    global_path = Path.home() / ".rays" / "mcp.json"
    if global_path.exists():
        try:
            import json as _json

            data = _json.loads(global_path.read_text(encoding="utf-8"))
            _ingest(data.get("mcp_servers", data if isinstance(data, list) else []))
        except Exception as exc:
            rays_ui.print_warning(f"Failed to load {global_path}: {exc}")

    local_path = codebase_root / ".rays" / "mcp.json"
    if local_path.exists():
        try:
            import json as _json

            data = _json.loads(local_path.read_text(encoding="utf-8"))
            _ingest(data.get("mcp_servers", data if isinstance(data, list) else []))
        except Exception as exc:
            rays_ui.print_warning(f"Failed to load {local_path}: {exc}")

    return list(merged.values())


@dataclass
class MCPServerSession:
    name: str
    status: str = "disconnected"
    description: str = ""
    tools: List[ToolDescriptor] = field(default_factory=list)
    error: Optional[str] = None
    backend_note: Optional[str] = None

    @property
    def is_usable(self) -> bool:
        return self.status == "connected" and not self.backend_note


class _ServerConnection:
    """Holds live MCP client session for one server."""

    def __init__(self, name: str, session: Any, stack: AsyncExitStack) -> None:
        self.name = name
        self.session = session
        self.stack = stack


class MCPManager:
    MAX_RESULT_CHARS = 12000

    def __init__(self, config: Dict[str, Any], codebase_root: Path) -> None:
        self.config = config
        self.codebase_root = Path(codebase_root).resolve()
        self.registry = ToolRegistry()
        self._server_configs = load_mcp_server_configs(config, self.codebase_root)
        self._sessions: Dict[str, MCPServerSession] = {}
        self._connections: Dict[str, _ServerConnection] = {}
        self._connected = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._loop_thread: Optional[threading.Thread] = None

    @property
    def has_server_configs(self) -> bool:
        return bool(self._server_configs)

    def _ensure_event_loop(self) -> asyncio.AbstractEventLoop:
        if self._loop is not None and self._loop.is_running():
            return self._loop
        self._loop = asyncio.new_event_loop()

        def _run_loop() -> None:
            asyncio.set_event_loop(self._loop)
            self._loop.run_forever()

        self._loop_thread = threading.Thread(
            target=_run_loop, name="rays-mcp-loop", daemon=True
        )
        self._loop_thread.start()
        return self._loop

    def _run_async(self, coro: Any, timeout: float = 300.0) -> Any:
        loop = self._ensure_event_loop()
        future = asyncio.run_coroutine_threadsafe(coro, loop)
        return future.result(timeout=timeout)

    def list_planner_mcp_catalog(self) -> List[Dict[str, Any]]:
        """Configured MCP servers for capability selection (no live connection)."""
        catalog: List[Dict[str, Any]] = []
        for entry in self._server_configs:
            if entry.get("enabled", True) is False:
                continue
            name = str(entry.get("name", "")).strip()
            if not name:
                continue
            catalog.append(
                {
                    "name": name,
                    "description": entry.get("description")
                    or f"MCP server '{name}' (connects when selected)",
                    "tools": [],
                }
            )
        return catalog

    def connect_all(self) -> Dict[str, MCPServerSession]:
        names = [
            str(e.get("name", "")).strip()
            for e in self._server_configs
            if e.get("enabled", True) is not False and e.get("name")
        ]
        return self.connect_servers(names)

    def connect_servers(self, server_names: List[str]) -> Dict[str, MCPServerSession]:
        if not self._server_configs or not server_names:
            self._connected = True
            return dict(self._sessions)

        wanted = {n.strip() for n in server_names if n and str(n).strip()}
        if not wanted:
            self._connected = True
            return dict(self._sessions)

        already_ok = all(
            self._sessions.get(n) and self._sessions[n].status == "connected"
            for n in wanted
        )
        if already_ok:
            return dict(self._sessions)

        try:
            self._run_async(self._connect_servers_async(wanted))
        except Exception as exc:
            rays_ui.print_warning(f"MCP connect failed: {exc}")
        self._connected = True
        return dict(self._sessions)

    async def _connect_all_async(self) -> None:
        names = [
            str(e.get("name", "")).strip()
            for e in self._server_configs
            if e.get("enabled", True) is not False and e.get("name")
        ]
        await self._connect_servers_async(set(names))

    async def _connect_servers_async(self, wanted: set[str]) -> None:
        if not wanted:
            return

        for entry in self._server_configs:
            if entry.get("enabled", True) is False:
                continue
            name = str(entry.get("name", "")).strip()
            if not name or name not in wanted:
                continue
            existing = self._sessions.get(name)
            if existing and existing.status == "connected":
                continue
            transport = (entry.get("transport") or "stdio").lower()
            if transport != "stdio":
                self._sessions[name] = MCPServerSession(
                    name=name,
                    status="error",
                    error=f"Unsupported transport '{transport}' (stdio only in v1)",
                )
                rays_ui.print_warning(
                    f"MCP server '{name}': transport '{transport}' not supported yet."
                )
                continue
            try:
                await self._connect_stdio_server(name, entry)
            except Exception as exc:
                self._sessions[name] = MCPServerSession(
                    name=name, status="error", error=str(exc)
                )
                rays_ui.print_warning(f"MCP server '{name}' failed to connect: {exc}")

    async def _connect_stdio_server(self, name: str, entry: Dict[str, Any]) -> None:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        command = entry.get("command")
        if not command:
            raise ValueError("stdio MCP server requires 'command'")

        import shutil
        resolved_command = shutil.which(str(command)) or str(command)

        args = _expand_env_value(entry.get("args") or [])
        env = _expand_env_value(entry.get("env") or {})
        merged_env = {**os.environ, **{k: str(v) for k, v in env.items()}}

        params = StdioServerParameters(
            command=resolved_command,
            args=[str(a) for a in args],
            env=merged_env,
        )

        quiet = entry.get("quiet", self.config.get("mcp_quiet_stderr", True))
        errlog = open(os.devnull, "w") if quiet else sys.stderr

        stack = AsyncExitStack()
        stdio_transport = await stack.enter_async_context(
            stdio_client(params, errlog=errlog)
        )
        read_stream, write_stream = stdio_transport
        session = await stack.enter_async_context(ClientSession(read_stream, write_stream))
        await session.initialize()

        list_result = await session.list_tools()
        tools: List[ToolDescriptor] = []
        for tool in list_result.tools:
            schema: Dict[str, Any] = {}
            if tool.inputSchema is not None:
                if hasattr(tool.inputSchema, "model_dump"):
                    schema = tool.inputSchema.model_dump()
                elif isinstance(tool.inputSchema, dict):
                    schema = tool.inputSchema
                else:
                    schema = dict(tool.inputSchema)
            descriptor = ToolDescriptor(
                server=name,
                name=tool.name,
                description=tool.description or "",
                input_schema=schema,
            )
            tools.append(descriptor)
            self.registry.register(descriptor)

        self._connections[name] = _ServerConnection(name, session, stack)
        self._sessions[name] = MCPServerSession(
            name=name,
            status="connected",
            description=entry.get("description", ""),
            tools=tools,
        )
        msg = f"{name} · {len(tools)} tool{'s' if len(tools) != 1 else ''}"
        if rays_ui.orchestration_hud_active():
            rays_ui.hud_set_status("MCP", msg)
        else:
            rays_ui.print_step(f"MCP '{name}' connected ({len(tools)} tools)")

    def list_capabilities(self) -> List[Dict[str, Any]]:
        """Planner-facing catalog of connected MCP servers."""
        caps: List[Dict[str, Any]] = []
        for session in self._sessions.values():
            if session.status != "connected":
                continue
            caps.append(
                {
                    "name": session.name,
                    "description": session.description,
                    "tools": [
                        {
                            "name": t.name,
                            "description": t.description,
                            "input_schema": _truncate_schema(t.input_schema),
                        }
                        for t in session.tools
                    ],
                }
            )
        return caps

    def probe_server(self, server_config: Dict[str, Any]) -> Dict[str, Any]:
        """Probes a server by connecting, fetching tools, and immediately disconnecting."""
        try:
            return self._run_async(self._probe_server_async(server_config))
        except Exception as exc:
            return {"ok": False, "error": str(exc), "tools": []}

    async def _probe_server_async(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
        import shutil

        transport = (entry.get("transport") or "stdio").lower()
        if transport != "stdio":
            return {"ok": False, "error": f"Unsupported transport '{transport}'", "tools": []}

        command = entry.get("command")
        if not command:
            return {"ok": False, "error": "stdio MCP server requires 'command'", "tools": []}

        resolved_command = shutil.which(str(command)) or str(command)
        args = _expand_env_value(entry.get("args") or [])
        env = _expand_env_value(entry.get("env") or {})
        merged_env = {**os.environ, **{k: str(v) for k, v in env.items()}}

        params = StdioServerParameters(
            command=resolved_command,
            args=[str(a) for a in args],
            env=merged_env,
        )

        quiet = entry.get("quiet", self.config.get("mcp_quiet_stderr", True))
        errlog = open(os.devnull, "w") if quiet else sys.stderr

        stack = AsyncExitStack()
        try:
            stdio_transport = await stack.enter_async_context(
                stdio_client(params, errlog=errlog)
            )
            read_stream, write_stream = stdio_transport
            session = await stack.enter_async_context(ClientSession(read_stream, write_stream))
            await session.initialize()

            list_result = await session.list_tools()
            tools = []
            for tool in list_result.tools:
                schema = {}
                if tool.inputSchema is not None:
                    if hasattr(tool.inputSchema, "model_dump"):
                        schema = tool.inputSchema.model_dump()
                    elif isinstance(tool.inputSchema, dict):
                        schema = tool.inputSchema
                    else:
                        schema = dict(tool.inputSchema)
                tools.append({
                    "name": tool.name,
                    "description": tool.description or "",
                    "input_schema": schema
                })
            return {"ok": True, "tools": tools}
        except Exception as e:
            return {"ok": False, "error": str(e), "tools": []}
        finally:
            try:
                await stack.aclose()
            except Exception:
                pass

    def get_session(self, server: str) -> Optional[MCPServerSession]:
        return self._sessions.get(server)

    def note_backend_unreachable(self, server: str, detail: str) -> None:
        session = self._sessions.get(server)
        if session:
            session.backend_note = detail

    def clear_backend_note(self, server: str) -> None:
        session = self._sessions.get(server)
        if session:
            session.backend_note = None

    def reconnect_server(self, server_name: str) -> bool:
        try:
            self._run_async(self._reconnect_server_async(server_name))
        except Exception as exc:
            rays_ui.print_warning(f"MCP reconnect '{server_name}' failed: {exc}")
            return False
        session = self._sessions.get(server_name)
        return bool(session and session.status == "connected")

    async def _disconnect_server_async(self, name: str) -> None:
        conn = self._connections.pop(name, None)
        if conn:
            try:
                await conn.stack.aclose()
            except Exception:
                pass
        self._sessions.pop(name, None)
        self.registry.unregister_server(name)

    async def _reconnect_server_async(self, name: str) -> None:
        await self._disconnect_server_async(name)
        await self._connect_servers_async({name})

    def call_tool(self, server: str, tool_name: str, arguments: Dict[str, Any]) -> str:
        if server not in self._connections:
            return f"Error: MCP server '{server}' is not connected."
        descriptor = self.registry.get(server, tool_name)
        if descriptor is None:
            return f"Error: Tool '{tool_name}' not found on server '{server}'."

        try:
            return self._run_async(
                self._call_tool_async(server, tool_name, arguments or {})
            )
        except Exception as exc:
            return f"Error calling MCP tool {server}/{tool_name}: {exc}"

    async def _call_tool_async(
        self, server: str, tool_name: str, arguments: Dict[str, Any]
    ) -> str:
        conn = self._connections[server]
        result = await conn.session.call_tool(tool_name, arguments)
        return self._format_tool_result(result)

    def _format_tool_result(self, result: Any) -> str:
        parts: List[str] = []
        if getattr(result, "isError", False):
            parts.append("[MCP tool returned isError=true]")
        content = getattr(result, "content", None) or []
        for block in content:
            if hasattr(block, "text"):
                parts.append(str(block.text))
            elif hasattr(block, "model_dump"):
                parts.append(json.dumps(block.model_dump(), indent=2))
            else:
                parts.append(str(block))
        text = "\n".join(parts) if parts else json.dumps(
            result.model_dump() if hasattr(result, "model_dump") else str(result),
            indent=2,
            default=str,
        )
        if len(text) > self.MAX_RESULT_CHARS:
            return (
                text[: self.MAX_RESULT_CHARS]
                + f"\n... [truncated, {len(text)} chars total]"
            )
        return text

    def shutdown(self) -> None:
        if not self._connections and not self._loop:
            return
        try:
            if self._loop and self._loop.is_running():
                self._run_async(self._shutdown_async(), timeout=60.0)
        except Exception as exc:
            rays_ui.print_warning(f"MCP shutdown warning: {exc}")
        finally:
            self._connections.clear()
            self._sessions.clear()
            self.registry.clear()
            self._connected = False
            if self._loop is not None:
                self._loop.call_soon_threadsafe(self._loop.stop)
                self._loop = None
                self._loop_thread = None

    async def _shutdown_async(self) -> None:
        for conn in list(self._connections.values()):
            try:
                await conn.stack.aclose()
            except Exception:
                pass


def _truncate_schema(schema: Dict[str, Any], max_len: int = 2000) -> Dict[str, Any]:
    text = json.dumps(schema, default=str)
    if len(text) <= max_len:
        return schema
    return {"_truncated": True, "preview": text[:max_len]}
