"""Per-MCP-server dynamic sub-agent: runs until it decides the spawn objective is done."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from .ai_client import AIClient
from .execution_context import (
    format_prior_executions,
    format_session_actions,
    has_tool_actions,
)
from .mcp_health import (
    blender_recovery_hint,
    is_mcp_backend_error,
    session_actions_have_backend_failure,
)
from .mcp_manager import MCPManager
from .tool_registry import ToolPolicy, qualified_tool_name
from . import rays_ui


class MCPOrchestrator:
    def __init__(
        self,
        ai_client: AIClient,
        config: Dict[str, Any],
        codebase_root: Path,
        mcp_manager: MCPManager,
        execution_mode: str = "ask",
    ) -> None:
        self.ai_client = ai_client
        self.config = config
        self.codebase_root = Path(codebase_root).resolve()
        self.mcp_manager = mcp_manager
        self.execution_mode = execution_mode
        self.prompts = config.get("mcp_orchestrator_prompts") or {}
        self.tool_policy = ToolPolicy(config.get("mcp_tool_policy", {}))
        self.max_turns = int(config.get("mcp_subagent_max_turns", 25))
        self.connection_error_limit = int(
            config.get("mcp_connection_error_limit", 2)
        )
        self.backend_failure_max_turns = int(
            config.get("mcp_backend_failure_max_turns", 10)
        )
        self.no_tool_turn_limit = int(config.get("mcp_no_tool_turn_limit", 3))

    def set_execution_mode(self, mode: str) -> None:
        self.execution_mode = "autonomous" if mode == "autonomous" else "ask"

    def execute_mcp_step(
        self,
        server: str,
        step: Dict[str, Any],
        user_prompt: str,
        plan: List[Dict[str, Any]],
        previous_results: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        session = self.mcp_manager.get_session(server)
        if not session or session.status != "connected":
            return self._failed_record(
                server, step, f"MCP server '{server}' is not available."
            )

        tools_catalog = self.mcp_manager.registry.tools_for_server(server)
        if not tools_catalog:
            return self._failed_record(
                server, step, f"No tools registered for MCP server '{server}'."
            )

        tools_json = json.dumps(
            [
                {
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.input_schema,
                }
                for t in tools_catalog
            ],
            indent=2,
            default=str,
        )

        phase = (step.get("phase") or "act").lower()
        intent = step.get("intent") or step.get("reason", "")
        spawn_reason = (
            step.get("spawn_reason")
            or step.get("reason")
            or intent
            or f"Use {server} to satisfy the user request"
        )

        prior_block = self._prior_server_unusable(server, previous_results)
        if prior_block:
            return self._connection_lost_record(
                server, step, spawn_reason, intent, phase, prior_block, []
            )

        rays_ui.print_mcp_step_header(server, phase, intent, 0)
        if rays_ui.orchestration_hud_active():
            rays_ui.hud_set_status(f"MCP {server}", f"{phase}")

        session = self.mcp_manager.get_session(server)
        if session and session.backend_note:
            rays_ui.hud_note_warn(session.backend_note)
            self.mcp_manager.reconnect_server(server)
            session = self.mcp_manager.get_session(server)
            if session and session.backend_note:
                return self._connection_lost_record(
                    server, step, spawn_reason, intent, phase, session.backend_note, []
                )

        prior_transcript = format_prior_executions(previous_results, user_prompt)
        session_actions: List[Dict[str, Any]] = []
        consecutive_backend_errors = 0
        reconnected_this_step = False
        first_backend_failure_turn: int | None = None
        consecutive_no_tool_turns = 0
        recovery_hint = blender_recovery_hint() if "blender" in server.lower() else (
            "MCP backend unreachable; fix the external app and retry."
        )

        for turn in range(1, self.max_turns + 1):
            if first_backend_failure_turn is not None:
                turns_since_failure = turn - first_backend_failure_turn
                if turns_since_failure >= self.backend_failure_max_turns:
                    return self._connection_lost_record(
                        server,
                        step,
                        spawn_reason,
                        intent,
                        phase,
                        (
                            f"{recovery_hint} "
                            f"(stopped after {self.backend_failure_max_turns} turns "
                            f"with backend unreachable)"
                        ),
                        session_actions,
                    )

            rays_ui.hud_set_status("Thinking", f"{server} · turn {turn}")

            prompt = self.prompts.get("mcp_subagent_turn", "").format(
                user_prompt=user_prompt,
                server_name=server,
                spawn_reason=spawn_reason,
                phase=phase,
                intent=intent,
                tools_catalog=tools_json,
                prior_executions=prior_transcript,
                session_actions=format_session_actions(session_actions),
                turn_number=turn,
            )
            response = self.ai_client.generate_json(prompt)
            status = (response.get("status") or "running").lower()
            thought = response.get("thought", "")
            tool_call = response.get("tool_call")

            if thought:
                rays_ui.print_mcp_thought(thought)

            if tool_call:
                consecutive_no_tool_turns = 0
                result = self._dispatch_mcp_tool(server, tool_call)
                lost = self._apply_backend_error_handling(
                    server,
                    result,
                    consecutive_backend_errors,
                    reconnected_this_step,
                )
                consecutive_backend_errors = lost["consecutive"]
                reconnected_this_step = lost["reconnected"]
                result = lost["result"]
                if lost["stop"]:
                    session_actions.append(
                        {
                            "turn": turn,
                            "thought": thought,
                            "tool": tool_call.get("name"),
                            "arguments": tool_call.get("arguments"),
                            "result": result,
                        }
                    )
                    return self._connection_lost_record(
                        server,
                        step,
                        spawn_reason,
                        intent,
                        phase,
                        lost["hint"],
                        session_actions,
                    )
                session_actions.append(
                    {
                        "turn": turn,
                        "thought": thought,
                        "tool": tool_call.get("name"),
                        "arguments": tool_call.get("arguments"),
                        "result": result,
                    }
                )
                rays_ui.print_mcp_tool_done(
                    server,
                    tool_call.get("name", "?"),
                    result,
                    tool_call.get("arguments"),
                )

            if session_actions_have_backend_failure(server, session_actions):
                if first_backend_failure_turn is None:
                    first_backend_failure_turn = turn

            if status == "completed":
                if first_backend_failure_turn is not None:
                    return self._connection_lost_record(
                        server,
                        step,
                        spawn_reason,
                        intent,
                        phase,
                        recovery_hint,
                        session_actions,
                    )
                if not has_tool_actions(session_actions):
                    session_actions.append(
                        {
                            "turn": turn,
                            "thought": thought,
                            "tool": None,
                            "arguments": None,
                            "result": (
                                "REJECTED completion: call at least one MCP tool on this "
                                "server before status completed. Do not claim docx/pptx or "
                                "file documentation is impossible — those are handled by "
                                "separate skill sub-agents later."
                            ),
                        }
                    )
                    continue
                return {
                    "type": "mcp",
                    "server": server,
                    "phase": phase,
                    "spawn_reason": spawn_reason,
                    "intent": intent,
                    "status": "completed",
                    "exit_message": response.get("exit_message", ""),
                    "actions": session_actions,
                }

            if not tool_call:
                consecutive_no_tool_turns += 1
                session_actions.append(
                    {
                        "turn": turn,
                        "thought": thought,
                        "tool": None,
                        "arguments": None,
                        "result": "No tool_call provided; sub-agent must call a tool or set status completed.",
                    }
                )
                if first_backend_failure_turn is not None:
                    return self._connection_lost_record(
                        server,
                        step,
                        spawn_reason,
                        intent,
                        phase,
                        recovery_hint,
                        session_actions,
                    )
                if consecutive_no_tool_turns >= self.no_tool_turn_limit:
                    return self._connection_lost_record(
                        server,
                        step,
                        spawn_reason,
                        intent,
                        phase,
                        (
                            f"Stopped after {self.no_tool_turn_limit} turns without calling "
                            f"an MCP tool. {recovery_hint}"
                        ),
                        session_actions,
                    )

        return {
            "type": "mcp",
            "server": server,
            "phase": phase,
            "spawn_reason": spawn_reason,
            "intent": intent,
            "status": "max_turns",
            "exit_message": f"Stopped after {self.max_turns} turns without completion.",
            "actions": session_actions,
        }

    def _prior_server_unusable(
        self, server: str, previous_results: List[Dict[str, Any]]
    ) -> str:
        for entry in previous_results:
            if entry.get("type") != "mcp" or entry.get("server") != server:
                continue
            if entry.get("status") in ("connection_lost", "error", "skipped"):
                return (
                    entry.get("exit_message")
                    or blender_recovery_hint()
                )
            if session_actions_have_backend_failure(
                server, entry.get("actions") or []
            ):
                return blender_recovery_hint() if "blender" in server.lower() else (
                    "MCP backend was unreachable in a prior step for this server."
                )
        return ""

    def _apply_backend_error_handling(
        self,
        server: str,
        result: str,
        consecutive: int,
        reconnected: bool,
    ) -> Dict[str, Any]:
        if not is_mcp_backend_error(server, result):
            self.mcp_manager.clear_backend_note(server)
            return {
                "result": result,
                "consecutive": 0,
                "reconnected": reconnected,
                "stop": False,
                "hint": "",
            }

        consecutive += 1
        hint = blender_recovery_hint() if "blender" in server.lower() else (
            "MCP backend unreachable; fix the external app and retry."
        )
        self.mcp_manager.note_backend_unreachable(server, hint)

        if not reconnected:
            if self.mcp_manager.reconnect_server(server):
                rays_ui.print_warning(
                    f"MCP '{server}' subprocess restarted after backend error."
                )
            reconnected = True
            result = f"{result}\n\n[RAYS] Restarted MCP subprocess once. {hint}"
            if consecutive >= self.connection_error_limit:
                return {
                    "result": result,
                    "consecutive": consecutive,
                    "reconnected": reconnected,
                    "stop": True,
                    "hint": hint,
                }
            return {
                "result": result,
                "consecutive": consecutive,
                "reconnected": reconnected,
                "stop": False,
                "hint": hint,
            }

        result = f"{result}\n\n[RAYS] Backend still unreachable. Stop retrying. {hint}"
        return {
            "result": result,
            "consecutive": consecutive,
            "reconnected": reconnected,
            "stop": consecutive >= self.connection_error_limit,
            "hint": hint,
        }

    def _connection_lost_record(
        self,
        server: str,
        step: Dict[str, Any],
        spawn_reason: str,
        intent: str,
        phase: str,
        hint: str,
        actions: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        rays_ui.hud_note_warn(hint)
        return {
            "type": "mcp",
            "server": server,
            "phase": phase,
            "spawn_reason": spawn_reason,
            "intent": intent,
            "status": "connection_lost",
            "exit_message": hint,
            "actions": actions,
        }

    def _failed_record(
        self, server: str, step: Dict[str, Any], message: str
    ) -> Dict[str, Any]:
        return {
            "type": "mcp",
            "server": server,
            "phase": step.get("phase", "act"),
            "spawn_reason": step.get("spawn_reason") or step.get("reason", ""),
            "intent": step.get("intent", ""),
            "status": "error",
            "exit_message": message,
            "actions": [],
        }

    def _dispatch_mcp_tool(self, server: str, tool_call: Dict[str, Any]) -> str:
        tool_name = tool_call.get("name") or tool_call.get("tool")
        arguments = tool_call.get("arguments") or {}

        if not tool_name:
            return "Error: MCP tool_call missing 'name'."

        if tool_call.get("server") and tool_call.get("server") != server:
            return (
                f"Error: tool_call server '{tool_call.get('server')}' "
                f"does not match plan step server '{server}'."
            )

        decision, message = self.tool_policy.evaluate(
            server, tool_name, self.execution_mode
        )
        if decision == "deny":
            return f"Error: {message}"

        qualified = qualified_tool_name(server, tool_name)
        if decision == "confirm":
            if not rays_ui.ask_approval(f"Allow MCP tool {qualified}?"):
                return "Error: User denied MCP tool execution."

        rays_ui.print_mcp_tool_invoke(server, tool_name, arguments)
        return self.mcp_manager.call_tool(server, tool_name, arguments)
