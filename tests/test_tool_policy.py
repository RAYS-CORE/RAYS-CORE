from rays_core.tool_registry import ToolPolicy, qualified_tool_name


def test_qualified_tool_name():
    assert qualified_tool_name("github", "create_issue") == "github/create_issue"


def test_deny_pattern_blocks_tool():
    policy = ToolPolicy({"deny": ["github/delete_*"]})
    decision, _ = policy.evaluate("github", "delete_repo", "autonomous")
    assert decision == "deny"


def test_confirm_in_ask_mode():
    policy = ToolPolicy({"require_confirmation": ["github/create_*"]})
    decision, _ = policy.evaluate("github", "create_issue", "ask")
    assert decision == "confirm"


def test_allow_in_autonomous_mode():
    policy = ToolPolicy({"require_confirmation": ["github/create_*"]})
    decision, _ = policy.evaluate("github", "create_issue", "autonomous")
    assert decision == "allow"
