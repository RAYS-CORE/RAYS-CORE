from pathlib import Path

from rays_core.mcp_manager import load_mcp_server_configs, _expand_env_value


def test_expand_env_value():
    import os

    os.environ["RAYS_TEST_MCP_TOKEN"] = "secret-token"
    try:
        assert _expand_env_value("${RAYS_TEST_MCP_TOKEN}") == "secret-token"
    finally:
        del os.environ["RAYS_TEST_MCP_TOKEN"]


def test_load_mcp_server_configs_from_config(tmp_path, monkeypatch):
    """Isolated from developer ~/.rays/mcp.json on the machine running CI."""
    monkeypatch.setenv("HOME", str(tmp_path))
    project = tmp_path / "project"
    project.mkdir()
    config = {
        "mcp_servers": [
            {"name": "demo", "command": "echo", "enabled": True},
        ]
    }
    servers = load_mcp_server_configs(config, project)
    assert len(servers) == 1
    assert servers[0]["name"] == "demo"
