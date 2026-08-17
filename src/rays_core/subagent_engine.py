"""
Sub-Agent Engine for RAYS-CORE.

Provides isolated, specialized, concurrent sub-agent execution inspired by
state-of-the-art architectures (Hermes delegate_task, OpenCode subagent sessions,
Pi Agent worker pool, Antigravity multi-agent orchestration).

Features:
- Context Isolation: Sub-agents run with clean context to protect parent window.
- Specialized Roles: researcher, coder, reviewer, general.
- Execution Modes: Single, Parallel (ThreadPoolExecutor), and Chained pipelines.
- Depth & Budget Protection: Recursion limit (max_depth=2) and turn caps.
- Live RAYS UI Status: Real-time child activity updates in terminal.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .ai_client import AIClient
from . import rays_ui

logger = logging.getLogger(__name__)

# Maximum recursion depth for sub-agents (prevent infinite delegation trees)
MAX_SPAWN_DEPTH = 2
MAX_SUBAGENTS_BATCH = 8
MAX_SUBAGENT_TURNS = 12


@dataclass
class SubagentTask:
    task_id: str
    role: str
    prompt: str
    context: str = ""
    tools_allowed: Optional[List[str]] = None
    max_turns: int = MAX_SUBAGENT_TURNS


@dataclass
class SubagentResult:
    task_id: str
    role: str
    success: bool
    summary: str
    actions: List[Dict[str, Any]] = field(default_factory=list)
    duration: float = 0.0
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "role": self.role,
            "success": self.success,
            "summary": self.summary,
            "actions_count": len(self.actions),
            "duration_seconds": round(self.duration, 2),
            "error": self.error,
        }


ROLE_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "researcher": {
        "title": "Researcher",
        "description": "Deep codebase search, file reading, live web search, architecture exploration, and fact finding. Read-only.",
        "allowed_tools": [
            "web_search", "web_fetch", "read_file", "list_directory", "run_shell_command",
            "check_process", "report_progress"
        ],
        "system_prompt": (
            "You are a specialized Research Subagent in RAYS-CORE operating with an isolated context window.\n"
            "Your objective is to thoroughly investigate the codebase and web, find precise facts, file locations, "
            "and code snippets relevant to the delegated prompt.\n"
            "Rules:\n"
            "1. You are READ-ONLY. Do not write or patch files.\n"
            "2. When calling 'run_shell_command', only use inspection commands (grep, git status, find, python --version, etc.).\n"
            "3. You can use 'web_search' and 'web_fetch' to search the live web and read online docs/tutorials.\n"
            "4. Return a concise, high-density factual summary when complete."
        )
    },
    "coder": {
        "title": "Specialist Coder",
        "description": "Targeted file creation, patching, bug fixing, web docs lookup, and test execution.",
        "allowed_tools": [
            "web_search", "web_fetch", "read_file", "write_file", "patch_file", "list_directory",
            "run_shell_command", "check_process", "wait_process", "report_progress"
        ],
        "system_prompt": (
            "You are a specialized Coding Subagent in RAYS-CORE operating with an isolated context window.\n"
            "Your objective is to implement code changes, create files, apply patches, search for online docs if needed, and run validation commands.\n"
            "Rules:\n"
            "1. Focus strictly on the delegated prompt without making unrelated changes.\n"
            "2. Always read files before modifying them.\n"
            "3. Return a clear summary of all modified files, added logic, and validation outcomes."
        )
    },
    "reviewer": {
        "title": "Code Reviewer",
        "description": "Auditing diffs, detecting edge cases, checking code quality, and security review.",
        "allowed_tools": [
            "web_search", "web_fetch", "read_file", "list_directory", "run_shell_command", "report_progress"
        ],
        "system_prompt": (
            "You are a specialized Reviewer Subagent in RAYS-CORE operating with an isolated context window.\n"
            "Your objective is to critically evaluate code changes, architecture, edge cases, and potential bugs.\n"
            "Rules:\n"
            "1. Read the relevant code and assess correctness, performance, and security.\n"
            "2. Return a structured breakdown of findings, edge cases, and recommendations."
        )
    },
    "general": {
        "title": "General Worker",
        "description": "Full-capability autonomous sub-agent with access to all standard tools.",
        "allowed_tools": [
            "web_search", "web_fetch", "read_file", "write_file", "patch_file", "list_directory",
            "run_shell_command", "check_process", "wait_process", "sleep",
            "kill_process", "list_processes", "report_progress"
        ],
        "system_prompt": (
            "You are an autonomous General Subagent in RAYS-CORE operating with an isolated context window.\n"
            "Your objective is to accomplish the delegated sub-task thoroughly and report your findings to the parent agent."
        )
    }
}


class SubagentEngine:
    """Orchestrates isolated sub-agent executions (Single, Parallel, Chained)."""

    def __init__(
        self,
        ai_client: AIClient,
        config: Dict[str, Any],
        codebase_root: Path,
        skills_orchestrator: Any,
        depth: int = 0
    ) -> None:
        self.ai_client = ai_client
        self.config = config
        self.codebase_root = Path(codebase_root).resolve()
        self.skills = skills_orchestrator
        self.depth = depth

    def execute_delegation(
        self,
        goal: Optional[str] = None,
        role: Optional[str] = None,
        context: Optional[str] = None,
        tasks: Optional[Any] = None,
        chain: Optional[Any] = None,
        parallel: bool = True,
    ) -> Dict[str, Any]:
        """
        Main entry point for subagent delegation.
        Supports:
        - Single task (goal + role + context)
        - Parallel batch (tasks=[...])
        - Chained pipeline (chain=[...])
        """
        if self.depth >= MAX_SPAWN_DEPTH:
            return {
                "success": False,
                "error": f"Maximum subagent delegation depth reached (depth={self.depth}).",
                "results": []
            }

        # 1. Chained Execution Pipeline
        if chain:
            chain_list = [chain] if isinstance(chain, dict) else (chain if isinstance(chain, list) else [{"prompt": str(chain)}])
            return self._run_chain(chain_list)

        # 2. Parallel / Batch Execution
        if tasks:
            tasks_list = [tasks] if isinstance(tasks, dict) else (tasks if isinstance(tasks, list) else [{"prompt": str(tasks)}])
            return self._run_batch(tasks_list, parallel=parallel)

        # 3. Single Subagent Task
        if goal:
            task_role = (role or "researcher").lower().strip()
            task_obj = SubagentTask(
                task_id=f"sub_1",
                role=task_role,
                prompt=goal,
                context=context or ""
            )
            rays_ui.orch_emit_subagent_start(1, [f"[{task_role}] {goal[:60]}..."])
            result = self._run_single_task(task_obj)
            rays_ui.orch_emit_subagent_done(
                result.task_id, result.role, result.summary, result.duration
            )
            return {
                "success": result.success,
                "mode": "single",
                "results": [result.to_dict()],
                "consolidated_summary": result.summary
            }

        return {
            "success": False,
            "error": "delegate_subagent requires 'goal', 'tasks' list, or 'chain' list.",
            "results": []
        }

    def _run_batch(self, task_dicts: List[Any], parallel: bool = True) -> Dict[str, Any]:
        """Run multiple sub-agent tasks concurrently or sequentially."""
        tasks: List[SubagentTask] = []
        for i, t in enumerate(task_dicts[:MAX_SUBAGENTS_BATCH], start=1):
            if isinstance(t, str):
                prompt = t.strip()
                role = "researcher"
                ctx = ""
            elif isinstance(t, dict):
                prompt = (
                    t.get("prompt")
                    or t.get("goal")
                    or t.get("task")
                    or t.get("description")
                    or t.get("instruction")
                    or t.get("query")
                    or ""
                ).strip()
                role = (t.get("role") or t.get("subagent_type") or "researcher").lower().strip()
                ctx = t.get("context", "")
            else:
                continue

            if not prompt:
                continue

            tasks.append(
                SubagentTask(
                    task_id=f"sub_{i}",
                    role=role,
                    prompt=prompt,
                    context=ctx,
                    max_turns=int(t.get("max_turns") or t.get("step_budget") or MAX_SUBAGENT_TURNS) if isinstance(t, dict) else MAX_SUBAGENT_TURNS
                )
            )

        if not tasks:
            return {"success": False, "error": "No valid tasks in batch.", "results": []}

        previews = [f"[{t.role}] {t.prompt[:50]}..." for t in tasks]
        rays_ui.orch_emit_subagent_start(len(tasks), previews)

        results: List[SubagentResult] = []
        start_time = time.time()

        if parallel and len(tasks) > 1:
            max_workers = min(4, len(tasks))
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_task = {
                    executor.submit(self._run_single_task, task): task
                    for task in tasks
                }
                for future in as_completed(future_to_task):
                    res = future.result()
                    origin_task = future_to_task[future]
                    results.append(res)
                    rays_ui.orch_emit_subagent_done(
                        res.task_id, res.role, res.summary, res.duration, origin_task.prompt
                    )
        else:
            for task in tasks:
                res = self._run_single_task(task)
                results.append(res)
                rays_ui.orch_emit_subagent_done(
                    res.task_id, res.role, res.summary, res.duration, task.prompt
                )

        # Sort back to original order by task_id
        results.sort(key=lambda r: r.task_id)

        # Build consolidated markdown report
        consolidated_parts = [
            f"### Delegated Batch Execution ({len(results)} Subagents completed in {time.time() - start_time:.1f}s):"
        ]
        for r in results:
            status_mark = "✓" if r.success else "✗"
            consolidated_parts.append(
                f"\n**{status_mark} [{r.task_id}: {r.role.upper()}]**\n{r.summary}"
            )

        consolidated = "\n".join(consolidated_parts)

        return {
            "success": all(r.success for r in results),
            "mode": "parallel" if parallel else "sequential",
            "results": [r.to_dict() for r in results],
            "consolidated_summary": consolidated
        }

    def _run_chain(self, chain_dicts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Run tasks sequentially with output chaining."""
        results: List[SubagentResult] = []
        previous_output = ""
        start_time = time.time()

        previews = [f"[{t.get('role', 'general')}] {str(t.get('prompt', ''))[:40]}..." for t in chain_dicts]
        rays_ui.orch_emit_subagent_start(len(chain_dicts), previews)

        for i, t in enumerate(chain_dicts, start=1):
            raw_prompt = t.get("prompt") or t.get("goal") or ""
            # Inject {previous} placeholder from prior task output
            resolved_prompt = raw_prompt.replace("{previous}", previous_output)
            role = (t.get("role") or "general").lower().strip()
            max_turns = int(t.get("max_turns") or t.get("step_budget") or MAX_SUBAGENT_TURNS)

            task_obj = SubagentTask(
                task_id=f"step_{i}",
                role=role,
                prompt=resolved_prompt,
                context=t.get("context", ""),
                max_turns=max_turns
            )
            res = self._run_single_task(task_obj)
            results.append(res)
            previous_output = res.summary
            rays_ui.orch_emit_subagent_done(
                res.task_id, res.role, res.summary, res.duration, task_obj.prompt
            )

            if not res.success:
                break

        consolidated = f"### Pipeline Chain ({len(results)} steps):\n" + "\n\n".join(
            f"**Step {r.task_id} ({r.role}):**\n{r.summary}" for r in results
        )

        return {
            "success": all(r.success for r in results),
            "mode": "chain",
            "results": [r.to_dict() for r in results],
            "consolidated_summary": consolidated
        }

    def _run_single_task(self, task: SubagentTask) -> SubagentResult:
        """Execute an isolated turn loop for a single sub-agent."""
        start_ts = time.time()
        role_info = ROLE_DEFINITIONS.get(task.role, ROLE_DEFINITIONS["general"])
        allowed_tools = task.tools_allowed or role_info["allowed_tools"]
        system_prompt = role_info["system_prompt"]
        max_turns = task.max_turns or MAX_SUBAGENT_TURNS

        history: List[Dict[str, Any]] = []
        actions_taken: List[Dict[str, Any]] = []

        rays_ui.subagent_start(task.task_id, task.role, task.prompt)
        rays_ui.orch_emit_subagent_progress(task.task_id, task.role, "Initializing subagent...")

        for turn in range(1, max_turns + 1):
            user_msg = self._build_subagent_turn_prompt(task, history, allowed_tools)
            try:
                rays_ui.orch_emit_subagent_progress(
                    task.task_id, task.role, f"Turn {turn}/{max_turns}: reasoning..."
                )
                response = self.ai_client.generate_json(user_msg, system_prompt=system_prompt)
            except Exception as e:
                logger.error(f"Subagent {task.task_id} LLM generation error: {e}")
                rays_ui.subagent_done(task.task_id, f"Error: {e}", time.time() - start_ts)
                return SubagentResult(
                    task_id=task.task_id,
                    role=task.role,
                    success=False,
                    summary=f"Subagent execution failed during LLM call: {e}",
                    actions=actions_taken,
                    duration=time.time() - start_ts,
                    error=str(e)
                )

            thought = response.get("thought", "")
            action = response.get("action", "finish")
            tool_call = response.get("tool_call") or {}
            final_summary = response.get("summary") or response.get("result") or ""

            # Check for completion
            if action in ("finish", "complete", "done") or not tool_call or not tool_call.get("name"):
                summary_text = final_summary or thought or "Task completed with no output."
                rays_ui.subagent_done(task.task_id, summary_text, time.time() - start_ts)
                return SubagentResult(
                    task_id=task.task_id,
                    role=task.role,
                    success=True,
                    summary=summary_text,
                    actions=actions_taken,
                    duration=time.time() - start_ts
                )

            # Tool Execution Scoping
            tool_name = tool_call.get("name", "")
            tool_args = tool_call.get("arguments", {})

            v, d = rays_ui._format_tool_verb(tool_name, tool_args)
            tool_display = f"{v} {d}"

            if tool_name not in allowed_tools:
                tool_output = f"Error: Tool '{tool_name}' is not permitted for role '{task.role}'. Allowed tools: {allowed_tools}"
            else:
                rays_ui.subagent_update(task.task_id, tool_display)
                rays_ui.orch_emit_subagent_progress(
                    task.task_id, task.role, tool_display
                )
                tool_output = self._dispatch_subagent_tool(tool_name, tool_args)

            action_record = {
                "turn": turn,
                "thought": thought,
                "tool": tool_name,
                "args": tool_args,
                "output": tool_output[:1000] if isinstance(tool_output, str) else str(tool_output)[:1000]
            }
            actions_taken.append(action_record)
            history.append(action_record)

        # Reached max turns without explicit finish
        final_summary = (
            f"Subagent completed step budget ({max_turns} turns).\n"
            f"Last findings: {actions_taken[-1]['output'][:500] if actions_taken else 'No actions'}"
        )
        rays_ui.subagent_done(task.task_id, final_summary, time.time() - start_ts)
        return SubagentResult(
            task_id=task.task_id,
            role=task.role,
            success=True,
            summary=final_summary,
            actions=actions_taken,
            duration=time.time() - start_ts
        )

    def _build_subagent_turn_prompt(
        self,
        task: SubagentTask,
        history: List[Dict[str, Any]],
        allowed_tools: List[str]
    ) -> str:
        """Construct isolated prompt with prior step results."""
        max_turns = task.max_turns or MAX_SUBAGENT_TURNS
        turn_num = len(history) + 1
        prompt_parts = [
            f"GOAL: {task.prompt}",
            f"BUDGET: Turn {turn_num} of {max_turns} maximum turns.",
        ]
        if task.context:
            prompt_parts.append(f"CONTEXT: {task.context}")

        prompt_parts.append(f"ALLOWED TOOLS: {', '.join(allowed_tools)}")

        if history:
            prompt_parts.append("\nPREVIOUS ACTIONS TAKEN IN THIS SUBAGENT SESSION:")
            for h in history:
                prompt_parts.append(
                    f"- Turn {h['turn']}: Called '{h['tool']}' with args {json.dumps(h['args'])}\n"
                    f"  Output preview:\n{h['output'][:400]}"
                )

        if turn_num >= max_turns:
            prompt_parts.append(
                "\nFINAL TURN NOTICE: This is your final turn. You must set 'action': 'finish' and provide a comprehensive 'summary' of your findings."
            )
        else:
            prompt_parts.append(
                "\nOnce you have sufficient information to answer the goal, set 'action': 'finish' and provide a thorough 'summary'."
            )

        prompt_parts.append(
            "\nYou must respond with valid JSON adhering to this exact schema:\n"
            "{\n"
            '  "thought": "Reasoning on current state and next step",\n'
            '  "action": "call_tool" | "finish",\n'
            '  "tool_call": {\n'
            '    "name": "<tool_name_from_allowed_tools>",\n'
            '    "arguments": { ... }\n'
            '  },\n'
            '  "summary": "Required if action is finish. Detailed summary of findings/changes."\n'
            "}"
        )
        return "\n".join(prompt_parts)

    def _dispatch_subagent_tool(self, name: str, args: Dict[str, Any]) -> str:
        """Route tool execution through skills orchestrator safely."""
        try:
            return self.skills._dispatch_tool({"name": name, "arguments": args})
        except Exception as e:
            return f"Tool execution failed: {e}"
