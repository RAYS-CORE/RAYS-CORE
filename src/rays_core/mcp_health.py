"""Detect MCP backend connectivity failures (e.g. Blender addon dropped)."""

from __future__ import annotations

from typing import List

_BLENDER_CONN_MARKERS = (
    "could not connect to blender",
    "make sure the blender addon",
    "blender addon",
    "connection refused",
    "connection reset",
)

_FATAL_BLENDER_MARKERS = (
    "server thread stopped",
    "blendermcp server stopped",
    "mcp server stopped",
)


def is_blender_connection_error(text: str) -> bool:
    if not text:
        return False
    lower = text.lower()
    return any(m in lower for m in _BLENDER_CONN_MARKERS)


def is_blender_fatal_result(text: str) -> bool:
    """Result that likely broke the Blender addon link (even if not prefixed with Error)."""
    if not text:
        return False
    lower = text.lower()
    return any(m in lower for m in _FATAL_BLENDER_MARKERS)


def is_mcp_backend_error(server: str, text: str) -> bool:
    if server == "blender" or "blender" in server.lower():
        return is_blender_connection_error(text) or is_blender_fatal_result(text)
    if not text:
        return False
    lower = text.lower()
    return lower.startswith("error") and "could not connect" in lower


def blender_recovery_hint() -> str:
    return (
        "Blender MCP backend unreachable. In Blender: open the Blender MCP addon panel, "
        "click Connect (default port 9876), ensure a .blend is open, then retry in RAYS. "
        "Do not run Python that stops or restarts the MCP server thread."
    )


def session_actions_have_backend_failure(
    server: str, actions: List[dict]
) -> bool:
    for action in actions:
        result = action.get("result")
        if result is not None and is_mcp_backend_error(server, str(result)):
            return True
    return False
