from pathlib import Path

import yaml

from rays_core.agent_orchestrator import AgentOrchestrator
from rays_core.skills_orchestrator import SkillsOrchestrator


class _FakeAI:
    pass


def _load_config():
    cfg_path = Path(__file__).resolve().parents[1] / "src" / "rays_core" / "config.yaml"
    return yaml.safe_load(cfg_path.read_text())


def _orchestrator():
    config = _load_config()
    skills = SkillsOrchestrator(_FakeAI(), config, Path("/tmp"))
    from rays_core.mcp_manager import MCPManager

    mcp = MCPManager(config, Path("/tmp"))
    return AgentOrchestrator(_FakeAI(), config, Path("/tmp"), skills, mcp)


def test_filter_plan_accepts_skill_and_mcp_steps():
    orch = _orchestrator()
    skills_map = {"workspace": {"name": "workspace"}}
    mcp_map = {"github": {"name": "github"}}
    raw = [
        {"step": 1, "type": "skill", "skill": "workspace", "reason": "map"},
        {"step": 2, "type": "mcp", "server": "github", "reason": "issue"},
        {"step": 3, "type": "mcp", "server": "missing", "reason": "skip"},
        {"step": 4, "skill": "ghost", "reason": "legacy skip"},
    ]
    plan = orch._filter_plan(raw, skills_map, mcp_map)
    assert len(plan) == 2
    assert plan[0]["type"] == "skill"
    assert plan[1]["type"] == "mcp"


def test_filter_plan_legacy_skill_only_step():
    orch = _orchestrator()
    skills_map = {"docx": {"name": "docx"}}
    raw = [{"step": 1, "skill": "docx", "reason": "write"}]
    plan = orch._filter_plan(raw, skills_map, {})
    assert len(plan) == 1
    assert plan[0]["type"] == "skill"
