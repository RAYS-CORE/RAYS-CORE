from rays_core.execution_context import (
    format_prior_executions,
    has_tool_actions,
    programmatic_completion_failures,
)


def test_format_prior_executions_includes_tool_calls():
    history = [
        {
            "type": "mcp",
            "server": "blender",
            "phase": "discover",
            "spawn_reason": "Need scene baseline",
            "status": "completed",
            "actions": [
                {
                    "turn": 1,
                    "thought": "read scene",
                    "tool": "get_scene_info",
                    "arguments": {},
                    "result": '{"objects": []}',
                }
            ],
        }
    ]
    text = format_prior_executions(history, "color the donut")
    assert "blender" in text
    assert "get_scene_info" in text
    assert '{"objects": []}' in text
    assert "Need scene baseline" in text
    assert "Legacy summary" not in text


def test_has_tool_actions():
    assert not has_tool_actions([])
    assert not has_tool_actions([{"thought": "x", "tool": None}])
    assert has_tool_actions([{"tool": "write_file"}])


def test_programmatic_completion_failures_docx_without_tools():
    history = [
        {
            "type": "skill",
            "skill": "docx",
            "status": "completed",
            "actions": [{"thought": "done", "tool": None}],
        }
    ]
    failures = programmatic_completion_failures(
        "create a docx about iphone development", history
    )
    assert any("docx" in f for f in failures)
    assert any("without calling" in f for f in failures)


def test_programmatic_completion_failures_passes_with_tool():
    history = [
        {
            "type": "skill",
            "skill": "docx",
            "status": "completed",
            "actions": [{"tool": "run_shell_command", "result": "ok"}],
        }
    ]
    failures = programmatic_completion_failures(
        "create a docx about iphone development", history
    )
    assert not failures
