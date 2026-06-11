"""Structured execution transcripts passed between orchestrator sub-agents (no LLM summaries)."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

MAX_STORED_RESULT_CHARS = 12000


def cap_stored_text(text: Any, limit: int = MAX_STORED_RESULT_CHARS) -> str:
    s = text if isinstance(text, str) else json.dumps(text, indent=2, default=str)
    if len(s) <= limit:
        return s
    return s[: limit - 40] + "\n… [result truncated for context limit]"


def format_prior_executions(
    history: List[Dict[str, Any]],
    user_prompt: str,
) -> str:
    """Full, organized dump of prior sub-agent runs for the next sub-agent prompt."""
    if not history:
        return "(No prior sub-agent runs in this session yet.)"

    blocks: List[str] = []
    for idx, entry in enumerate(history, start=1):
        blocks.append(_format_entry(idx, entry, user_prompt))
    return "\n\n".join(blocks)


def _format_entry(index: int, entry: Dict[str, Any], user_prompt: str) -> str:
    etype = entry.get("type", "unknown")
    lines = [
        f"=== Prior sub-agent #{index} ({etype}) ===",
        f"Original user prompt: {user_prompt}",
    ]

    if etype == "skill":
        lines.append(f"Skill: {entry.get('skill', '?')}")
    elif etype == "mcp":
        lines.append(f"MCP server: {entry.get('server', '?')}")
        lines.append(f"Phase: {entry.get('phase', 'act')}")

    spawn = entry.get("spawn_reason") or entry.get("reason") or entry.get("intent")
    if spawn:
        lines.append(f"Why this sub-agent was spawned: {spawn}")

    intent = entry.get("intent")
    if intent and intent != spawn:
        lines.append(f"Intent: {intent}")

    status = entry.get("status", "unknown")
    lines.append(f"Exit status: {status}")
    if entry.get("exit_message"):
        lines.append(f"Sub-agent exit note: {entry.get('exit_message')}")

    actions = entry.get("actions")
    if isinstance(actions, list) and actions:
        lines.append("Tool calls (exact sequence):")
        for a in actions:
            lines.extend(_format_action(a))
    elif entry.get("summary"):
        # Legacy history entries from older runs
        lines.append(f"(Legacy summary only): {entry.get('summary')}")
    else:
        lines.append("(No tool calls recorded.)")

    return "\n".join(lines)


def _format_action(action: Dict[str, Any]) -> List[str]:
    turn = action.get("turn", action.get("task_id", "?"))
    tool = action.get("tool") or action.get("name")
    if not tool and isinstance(action.get("tool_call"), dict):
        tool = action["tool_call"].get("name")
    args = action.get("arguments")
    if args is None and isinstance(action.get("tool_call"), dict):
        args = action["tool_call"].get("arguments")
    result = action.get("result", "")
    thought = action.get("thought", "")

    out = [f"  --- Turn {turn} ---"]
    if thought:
        out.append(f"  Reasoning: {thought}")
    out.append(f"  Tool: {tool}")
    out.append(f"  Arguments: {json.dumps(args or {}, indent=2, default=str)}")
    out.append(f"  Result:\n{cap_stored_text(result)}")
    return out


def format_session_actions(actions: List[Dict[str, Any]]) -> str:
    if not actions:
        return "(No tool calls yet in this sub-agent session.)"
    parts: List[str] = []
    for a in actions:
        parts.append("\n".join(_format_action(a)))
    return "\n".join(parts)


def has_tool_actions(actions: Optional[List[Dict[str, Any]]]) -> bool:
    """True if the sub-agent session recorded at least one real tool invocation."""
    if not actions:
        return False
    return any(a.get("tool") for a in actions)


def programmatic_completion_failures(
    user_prompt: str,
    history: List[Dict[str, Any]],
) -> List[str]:
    """Hard checks before LLM completion validation. Returns human-readable failures."""
    failures: List[str] = []
    prompt_lower = user_prompt.lower()

    deliverable_skills: Dict[str, List[str]] = {
        "docx": [".docx", "docx", "word document", "word file"],
        "pptx": [".pptx", "pptx", "powerpoint", "presentation"],
    }

    for skill_name, keywords in deliverable_skills.items():
        if not any(k in prompt_lower for k in keywords):
            continue
        skill_runs = [
            e for e in history if e.get("type") == "skill" and e.get("skill") == skill_name
        ]
        if not skill_runs:
            failures.append(
                f"User asked for {skill_name} output but no '{skill_name}' skill sub-agent ran."
            )
            continue
        for run in skill_runs:
            if not has_tool_actions(run.get("actions")):
                failures.append(
                    f"Skill '{skill_name}' exited without calling any tools "
                    f"(status={run.get('status', '?')}). "
                    "File generation requires run_shell_command or write_file."
                )
            elif run.get("status") not in ("completed",):
                failures.append(
                    f"Skill '{skill_name}' did not complete successfully "
                    f"(status={run.get('status', '?')})."
                )

    for entry in history:
        if entry.get("type") != "skill":
            continue
        if entry.get("status") == "completed" and not has_tool_actions(entry.get("actions")):
            spawn = entry.get("spawn_reason") or entry.get("reason") or ""
            if any(
                w in spawn.lower()
                for w in ("generat", "creat", "write", "build", "produce", "export")
            ):
                failures.append(
                    f"Skill '{entry.get('skill', '?')}' marked completed with zero tool calls "
                    f"despite spawn reason: {spawn}"
                )

    return failures
