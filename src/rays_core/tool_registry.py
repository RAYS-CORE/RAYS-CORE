"""MCP tool naming and execution policy for the orchestrator path."""

from __future__ import annotations

import fnmatch
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


def qualified_tool_name(server: str, tool_name: str) -> str:
    return f"{server}/{tool_name}"


@dataclass
class ToolDescriptor:
    server: str
    name: str
    description: str
    input_schema: Dict[str, Any]

    @property
    def qualified_name(self) -> str:
        return qualified_tool_name(self.server, self.name)


class ToolRegistry:
    """Maps qualified MCP tool names to descriptors discovered at connect time."""

    def __init__(self) -> None:
        self._tools: Dict[str, ToolDescriptor] = {}

    def clear(self) -> None:
        self._tools.clear()

    def unregister_server(self, server: str) -> None:
        prefix = f"{server}/"
        for key in [k for k in self._tools if k.startswith(prefix)]:
            del self._tools[key]

    def register(self, descriptor: ToolDescriptor) -> None:
        self._tools[descriptor.qualified_name] = descriptor

    def get(self, server: str, tool_name: str) -> Optional[ToolDescriptor]:
        return self._tools.get(qualified_tool_name(server, tool_name))

    def tools_for_server(self, server: str) -> List[ToolDescriptor]:
        prefix = f"{server}/"
        return [t for key, t in self._tools.items() if key.startswith(prefix)]

    def all_tools(self) -> List[ToolDescriptor]:
        return list(self._tools.values())


class ToolPolicy:
    """Pattern-based allow / deny / confirm-before-call for MCP tools."""

    def __init__(self, policy_config: Optional[Dict[str, Any]] = None) -> None:
        policy_config = policy_config or {}
        self.deny_patterns: List[str] = list(policy_config.get("deny", []))
        self.confirm_patterns: List[str] = list(
            policy_config.get("require_confirmation", [])
        )

    def _matches_any(self, qualified_name: str, patterns: List[str]) -> bool:
        for pattern in patterns:
            if fnmatch.fnmatch(qualified_name, pattern):
                return True
            if fnmatch.fnmatch(qualified_name.split("/", 1)[-1], pattern):
                return True
        return False

    def evaluate(
        self, server: str, tool_name: str, execution_mode: str
    ) -> tuple[str, str]:
        """
        Returns (decision, message) where decision is allow | deny | confirm.
        """
        qualified = qualified_tool_name(server, tool_name)
        if self._matches_any(qualified, self.deny_patterns):
            return "deny", f"Tool '{qualified}' is denied by mcp_tool_policy."

        if execution_mode != "autonomous" and self._matches_any(
            qualified, self.confirm_patterns
        ):
            return "confirm", f"Tool '{qualified}' requires confirmation."

        return "allow", ""
