"""Unified skills + MCP orchestration for the default (non-/code) CLI path."""

from __future__ import annotations

import json
import logging
import re
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
        
        # Persistent Memory initialization
        self.memory_enabled = self.config.get("memory", {}).get("memoryEnabled", False)
        self.frozen_memory_context = ""
        if self.memory_enabled:
            import sys
            # Dynamically register the memory MCP server
            memory_server_config = {
                "name": "persistent_memory",
                "command": sys.executable,
                "args": ["-m", "rays_core.memory_mcp"]
            }
            # Add if not already present
            if not any(c.get("name") == "persistent_memory" for c in self.mcp_manager._server_configs):
                self.mcp_manager._server_configs.append(memory_server_config)
            
            # Load the frozen context
            from .persistent_memory import MemoryStore
            mem_store = MemoryStore(self.codebase_root)
            mem_store.load_from_disk()
            self.frozen_memory_context = mem_store.format_for_system_prompt()

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

            raw_skills_list = self.skills.discover_skills()
            mcp_planner_catalog = self.mcp_manager.list_planner_mcp_catalog()
            mcp_server_names = {c["name"] for c in mcp_planner_catalog}

            skills_list = []
            for s in raw_skills_list:
                if s.get("category", "").lower() == "mcp":
                    base_name = s["name"].replace("-mcp", "")
                    if s["name"] in mcp_server_names or base_name in mcp_server_names:
                        skills_list.append(s)
                else:
                    skills_list.append(s)

            rays_ui.hud_set_status("Thinking", "Choosing capabilities")
            selection = self._select_capabilities(
                user_prompt, skills_list, mcp_planner_catalog, cumulative_history
            )
            required_skills = selection.get("required_skills") or selection.get("skills") or []
            required_mcp_servers = selection.get("required_mcp_servers") or selection.get("mcp_servers") or []
            if required_mcp_servers:
                self.mcp_manager.connect_servers(required_mcp_servers)
            mcp_capabilities = self.mcp_manager.list_capabilities()
            
            # Only print capability selection if there are actually capabilities picked
            if required_skills or required_mcp_servers:
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

            plan_raw = plan_data.get("plan") or plan_data.get("steps") or []
            plan = self._filter_plan(plan_raw, skills_map, mcp_map)
            plan = self._ensure_workspace_step(plan, required_skills, skills_map)
            
            # Print capabilities if we found steps but didn't print capabilities earlier
            # (In case LLM failed to put it in _select_capabilities but did in plan)
            if plan and not required_skills and not required_mcp_servers:
                inferred_skills = [s["skill"] for s in plan if s.get("type") == "skill" and s.get("skill")]
                inferred_mcps = [s["server"] for s in plan if s.get("type") == "mcp" and s.get("server")]
                if inferred_skills or inferred_mcps:
                    rays_ui.orch_emit_capabilities(inferred_skills, inferred_mcps, "Inferred from plan")
            
            rays_ui.orch_emit_plan(summary, plan)

            if not plan:
                if plan_raw:
                    rays_ui.hud_note_warn("Planned steps are not available (all steps were dropped).")
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
            skill_val = step.get("skill") or step.get("name")
            server_val = step.get("server") or step.get("name")
            
            if not step_type:
                if skill_val in skills_map:
                    step_type = "skill"
                elif server_val in mcp_map:
                    step_type = "mcp"
            if step_type == "skill":
                if skill_val in skills_map:
                    filtered.append({**step, "type": "skill", "skill": skill_val})
                elif skill_val in mcp_map:
                    # AI confused skill for MCP server
                    filtered.append({**step, "type": "mcp", "server": skill_val})
            elif step_type == "mcp":
                if server_val in mcp_map:
                    filtered.append({**step, "type": "mcp", "server": server_val})
                elif server_val in skills_map:
                    # AI confused MCP server for skill
                    filtered.append({**step, "type": "skill", "skill": server_val})
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

    def _slim_skills_list(
        self, skills_list: List[Dict[str, str]], user_prompt: str = "", max_skills: int = 0
    ) -> List[Dict[str, str]]:
        """Trim skills to just name+description, ranked by keyword relevance, capped at max_skills."""
        # Provider-aware default caps: Groq free tier = 6K TPM, others are much higher
        provider = getattr(self.ai_client, 'provider', 'ollama')
        if max_skills == 0:
            max_skills = 25 if provider == 'groq' else 150

        slim = [{"name": s["name"], "category": s.get("category", ""), "description": s.get("description", "")} for s in skills_list]

        if user_prompt and len(slim) > max_skills:
            # Simple keyword ranking: count how many words from user_prompt appear in name/description
            words = set(re.findall(r'\w+', user_prompt.lower()))
            common_stopwords = {"the", "a", "an", "is", "for", "of", "in", "to", "and", "or", "i", "on", "at", "do", "can", "use", "using", "with"}
            keywords = words - common_stopwords

            def relevance(s: Dict) -> int:
                text = (s["name"] + " " + s.get("description", "")).lower()
                score = sum(1 for kw in keywords if kw in text)
                if s["name"] == "duckduckgo" and ("search" in keywords or "web" in keywords):
                    score += 100
                return score

            slim.sort(key=relevance, reverse=True)

            # CRITICAL FIX: If this is a general web search, hide competing unconfigured community search skills 
            # so the LLM doesn't get distracted by them, unless the user explicitly requested one by name.
            if ("search" in keywords or "web" in keywords) and any(s["name"] == "duckduckgo" for s in slim):
                filtered_slim = []
                for s in slim:
                    name_lower = s["name"].lower()
                    if name_lower == "duckduckgo" or name_lower in user_prompt.lower():
                        filtered_slim.append(s)
                    else:
                        # Hide if it's a generic search script competing with duckduckgo
                        is_competing_search = "search" in name_lower or "web" in name_lower
                        if not is_competing_search:
                            filtered_slim.append(s)
                slim = filtered_slim

        return slim[:max_skills]

    def _select_capabilities(
        self,
        user_prompt: str,
        skills_list: List[Dict[str, str]],
        mcp_capabilities: List[Dict[str, Any]],
        history: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        slim_skills = self._slim_skills_list(skills_list, user_prompt=user_prompt)
        prompt = self.prompts.get("select_required_capabilities", "").format(
            user_prompt=user_prompt,
            skills_list=json.dumps(slim_skills, indent=2),
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
