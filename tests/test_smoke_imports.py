"""Minimal import checks — ensured by CI on Linux, macOS, and Windows."""


def test_import_ai_client():
    from rays_core import ai_client  # noqa: F401

    assert hasattr(ai_client, "AIClient")


def test_import_config_locator():
    from rays_core import config_locator  # noqa: F401

    assert hasattr(config_locator, "resolve_config_path")


def test_import_rays_main_orchestrator():
    from rays_core import rays_main  # noqa: F401

    assert hasattr(rays_main, "RAYS")
    assert hasattr(rays_main, "main")


def test_import_mcp_modules():
    from rays_core import mcp_manager, agent_orchestrator, mcp_orchestrator, tool_registry  # noqa: F401

    assert hasattr(mcp_manager, "MCPManager")
    assert hasattr(agent_orchestrator, "AgentOrchestrator")


def test_distribution_is_installed_and_named():
    """After `pip install .`, metadata must resolve (also validates packaging)."""
    from importlib.metadata import distribution

    meta = distribution("rays-core")
    assert meta.metadata["Name"] == "rays-core"
