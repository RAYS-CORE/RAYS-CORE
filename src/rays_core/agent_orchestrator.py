"""Unified skills + MCP orchestration for the default (non-/code) CLI path."""

from __future__ import annotations

import json
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from .ai_client import AIClient
from .execution_context import format_prior_executions

logger = logging.getLogger(__name__)
from .mcp_manager import MCPManager
from .mcp_orchestrator import MCPOrchestrator
from .skills_orchestrator import SkillsOrchestrator
from . import rays_ui


class AgentOrchestrator:
    def __init__(
        self,
        ai_client: AIClient,
        config: Dict[str, Any],
        codebase_root: Path,
        skills_orchestrator: SkillsOrchestrator,
        mcp_manager: MCPManager,
        execution_mode: str = "ask",
    ) -> None:
        self.ai_client = ai_client
        self.config = config
        self.codebase_root = Path(codebase_root).resolve()
        self.skills = skills_orchestrator
        self.mcp_manager = mcp_manager
        self.mcp_orchestrator = MCPOrchestrator(
            ai_client, config, self.codebase_root, mcp_manager, execution_mode
        )
        self.execution_mode = execution_mode
        self.prompts = config.get("agent_orchestrator_prompts") or {}

    def set_execution_mode(self, mode: str) -> None:
        normalized = "autonomous" if mode == "autonomous" else "ask"
        self.execution_mode = normalized
        self.mcp_orchestrator.set_execution_mode(normalized)

    def run(self, user_prompt: str) -> Dict[str, Any]:
        cumulative_history: List[Dict[str, Any]] = []
        max_loops = 3

        with rays_ui.orchestration_hud():
            rays_ui.orch_begin_session(user_prompt)
            result = self._run_loops(user_prompt, cumulative_history, max_loops)

        result["narrative_summary"] = self._generate_session_summary(
            user_prompt, result
        )
        rays_ui.orch_render_final_summary(result)
        
        # Save Execution-State Graph for FOGR Fine-Tuning
        try:
            session_id = str(uuid.uuid4())
            log_dir = os.path.expanduser(f"~/.rays/conversations/{session_id}")
            os.makedirs(log_dir, exist_ok=True)
            log_path = os.path.join(log_dir, "execution_graphs.jsonl")
            
            graph_data = {
                "session_id": session_id,
                "intent": user_prompt,
                "execution_topology": cumulative_history,
                "is_complete": result.get("complete", False)
            }
            with open(log_path, "w", encoding="utf-8") as f:
                f.write(json.dumps(graph_data) + "\n")
            logger.info(f"FOGR Execution Graph saved to {log_path}")
        except Exception as e:
            logger.error(f"Failed to save FOGR execution graph: {e}")

        return result

    def _run_loops(
        self,
        user_prompt: str,
        cumulative_history: List[Dict[str, Any]],
        max_loops: int,
    ) -> Dict[str, Any]:
        complete = False
        summary = ""
        validation_reasoning = ""
        for loop_idx in range(max_loops):
            if loop_idx > 0:
                rays_ui.hud_set_status(
                    "Retrying", f"loop {loop_idx + 1} of {max_loops}"
                )
                rays_ui.orch_emit_section(f"Retry {loop_idx + 1}")

            skills_list = self.skills.discover_skills()
            mcp_planner_catalog = self.mcp_manager.list_planner_mcp_catalog()

            rays_ui.hud_set_status("Thinking", "Choosing capabilities")
            selection = self._select_capabilities(
                user_prompt, skills_list, mcp_planner_catalog, cumulative_history
            )
            required_skills = selection.get("required_skills", [])
            required_mcp_servers = selection.get("required_mcp_servers", [])
            if required_mcp_servers:
                self.mcp_manager.connect_servers(required_mcp_servers)
            mcp_capabilities = self.mcp_manager.list_capabilities()
            rays_ui.orch_emit_capabilities(
                required_skills,
                required_mcp_servers,
                selection.get("reasoning", ""),
            )

            rays_ui.hud_set_status("Planning", "Building execution plan")
            plan_data = self._generate_plan(
                user_prompt,
                required_skills,
                required_mcp_servers,
                cumulative_history,
                mcp_capabilities,
            )
            summary = plan_data.get("summary", "No summary provided.")

            skills_map = {s["name"]: s for s in skills_list}
            mcp_map = {
                c["name"]: c
                for c in mcp_capabilities
                if self.mcp_manager.get_session(c["name"])
                and self.mcp_manager.get_session(c["name"]).is_usable
            }

            plan = self._filter_plan(plan_data.get("plan", []), skills_map, mcp_map)
            plan = self._ensure_workspace_step(plan, required_skills, skills_map)
            rays_ui.orch_emit_plan(summary, plan)

            if not plan:
                if plan_data.get("plan"):
                    rays_ui.hud_note_warn("Planned steps are not available.")
                if loop_idx == 0:
                    return {
                        "status": "completed",
                        "complete": False,
                        "summary": summary,
                        "history": cumulative_history,
                    }
                break

            for i, step in enumerate(plan):
                step_type = step.get("type") or (
                    "skill" if step.get("skill") else "mcp"
                )
                reason = step.get("reason", "")
                if step_type == "skill":
                    label = f"skill/{step.get('skill', '?')}"
                    spawn_reason = (
                        step.get("spawn_reason") or reason or "Run workspace skill"
                    )
                else:
                    label = f"mcp/{step.get('server', '?')}"
                    spawn_reason = (
                        step.get("spawn_reason") or reason or "Run MCP step"
                    )
                rays_ui.orch_emit_step_header(label, spawn_reason)
                rays_ui.hud_set_status(
                    "Running", f"step {i + 1}/{len(plan)} · {label}"
                )

                if step_type == "skill":
                    skill_name = step.get("skill")
                    skill_info = skills_map.get(skill_name)
                    record = self.skills._execute_skill(
                        skill_info,
                        spawn_reason,
                        user_prompt,
                        plan,
                        cumulative_history,
                    )
                    cumulative_history.append(record)
                elif step_type == "mcp":
                    server_name = step.get("server")
                    if self._mcp_server_connection_lost(cumulative_history, server_name):
                        rays_ui.hud_note_warn(
                            f"Skipping mcp/{server_name} — backend connection lost earlier."
                        )
                        cumulative_history.append(
                            {
                                "type": "mcp",
                                "server": server_name,
                                "phase": step.get("phase", "act"),
                                "spawn_reason": spawn_reason,
                                "intent": step.get("intent", ""),
                                "status": "skipped",
                                "exit_message": "Skipped because this MCP backend was unreachable.",
                                "actions": [],
                            }
                        )
                        continue
                    record = self.mcp_orchestrator.execute_mcp_step(
                        server_name,
                        step,
                        user_prompt,
                        plan,
                        cumulative_history,
                    )
                    cumulative_history.append(record)
                else:
                    rays_ui.hud_note_warn(f"Unknown step type: {step_type}")

            rays_ui.hud_set_status("Validating", "Checking completion")
            completion = self._evaluate_completion(user_prompt, cumulative_history)
            validation_reasoning = completion.get("reasoning", "")
            is_done = completion.get("is_complete", False)
            rays_ui.orch_emit_validation(is_done, validation_reasoning)
            if is_done:
                complete = True
                break

        return {
            "status": "completed",
            "complete": complete,
            "history": cumulative_history,
            "summary": summary,
            "validation_reasoning": validation_reasoning,
        }

    def _mcp_server_connection_lost(
        self, history: List[Dict[str, Any]], server: str
    ) -> bool:
        for entry in history:
            if (
                entry.get("type") == "mcp"
                and entry.get("server") == server
                and entry.get("status") == "connection_lost"
            ):
                return True
        return False

    def _filter_plan(
        self,
        raw_plan: List[Dict[str, Any]],
        skills_map: Dict[str, Any],
        mcp_map: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        filtered: List[Dict[str, Any]] = []
        for step in raw_plan:
            step_type = (step.get("type") or "").lower()
            if not step_type:
                if step.get("skill"):
                    step_type = "skill"
                elif step.get("server"):
                    step_type = "mcp"
            if step_type == "skill" and step.get("skill") in skills_map:
                filtered.append({**step, "type": "skill"})
            elif step_type == "mcp" and step.get("server") in mcp_map:
                filtered.append({**step, "type": "mcp"})
        return filtered

    def _ensure_workspace_step(
        self,
        plan: List[Dict[str, Any]],
        required_skills: List[str],
        skills_map: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        if "workspace" not in required_skills or "workspace" not in skills_map:
            return plan
        if any(s.get("skill") == "workspace" for s in plan):
            return plan
        return [
            {
                "step": 0,
                "type": "skill",
                "skill": "workspace",
                "spawn_reason": "Map local project context before external MCP actions",
                "reason": "Map local project context before external MCP actions",
            },
            *plan,
        ]

    def _select_capabilities(
        self,
        user_prompt: str,
        skills_list: List[Dict[str, str]],
        mcp_capabilities: List[Dict[str, Any]],
        history: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        prompt = self.prompts.get("select_required_capabilities", "").format(
            user_prompt=user_prompt,
            skills_list=json.dumps(skills_list, indent=2),
            mcp_servers=json.dumps(mcp_capabilities, indent=2),
            execution_history=format_prior_executions(history, user_prompt),
        )
        return self.ai_client.generate_json(prompt)

    def _generate_plan(
        self,
        user_prompt: str,
        required_skills: List[str],
        required_mcp_servers: List[str],
        history: List[Dict[str, Any]],
        mcp_capabilities: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        catalog = [
            c
            for c in mcp_capabilities
            if c.get("name") in required_mcp_servers
        ]
        prompt = self.prompts.get("generate_agent_execution_plan", "").format(
            user_prompt=user_prompt,
            required_skills=json.dumps(required_skills),
            required_mcp_servers=json.dumps(required_mcp_servers),
            mcp_tool_catalog=json.dumps(catalog, indent=2, default=str),
            execution_history=format_prior_executions(history, user_prompt),
        )
        return self.ai_client.generate_json(prompt)

    def _generate_session_summary(
        self, user_prompt: str, result: Dict[str, Any]
    ) -> str:
        template = self.prompts.get("generate_session_summary", "")
        if not template:
            return ""
        history = result.get("history") or []
        complete = result.get("complete", False)
        try:
            prompt = template.format(
                user_prompt=user_prompt,
                execution_history=format_prior_executions(history, user_prompt),
                is_complete="yes" if complete else "no",
                plan_summary=result.get("summary") or "",
            )
            return (self.ai_client.generate_text(prompt) or "").strip()
        except Exception:
            logger.exception("Failed to generate orchestration session summary")
            return ""

    def _evaluate_completion(
        self, user_prompt: str, history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        from .execution_context import programmatic_completion_failures

        hard_failures = programmatic_completion_failures(user_prompt, history)
        if hard_failures:
            return {
                "is_complete": False,
                "reasoning": "Programmatic validation failed:\n- "
                + "\n- ".join(hard_failures),
            }
        prompt = self.prompts.get("check_completion", "").format(
            user_prompt=user_prompt,
            execution_history=format_prior_executions(history, user_prompt),
        )
        return self.ai_client.generate_json(prompt)

    def list_mcp_status(self) -> str:
        """Human-readable MCP status for /mcp command."""
        if not self.mcp_manager.has_server_configs:
            return "No MCP servers configured. Add mcp_servers to config.yaml or ~/.rays/mcp.json."
        if not self.mcp_manager._connected:
            self.mcp_manager.connect_all()
        lines = []
        for name, session in self.mcp_manager._sessions.items():
            if session.status == "connected":
                tool_names = ", ".join(t.name for t in session.tools) or "(none)"
                if session.backend_note:
                    lines.append(
                        f"  {name}: connected (stdio) — backend unreachable — {session.backend_note}"
                    )
                else:
                    lines.append(f"  {name}: connected — tools: {tool_names}")
            else:
                lines.append(f"  {name}: {session.status} — {session.error or ''}")
        configured = [c.get("name") for c in self.mcp_manager._server_configs if c.get("name")]
        missing = [n for n in configured if n and n not in self.mcp_manager._sessions]
        for name in missing:
            lines.append(f"  {name}: not connected")
        return "\n".join(lines) if lines else "No MCP sessions."
