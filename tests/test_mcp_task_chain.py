from pathlib import Path

import yaml

from rays_core.mcp_manager import MCPManager, MCPServerSession
from rays_core.mcp_orchestrator import MCPOrchestrator
from rays_core.tool_registry import ToolDescriptor


class _FakeAI:
    def __init__(self):
        self._turn = 0

    def generate_json(self, prompt):
        self._turn += 1
        if self._turn == 1:
            return {
                "status": "running",
                "thought": "Inspect scene",
                "tool_call": {"name": "get_scene_info", "arguments": {}},
            }
        return {
            "status": "completed",
            "thought": "Done",
            "exit_message": "Scene updated.",
        }


def _load_config():
    cfg_path = Path(__file__).resolve().parents[1] / "src" / "rays_core" / "config.yaml"
    return yaml.safe_load(cfg_path.read_text())


def test_mcp_subagent_loops_until_completed(monkeypatch):
    config = _load_config()
    mcp = MCPManager(config, Path("/tmp"))
    mcp.registry.register(
        ToolDescriptor(
            server="app", name="get_scene_info", description="", input_schema={}
        )
    )
    mcp._sessions["app"] = MCPServerSession(name="app", status="connected", tools=[])
    calls = []

    def fake_call(server, tool_name, arguments):
        calls.append(tool_name)
        return f"ok:{tool_name}"

    mcp.call_tool = fake_call

    orch = MCPOrchestrator(_FakeAI(), config, Path("/tmp"), mcp, "autonomous")
    step = {
        "server": "app",
        "phase": "act",
        "intent": "Build scene",
        "spawn_reason": "Apply user changes in the app",
    }
    record = orch.execute_mcp_step("app", step, "make a donut", [], [])
    assert calls == ["get_scene_info"]
    assert record["type"] == "mcp"
    assert record["status"] == "completed"
    assert len(record["actions"]) == 1
    assert record["actions"][0]["tool"] == "get_scene_info"
    assert "ok:get_scene_info" in record["actions"][0]["result"]


def test_filter_plan_allows_duplicate_mcp_servers():
    from rays_core.agent_orchestrator import AgentOrchestrator
    from rays_core.skills_orchestrator import SkillsOrchestrator

    config = _load_config()
    skills = SkillsOrchestrator(_FakeAI(), config, Path("/tmp"))
    mcp = MCPManager(config, Path("/tmp"))
    orch = AgentOrchestrator(_FakeAI(), config, Path("/tmp"), skills, mcp)
    mcp_map = {"blender": {"name": "blender"}}
    raw = [
        {"step": 1, "type": "mcp", "server": "blender", "phase": "discover"},
        {"step": 2, "type": "mcp", "server": "blender", "phase": "act"},
    ]
    plan = orch._filter_plan(raw, {}, mcp_map)
    assert len(plan) == 2
    assert plan[0]["phase"] == "discover"
    assert plan[1]["phase"] == "act"
