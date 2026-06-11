from pathlib import Path

import yaml

from rays_core.mcp_health import (
    is_blender_connection_error,
    is_blender_fatal_result,
    is_mcp_backend_error,
)
from rays_core.mcp_manager import MCPManager, MCPServerSession
from rays_core.mcp_orchestrator import MCPOrchestrator
from rays_core.tool_registry import ToolDescriptor


def test_blender_connection_error_detection():
    assert is_blender_connection_error(
        "Error getting scene info: Could not connect to Blender. Make sure the addon..."
    )
    assert is_blender_fatal_result(
        "Code executed successfully: Server thread stopped BlenderMCP server stopped"
    )
    assert is_mcp_backend_error("blender", "Could not connect to Blender")


class _RetryThenQuitAI:
    def __init__(self):
        self._turn = 0

    def generate_json(self, prompt):
        self._turn += 1
        return {
            "status": "running",
            "thought": "try tool",
            "tool_call": {"name": "get_scene_info", "arguments": {}},
        }


def _load_config():
    cfg_path = Path(__file__).resolve().parents[1] / "src" / "rays_core" / "config.yaml"
    return yaml.safe_load(cfg_path.read_text())


class _ThoughtOnlyAfterFailureAI:
    """Simulates model looping with thoughts but no tools after a failure."""

    def __init__(self):
        self._turn = 0

    def generate_json(self, prompt):
        self._turn += 1
        if self._turn == 1:
            return {
                "status": "running",
                "thought": "try scene info",
                "tool_call": {"name": "get_scene_info", "arguments": {}},
            }
        return {
            "status": "running",
            "thought": "Failed to connect to Blender MCP server multiple times.",
        }


def test_mcp_stops_thought_only_loop_after_backend_failure(monkeypatch):
    config = _load_config()
    mcp = MCPManager(config, Path("/tmp"))
    mcp.registry.register(
        ToolDescriptor(server="blender", name="get_scene_info", description="", input_schema={})
    )
    mcp._sessions["blender"] = MCPServerSession(name="blender", status="connected", tools=[])
    mcp.call_tool = lambda *a, **k: (
        "Error getting scene info: Could not connect to Blender. Make sure the addon is running."
    )
    mcp.reconnect_server = lambda name: False

    orch = MCPOrchestrator(_ThoughtOnlyAfterFailureAI(), config, Path("/tmp"), mcp, "autonomous")
    step = {
        "server": "blender",
        "phase": "discover",
        "intent": "Inspect scene",
        "spawn_reason": "Need baseline",
    }
    record = orch.execute_mcp_step("blender", step, "garden scene", [], [])
    assert record["status"] == "connection_lost"
    assert len(record["actions"]) <= 3


def test_mcp_stops_after_backend_errors(monkeypatch):
    config = _load_config()
    mcp = MCPManager(config, Path("/tmp"))
    mcp.registry.register(
        ToolDescriptor(server="blender", name="get_scene_info", description="", input_schema={})
    )
    mcp._sessions["blender"] = MCPServerSession(name="blender", status="connected", tools=[])
    calls = {"n": 0}

    def fake_call(server, tool_name, arguments):
        calls["n"] += 1
        return "Error getting scene info: Could not connect to Blender. Make sure the addon is running."

    mcp.call_tool = fake_call
    mcp.reconnect_server = lambda name: False

    orch = MCPOrchestrator(_RetryThenQuitAI(), config, Path("/tmp"), mcp, "autonomous")
    step = {
        "server": "blender",
        "phase": "discover",
        "intent": "Inspect scene",
        "spawn_reason": "Need baseline",
    }
    record = orch.execute_mcp_step("blender", step, "garden scene", [], [])
    assert record["status"] == "connection_lost"
    assert calls["n"] == 2
    assert mcp.get_session("blender").backend_note
