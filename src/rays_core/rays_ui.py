"""
RAYS UI — Centralized terminal UI module.

All animations, spinners, colored output, diff display, file trees,
command boxes, and themed printing live here.

Color palette (ANSI 256):
  99  — purple (borders, primary)
  213 — pink (accent/highlight)
  177 — lavender (secondary text)
  141 — light purple (tertiary)
  105 — mid purple (dim accent)
  120 — green (success)
  210 — red/coral (error, removed lines)
  228 — yellow (warning)
"""

import json
import sys
import os
import time
import shutil
import threading
import re
import textwrap
import difflib
import atexit
import signal
import select
from contextlib import contextmanager
from typing import Any, List, Optional, Dict, Tuple
from rich.console import Console
from rich.syntax import Syntax
from rich.panel import Panel
from rich.text import Text

try:
    import readline
except ImportError:
    readline = None

try:
    import tty
    import termios
except ImportError:
    tty = None
    termios = None

_console = Console(force_terminal=True)

# ─── ANSI Color Constants ────────────────────────────────────────────
RESET      = "\033[0m"
BOLD       = "\033[1m"
DIM        = "\033[2m"
ITALIC     = "\033[3m"

# RAYS palette (Vivid Shapes V4.2)
C_PURPLE   = "\033[38;5;129m" # Deep Violet
C_PINK     = "\033[38;5;213m" # Soft Pink
C_VIOLET   = "\033[38;5;165m" # Bright Violet
C_HOT_PINK = "\033[38;5;201m" # Vivid Pink (Hot Pink)
C_LAVENDER = "\033[38;5;177m"
C_LILAC    = "\033[38;5;141m"
C_MID      = "\033[38;5;105m"
C_GREEN    = "\033[38;5;120m"
C_RED      = "\033[38;5;201m" # Remapped to Hot Pink for "Forget Red"
C_YELLOW   = "\033[38;5;228m"
C_WHITE    = "\033[38;5;255m"

# Thought and Summary Palette — Elegant Soft Orchid Violet & Slate Lilac
C_NEON_BLUE = "\033[38;5;27m" # Navy Neon Blue
C_CREAM     = "\033[38;5;183m" # Soft Orchid Violet (Model Thoughts & Summaries)
C_DIM_CREAM = "\033[38;5;146m" # Muted Slate Lilac
DEVMODE = False

# Grey palette mapped to vibrant for compatibility
C_GRAY     = C_LAVENDER
C_DIM_GRAY = C_MID

# UI State Management
UI_MODE = "cool" # "cool" or "detail"
_ORCHESTRATION_ACTIVE = False
_ORCH_SESSION_START: float = 0.0
THOUGHT_PROCESS_BUFFER = []
_ACTIVE_SPINNER = None
PENDING_TOGGLE = False  # Signal-safe toggle flag

# ─── Background Task Tracking ────────────────────────────────────────
# Maps task_id → (description, start_time)
_BACKGROUND_TASKS: Dict[str, Tuple[str, float]] = {}
_BG_LOCK = threading.Lock()


def bg_task_start(task_id: str = None, description: str = "") -> str:
    """Register a background task for status bar tracking. Returns task_id."""
    if task_id is None:
        tid = f"bg_{int(time.time() * 1000) % 100000}"
        desc = description or "Background Task"
    elif not description:
        # Single argument passed: bg_task_start(description)
        desc = str(task_id)
        tid = f"bg_{int(time.time() * 1000) % 100000}"
    else:
        tid = str(task_id)
        desc = str(description)
    with _BG_LOCK:
        _BACKGROUND_TASKS[tid] = (desc, time.time())
    _pt_invalidate()
    return tid


def bg_task_done(task_id: str) -> None:
    """Remove a background task from tracking."""
    with _BG_LOCK:
        _BACKGROUND_TASKS.pop(task_id, None)
    _pt_invalidate()


def bg_task_count() -> int:
    """Return number of active background tasks."""
    with _BG_LOCK:
        return len(_BACKGROUND_TASKS)


def _pt_invalidate() -> None:
    """Thread-safe invalidation of the prompt_toolkit app, if running."""
    try:
        app = _get_pt_app()
        if app is not None:
            loop = getattr(app, 'loop', None)
            if loop is not None:
                loop.call_soon_threadsafe(app.invalidate)
            else:
                app.invalidate()
    except Exception:
        pass


# ─── Session-level state for status bar ──────────────────────────────
_SESSION_START_TIME: float = 0.0
_SESSION_MODEL: str = "rays"
_SESSION_CTX_USED: int = 0
_SESSION_CTX_LIMIT: int = 131072
_SESSION_AGENT_RUNNING: bool = False
_PT_APP_REF: Any = None   # weak reference to the active pt Application


def _get_pt_app():
    return _PT_APP_REF


def status_set_model(model: str) -> None:
    global _SESSION_MODEL
    _SESSION_MODEL = model


def status_add_tokens(n: int) -> None:
    global _SESSION_CTX_USED
    _SESSION_CTX_USED += n


def status_set_agent_running(running: bool) -> None:
    global _SESSION_AGENT_RUNNING
    _SESSION_AGENT_RUNNING = running
    _pt_invalidate()


# ─── Live Subagents State ──────────────────────────────────────────
_ACTIVE_SUBAGENTS: Dict[str, Dict[str, Any]] = {}
_SUBAGENT_LOCK = threading.Lock()

def subagent_start(task_id: str, role: str, prompt: str) -> None:
    """Register an active subagent starting execution."""
    with _SUBAGENT_LOCK:
        _ACTIVE_SUBAGENTS[task_id] = {
            "role": role,
            "prompt": prompt,
            "action": "Starting...",
            "start_time": time.time(),
            "status": "running"
        }
    _pt_invalidate()

def subagent_update(task_id: str, action: str) -> None:
    """Update current tool or task for a running subagent in-place."""
    with _SUBAGENT_LOCK:
        if task_id in _ACTIVE_SUBAGENTS:
            _ACTIVE_SUBAGENTS[task_id]["action"] = action
    _pt_invalidate()

def subagent_done(task_id: str, summary: str = "", duration: float = 0.0) -> None:
    """Mark subagent as completed."""
    with _SUBAGENT_LOCK:
        _ACTIVE_SUBAGENTS.pop(task_id, None)
    _pt_invalidate()

def active_subagent_count() -> int:
    with _SUBAGENT_LOCK:
        return len(_ACTIVE_SUBAGENTS)

def get_active_subagents() -> List[Tuple[str, Dict[str, Any]]]:
    with _SUBAGENT_LOCK:
        return list(_ACTIVE_SUBAGENTS.items())


def _build_status_bar_ansi_string(
    phase: str = "",
    detail: str = "",
    tokens: int = 0,
    s1: str = "▲",
    s2: str = "⬟",
    c1: str = C_HOT_PINK,
    c2: str = C_PURPLE,
) -> str:
    """Build full ANSI status bar string matching prompt_toolkit bottom toolbar."""
    ctx_used = _SESSION_CTX_USED
    ctx_limit = _SESSION_CTX_LIMIT
    
    if ctx_used >= 1000000:
        ctx_used_str = f"{ctx_used/1000000:.1f}M"
    elif ctx_used >= 1000:
        ctx_used_str = f"{ctx_used/1000:.1f}K"
    else:
        ctx_used_str = str(ctx_used)
        
    if ctx_limit >= 1000000:
        ctx_limit_str = f"{ctx_limit/1000000:.1f}M"
    elif ctx_limit >= 1000:
        ctx_limit_str = f"{ctx_limit/1000:.1f}K"
    else:
        ctx_limit_str = str(ctx_limit)
        
    pct = int(100 * ctx_used / max(ctx_limit, 1)) if ctx_limit > 0 else 0
    pct = min(100, max(0, pct))
    
    w = 8
    filled = int(w * pct / 100)
    bar = "=" * filled + " " * (w - filled)
    
    elapsed = time.time() - _SESSION_START_TIME if _SESSION_START_TIME > 0 else 0
    if elapsed < 60:
        time_str = f"{int(elapsed)}s"
    else:
        m = int(elapsed // 60)
        s = int(elapsed % 60)
        time_str = f"{m}m" if s == 0 else f"{m}m {s}s"
        
    bg_tasks = len(_BACKGROUND_TASKS)
    bg_str = f" | {C_YELLOW}⊙ {bg_tasks}{RESET}" if bg_tasks > 0 else ""
    
    with _SUBAGENT_LOCK:
        sub_cnt = len(_ACTIVE_SUBAGENTS)
    sub_str = f" | {C_LILAC}❖ {sub_cnt} subagent{'s' if sub_cnt != 1 else ''}{RESET}" if sub_cnt > 0 else ""
    
    model_display = _SESSION_MODEL or "rays"
    
    spinner = f"{c1}{s1}{RESET}{c2}{s2}{RESET} " if s1 and s2 else ""
    left = f" {spinner}{BOLD}{C_PINK}${RESET} {C_WHITE}{model_display}{RESET} | {C_LAVENDER}{ctx_used_str}/{ctx_limit_str}{RESET} | [{C_MID}{bar}{RESET}] {pct}% | {C_LILAC}{time_str}{RESET}{bg_str}{sub_str}"
    
    # Right side: phase / detail / tokens
    right_parts = []
    if phase:
        right_parts.append(f"{C_PINK}{phase}{RESET}")
    if detail:
        right_parts.append(f"{C_GRAY}· {truncate_for_display(detail, 32)}{RESET}")
    if tokens > 0:
        right_parts.append(f"{C_DIM_GRAY}tokens {tokens:,}{RESET}")
    elif _SESSION_AGENT_RUNNING:
        right_parts.append(f"{C_DIM_GRAY}msg=interrupt · ^C cancel{RESET}")
    
    right_str = (" | " + " ".join(right_parts)) if right_parts else ""
    full_bar = f"{left}{right_str}"
    
    term_w = _term_width()
    max_allowed = max(30, term_w - 6)
    if _vis_len(full_bar) > max_allowed:
        if right_parts and detail:
            right_parts = []
            if phase:
                right_parts.append(f"{C_PINK}{phase}{RESET}")
            right_parts.append(f"{C_GRAY}· {truncate_for_display(detail, 16)}{RESET}")
            if tokens > 0:
                right_parts.append(f"{C_DIM_GRAY}tokens {tokens:,}{RESET}")
            right_str = (" | " + " ".join(right_parts)) if right_parts else ""
            full_bar = f"{left}{right_str}"
    
    return full_bar


class OrchestrationHUD:
    """Persistent bottom status bar with rotating shapes and live telemetry."""

    def __init__(self) -> None:
        self.active = False
        self.phase = "RAYS"
        self.detail = ""
        self.tokens = 0
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._shape_idx = 0
        self._color_idx = 0
        self._rule_drawn = False
        self._lock = threading.Lock()
        self._pause_print = False

    def start(self) -> None:
        self.active = True
        self._stop.clear()
        if not self._rule_drawn:
            inner = max(20, _term_width() - 4)
            sys.stdout.write(f"\n  {C_MID}{'─' * inner}{RESET}\n")
            sys.stdout.flush()
            self._rule_drawn = True
        if self._thread is None or not self._thread.is_alive():
            self._thread = threading.Thread(target=self._animate, daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self.active = False
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=1.0)
        sys.stdout.write(f"\r\033[2K")
        sys.stdout.write(f"{_build_status_bar_ansi_string(phase='Done', detail='', tokens=self.tokens, s1='', s2='')}\n")
        sys.stdout.flush()
        self._rule_drawn = False

    def set_status(self, phase: str, detail: str = "") -> None:
        self.phase = phase
        self.detail = (detail or "").strip()[:56]

    def add_tokens(self, count: int) -> None:
        if count > 0:
            self.tokens += int(count)

    def print_below(self, text: str) -> None:
        """Print a persistent line above the HUD status bar without losing animation."""
        if not self.active:
            sys.stdout.write(text if text.endswith("\n") else text + "\n")
            sys.stdout.flush()
            return
        with self._lock:
            self._pause_print = True
            time.sleep(0.02)
            sys.stdout.write(f"\r\033[2K")
            sys.stdout.write(text if text.endswith("\n") else text + "\n")
            # Immediately restore status line at the bottom
            status_line = _build_status_bar_ansi_string(
                phase=self.phase,
                detail=self.detail,
                tokens=self.tokens,
                s1="▲",
                s2="⬟"
            )
            sys.stdout.write(f"\r\033[2K{status_line}")
            sys.stdout.flush()
            self._pause_print = False

    def _animate(self) -> None:
        try:
            while not self._stop.is_set():
                if self._pause_print:
                    time.sleep(0.03)
                    continue
                process_pending_ui_events()
                s1 = SHAPE_SEQUENCE[self._shape_idx % len(SHAPE_SEQUENCE)]
                s2 = SHAPE_SEQUENCE[(self._shape_idx + 3) % len(SHAPE_SEQUENCE)]
                c1 = THEME_COLORS[self._color_idx % len(THEME_COLORS)]
                c2 = THEME_COLORS[(self._color_idx + 2) % len(THEME_COLORS)]
                
                status_line = _build_status_bar_ansi_string(
                    phase=self.phase,
                    detail=self.detail,
                    tokens=self.tokens,
                    s1=s1,
                    s2=s2,
                    c1=c1,
                    c2=c2
                )
                
                with self._lock:
                    if not self._pause_print:
                        sys.stdout.write(f"\r\033[2K{status_line}")
                        sys.stdout.flush()
                self._shape_idx += 1
                if self._shape_idx % len(SHAPE_SEQUENCE) == 0:
                    self._color_idx += 1
                time.sleep(0.12)
        finally:
            pass


class OrchestrationTranscript:
    """Buffered full transcript for Ctrl+T detail view."""

    def __init__(self) -> None:
        self.lines: List[str] = []

    def clear(self) -> None:
        self.lines.clear()

    def add(self, line: str) -> None:
        self.lines.append(re.sub(r"\033\[[0-9;]*m", "", line).strip())

    def render(self) -> None:
        if not self.lines:
            return
        inner = max(40, _term_width() - 8)
        bar = "/" * max(8, (inner - 12) // 2)
        header = f"  {C_MID}{bar}{RESET} {C_LILAC}{BOLD}TRANSCRIPT{RESET} {C_MID}{bar}{RESET}"
        _orch_persistent_print(f"\n{header}\n")
        for line in self.lines:
            wrapped = textwrap.wrap(line, width=inner) or [line]
            for w in wrapped:
                _orch_persistent_print(f"  {C_DIM_GRAY}{w}{RESET}\n")
        _orch_persistent_print(
            f"\n  {C_DIM_GRAY}ctrl+t transcript · ctrl+u detail toggle{RESET}\n\n"
        )


_HUD = OrchestrationHUD()
_ORCH_TRANSCRIPT = OrchestrationTranscript()


def _orch_persistent_print(text: str) -> None:
    if _HUD.active:
        _HUD.print_below(text)
    else:
        sys.stdout.write(text)
        sys.stdout.flush()


def _orch_transcript_note(text: str) -> None:
    _ORCH_TRANSCRIPT.add(text)


def orch_emit_validation(is_complete: bool, reasoning: str) -> None:
    if is_complete:
        orch_emit_action("Validated", "task complete", ok=True)
    else:
        orch_emit_section("Needs follow-up")
    if reasoning:
        for w in textwrap.wrap(reasoning.strip(), width=max(40, _term_width() - 10)):
            _orch_persistent_print(f"    {C_DIM_GRAY}{w}{RESET}\n")
        _orch_transcript_note(f"validation: {reasoning.strip()}")


def orch_begin_session(user_prompt: str) -> None:
    """Codex-style session opener under the HUD rule."""
    prefix = get_shape_prefix()
    _orch_persistent_print(f"\n  {prefix} {BOLD}{C_WHITE}Request{RESET}\n")
    for w in textwrap.wrap(user_prompt.strip(), width=max(40, _term_width() - 8)):
        _orch_persistent_print(f"    {C_CREAM}{w}{RESET}\n")
    _orch_transcript_note(f"user: {user_prompt.strip()}")


def orch_emit_section(title: str) -> None:
    prefix = get_shape_prefix()
    line = f"  {prefix} {BOLD}{C_WHITE}{title}{RESET}\n"
    _orch_persistent_print(line)
    _orch_transcript_note(title)


def orch_emit_thinking(thought: str) -> None:
    if not thought or not thought.strip():
        return
    wrapped = textwrap.wrap(thought.strip(), width=max(40, _term_width() - 8))
    _orch_persistent_print(f"  {C_LILAC}✦{RESET} {BOLD}{C_LAVENDER}Thought{RESET}\n")
    for w in wrapped:
        _orch_persistent_print(f"    {C_CREAM}{w}{RESET}\n")
    _orch_persistent_print("\n")
    _orch_transcript_note(f"thinking: {thought.strip()}")


def orch_emit_action(verb: str, detail: str, *, ok: bool = True) -> None:
    """Codex-style bullet: • Ran git status, • blender/get_scene_info"""
    mark = f"{C_GREEN}•{RESET}" if ok else f"{C_HOT_PINK}•{RESET}"
    verb_part = f"{BOLD}{verb}{RESET}" if verb else ""
    detail_part = f" {C_WHITE}{detail}{RESET}" if detail else ""
    line = f"  {mark} {verb_part}{detail_part}\n"
    _orch_persistent_print(line)
    _orch_transcript_note(f"{verb} {detail}".strip())


def orch_emit_plan(summary: str, plan: List[Dict[str, Any]]) -> None:
    orch_emit_section("Plan")
    if summary:
        for w in textwrap.wrap(summary.strip(), width=max(40, _term_width() - 8)):
            _orch_persistent_print(f"    {C_CREAM}{w}{RESET}\n")
        _orch_transcript_note(summary.strip())
    for i, step in enumerate(plan, start=1):
        stype = step.get("type") or ("skill" if step.get("skill") else "mcp")
        if stype == "skill":
            label = step.get("skill", "?")
            phase = ""
        else:
            label = step.get("server", "?")
            phase = f" [{step.get('phase', 'act')}]"
        reason = (
            step.get("spawn_reason")
            or step.get("reason")
            or step.get("intent")
            or ""
        )
        _orch_persistent_print(
            f"    {C_GRAY}{i}.{RESET} {C_LAVENDER}{label}{phase}{RESET}"
            f"{f' — {C_DIM_GRAY}{truncate_for_display(reason, 72)}{RESET}' if reason else ''}\n"
        )
        _orch_transcript_note(f"{i}. {label}{phase} {reason}")

def orch_emit_task_status(status: str, task_name: str) -> None:
    """
    Print a Kanban-style task status update to the terminal.
    Statuses: 'todo' (◻), 'running' (▶), 'blocked' (⊘), 'done' (✓)
    """
    if status == 'done':
        mark = f"{C_GREEN}✓{RESET}"
        status_text = f"{C_GREEN}Goal done:{RESET}"
    elif status == 'running':
        mark = f"{C_YELLOW}▶{RESET}"
        status_text = f"{C_YELLOW}Running:{RESET}"
    elif status == 'blocked':
        mark = f"{C_RED}⊘{RESET}"
        status_text = f"{C_RED}Blocked:{RESET}"
    else:
        mark = f"{C_GRAY}◻{RESET}"
        status_text = f"{C_GRAY}Queued:{RESET}"
        
    line = f"  {mark} {status_text} {C_WHITE}{task_name}{RESET}\n"
    _orch_persistent_print(line)
    _orch_transcript_note(f"[{status.upper()}] {task_name}")


def orch_emit_capabilities(skills: List[str], mcp_servers: List[str], reasoning: str = "") -> None:
    parts = []
    if skills:
        parts.append(f"skills: {', '.join(skills)}")
    if mcp_servers:
        parts.append(f"MCP: {', '.join(mcp_servers)}")
    if parts:
        orch_emit_action("Using", " · ".join(parts))
    if reasoning:
        orch_emit_thinking(reasoning)


def orch_emit_step_header(label: str, spawn_reason: str = "") -> None:
    orch_emit_section(label)
    if spawn_reason:
        orch_emit_thinking(spawn_reason)


def orch_emit_progress(message: str) -> None:
    """Print an intermediate progress milestone / summary from the agent."""
    if not message or not message.strip():
        return
    prefix = get_shape_prefix()
    _orch_persistent_print(f"\n  {prefix} {BOLD}{C_PINK}Progress Update{RESET}\n")
    for w in textwrap.wrap(message.strip(), width=max(40, _term_width() - 8)):
        _orch_persistent_print(f"    {C_CREAM}{w}{RESET}\n")
    _orch_persistent_print("\n")
    _orch_transcript_note(f"progress: {message.strip()}")


def orch_emit_subagent_start(count: int, descriptions: List[str]) -> None:
    """Print header when subagents are spawned."""
    prefix = get_shape_prefix()
    _orch_persistent_print(f"\n  {prefix} {BOLD}{C_PINK}Sub-Agent Delegation ({count} workers){RESET}\n")
    for desc in descriptions:
        _orch_persistent_print(f"    {C_LAVENDER}•{RESET} {C_WHITE}{desc}{RESET}\n")
    _orch_persistent_print("\n")


def orch_emit_subagent_progress(sub_id: str, role: str, status: str) -> None:
    """Update live HUD with subagent activity."""
    subagent_update(sub_id, status)
    hud_set_status(f"subagent:{role}", f"[{sub_id}] {status}")


def orch_emit_subagent_done(sub_id: str, role: str, summary: str, duration: float, prompt: str = "") -> None:
    """Print completed subagent card in terminal matching reference layout."""
    subagent_done(sub_id, summary, duration)
    dur_str = f"{duration:.1f}s"
    prompt_snip = f"({truncate_for_display(prompt, 50)})" if prompt else ""
    _orch_persistent_print(f"  {C_GREEN}•{RESET} {BOLD}{C_YELLOW}Agent({role}: {sub_id}){RESET}{C_LAVENDER}{prompt_snip}{RESET} {C_MID}({dur_str}){RESET}\n")
    if summary:
        lines = [l.rstrip() for l in summary.strip().split("\n") if l.strip()]
        for line in lines[:8]:
            _orch_persistent_print(f"    {C_CREAM}{truncate_for_display(line, max(40, _term_width() - 8))}{RESET}\n")
        if len(lines) > 8:
            _orch_persistent_print(f"    {C_DIM_GRAY}… +{len(lines) - 8} more lines{RESET}\n")
    _orch_persistent_print("\n")


def _format_tool_verb(tool: str, arguments: Any) -> Tuple[str, str]:
    args = arguments if isinstance(arguments, dict) else {}
    if tool in ("delegate_subagent", "delegate_task", "invoke_subagent"):
        tasks = args.get("tasks") or args.get("chain") or []
        cnt = len(tasks) if isinstance(tasks, list) else 1
        r = args.get("role") or (tasks[0].get("role") if tasks and isinstance(tasks[0], dict) else "subagent")
        return "Delegated", f"to {cnt} {r} subagent{'s' if cnt != 1 else ''}"
    if tool in ("web_search", "search_web"):
        q = args.get("query") or args.get("search_query") or args.get("q") or ""
        return "Searched web", f"`{truncate_for_display(q, 60)}`"
    if tool in ("web_fetch", "fetch_url", "web_extract"):
        u = args.get("url") or args.get("link") or ""
        return "Fetched", f"`{truncate_for_display(u, 60)}`"
    if tool == "list_directory":
        return "Listed", f"`{args.get('path', '.')}`"
    if tool == "read_file":
        p = args.get('path', '?')
        sl, el = args.get('start_line'), args.get('end_line')
        range_str = f" (L{sl}-L{el})" if sl and el else ""
        return "Read", f"`{p}`{range_str}"
    if tool == "write_file":
        return "Wrote", f"`{args.get('path', '?')}`"
    if tool == "patch_file":
        return "Edited", f"`{args.get('path', '?')}`"
    if tool == "run_shell_command":
        cmd = str(args.get("command", "")).strip()
        bg = " (bg)" if args.get("is_background") or args.get("background") else ""
        return "Ran", f"`{truncate_for_display(cmd, 64)}`{bg}"
    if tool == "check_process":
        tid = args.get("task_id") or args.get("pid") or "all"
        return "Checked", f"process `{tid}`"
    if tool == "wait_process":
        tid = args.get("task_id") or args.get("pid") or "process"
        sec = args.get("timeout", 30)
        return "Waited", f"for `{tid}` ({sec}s)"
    if tool in ("sleep", "wait"):
        sec = args.get("seconds", 5)
        return "Waited", f"{sec}s"
    if tool == "kill_process":
        tid = args.get("task_id") or args.get("pid") or "?"
        return "Killed", f"process `{tid}`"
    if tool == "list_processes":
        return "Listed", "background processes"
    if tool == "report_progress":
        msg = str(args.get("message", "")).strip()
        return "Progress", f"{truncate_for_display(msg, 64)}"
    return "Called", tool or "?"


def orch_emit_tool_result(
    tool: str,
    arguments: Any,
    result: str,
    *,
    server: str = "",
) -> None:
    ok = not str(result).lower().startswith("error")
    if server:
        verb, detail = "Called", f"{server}/{tool}"
    else:
        verb, detail = _format_tool_verb(tool, arguments)
    orch_emit_action(verb, detail, ok=ok)
    preview = truncate_for_display(result, 220 if UI_MODE == "detail" else 72)
    if preview:
        indent = "      "
        if UI_MODE == "detail":
            for w in textwrap.wrap(preview, width=max(36, _term_width() - 12)):
                _orch_persistent_print(f"{indent}{C_DIM_GRAY}{w}{RESET}\n")
        else:
            _orch_persistent_print(f"{indent}{C_DIM_GRAY}→ {preview}{RESET}\n")
    _orch_transcript_note(f"{verb} {detail} -> {preview}")


def _format_crunched_elapsed(seconds: float) -> str:
    total = max(0, int(round(seconds)))
    if total < 60:
        return f"Crunched for {total}s"
    minutes, secs = divmod(total, 60)
    if minutes < 60:
        return f"Crunched for {minutes}m {secs}s" if secs else f"Crunched for {minutes}m"
    hours, minutes = divmod(minutes, 60)
    return f"Crunched for {hours}h {minutes}m"


def _box_line(inner: int, content: str, *, color: str = "") -> None:
    """Write one line inside the Session Summary box."""
    pad = max(0, inner - _vis_len(content))
    sys.stdout.write(
        f"  {C_VIOLET}│{RESET}{color}{content}{' ' * pad}{C_VIOLET}│{RESET}\n"
    )


def orch_render_final_summary(result: Dict[str, Any]) -> None:
    """Boxed session summary: step updates plus optional prose wrap-up."""
    history = result.get("history") or []
    complete = result.get("complete", False)
    plan_summary = result.get("summary") or ""
    narrative = (result.get("narrative_summary") or "").strip()

    updates: List[str] = []
    for entry in history:
        etype = entry.get("type")
        actions = entry.get("actions") or []
        exit_msg = (entry.get("exit_message") or "").strip()
        if etype == "skill":
            name = entry.get("skill", "skill")
            for a in actions:
                tool = a.get("tool")
                if not tool:
                    continue
                v, d = _format_tool_verb(tool, a.get("arguments"))
                updates.append(f"{name}: {v} {d}")
            if exit_msg and entry.get("status") == "completed":
                updates.append(f"{name}: {truncate_for_display(exit_msg, 120)}")
        elif etype == "mcp":
            server = entry.get("server", "mcp")
            phase = entry.get("phase", "act")
            for a in actions:
                tool = a.get("tool")
                if not tool:
                    continue
                res = truncate_for_display(str(a.get("result", "")), 80)
                ok = not res.lower().startswith("error")
                mark = "✓" if ok else "✗"
                updates.append(f"{mark} {server}/{tool} ({phase}) — {res}")
            if exit_msg and entry.get("status") == "completed":
                updates.append(f"{server}: {truncate_for_display(exit_msg, 120)}")

    if not updates and plan_summary:
        updates.append(truncate_for_display(plan_summary, 200))

    inner = max(20, _safe_inner_width(margin=8, minimum=20))
    status = f"{C_GREEN}complete{RESET}" if complete else f"{C_YELLOW}may need follow-up{RESET}"
    title = f" {BOLD}Session Summary {RESET}{C_VIOLET}"
    dashes = max(0, inner - _vis_len(title) - 1)
    sys.stdout.write(f"\n  {C_VIOLET}╭─{RESET}{C_VIOLET}{title}{'─' * dashes}╮{RESET}\n")
    _box_line(inner, f"  {C_LAVENDER}Status:{RESET} {status}")

    if updates:
        _box_line(inner, "")
        _box_line(inner, f"  {C_LILAC}{BOLD}> Updates{RESET}")
        for item in updates[:12]:
            for w in textwrap.wrap(item, width=inner - 6):
                _box_line(inner, f"  • {w}", color=C_CREAM)
        if len(updates) > 12:
            _box_line(inner, f"  … +{len(updates) - 12} more", color=C_DIM_GRAY)

    if narrative:
        _box_line(inner, "")
        _box_line(inner, f"  {C_LILAC}{BOLD}> Summary{RESET}")
        for para in re.split(r"\n\s*\n", narrative):
            para = para.strip()
            if not para:
                continue
            for w in textwrap.wrap(para, width=inner - 6):
                _box_line(inner, f"  {w}", color=C_CREAM)

    validation = (result.get("validation_reasoning") or "").strip()
    if validation and not complete:
        _box_line(inner, "")
        _box_line(inner, f"  {C_YELLOW}{BOLD}Note{RESET}")
        for w in textwrap.wrap(validation, width=inner - 6):
            _box_line(inner, f"  {w}", color=C_DIM_GRAY)

    sys.stdout.write(f"  {C_VIOLET}╰{'─' * inner}╯{RESET}\n")

    elapsed = time.time() - _ORCH_SESSION_START if _ORCH_SESSION_START else 0.0
    if elapsed > 0:
        sys.stdout.write(f"  {C_DIM_GRAY}{_format_crunched_elapsed(elapsed)}{RESET}\n")
    sys.stdout.write("\n")
    sys.stdout.flush()


def show_orchestration_transcript() -> None:
    if _ORCHESTRATION_ACTIVE:
        _HUD.print_below("")
    _ORCH_TRANSCRIPT.render()


def hud_set_status(phase: str, detail: str = "") -> None:
    if _HUD.active:
        _HUD.set_status(phase, detail)


def hud_add_tokens(count: int) -> None:
    if _HUD.active and count > 0:
        _HUD.add_tokens(count)


def orchestration_hud_active() -> bool:
    return _ORCHESTRATION_ACTIVE


def hud_note_ok(message: str) -> None:
    """One-line outcome after HUD stops (no walls of text)."""
    prefix = get_shape_prefix()
    sys.stdout.write(f"  {prefix} {C_GREEN}{message}{RESET}\n")
    sys.stdout.flush()


def hud_note_warn(message: str) -> None:
    prefix = get_shape_prefix()
    sys.stdout.write(f"  {prefix} {C_YELLOW}{message}{RESET}\n")
    sys.stdout.flush()

def toggle_ui_mode(signum=None, frame=None):
    """Toggle between cool and detail UI modes — signal-safe version."""
    global PENDING_TOGGLE
    PENDING_TOGGLE = True


def _toggle_ui_mode_now() -> None:
    global UI_MODE
    UI_MODE = "detail" if UI_MODE == "cool" else "cool"
    hint = "detail" if UI_MODE == "detail" else "compact"
    _orch_persistent_print(f"    {C_DIM_GRAY}view: {hint}{RESET}\n")


def process_pending_ui_events() -> None:
    """Handle Ctrl+T (SIGINFO) and other deferred UI toggles during orchestration."""
    global PENDING_TOGGLE
    if not PENDING_TOGGLE:
        return
    PENDING_TOGGLE = False
    if _ORCHESTRATION_ACTIVE:
        show_orchestration_transcript()
    else:
        _toggle_ui_mode_now()
        flush_thought_process()

# Catch SIGINFO (Ctrl+T) or SIGQUIT (Ctrl+\) on Mac/Linux
_SIGINFO = getattr(signal, "SIGINFO", None)
if _SIGINFO is not None:
    signal.signal(_SIGINFO, toggle_ui_mode)

# SIGQUIT is Ctrl+\ and is very reliable (where available).
_SIGQUIT = getattr(signal, "SIGQUIT", None)
if _SIGQUIT is not None:
    signal.signal(_SIGQUIT, toggle_ui_mode)

def flush_thought_process():
    """Print buffered thought processes with pretty formatting — no raw JSON or prompts."""
    global THOUGHT_PROCESS_BUFFER
    if not THOUGHT_PROCESS_BUFFER:
        return

    sys.stderr.write(f"\n  {C_LILAC}✧{RESET} {C_PINK}Revealing Thought Process...{RESET}\n")
    sys.stderr.flush()

    import json as _json

    for msg in THOUGHT_PROCESS_BUFFER:
        # Strip ANSI codes for content analysis
        clean = re.sub(r'\033\[[0-9;]*m', '', msg).strip()

        # Skip raw prompts sent TO the model (MODEL REQUEST lines with long prompts)
        if 'MODEL REQUEST:' in clean and len(clean) > 200:
            # Extract just the action summary, not the full prompt
            action_part = clean.split(':', 1)[1].strip()[:120]
            sys.stdout.write(f"  {C_LILAC}✦{RESET} {C_CREAM}Prompted model: {action_part}...{RESET}\n")
            continue

        # Try to parse MODEL RESPONSE JSON into human-readable output
        if 'MODEL RESPONSE:' in clean:
            json_part = clean.split('MODEL RESPONSE:', 1)[1].strip()
            try:
                parsed = _json.loads(json_part)
                # Extract readable fields
                if isinstance(parsed, dict):
                    # analysis_summary or batch_summary
                    summary = parsed.get('analysis_summary') or parsed.get('batch_summary') or parsed.get('verification_summary')
                    if summary:
                        sys.stdout.write(f"  {C_LILAC}✦{RESET} {C_CREAM}Analysis: {summary}{RESET}\n")

                    # affected_symbols or verified_symbols
                    symbols = parsed.get('affected_symbols') or parsed.get('verified_symbols') or []
                    for sym in symbols[:5]:  # Show max 5
                        name = sym.get('symbol_name', '?')
                        reason = sym.get('reason', 'identified')
                        sys.stdout.write(f"  {C_LILAC}  →{RESET} {C_PINK}{name}{RESET}: {C_CREAM}{reason[:100]}{RESET}\n")
                    if len(symbols) > 5:
                        sys.stdout.write(f"  {C_DIM_CREAM}  ... and {len(symbols) - 5} more{RESET}\n")
                    continue
            except (_json.JSONDecodeError, ValueError):
                pass
            # If JSON parse failed, show truncated
            sys.stdout.write(f"  {C_LILAC}✦{RESET} {C_CREAM}Model response: {json_part[:120]}...{RESET}\n")
            continue

        # For all other messages (status, scan, verification), print as-is
        if msg.startswith("\033") or "|" in msg:
            sys.stdout.write(msg)
        else:
            sys.stdout.write(f"  {msg}\n")

    sys.stdout.write("\n")
    sys.stdout.flush()
    THOUGHT_PROCESS_BUFFER = []

@contextmanager
def orchestration_hud():
    """Compact agent/MCP UI: one animated status line, tokens on the right."""
    global _ORCHESTRATION_ACTIVE, THOUGHT_PROCESS_BUFFER, _ORCH_SESSION_START
    _ORCHESTRATION_ACTIVE = True
    _ORCH_SESSION_START = time.time()
    _ORCH_TRANSCRIPT.clear()
    _HUD.start()
    _orch_persistent_print(
        f"  {C_DIM_GRAY}^T transcript · ^U detail toggle{RESET}\n"
    )
    try:
        yield _HUD
    finally:
        _HUD.stop()
        _ORCHESTRATION_ACTIVE = False
        THOUGHT_PROCESS_BUFFER.clear()


@contextmanager
def orchestration_live_output():
    """Deprecated alias — use orchestration_hud()."""
    with orchestration_hud():
        yield


def log_model_interaction(action: str, details: str):
    """Log model reading/writing actions in a beautiful creamish style."""
    if _ORCHESTRATION_ACTIVE:
        label = action.replace("Model ", "").strip()
        short = re.sub(r"\s+", " ", details).strip()[:48]
        hud_set_status(label or "Thinking", short)
        return

    icon = "⚙" if "read" in action.lower() else "✦"
    msg = f"  {C_DIM_CREAM}{icon} {action.upper()}:{RESET} {C_CREAM}{details}{RESET}\n"
    
    if UI_MODE == "cool" and not _ORCHESTRATION_ACTIVE:
        # Buffer and update sub-message, but NEVER print to stdout directly.
        THOUGHT_PROCESS_BUFFER.append(msg)
        if _ACTIVE_SPINNER:
            clean_msg = re.sub(r'\033\[[0-9;]*m', '', details).strip()
            clean_msg = re.sub(r'^[▲■⬟⬢⎔● ⚙✦]+', '', clean_msg)
            if clean_msg:
                _ACTIVE_SPINNER.set_sub_message(clean_msg[:50] + "..." if len(clean_msg) > 50 else clean_msg)
        return
        
    # In detail mode, print instantly
    sys.stdout.write("\r" + " " * 120 + "\r")
    sys.stdout.write(msg)
    sys.stdout.flush()

def capture_print(message: str, *, force: bool = False):
    """Capture or print based on UI_MODE. force=True always prints immediately."""
    if _ORCHESTRATION_ACTIVE and not force:
        return
    if (
        not force
        and not _ORCHESTRATION_ACTIVE
        and _ACTIVE_SPINNER
        and UI_MODE == "cool"
    ):
        # Buffer it for later
        THOUGHT_PROCESS_BUFFER.append(message)
        # Update spinner sub-message with a sanitized snippet
        clean_msg = re.sub(r'\033\[[0-9;]*m', '', message).strip()
        # Remove indentation bullets if they exist
        clean_msg = re.sub(r'^[▲■⬟⬢⎔● ⚙✦]+', '', clean_msg)
        if clean_msg:
            _ACTIVE_SPINNER.set_sub_message(clean_msg[:50] + "..." if len(clean_msg) > 50 else clean_msg)
    else:
        # Clear the current animation line before printing
        sys.stdout.write("\r" + " " * 120 + "\r")
        sys.stdout.write(message)
        sys.stdout.flush()

# Shape Engine (Vivid Shapes)
SHAPES = ["◆", "▲", "■", "▼", "⧫", "⬟", "⬢", "✦", "❖"]
_shape_idx = 0

def get_shape_prefix() -> str:
    """Return a color-cycling shape prefix."""
    global _shape_idx
    shape = SHAPE_SEQUENCE[_shape_idx % len(SHAPE_SEQUENCE)]
    color = THEME_COLORS[_shape_idx % len(THEME_COLORS)]
    _shape_idx += 1
    return f"{color}{shape}{RESET}"

# Vivid Shapes aliases
C_PINK   = C_HOT_PINK
C_VIOLET = C_PURPLE

BOLD  = "\033[1m"
RESET = "\033[0m"
DIM        = "\033[2m" # Kept from original, not in diff but good to have
ITALIC     = "\033[3m" # Kept from original, not in diff but good to have

# Shape and Animation Sequences (V7.0)
SHAPE_SEQUENCE = ["▲", "■", "⬟", "⬢", "⎔", "●", "⎔", "⬢", "⬟", "■"]
THEME_COLORS = [C_HOT_PINK, C_PURPLE, C_LAVENDER, C_LILAC, C_MID, C_VIOLET, C_PINK]

# Braille spinner frames (kept from original, not in diff but good to have)
SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

# ─── Terminal width helper ────────────────────────────────────────────
def _term_width() -> int:
    try:
        return shutil.get_terminal_size().columns
    except:
        return 80

def _safe_inner_width(margin: int = 8, minimum: int = 20) -> int:
    """
    Return a conservative inner frame width that stays inside the terminal.
    We keep extra margin to avoid edge wrapping artifacts.
    """
    return max(minimum, _term_width() - margin)

def _vis_len(text: str) -> int:
    """Calculate the visible length of a string, ignoring ANSI escape codes."""
    import re
    return len(re.sub(r'\033\[[0-9;]*m', '', text))

def _center(text: str, width: int = 0) -> str:
    """Center a single line of text (ignoring ANSI codes for width calc)."""
    import re
    w = width or _term_width()
    visible_len = len(re.sub(r'\033\[[0-9;]*m', '', text))
    pad = max(0, (w - visible_len) // 2)
    return " " * pad + text


# ═══════════════════════════════════════════════════════════════════════
#                             BANNER
# ═══════════════════════════════════════════════════════════════════════

def display_banner(skills: List[str] = None, mcp_servers: List[str] = None, model: str = "", cwd: str = ""):
    """Display the RAYS banner with signature Vivid Shapes purple/pink/lavender theme and 2-column layout."""
    inner = max(78, _safe_inner_width(margin=4, minimum=78))
    
    # Exact RAYS signature logo lines with pink/lavender/lilac/mid color mapping
    logo_lines = [
        f"{C_PINK}██████╗   {C_LAVENDER}█████╗  {C_LILAC}██╗   ██╗ {C_MID}███████╗{RESET}",
        f"{C_PINK}██╔══██╗ {C_LAVENDER}██╔══██╗ {C_LILAC}╚██╗ ██╔╝ {C_MID}██╔════╝{RESET}",
        f"{C_PINK}██████╔╝ {C_LAVENDER}███████║  {C_LILAC}╚████╔╝  {C_MID}███████╗{RESET}",
        f"{C_PINK}██╔══██╗ {C_LAVENDER}██╔══██║   {C_LILAC}╚██╔╝   {C_MID}╚════██║{RESET}",
        f"{C_PINK}██║  ██║ {C_LAVENDER}██║  ██║    {C_LILAC}██║    {C_MID}███████║{RESET}",
        f"{C_PINK}╚═╝  ╚═╝ {C_LAVENDER}╚═╝  ╚═╝    {C_LILAC}╚═╝    {C_MID}╚══════╝{RESET}",
    ]
    
    print()
    for l in logo_lines:
        vlen = _vis_len(l)
        pad = max(0, (inner - vlen) // 2)
        print(f"  {' ' * pad}{l}")
    print()

    # Double-line box container in signature C_PURPLE
    top_title = f" {BOLD}{C_LAVENDER}RAYS Agent v1.7.1{RESET} {C_MID}·{RESET} {C_LILAC}github.com/markknoffler/RAYS-CORE-CLI{RESET} "
    top_title_vis = _vis_len(top_title)
    top_dashes = max(2, inner - top_title_vis - 2)
    hdr = f"  {C_PURPLE}╔═{RESET}{top_title}{C_PURPLE}{'═' * top_dashes}╗{RESET}"
    ftr = f"  {C_PURPLE}╚{'═' * inner}╝{RESET}"
    gap = f"  {C_PURPLE}║{' ' * inner}║{RESET}"
    
    # ── Left Column: Commands ──
    left_rows = [
        f"{BOLD}{C_LAVENDER}Available Commands{RESET}",
        f"{C_PINK}/help{RESET}        {C_GRAY}Show available commands{RESET}",
        f"{C_PINK}/code <task>{RESET} {C_GRAY}Autonomous coding pipeline{RESET}",
        f"{C_PINK}/chat <q>{RESET}    {C_GRAY}Read-only Q&A{RESET}",
        f"{C_PINK}/model <name>{RESET}{C_GRAY}Switch LLM model{RESET}",
        f"{C_PINK}/mcp{RESET}         {C_GRAY}List MCP servers{RESET}",
        f"{C_PINK}/mode auto{RESET}   {C_GRAY}Full autonomy mode{RESET}",
        f"{C_PINK}/mode ask{RESET}    {C_GRAY}Ask-permission mode{RESET}",
        f"{C_PINK}/git{RESET}         {C_GRAY}Summarize git changes{RESET}",
        f"{C_PINK}/clear{RESET}       {C_GRAY}Clear screen{RESET}",
        f"{C_PINK}/bg{RESET}          {C_GRAY}Background tasks{RESET}",
        f"{C_PINK}/exit{RESET}        {C_GRAY}Exit RAYS{RESET}",
    ]
    
    # ── Right Column: Tools & Skills ──
    right_rows = [
        f"{BOLD}{C_LAVENDER}Available Tools{RESET}",
        f"{C_LILAC}web_search:{RESET}  {C_WHITE}DuckDuckGo search{RESET}",
        f"{C_LILAC}web_fetch:{RESET}   {C_WHITE}Page content extract{RESET}",
        f"{C_LILAC}code_edit:{RESET}   {C_WHITE}patch_file, write_file{RESET}",
        f"{C_LILAC}filesystem:{RESET}  {C_WHITE}read_file, list_dir{RESET}",
        f"{C_LILAC}terminal:{RESET}    {C_WHITE}run_command, bg_tasks{RESET}",
        f"{C_LILAC}subagents:{RESET}   {C_WHITE}delegate_subagent{RESET}",
        f"",
        f"{BOLD}{C_LAVENDER}Available Skills{RESET}",
        f"{C_MID}docx, pptx:{RESET}  {C_LILAC}Office document editors{RESET}",
        f"{C_MID}rayspy:{RESET}      {C_LILAC}Python analysis & REPL{RESET}",
        f"{C_MID}workspace:{RESET}   {C_LILAC}Codebase indexing & AST{RESET}",
    ]
    
    col_w = (inner - 4) // 2
    max_r = max(len(left_rows), len(right_rows))
    
    body_lines = [hdr, gap]
    for i in range(max_r):
        l_text = left_rows[i] if i < len(left_rows) else ""
        r_text = right_rows[i] if i < len(right_rows) else ""
        
        l_vis = _vis_len(l_text)
        r_vis = _vis_len(r_text)
        
        l_pad = max(0, col_w - l_vis)
        r_pad = max(0, col_w - r_vis)
        
        row_str = f"  {l_text}{' ' * l_pad}  {r_text}{' ' * r_pad}"
        row_vis = _vis_len(row_str)
        rem_pad = max(0, inner - row_vis)
        
        body_lines.append(f"  {C_PURPLE}║{RESET}{row_str}{' ' * rem_pad}{C_PURPLE}║{RESET}")
    
    body_lines.append(gap)
    
    # ── Separator & Footer stats inside box ──
    sep = f"  {C_PURPLE}╠{'═' * inner}╣{RESET}"
    body_lines.append(sep)
    
    model_display = model or _SESSION_MODEL or "rays"
    cwd_display = cwd or os.getcwd()
    max_cwd = 35
    if len(cwd_display) > max_cwd:
        cwd_display = "…" + cwd_display[-(max_cwd - 1):]
    skill_cnt = len(skills) if skills else 5
    mcp_cnt = len(mcp_servers) if mcp_servers else 0
    
    stats_left = f" {C_PINK}${RESET} {C_WHITE}{model_display}{RESET}  {C_MID}·{RESET}  {C_GRAY}{cwd_display}{RESET}"
    stats_right = f"{C_LAVENDER}{skill_cnt} skills{RESET}  {C_MID}·{RESET}  {C_LILAC}{mcp_cnt} MCP{RESET}  {C_MID}·{RESET}  {C_PINK}11 cmds{RESET}  {C_MID}·{RESET}  {C_PINK}/help{RESET} "
    
    sl_vis = _vis_len(stats_left)
    sr_vis = _vis_len(stats_right)
    gap_pad = max(1, inner - sl_vis - sr_vis)
    stats_row = f"{stats_left}{' ' * gap_pad}{stats_right}"
    
    body_lines.append(f"  {C_PURPLE}║{RESET}{stats_row}{C_PURPLE}║{RESET}")
    body_lines.append(ftr)
    
    for bl in body_lines:
        print(bl)
        
    hint = f"  {C_MID}Welcome to RAYS! Type your message or {RESET}{C_PINK}/help{RESET}{C_MID}  ·  {RESET}{C_LAVENDER}/code <task>{RESET}{C_MID} for coding pipeline{RESET}"
    print(f"\n{hint}\n")



#                          ANIMATED SPINNER
# ═══════════════════════════════════════════════════════════════════════

class AnimatedShapeSpinner:
    """Threaded spinner that cycles shapes and colors with a 2-second minimum."""
    
    def __init__(
        self,
        message: str = "Working",
        cool_messages: List[str] = None,
        *,
        use_global: bool = True,
        dual_shapes: bool = False,
    ):
        self.original_message = message
        self.message = message
        self.cool_messages = cool_messages or []
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self.start_time: float = 0.0
        self.use_global = use_global
        self.dual_shapes = dual_shapes
    
    def _spin(self):
        shape_idx = 0
        color_idx = 0
        while not self._stop_event.is_set():
            if self.dual_shapes:
                s1 = SHAPE_SEQUENCE[shape_idx % len(SHAPE_SEQUENCE)]
                s2 = SHAPE_SEQUENCE[(shape_idx + 3) % len(SHAPE_SEQUENCE)]
                c1 = THEME_COLORS[color_idx % len(THEME_COLORS)]
                c2 = THEME_COLORS[(color_idx + 2) % len(THEME_COLORS)]
                prefix = f"{c1}{s1}{RESET}{c2}{s2}{RESET}"
            else:
                shape = SHAPE_SEQUENCE[shape_idx % len(SHAPE_SEQUENCE)]
                color = THEME_COLORS[color_idx % len(THEME_COLORS)]
                prefix = f"{color}{shape}{RESET}"
            sys.stdout.write(f"\r  {prefix} {C_GRAY}{self.message}{RESET}   ")
            sys.stdout.flush()
            
            shape_idx += 1
            if shape_idx % len(SHAPE_SEQUENCE) == 0:
                color_idx += 1
                
            time.sleep(0.15) # Pulse speed for shapes
            
        sys.stdout.write(f"\r{' ' * (_term_width() - 1)}\r")
        sys.stdout.flush()
    
    def start(self):
        global _ACTIVE_SPINNER
        if self.use_global:
            if _ACTIVE_SPINNER is not None and getattr(_ACTIVE_SPINNER, 'stop', None):
                try:
                    _ACTIVE_SPINNER.stop()
                except Exception:
                    pass
            _ACTIVE_SPINNER = self
        self._stop_event.clear()
        self.start_time = time.time()
        self._thread = threading.Thread(target=self._spin, daemon=True)
        self._thread.start()
    
    def stop(self, final_message: str = "", success: bool = True):
        global _ACTIVE_SPINNER
        if self.use_global and _ACTIVE_SPINNER == self:
            _ACTIVE_SPINNER = None
            
        # Enforce weight
        elapsed = time.time() - self.start_time
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)
            
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=1)
            
        if final_message:
            color = C_GREEN if success else C_HOT_PINK
            print(f"  {color}▲{RESET} {C_WHITE}{final_message}{RESET}")
            
    def set_sub_message(self, sub_msg: str):
        """No-op for base spinner."""
        pass


@contextmanager
def spinner(message: str = "Working"):
    """Context manager for animated shape spinner."""
    s = AnimatedShapeSpinner(message)
    s.start()
    try:
        yield s
    finally:
        s.stop()


@contextmanager
def local_shape_spinner(message: str = "Working"):
    """Shape/color spinner on one line without buffering other output."""
    s = AnimatedShapeSpinner(message, use_global=False, dual_shapes=True)
    s.start()
    try:
        yield s
    finally:
        s.stop()

@contextmanager
def thinking(message: str = "Thinking"):
    """Shorthand for the thinking shape spinner."""
    with spinner(message) as s:
        yield s

COOL_MESSAGES = [
    "Architecting logic and data flows...",
    "Synthesizing instructions...",
    "Mapping codebase relationships...",
    "Forging new components...",
    "Weaving threads of code...",
    "Applying structural integrity...",
    "Refining the implementation plan...",
    "Simulating code execution...",
    "Optimizing for performance...",
    "Securing the architecture..."
]

class CoolAnimation(AnimatedShapeSpinner):
    """Enhanced spinner with cycling cool messages and vivid shapes."""
    def __init__(self, title: str, messages: List[str] = None):
        super().__init__("")
        self.title = title
        self.cool_messages = messages or COOL_MESSAGES
        self.sub_message = ""
        self.last_update_time = time.time()
        
    def set_sub_message(self, sub_msg: str):
        if sub_msg != self.sub_message:
            self.sub_message = sub_msg
            self.last_update_time = time.time()

    def _spin(self):
        shape_idx = 0
        color_idx = 0
        msg_idx = 0
        tick = 0
        
        # Scope terminal settings only for the duration of this animation
        has_tty = False
        fd = None
        try:
            fd = sys.stdin.fileno()
            old_settings = termios.tcgetattr(fd)
            tty.setcbreak(fd)
            has_tty = True
        except Exception:
            has_tty = False

        try:
            while not self._stop_event.is_set():
                tick += 1
                
                # Dual unsynchronized rotating shapes
                s1 = SHAPE_SEQUENCE[(shape_idx) % len(SHAPE_SEQUENCE)]
                s2 = SHAPE_SEQUENCE[(shape_idx + 3) % len(SHAPE_SEQUENCE)]  # offset by 3 for desync
                c1 = THEME_COLORS[(color_idx) % len(THEME_COLORS)]
                c2 = THEME_COLORS[(color_idx + 2) % len(THEME_COLORS)]  # different color
                
                # Formatting: Dual shapes + phase message
                main_text = f" {c1}{s1}{RESET}{c2}{s2}{RESET} {C_LILAC}{self.title}{RESET}"
                detail_hint = f" {C_DIM_GRAY}(ctrl+u toggle){RESET}"
                
                # Stuck detector: If no sub_message update for 5s, show "Working..."
                stuck_text = ""
                if time.time() - self.last_update_time > 5:
                    # Pulse "Working..." every 1s
                    if int(time.time()) % 2 == 0:
                        stuck_text = f" {C_MID}(Working...){RESET}"

                # Non-blocking check for Ctrl+U (\x15) ONLY
                if has_tty:
                    try:
                        if select.select([sys.stdin], [], [], 0)[0]:
                            char = sys.stdin.read(1)
                            if char == '\x15':  # Ctrl+U only
                                toggle_ui_mode()
                    except Exception:
                        pass

                if self.sub_message and UI_MODE == "cool":
                    sys.stdout.write(f"\r {main_text} {C_GRAY}> {self.sub_message[:45]}{RESET}{stuck_text}    {detail_hint} {' ' * 20}")
                else:
                    sys.stdout.write(f"\r {main_text}{stuck_text}    {detail_hint} {' ' * 40}")
                    
                sys.stdout.flush()
                
                shape_idx += 1
                if shape_idx % len(SHAPE_SEQUENCE) == 0:
                    color_idx += 1
                    
                tick += 1
                time.sleep(0.15)
        finally:
            if has_tty:
                termios.tcsetattr(fd, termios.TCSABRAIN if hasattr(termios, 'TCSABRAIN') else termios.TCSADRAIN, old_settings)
            
        sys.stdout.write(f"\r{' ' * (_term_width() - 1)}\r")
        sys.stdout.flush()

@contextmanager
def cool_thinking(title: str = "Processing", sub_messages: List[str] = None, message: str = None):
    """The 'Cool' way to display progress. Accepts optional sub_messages for cycling."""
    effective_title = message or title
    print_phase(effective_title)
    s = CoolAnimation(effective_title, sub_messages)
    s.start()
    try:
        yield s
    finally:
        s.stop(f"{effective_title} complete")

# SIGINFO Toggle (Ctrl+T on Mac) is handled via signal module at the top of this file.


# ═══════════════════════════════════════════════════════════════════════
#                       PHASE HEADERS
# ═══════════════════════════════════════════════════════════════════════

PLANNING_MESSAGES = [
    "Synthesizing architectural map...",
    "Optimizing symbol insertion points...",
    "Calibrating dependency vectors...",
    "Parsing structural hierarchies...",
    "Mapping logical boundaries...",
    "Resolving symbol collisions..."
]

GENERATION_MESSAGES = [
    "Forging neural-coded logic...",
    "Assembling structural fragments...",
    "Injecting refined algorithms...",
    "Verifying codebase integrity...",
    "Synchronizing file states...",
    "Merging logical branches..."
]

def print_phase(title: str):
    """Print a styled phase header."""
    global _ACTIVE_SPINNER
    if _ACTIVE_SPINNER: 
        _ACTIVE_SPINNER.stop()
        
    prefix = get_shape_prefix()
    capture_print(f"\n  {prefix} {BOLD}{C_WHITE}{title}{RESET}\n")


def print_sub_phase(title: str, *, force: bool = True):
    """Print a sub-phase indicator with a shape."""
    prefix = get_shape_prefix()
    capture_print(f"\n  {prefix} {C_LAVENDER}{title}{RESET}\n", force=force)


def print_step(message: str, success: bool = True):
    """Print a step result with a shape."""
    prefix = get_shape_prefix()
    capture_print(f"    {prefix} {C_GRAY}{message}{RESET}\n")


def print_warning(message: str):
    """Print a warning message."""
    prefix = get_shape_prefix()
    capture_print(f"    {prefix} {C_NEON_BLUE}{message}{RESET}\n")


def print_error(message: str):
    """Print an error message."""
    prefix = get_shape_prefix()
    capture_print(f"    {prefix} {C_NEON_BLUE}{BOLD}{message}{RESET}\n")


def print_exception(e: Exception, devmode: bool = None):
    """Print an exception, cleanly hiding or showing the trace in Neon Blue."""
    import traceback
    
    if devmode is None:
        devmode = DEVMODE
        
    prefix = get_shape_prefix()
    
    # Always print the immediate exception message wrapped contextually
    capture_print(f"    {prefix} {C_NEON_BLUE}{type(e).__name__}: {str(e)}{RESET}\n")
    
    if devmode:
        trace = traceback.format_exc()
        # Ensure the trace is fully styled in neon blue
        capture_print(f"\n{C_NEON_BLUE}{trace}{RESET}\n")


def print_info(message: str, *, force: bool = False):
    """Print an info message."""
    prefix = get_shape_prefix()
    capture_print(f"    {prefix} {C_LAVENDER}{message}{RESET}\n", force=force)


MCP_MESSAGES = [
    "Connecting to external application...",
    "Reading current state...",
    "Planning next MCP action...",
    "Applying changes step by step...",
    "Verifying outcome...",
]

def truncate_for_display(text: str, max_len: int = 280) -> str:
    """Single-line preview for MCP tool results."""
    one_line = re.sub(r"\s+", " ", str(text)).strip()
    if len(one_line) <= max_len:
        return one_line
    return one_line[: max_len - 3] + "..."


def print_mcp_step_header(server: str, phase: str, intent: str, task_count: int) -> None:
    if _ORCHESTRATION_ACTIVE:
        hud_set_status(f"MCP {server}", f"{phase} · {task_count} task(s)")
        return
    prefix = get_shape_prefix()
    capture_print(
        f"\n  {prefix} {BOLD}{C_WHITE}MCP {server}{RESET} "
        f"{C_LAVENDER}[{phase}]{RESET} — {C_CREAM}{intent}{RESET}\n",
        force=True,
    )


def print_mcp_task_start(index: int, total: int, purpose: str) -> None:
    if _ORCHESTRATION_ACTIVE:
        hud_set_status("MCP", f"{index}/{total}")
        return
    prefix = get_shape_prefix()
    capture_print(
        f"    {prefix} {C_LILAC}Task {index}/{total}{RESET} "
        f"{C_GRAY}{truncate_for_display(purpose, 120)}{RESET}\n",
        force=True,
    )


def print_mcp_thought(thought: str) -> None:
    if _ORCHESTRATION_ACTIVE:
        orch_emit_thinking(thought)
        return


def print_mcp_tool_invoke(server: str, tool_name: str, arguments: Any = None) -> None:
    if _ORCHESTRATION_ACTIVE:
        hud_set_status("Calling", f"{server}/{tool_name}")
        return
    prefix = get_shape_prefix()
    capture_print(
        f"      {prefix} {C_VIOLET}call{RESET} {BOLD}{server}/{tool_name}{RESET}\n",
        force=True,
    )


def print_mcp_tool_done(
    server: str,
    tool_name: str,
    result: str,
    arguments: Any = None,
) -> None:
    if _ORCHESTRATION_ACTIVE:
        orch_emit_tool_result(
            tool_name, arguments, result, server=server
        )
        err = str(result).lower().startswith("error")
        hud_set_status("Done" if not err else "Failed", f"{server}/{tool_name}")
        return
    prefix = get_shape_prefix()
    preview = truncate_for_display(result, 160)
    capture_print(
        f"      {prefix} {C_GREEN}done{RESET} "
        f"{server}/{tool_name} {C_GRAY}→ {preview}{RESET}\n",
        force=True,
    )


def print_mcp_server_status(name: str, status: str, detail: str = "") -> None:
    """Print a clean per-server MCP connection status line framed inside the box."""
    inner = max(40, _safe_inner_width(margin=8, minimum=40))
    if status == 'connected':
        icon = f"{C_GREEN}✓{RESET}"
        name_color = C_WHITE
        detail_color = C_LAVENDER
    elif status == 'warning':
        icon = f"{C_YELLOW}⚠{RESET}"
        name_color = C_WHITE
        detail_color = C_YELLOW
    else:
        icon = f"{C_RED}✗{RESET}"
        name_color = C_MID
        detail_color = C_MID
    detail_str = f"  {C_MID}·{RESET}  {detail_color}{detail}{RESET}" if detail else ""
    row_content = f"     {icon}  {name_color}{name}{RESET}{detail_str}"
    row_vis = _vis_len(row_content)
    pad = max(0, inner - row_vis)
    print(f"  {C_PURPLE}│{RESET}{row_content}{' ' * pad}{C_PURPLE}│{RESET}")
    sys.stdout.flush()


def print_mcp_connect_header(server_names: List[str]) -> None:
    """Print a clean header before MCP connection sequence begins."""
    inner = max(40, _safe_inner_width(margin=8, minimum=40))
    count = len(server_names)
    label = f"server{'s' if count != 1 else ''}"
    # Build styled content, then compute padding
    content_styled = f"  {BOLD}{C_PINK}MCP Connections{RESET}  {C_MID}·{RESET}  {C_WHITE}{count}{RESET} {C_MID}{label}{RESET}  "
    content_vis = _vis_len(content_styled)
    pad = max(0, inner - content_vis)
    print(f"\n  {C_PURPLE}╭{'─' * inner}╮{RESET}")
    print(f"  {C_PURPLE}│{RESET}{content_styled}{' ' * pad}{C_PURPLE}│{RESET}")
    print(f"  {C_PURPLE}├{'─' * inner}┤{RESET}")


def print_mcp_connect_summary(sessions: dict) -> None:
    """Print a summary box after all MCP connections are attempted."""
    inner = max(40, _safe_inner_width(margin=8, minimum=40))
    connected = [n for n, s in sessions.items() if getattr(s, 'status', '') == 'connected']
    failed = [n for n, s in sessions.items() if getattr(s, 'status', '') != 'connected']
    total_tools = sum(len(getattr(s, 'tools', [])) for s in sessions.values() if getattr(s, 'status', '') == 'connected')
    ok_str = f"{C_GREEN}{len(connected)} connected{RESET}"
    fail_str = f"{C_MID}{len(failed)} failed{RESET}" if not failed else f"{C_RED}{len(failed)} failed{RESET}"
    tools_str = f"{C_LAVENDER}{total_tools} tool{'s' if total_tools != 1 else ''} available{RESET}"
    content_styled = f"  {ok_str}  {C_MID}·{RESET}  {fail_str}  {C_MID}·{RESET}  {tools_str}  "
    content_vis = _vis_len(content_styled)
    pad = max(0, inner - content_vis)
    print(f"  {C_PURPLE}├{'─' * inner}┤{RESET}")
    print(f"  {C_PURPLE}│{RESET}{content_styled}{' ' * pad}{C_PURPLE}│{RESET}")
    print(f"  {C_PURPLE}╰{'─' * inner}╯{RESET}\n")



# ═══════════════════════════════════════════════════════════════════════
#                          BOXES
# ═══════════════════════════════════════════════════════════════════════

def print_box(
    title: str,
    content: str,
    color: str = C_VIOLET,
    max_lines: int = 15,
    content_color: str = C_CREAM,
    *,
    force: bool = True,
):
    """Print a styled box with precision alignment."""
    lines = content.split('\n')
    truncated = len(lines) > max_lines
    display_lines = lines[:max_lines] if truncated else lines
    
    # Keep full-width while fitting terminal: total printed width = inner + 4.
    inner = _safe_inner_width(margin=8, minimum=20)
    
    # Top border: "  " + "╭" + "─" + tag + dashes + "╮"
    title_text = f" {BOLD}{title} {RESET}{color}"
    title_vis = _vis_len(title_text)
    dashes = max(0, inner - title_vis - 1)
    capture_print(f"\n  {color}╭─{RESET}{color}{title_text}{'─' * dashes}╮{RESET}\n", force=force)
    
    for line in display_lines:
        visible = line[:max(1, inner - 4)] # Leave room for internal padding
        content_line = f"  {visible}"
        pad = max(0, inner - _vis_len(content_line))
        capture_print(f"  {color}│{RESET}{content_color}{content_line}{' ' * pad}{color}│{RESET}\n", force=force)
    
    if truncated:
        msg = f"  … +{len(lines) - max_lines} more lines"
        pad = max(0, inner - _vis_len(msg))
        capture_print(f"  {color}│{RESET}{C_DIM_GRAY}{msg}{' ' * pad}{color}│{RESET}\n", force=force)
    
    capture_print(f"  {color}╰{'─' * inner}╯{RESET}\n", force=force)


def print_plan_box(plan_text: str):
    """Print the implementation plan in a styled box."""
    print_box("Implementation Plan", plan_text, C_VIOLET)


def print_summary_box(stats: Dict[str, any]):
    """Print the execution summary box with pixel-perfect alignment."""
    # total printed width = inner + 4
    inner = _safe_inner_width(margin=8, minimum=20)
    
    out_buffer = []

    def _draw_line(content: str, color_override: str = None):
        vis = _vis_len(content)
        pad = max(0, inner - vis)
        c = color_override or C_VIOLET
        out_buffer.append(f"  {c}│{RESET}{content}{' ' * pad}{c}│{RESET}\n")

    success = stats.get('success', False)
    status_text = f"{C_GREEN}SUCCESS{RESET}" if success else f"{C_HOT_PINK}FAILED{RESET}"
    prefix = get_shape_prefix()
    status_icon = f"{prefix} {status_text}"
    
    # Top border: "  " + "╭─" + "title" + dashes + "╮"
    title_text = f" {BOLD}Execution Summary {RESET}{C_VIOLET}"
    title_vis = _vis_len(title_text)
    dashes = max(0, inner - title_vis - 1)
    out_buffer.append(f"\n  {C_VIOLET}╭─{RESET}{C_VIOLET}{title_text}{'─' * dashes}╮{RESET}\n")
    
    # Status line
    _draw_line(f"  {C_LAVENDER}Status:{RESET}  {status_icon}")
    _draw_line(f"") # Empty spacer line
    
    metrics = []
    if stats.get('files_modified', 0):
        metrics.append(("Files modified:", str(stats['files_modified'])))
    if stats.get('files_created', 0):
        metrics.append(("Files created: ", str(stats['files_created'])))
    if stats.get('edits_applied', 0):
        metrics.append(("Edits applied: ", str(stats['edits_applied'])))
    
    for label, val in metrics:
        v_str = f"{C_WHITE}{val}{RESET}"
        _draw_line(f"  {C_LILAC}{label}{RESET} {v_str}")
    
    errors = stats.get('errors', [])
    if errors:
        out_buffer.append(f"  {C_VIOLET}├{'─' * inner}┤{RESET}\n")
        import textwrap
        for err in errors[:5]:
            wrap_width = inner - 6
            wrapped = textwrap.wrap(err, width=wrap_width)
            for i, line in enumerate(wrapped):
                bullet = f"{C_RED}• {RESET}" if i == 0 else "  "
                _draw_line(f"  {bullet}{C_HOT_PINK}{line}{RESET}")
    
    git_status = stats.get('git_status')
    if git_status:
        if metrics or errors:
            _draw_line("")
        git_label = "Git Change Summary:"
        limit = inner - 25 # label width + safety
        truncated_git = git_status[:limit-3] + "..." if len(git_status) > limit else git_status
        _draw_line(f"  {C_LAVENDER}{git_label}{RESET} {C_MID}{truncated_git}{RESET}")

    out_buffer.append(f"  {C_VIOLET}╰{'─' * inner}╯{RESET}\n")

    # Stop any active phase spinner before summary
    global _ACTIVE_SPINNER
    if _ACTIVE_SPINNER:
        _ACTIVE_SPINNER.stop()
        _ACTIVE_SPINNER = None

    for line in out_buffer:
        # In cool mode, summary box should ALWAYS print
        sys.stdout.write(line)
        sys.stdout.flush()


def print_change_summary_box(summaries: List[Dict[str, any]]):
    """
    Print final change summary generated by memory summarizer.
    This is intended to be shown at the very end of pipeline execution.
    """
    if not summaries:
        print_box("Final Change Summary", "No summarized changes were generated.", C_VIOLET)
        return

    lines = []
    for item in summaries:
        item_type = item.get("type", "unknown")
        name = item.get("name", "unknown")
        file_path = item.get("file_path", "unknown")
        summary = item.get("summary") or item.get("reasoning") or ""

        lines.append(f"- [{item_type}] {name} ({file_path})")
        if summary:
            lines.append(f"  {summary}")
        lines.append("")

    content = "\n".join(lines).strip()
    print_box("Final Change Summary", content, C_VIOLET, max_lines=24)


def print_full_width_box(title: str, content: str, color: str = C_VIOLET, content_color: str = C_CREAM):
    """
    Print a full-width box that uses the available terminal width.
    Unlike print_box(), this does not clamp width to 76 columns.
    """
    inner = _safe_inner_width(margin=8, minimum=40)

    lines = content.split("\n") if content else [""]
    title_text = f" {BOLD}{title} {RESET}{color}"
    title_vis = _vis_len(title_text)
    dashes = max(0, inner - title_vis - 1)

    capture_print(f"\n  {color}╭─{RESET}{color}{title_text}{'─' * dashes}╮{RESET}\n")

    for raw_line in lines:
        wrapped = textwrap.wrap(raw_line, width=max(10, inner - 4)) or [""]
        for seg in wrapped:
            payload = f"  {seg}"
            pad = max(0, inner - _vis_len(payload))
            capture_print(f"  {color}│{RESET}{content_color}{payload}{' ' * pad}{color}│{RESET}\n")

    capture_print(f"  {color}╰{'─' * inner}╯{RESET}\n")


def print_final_run_summary(summary_text: str):
    """Print the final run summary in a full-width terminal box."""
    text = (summary_text or "").strip() or "No final run summary generated."
    print_full_width_box("Final Run Summary", text, C_VIOLET, C_CREAM)


# ═══════════════════════════════════════════════════════════════════════
#                      DIFF DISPLAY
# ═══════════════════════════════════════════════════════════════════════

def print_diff(file_path: str, old_content: str, new_content: str, reason: str = "") -> None:
    """Print a clean Claude/OpenCode-style diff with line numbers and green/red highlights."""
    prefix = get_shape_prefix()
    s_lines = (old_content or "").splitlines()
    r_lines = (new_content or "").splitlines()
    
    diff = list(difflib.unified_diff(
        s_lines, r_lines,
        fromfile='original', tofile='modified',
        lineterm='', n=3
    ))
    
    added_count = sum(1 for l in diff if l.startswith('+') and not l.startswith('+++'))
    removed_count = sum(1 for l in diff if l.startswith('-') and not l.startswith('---'))

    header = f"\n  {prefix} {BOLD}{C_WHITE}Update({C_LAVENDER}{file_path}{C_WHITE}){RESET}\n"
    header += f"  {C_MID}⎿{RESET}  {C_PINK}Added {added_count} lines, removed {removed_count} lines{RESET}\n"
    if reason:
        header += f"    {C_LAVENDER}{reason}{RESET}\n"
    header += "\n"
    _orch_persistent_print(header)

    if not diff:
        return

    w = max(60, min(120, _term_width() - 4))
    lineno_left = 0
    lineno_right = 0
    
    for line in diff:
        if line.startswith('---') or line.startswith('+++'):
            continue
            
        if line.startswith('@@'):
            match = re.search(r'@@ -(\d+),?\d* \+(\d+),?\d* @@', line)
            if match:
                lineno_left = int(match.group(1))
                lineno_right = int(match.group(2))
            _orch_persistent_print(f"     {C_DIM_GRAY}...\n{RESET}")
            continue
            
        if line.startswith('+'):
            marking = "+"
            content = line[1:]
            num_str = f"{' ' * 6}{lineno_right:>5} {marking} "
            lineno_right += 1
            # Emerald green background with bold white text
            formatted = f"\033[48;2;0;50;20m\033[1;37m{num_str}{content.ljust(max(0, w - len(num_str)))}\033[0m\n"
            _orch_persistent_print(formatted)
        elif line.startswith('-'):
            marking = "-"
            content = line[1:]
            num_str = f"{lineno_left:>6}{' ' * 6}{marking} "
            lineno_left += 1
            # Wine red background with bold white text
            formatted = f"\033[48;2;68;0;34m\033[1;37m{num_str}{content.ljust(max(0, w - len(num_str)))}\033[0m\n"
            _orch_persistent_print(formatted)
        else:
            marking = " "
            content = line[1:]
            num_str = f"{lineno_left:>6} {lineno_right:>5} {marking} "
            lineno_left += 1
            lineno_right += 1
            formatted = f"  {C_DIM_GRAY}{num_str}{RESET}{C_CREAM}{content}{RESET}\n"
            _orch_persistent_print(formatted)
            
    _orch_persistent_print("\n")


def print_file_created(file_path: str, content: str) -> None:
    """Print a file creation display with line numbers and full-width highlights."""
    prefix = get_shape_prefix()
    lines = (content or "").splitlines()
    num_lines = len(lines)
    
    header = f"\n  {prefix} {BOLD}{C_WHITE}Write({C_LAVENDER}{file_path}{C_WHITE}){RESET}\n"
    header += f"  {C_MID}⎿{RESET}  {C_PINK}Wrote {num_lines} lines to {file_path}{RESET}\n\n"
    _orch_persistent_print(header)
    
    w = max(60, min(120, _term_width() - 4))
    preview_limit = 25
    for i, line in enumerate(lines[:preview_limit], 1):
        num_str = f"{i:>6} + "
        formatted = f"\033[48;2;0;50;20m\033[1;37m{num_str}{line.ljust(max(0, w - len(num_str)))}\033[0m\n"
        _orch_persistent_print(formatted)
    
    if num_lines > preview_limit:
        _orch_persistent_print(f"     {C_LILAC}… +{num_lines - preview_limit} lines{RESET}\n")
    _orch_persistent_print("\n")


def print_file_modified(file_path: str, edits_count: int) -> None:
    """Print a modification header (Shape Update style)."""
    prefix = get_shape_prefix()
    line = f"\n  {prefix} {BOLD}{C_WHITE}Update({C_LAVENDER}{file_path}{C_WHITE}){RESET}\n"
    line += f"  {C_MID}⎿{RESET}  {C_LILAC}Applied {edits_count} edit(s){RESET}\n"
    _orch_persistent_print(line)


# ═══════════════════════════════════════════════════════════════════════
#                      FILE TREE
# ═══════════════════════════════════════════════════════════════════════

def print_file_tree(files: List[str], selected: List[str] = None, title: str = "Scanning project files"):
    """Print an animated file tree with selection indicators."""
    selected = selected or []
    selected_set = set(selected)
    prefix = get_shape_prefix()
    
    print(f"\n  {prefix} {C_LAVENDER}{title}{RESET}\n")
    
    # Build tree structure
    tree: Dict = {}
    for f in files:
        parts = f.split('/')
        current = tree
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = None  # leaf
    
    def _print_tree(node, prefix="  ", path_so_far=""):
        items = sorted(node.keys())
        for i, key in enumerate(items):
            is_last = (i == len(items) - 1)
            connector = "└── " if is_last else "├── "
            next_prefix = prefix + ("    " if is_last else "│   ")
            
            # Sanitize path
            current_path = key
            if path_so_far:
                full_path = f"{path_so_far}/{key}"
            else:
                full_path = key
            
            if node[key] is None:  # file
                if full_path in selected_set or key in selected_set:
                    indicator = f" {C_GREEN}← selected{RESET}"
                    color = C_GREEN
                else:
                    indicator = ""
                    color = C_DIM_GRAY
                print(f"{prefix}{C_PURPLE}{connector}{RESET}{color}{key}{RESET}{indicator}")
            else:  # directory
                print(f"{prefix}{C_PURPLE}{connector}{RESET}{C_LAVENDER}{key}/{RESET}")
                _print_tree(node[key], next_prefix, full_path)
    
    _print_tree(tree)
    print()


# ═══════════════════════════════════════════════════════════════════════
#                   COMMAND EXECUTION BOX
# ═══════════════════════════════════════════════════════════════════════

def print_command_box(command: str, output: str = "", elapsed: float = 0, success: bool = True):
    """Print a bash execution display (Vivid Shape style)."""
    badge = f"{C_GREEN}EXEC{RESET}" if success else f"{C_RED}FAIL{RESET}"
    prefix = get_shape_prefix()
    
    print(f"\n  {prefix} {BOLD}{C_WHITE}Bash({C_LAVENDER}{command[:80]}{'...' if len(command)>80 else ''}{C_WHITE}){RESET}")
    
    if not output and success:
        print(f"  {C_MID}⎿{RESET}  {C_GREEN}Command completed successfully {C_MID}({elapsed:.1f}s){RESET}")
        return

    # Status/Indentation symbol
    print(f"  {C_MID}⎿{RESET}  {badge} {C_MID}({elapsed:.1f}s){RESET} ")
    
    out_lines = output.split('\n')
    while out_lines and not out_lines[-1].strip(): out_lines.pop()
    
    for line in out_lines[:12]:
        print(f"       {C_LAVENDER}{line[:_term_width()-10]}{RESET}")
    
    if len(out_lines) > 12:
        print(f"     {C_LILAC}… +{len(out_lines)-12} lines (ctrl+o to expand){RESET}")


# ═══════════════════════════════════════════════════════════════════════
#                   COMMAND PERMISSION PROMPT
# ═══════════════════════════════════════════════════════════════════════

def prompt_command_permission(command: str) -> bool:
    """Ask user for permission to execute a command. Returns True if approved."""
    prefix = get_shape_prefix()
    print(f"\n  {prefix} {C_WHITE}RAYS wants to run:{RESET}")
    print(f"     {C_LAVENDER}${RESET} {C_WHITE}{command}{RESET}")
    
    while True:
        try:
            response = input(f"     {C_LILAC}Allow? {C_GRAY}[{C_GREEN}y{C_GRAY}/{C_RED}n{C_GRAY}]{RESET} ").strip().lower()
            if response in ('y', 'yes', ''):
                return True
            elif response in ('n', 'no'):
                print(f"    {C_YELLOW}⏭{RESET} {C_GRAY}Skipped{RESET}")
                return False
        except (EOFError, KeyboardInterrupt):
            return False


# ═══════════════════════════════════════════════════════════════════════
#                    MODEL SELECTOR
# ═══════════════════════════════════════════════════════════════════════

def print_model_selector(models: List[Dict], current_model: str = "") -> Optional[str]:
    """Display a model selection menu and return the chosen model name."""
    prefix = get_shape_prefix()
    print(f"\n  {prefix} {BOLD}{C_WHITE}Model Selection{RESET}\n")
    
    for i, model in enumerate(models, 1):
        name = model.get('name', model) if isinstance(model, dict) else model
        is_current = (name == current_model)
        marker = f" {C_GREEN}← current{RESET}" if is_current else ""
        print(f"    {C_LILAC}{i}.{RESET} {C_WHITE}{name}{RESET}{marker}")
    
    print(f"\n    {C_GRAY}Enter number to select, or press Enter to keep current:{RESET}")
    
    try:
        choice = input(f"    {C_LILAC}>{RESET} ").strip()
        if not choice:
            return None
        idx = int(choice) - 1
        if 0 <= idx < len(models):
            selected = models[idx]
            name = selected.get('name', selected) if isinstance(selected, dict) else selected
            print(f"\n    {C_GREEN}✓{RESET} {C_WHITE}Model set to: {C_PINK}{name}{RESET}")
            return name
    except (ValueError, IndexError, EOFError, KeyboardInterrupt):
        pass
    
    return None


# ═══════════════════════════════════════════════════════════════════════
#                    MODE SELECTOR
# ═══════════════════════════════════════════════════════════════════════

def print_mode_change(mode: str):
    """Acknowledge an execution mode change."""
    prefix = get_shape_prefix()
    if mode == "autonomous":
        print(f"\n  {prefix} {C_WHITE}Execution mode: {C_YELLOW}Autonomous{RESET} — commands run without asking")
    else:
        print(f"\n  {prefix} {C_WHITE}Execution mode: {C_GREEN}Ask Permission{RESET} — you approve each command")


# ═══════════════════════════════════════════════════════════════════════
#                STARTUP SESSION INFO
# ═══════════════════════════════════════════════════════════════════════

def print_session_info(codebase_path: str, model: str, execution_mode: str, conversation_id: str = ""):
    """Print the session info block in a rounded single-line box matching the banner style."""
    inner = max(60, _safe_inner_width(margin=8, minimum=60))

    def _row(label: str, val: str, val_color: str = C_WHITE) -> None:
        max_val_len = max(10, inner - len(label) - 6)
        disp = ("\u2026" + val[-(max_val_len - 1):]) if len(val) > max_val_len else val
        content = f"  {C_MID}{label}{RESET}  {val_color}{disp}{RESET}"
        vis = 2 + len(label) + 2 + len(disp)
        pad = max(0, inner - vis)
        print(f"  {C_PURPLE}│{RESET}{content}{' ' * pad}{C_PURPLE}│{RESET}")

    mode_display = "Autonomous" if execution_mode == "autonomous" else "Ask Permission"
    mode_color = C_YELLOW if execution_mode == "autonomous" else C_GREEN

    print(f"  {C_PURPLE}╭{'─' * inner}╮{RESET}")
    _row("Codebase :", codebase_path, C_WHITE)
    _row("Model    :", model, C_PINK)
    _row("Mode     :", mode_display, mode_color)
    if conversation_id:
        _row("Session  :", conversation_id, C_LILAC)
    print(f"  {C_PURPLE}╰{'─' * inner}╯{RESET}")
    print()


# ─── Slash command definitions (shared between help and autocomplete) ─
SLASH_COMMANDS = [
    ("/help",          "Show available commands and shortcuts"),
    ("/exit",          "Exit RAYS gracefully"),
    ("/code <task>",   "Execute autonomous coding pipeline"),
    ("/mcp",           "List MCP servers and connection status"),
    ("/model <name>",  "Switch LLM model"),
    ("/chat <q>",      "Read-only contextual Q&A (no file edits)"),
    ("/mode auto",     "Full autonomy — no confirmation prompts"),
    ("/mode ask",      "Ask-permission mode — confirm before each action"),
    ("/done",          "Submit current multi-line paste buffer"),
    ("/git",           "Summarize current git diff / changes"),
    ("/clear",         "Clear the screen"),
    ("/tui",           "Launch full-screen TUI mode (beta)"),
    ("/general_conversation_start", "Start Universal Cross-Terminal routing mode"),
    ("/gc_start",                   "Alias for /general_conversation_start"),
    ("/general_conversation_exit",  "Exit Universal Cross-Terminal routing mode"),
    ("/gc_exit",                    "Alias for /general_conversation_exit"),
    ("/gc_list",                    "List all connected terminal sessions"),
    ("/gc_connect <target>",        "Connect a terminal session by PID, pane ID, or interactively"),
    ("/gc_disconnect <target>",     "Disconnect a terminal session"),
    ("/skills",        "List discovered skills and capabilities"),
    ("/bg",            "List background tasks and their status"),
]


def prompt_gc_connect_interactive(available_sessions: list) -> Optional[str]:
    """Interactive CLI menu to connect a terminal session by number or custom PID/pane/TTY."""
    inner = max(66, _safe_inner_width(margin=8, minimum=60))
    print(f"\n  {C_PURPLE}╭{'─' * inner}╮{RESET}")
    print(f"  {C_PURPLE}│{RESET}  {BOLD}{C_PINK}Connect Terminal Agent Session{RESET}{' ' * max(0, inner - 32)}{C_PURPLE}│{RESET}")
    print(f"  {C_PURPLE}├{'─' * inner}┤{RESET}")
    
    if available_sessions:
        hdr = "Discovered Terminal Sessions on System:"
        print(f"  {C_PURPLE}│{RESET}  {C_LAVENDER}{hdr}{RESET}{' ' * max(0, inner - len(hdr) - 2)}{C_PURPLE}│{RESET}")
        for idx, sess in enumerate(available_sessions, 1):
            lbl = getattr(sess, "display_label", str(sess))
            line_str = f"  [{idx}] {C_WHITE}{lbl}{RESET}"
            pad = max(0, inner - _vis_len(line_str) - 2)
            print(f"  {C_PURPLE}│{RESET}  {line_str}{' ' * pad}{C_PURPLE}│{RESET}")
        print(f"  {C_PURPLE}├{'─' * inner}┤{RESET}")

    hint = "Enter selection number (1..N) or type PID, tmux pane (%0), session name, or TTY:"
    print(f"  {C_PURPLE}│{RESET}  {C_MID}{hint[:inner-4]}{RESET}{' ' * max(0, inner - len(hint[:inner-4]) - 2)}{C_PURPLE}│{RESET}")
    print(f"  {C_PURPLE}╰{'─' * inner}╯{RESET}")
    
    try:
        choice = input(f"  {C_PINK}Connect target > {RESET}").strip()
        if not choice:
            return None
        if choice.isdigit() and available_sessions:
            idx = int(choice) - 1
            if 0 <= idx < len(available_sessions):
                return available_sessions[idx].session_id
        return choice
    except (KeyboardInterrupt, EOFError):
        print()
        return None


def print_gc_connect_result(success: bool, detail: str, session: Optional[Any] = None) -> None:
    """Print connection result feedback."""
    if success and session:
        print(f"\n  {C_GREEN}✓ Connected to session:{RESET} {BOLD}{C_WHITE}{session.display_label}{RESET}\n")
    else:
        print(f"\n  {C_YELLOW}⚠ Connection note:{RESET} {C_GRAY}{detail}{RESET}\n")


def print_gc_mode_banner(sessions: list) -> None:
    """Print the General Conversation mode activation banner with connected sessions."""
    inner = max(66, _safe_inner_width(margin=8, minimum=60))
    print(f"\n  {C_PURPLE}╭{'─' * inner}╮{RESET}")
    print(f"  {C_PURPLE}│{RESET}  {BOLD}{C_PINK}✺ General Conversation Mode Active{RESET}{' ' * (inner - 36)}{C_PURPLE}│{RESET}")
    print(f"  {C_PURPLE}│{RESET}  {C_GRAY}Universal Semantic Cross-Terminal Agent Router & Observer{RESET}{' ' * max(0, inner - 61)}{C_PURPLE}│{RESET}")
    print(f"  {C_PURPLE}├{'─' * inner}┤{RESET}")
    
    if not sessions:
        msg = "No external terminal sessions found. (Open a tmux pane or Kitty window)"
        print(f"  {C_PURPLE}│{RESET}  {C_YELLOW}⚠ {msg}{RESET}{' ' * max(0, inner - len(msg) - 4)}{C_PURPLE}│{RESET}")
    else:
        hdr = f"Connected Terminal Sessions ({len(sessions)} active):"
        print(f"  {C_PURPLE}│{RESET}  {C_LAVENDER}{hdr}{RESET}{' ' * max(0, inner - len(hdr) - 2)}{C_PURPLE}│{RESET}")
        for idx, sess in enumerate(sessions, 1):
            lbl = getattr(sess, "display_label", str(sess))
            status_color = C_GREEN if getattr(sess, "is_agent_running", False) else C_GRAY
            line_str = f"  [{idx}] {status_color}{lbl}{RESET}"
            pad = max(0, inner - _vis_len(line_str) - 2)
            print(f"  {C_PURPLE}│{RESET}  {line_str}{' ' * pad}{C_PURPLE}│{RESET}")

    print(f"  {C_PURPLE}├{'─' * inner}┤{RESET}")
    hint1 = "Type your prompt. Citations like @file will resolve from ANY directory."
    hint2 = "Type /gc_exit or /general_conversation_exit to return to normal mode."
    print(f"  {C_PURPLE}│{RESET}  {C_MID}{hint1}{RESET}{' ' * max(0, inner - len(hint1) - 2)}{C_PURPLE}│{RESET}")
    print(f"  {C_PURPLE}│{RESET}  {C_GRAY}{hint2}{RESET}{' ' * max(0, inner - len(hint2) - 2)}{C_PURPLE}│{RESET}")
    print(f"  {C_PURPLE}╰{'─' * inner}╯{RESET}\n")


def print_gc_route_dispatched(decision: Any, target_session: Any, resolved_prompt: str, cited_files: list) -> None:
    """Print the prompt dispatch card with semantic routing details."""
    inner = max(66, _safe_inner_width(margin=8, minimum=60))
    agent_name = getattr(target_session, "agent_name", "Target Agent")
    sess_id = getattr(target_session, "session_id", "session")
    reasoning = getattr(decision, "reasoning", "")
    
    print(f"  {C_PURPLE}╭{'─' * inner}╮{RESET}")
    hdr = f"⚡ Routed to {BOLD}{C_PINK}{agent_name}{RESET} {C_LAVENDER}[{sess_id}]{RESET}"
    print(f"  {C_PURPLE}│{RESET}  {hdr}{' ' * max(0, inner - _vis_len(hdr) - 2)}{C_PURPLE}│{RESET}")
    
    if reasoning:
        r_line = f"Reason: {reasoning}"
        if len(r_line) > inner - 4:
            r_line = r_line[:inner - 7] + "..."
        print(f"  {C_PURPLE}│{RESET}  {C_GRAY}{r_line}{RESET}{' ' * max(0, inner - len(r_line) - 2)}{C_PURPLE}│{RESET}")

    if cited_files:
        c_line = f"Citations ({len(cited_files)}): " + ", ".join(f"@{f.get('file_name')}" for f in cited_files[:3])
        print(f"  {C_PURPLE}│{RESET}  {C_MID}{c_line}{RESET}{' ' * max(0, inner - len(c_line) - 2)}{C_PURPLE}│{RESET}")

    print(f"  {C_PURPLE}╰{'─' * inner}╯{RESET}")


def print_gc_observation_result(obs_result: Any, target_session: Any, is_interim: bool = False, round_num: int = 1) -> None:
    """Print the completed agent response or in-progress progress summary in RAYS signature purple/violet theme."""
    inner = max(66, _safe_inner_width(margin=8, minimum=60))
    agent_name = getattr(target_session, "agent_name", "Agent")
    sess_id = getattr(target_session, "session_id", "session")
    status = getattr(obs_result, "status", "completed")
    
    if status == "completed":
        out = getattr(obs_result, "full_output", "").strip()
        print(f"\n  {C_PINK}✓{RESET} {BOLD}{C_WHITE}{agent_name}{RESET} {C_LAVENDER}[{sess_id}]{RESET} {C_LILAC}Finished Output:{RESET}\n")
        if out:
            print_box(f"{agent_name} Response", out, C_PURPLE, max_lines=5000)
        else:
            print(f"  {C_GRAY}(Agent completed turn without additional text output){RESET}\n")
    elif status == "interrupted":
        print(f"\n  {C_LILAC}⊙ Observation paused — {agent_name} continues running in `{sess_id}`.{RESET}\n")
    else:
        # In progress
        summary = getattr(obs_result, "summary", "")
        stage_label = f"Check #{round_num}" if round_num > 0 else "Active"
        print(f"\n  {C_LILAC}⊙{RESET} {BOLD}{C_WHITE}{agent_name}{RESET} {C_LAVENDER}(Executing In Background · {stage_label}){RESET}\n")
        if summary:
            print_box(f"{agent_name} Progress Summary", summary, C_PURPLE, max_lines=5000)
        else:
            print(f"  {C_GRAY}Agent is currently performing tasks in `{sess_id}`...{RESET}\n")


def print_gc_mode_exit() -> None:
    """Print notice when exiting General Conversation Mode."""
    print(f"\n  {C_MID}← Exited General Conversation Mode. Returned to standard RAYS agent.{RESET}\n")


def print_help():
    """Print slash command help."""
    prefix = get_shape_prefix()
    print(f"\n  {prefix} {BOLD}{C_WHITE}Available Commands{RESET}\n")
    for cmd, desc in SLASH_COMMANDS:
        print(f"    {C_LILAC}{cmd:<28}{RESET} {C_GRAY}{desc}{RESET}")
    print()


# ═══════════════════════════════════════════════════════════════════════
#                   PROMPT INPUT & HISTORY
# ═══════════════════════════════════════════════════════════════════════

_history_path = None


def kawaii_thinking_animation(stop_event: threading.Event) -> None:
    """Hermes-style kawaii thinking animation that shows while LLM is running.
    
    Runs in a background thread. Call stop_event.set() to end it.
    """
    import itertools
    KAWAII_FACES = [
        "(´･_･`)", "(◔_◔)", "(¬‿¬)", "( ˘⌣˘)♡", "(⊙_⊙)",
        "(◡‿◡✿)", "ヽ(>∀<☆)☆", "(°ロ°)", "◉_◉", "ಠ_ಠ",
    ]
    THINK_VERBS = [
        "reflecting", "musing", "pondering", "contemplating",
        "cogitating", "deliberating", "analyzing", "processing",
    ]
    BRAILLE = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
    face_cycle = itertools.cycle(KAWAII_FACES)
    verb_cycle = itertools.cycle(THINK_VERBS)
    braille_cycle = itertools.cycle(BRAILLE)
    start = time.time()
    face = next(face_cycle)
    verb = next(verb_cycle)
    elapsed_ticks = 0

    while not stop_event.is_set():
        elapsed_ticks += 1
        if elapsed_ticks % 20 == 0:
            face = next(face_cycle)
            verb = next(verb_cycle)
        br = next(braille_cycle)
        elapsed = time.time() - start
        line = f"\r  {C_LILAC}{face}{RESET} {DIM}{verb}...{RESET}  {C_MID}{br}{RESET} {C_DIM_GRAY}({elapsed:.1f}s){RESET}"
        # Pad to clear previous content
        sys.stdout.write(line + "   ")
        sys.stdout.flush()
        stop_event.wait(timeout=0.12)

    # Clear the animation line on stop
    sys.stdout.write(f"\r{' ' * 70}\r")
    sys.stdout.flush()


def _readline_safe_prompt(raw_prompt: str) -> str:
    """
    Wrap ANSI escape sequences so readline does not count them as visible width.
    This prevents long-input cursor/vanish issues.
    """
    return re.sub(r'(\033\[[0-9;]*m)', r'\001\1\002', raw_prompt)

def setup_history(path: str):
    """Initialize readline history with a specific file path."""
    global _history_path
    _history_path = os.path.join(path, "history")

    if readline is None:
        # Windows may not ship GNU readline. History gracefully degrades.
        return

    if os.path.exists(_history_path):
        try:
            readline.read_history_file(_history_path)
            # Limit history
            readline.set_history_length(1000)
        except Exception:
            pass
    
    # Register save on exit
    atexit.register(save_history)


def save_history():
    """Save the current session history to disk."""
    if readline is None:
        return

    if _history_path:
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(_history_path), exist_ok=True)
            readline.write_history_file(_history_path)
        except Exception:
            pass


_pt_session = None
_paste_counter = 0


from prompt_toolkit import Application, PromptSession
from prompt_toolkit.layout import Layout, HSplit, VSplit, ConditionalContainer, Window
from prompt_toolkit.layout.controls import FormattedTextControl, BufferControl
from prompt_toolkit.buffer import Buffer
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.formatted_text import FormattedText, ANSI
from prompt_toolkit.history import FileHistory
from prompt_toolkit.filters import Condition
from prompt_toolkit.styles import Style
from prompt_toolkit.completion import Completer, Completion
from prompt_toolkit.output.color_depth import ColorDepth

def _build_status_bar_text():
    import time
    
    ctx_used_str = "0"
    if _SESSION_CTX_USED >= 1000000:
        ctx_used_str = f"{_SESSION_CTX_USED/1000000:.1f}M"
    elif _SESSION_CTX_USED >= 1000:
        ctx_used_str = f"{_SESSION_CTX_USED/1000:.1f}K"
    else:
        ctx_used_str = str(_SESSION_CTX_USED)
        
    ctx_limit_str = "0"
    if _SESSION_CTX_LIMIT >= 1000000:
        ctx_limit_str = f"{_SESSION_CTX_LIMIT/1000000:.1f}M"
    elif _SESSION_CTX_LIMIT >= 1000:
        ctx_limit_str = f"{_SESSION_CTX_LIMIT/1000:.1f}K"
    else:
        ctx_limit_str = str(_SESSION_CTX_LIMIT)
        
    pct = 0
    if _SESSION_CTX_LIMIT > 0:
        pct = int(100 * _SESSION_CTX_USED / _SESSION_CTX_LIMIT)
    pct = min(100, max(0, pct))
    
    w = 8
    filled = int(w * pct / 100)
    bar = "=" * filled + " " * (w - filled)
    
    elapsed = 0
    if _SESSION_START_TIME > 0:
        elapsed = time.time() - _SESSION_START_TIME
    
    if elapsed < 60:
        time_str = f"{int(elapsed)}s"
    else:
        m = int(elapsed // 60)
        s = int(elapsed % 60)
        if s == 0:
            time_str = f"{m}m"
        else:
            time_str = f"{m}m {s}s"
            
    bg_tasks = len(_BACKGROUND_TASKS)
    bg_str = f" | ⊙ {bg_tasks}" if bg_tasks > 0 else ""
    sub_cnt = active_subagent_count()
    sub_str = f" | ❖ {sub_cnt} subagent{'s' if sub_cnt != 1 else ''}" if sub_cnt > 0 else ""
    model_display = _SESSION_MODEL or "rays"
    
    left_part = f" $ {model_display} | {ctx_used_str}/{ctx_limit_str} | [{bar}] {pct}% | {time_str}{bg_str}{sub_str}"
    right_part = "/help commands · /code pipeline · /exit"
    
    term_w = _term_width()
    gap_len = max(2, term_w - len(left_part) - len(right_part) - 2)
    full_text = f"{left_part}{' ' * gap_len}{right_part} "
    
    return FormattedText([("class:bottom-toolbar", full_text)])

def _build_slash_dropdown_text(query: str, selected_idx: int):
    q = query.lower()
    if q.startswith('/'):
        q = q[1:]
    
    filtered = [cmd for cmd in SLASH_COMMANDS if q in cmd[0].lower()]
    
    items = []
    for i, (cmd, desc) in enumerate(filtered):
        style = "class:slash-selected" if i == selected_idx else ""
        cmd_padded = cmd.ljust(15)
        row = f" {cmd_padded} {desc} \n"
        items.append((style, row))
        
    return FormattedText(items)

def _build_bg_services_widget() -> FormattedText:
    """Render attractive, non-emoji banner showing active background commands above prompt."""
    with _BG_LOCK:
        tasks = list(_BACKGROUND_TASKS.items())
    if not tasks:
        return FormattedText([])
    
    parts = []
    header_text = f"  · Active Services ({len(tasks)}) ·\n"
    parts.append(("class:bg-header", header_text))
    
    for tid, (desc, st) in tasks:
        elapsed = int(time.time() - st)
        elapsed_str = f"{elapsed}s" if elapsed < 60 else f"{elapsed//60}m {elapsed%60}s"
        parts.append(("class:bg-dot", "   • "))
        parts.append(("class:bg-tid", f"[{tid}] "))
        parts.append(("class:bg-desc", f"{desc} "))
        parts.append(("class:bg-time", f"({elapsed_str})\n"))
    
    return FormattedText(parts)

_SESSION_PROMPT_INSTANCE: Any = None
_PASTE_COUNTER: int = 0

class SlashCommandCompleter(Completer):
    def get_completions(self, document, complete_event):
        text = document.text_before_cursor
        if text.startswith('/'):
            query = text.lower()
            for cmd, desc in SLASH_COMMANDS:
                cmd_parts = cmd.split()
                cmd_name = cmd_parts[0]
                has_args = len(cmd_parts) > 1
                insert_text = f"{cmd_name} " if has_args else cmd_name
                if cmd.lower().startswith(query) or cmd_name.lower().startswith(query) or query == '/':
                    yield Completion(
                        insert_text,
                        start_position=-len(text),
                        display=cmd,
                        display_meta=desc
                    )

def get_user_prompt() -> Optional[str]:
    """
    Get user input using persistent PromptSession with slash completions,
    live subagents / active services banner, and bottom status toolbar.
    """
    global _SESSION_PROMPT_INSTANCE, _PASTE_COUNTER
    import os
    import time
    
    # 1. Print Active Background Services Widget if any exist
    if bg_task_count() > 0:
        with _BG_LOCK:
            tasks = list(_BACKGROUND_TASKS.items())
        if tasks:
            sys.stdout.write(f"\n  {C_LAVENDER}{BOLD}· Active Services ({len(tasks)}) ·{RESET}\n")
            for tid, (desc, st) in tasks:
                elapsed = int(time.time() - st)
                elapsed_str = f"{elapsed}s" if elapsed < 60 else f"{elapsed//60}m {elapsed%60}s"
                sys.stdout.write(f"   {C_GREEN}•{RESET} {C_PINK}[{tid}]{RESET} {C_WHITE}{desc}{RESET} {C_GRAY}({elapsed_str}){RESET}\n")
            sys.stdout.write("\n")
            sys.stdout.flush()

    # 2. Print Live Sub-Agents Status Widget if any exist (matching Screenshot 1)
    if active_subagent_count() > 0:
        active_subagents = get_active_subagents()
        if active_subagents:
            inner = max(40, _term_width() - 8)
            sys.stdout.write(f"\n  {C_MID}{'─' * inner}{RESET}\n")
            for tid, data in active_subagents:
                role = data.get("role", "subagent")
                action = data.get("action", "Working...")
                elapsed = int(time.time() - data.get("start_time", time.time()))
                elapsed_str = f"{elapsed}s" if elapsed < 60 else f"{elapsed//60}m {elapsed%60}s"
                sys.stdout.write(f"   {C_YELLOW}•{RESET} {BOLD}{C_WHITE}Agent({role}){RESET}  {C_LAVENDER}{truncate_for_display(action, 45)}{RESET}  {C_MID}· {elapsed_str}{RESET}\n")
            sys.stdout.write(f"  {C_MID}{'─' * inner}{RESET}\n\n")
            sys.stdout.flush()

    # 2. Lazy-initialize or reuse PromptSession
    history_path = os.path.join(os.path.expanduser("~"), ".rays_history")
    if _SESSION_PROMPT_INSTANCE is None:
        style = Style.from_dict({
            'bottom-toolbar': 'bg:#232336 #a6a6b8',
            'bottom-toolbar.text': 'bg:#232336 #a6a6b8',
            'completion-menu': 'bg:#1e142e #f0e6ff',
            'completion-menu.completion': 'bg:#1e142e #f0e6ff',
            'completion-menu.completion.current': 'bg:#9333ea #ffffff bold',
            'completion-menu.meta': 'bg:#2a1b40 #d8b4fe',
            'completion-menu.meta.current': 'bg:#9333ea #ffffff bold',
            'completion-menu.meta.completion': 'bg:#2a1b40 #d8b4fe',
            'completion-menu.meta.completion.current': 'bg:#9333ea #ffffff bold',
            'completion-menu.multi-column-meta': 'bg:#2a1b40 #d8b4fe',
            'completion-menu.completion fuzzymatch.outside': '#d4c2fc',
            'completion-menu.completion fuzzymatch.inside': '#ffffff bold',
            'completion-menu.completion fuzzymatch.inside.character': '#ff80df underline',
            'completion-menu.completion.current fuzzymatch.outside': '#ffffff',
            'completion-menu.completion.current fuzzymatch.inside': '#ffffff bold',
            'completion-toolbar': 'bg:#1e142e #f0e6ff',
            'completion-toolbar.completion': 'bg:#1e142e #f0e6ff',
            'completion-toolbar.completion.current': 'bg:#9333ea #ffffff bold',
            'completion': 'bg:#1e142e #f0e6ff',
            'completion.current': 'bg:#9333ea #ffffff bold',
            'current-name': 'bg:#9333ea #ffffff bold',
            'selected-name': 'bg:#9333ea #ffffff bold',
            'scrollbar.background': 'bg:#1e142e',
            'scrollbar.button': 'bg:#9333ea',
        })
        kb = KeyBindings()
        
        @kb.add('c-c')
        def _(event):
            event.app.exit(result=None)
            
        _SESSION_PROMPT_INSTANCE = PromptSession(
            history=FileHistory(history_path),
            completer=SlashCommandCompleter(),
            complete_while_typing=True,
            color_depth=ColorDepth.TRUE_COLOR,
            style=style,
            key_bindings=kb,
            bottom_toolbar=_build_status_bar_text,
            reserve_space_for_menu=6,
        )

    prompt_prefix = ANSI(f"  \x1b[38;5;205m❯\x1b[0m ")
    try:
        raw_text = _SESSION_PROMPT_INSTANCE.prompt(prompt_prefix)
    except (KeyboardInterrupt, EOFError):
        return None
    except Exception:
        # Fallback to standard input if terminal mode was disrupted
        try:
            raw_text = input("  ❯ ")
        except (KeyboardInterrupt, EOFError):
            return None

    if raw_text is None:
        return None

    # Handle Paste Squashing for multi-line pasted blocks (>5 lines)
    if raw_text.count('\n') >= 5 and not raw_text.strip().startswith('/'):
        _PASTE_COUNTER += 1
        paste_dir = os.path.join(os.path.expanduser("~"), ".rays_pastes")
        os.makedirs(paste_dir, exist_ok=True)
        filename = f"paste_{_PASTE_COUNTER}_{int(time.time())}.txt"
        filepath = os.path.join(paste_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(raw_text)
        line_count = raw_text.count('\n') + 1
        return f"[Pasted text #{_PASTE_COUNTER}: {line_count} lines → {filepath}]"

    return raw_text.strip()

def expand_pasted_text(user_input: str) -> str:
    """
    Expands any squashed paste placeholders back into their full text
    before sending the prompt to the LLM.
    """
    import re
    
    def replacer(match):
        filepath = match.group(1)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception:
            return match.group(0)
            
    # Matches: [Pasted text #1: 10 lines → /path/to/file.txt]
    return re.sub(r'\[Pasted text #\d+: \d+ lines \u2192 (.+?)\]', replacer, user_input)


# ═══════════════════════════════════════════════════════════════════════
#                  PROGRESS BAR
# ═══════════════════════════════════════════════════════════════════════

def print_progress(current: int, total: int, label: str = ""):
    """Print a simple progress bar."""
    w = 30
    filled = int(w * current / max(total, 1))
    bar = f"{'█' * filled}{'░' * (w - filled)}"
    pct = int(100 * current / max(total, 1))
    sys.stdout.write(f"\r    {C_LILAC}{bar}{RESET} {C_GRAY}{pct}% {label}{RESET}   ")
    sys.stdout.flush()
    if current >= total:
        print()  # newline after completion


# ═══════════════════════════════════════════════════════════════════════
#                  INTERACTIVE APPROVAL
# ═══════════════════════════════════════════════════════════════════════

def ask_approval(message: str) -> bool:
    """
    Ask for user approval with a styled menu (Option 1: Yes, Option 2: No).
    """
    choice = select_from_menu(message, ["Yes", "No"])
    return choice == "Yes"


def select_from_menu(title: str, options: List[str], default_idx: int = 0) -> str:
    """
    Display an interactive, arrow-key navigable menu.
    Requires a true terminal (tty). Falls back to numbered list if not a tty.
    """
    # total printed width = inner + 4
    inner = _safe_inner_width(margin=8, minimum=20)
    
    if not sys.stdin.isatty():
        # Fallback for non-interactive environments
        title_len = _vis_len(f"╭─ {BOLD}{title} ")
        dashes = inner - title_len - 1
        print(f"\n  {C_VIOLET}╭─ {C_WHITE}{BOLD}{title}{RESET} {C_VIOLET}{'─' * max(0, dashes)}╮{RESET}")
        for i, opt in enumerate(options):
            raw_t = f"  [{i+1}] {opt}"
            pad = max(0, inner - _vis_len(raw_t))
            print(f"  {C_VIOLET}│{RESET}  {C_LILAC}[{i+1}]{RESET} {opt}{' ' * pad}{C_VIOLET}│{RESET}")
        print(f"  {C_VIOLET}╰{'─' * inner}╯{RESET}")
        
        while True:
            try:
                choice = input(f"  {C_PINK}❯ Select (1-{len(options)}): {RESET}").strip()
                idx = int(choice) - 1
                if 0 <= idx < len(options):
                    return options[idx]
            except:
                pass
            print(f"    {C_RED}Invalid choice.{RESET}")

    # Windows path: keep cursor-based selection via msvcrt (no tty/termios needed).
    if os.name == "nt":
        try:
            import msvcrt
            current_idx = min(max(0, default_idx), len(options) - 1)

            def render_win(idx: int):
                sys.stdout.write(f"\r\033[{len(options) + 2}A")
                sys.stdout.write("\033[J")
                title_tag = f"╭─ {BOLD}{title} "
                title_vis_len = _vis_len(title_tag)
                dashes = max(0, inner - title_vis_len + 1)
                sys.stdout.write(f"\r  {C_VIOLET}{title_tag}{RESET}{C_VIOLET}{'─' * dashes}╮{RESET}\r\n")

                for i, opt in enumerate(options):
                    if i == idx:
                        item_vis = f"  ❯ {opt}  "
                        pad = max(0, inner - _vis_len(item_vis))
                        sys.stdout.write(f"\r  {C_VIOLET}│{RESET}  {C_PINK}❯ {BOLD}{opt}{RESET}{' ' * pad}  {C_VIOLET}│{RESET}\r\n")
                    else:
                        item_vis = f"    {opt}  "
                        pad = max(0, inner - _vis_len(item_vis))
                        sys.stdout.write(f"\r  {C_VIOLET}│{RESET}    {C_GRAY}{opt}{RESET}{' ' * pad}  {C_VIOLET}│{RESET}\r\n")
                sys.stdout.write(f"\r  {C_VIOLET}╰{'─' * inner}╯{RESET}\r\n")
                sys.stdout.flush()

            sys.stdout.write("\r\n" * (len(options) + 2))
            render_win(current_idx)

            while True:
                ch = msvcrt.getwch()
                if ch in ("\r", "\n"):
                    return options[current_idx]
                # Arrow keys on Windows are reported as prefix + code
                if ch in ("\x00", "\xe0"):
                    k = msvcrt.getwch()
                    if k == "H":  # up
                        current_idx = (current_idx - 1) % len(options)
                        render_win(current_idx)
                    elif k == "P":  # down
                        current_idx = (current_idx + 1) % len(options)
                        render_win(current_idx)
                elif ch == "\x03":
                    raise KeyboardInterrupt
        except Exception:
            pass

    # Non-Windows or fallback path: if low-level terminal control isn't available,
    # use numbered input mode.
    if tty is None or termios is None:
        title_len = _vis_len(f"╭─ {BOLD}{title} ")
        dashes = max(0, inner - title_len - 1)
        print(f"\n  {C_VIOLET}╭─ {C_WHITE}{BOLD}{title}{RESET} {C_VIOLET}{'─' * dashes}╮{RESET}")
        for i, opt in enumerate(options):
            raw_t = f"  [{i+1}] {opt}"
            pad = max(0, inner - _vis_len(raw_t))
            print(f"  {C_VIOLET}│{RESET}  {C_LILAC}[{i+1}]{RESET} {opt}{' ' * pad}{C_VIOLET}│{RESET}")
        print(f"  {C_VIOLET}╰{'─' * inner}╯{RESET}")
        while True:
            try:
                choice = input(f"  {C_PINK}❯ Select (1-{len(options)}): {RESET}").strip()
                idx = int(choice) - 1
                if 0 <= idx < len(options):
                    return options[idx]
            except EOFError:
                raise KeyboardInterrupt
            except KeyboardInterrupt:
                raise
            except Exception:
                pass
            print(f"    {C_RED}Invalid choice.{RESET}")

    current_idx = min(max(0, default_idx), len(options) - 1)
    
    def render(idx: int):
        # Move cursor up to redraw
        sys.stdout.write(f"\r\033[{len(options) + 2}A")
        sys.stdout.write("\033[J")
        
        title_tag = f"╭─ {BOLD}{title} "
        title_vis_len = _vis_len(title_tag)
        dashes = max(0, inner - title_vis_len + 1)
        sys.stdout.write(f"\r  {C_VIOLET}{title_tag}{RESET}{C_VIOLET}{'─' * dashes}╮{RESET}\r\n")
        
        for i, opt in enumerate(options):
            if i == idx:
                prefix = "  ❯ "
                item_vis = f"  ❯ {opt}  "
                pad = max(0, inner - _vis_len(item_vis))
                sys.stdout.write(f"\r  {C_VIOLET}│{RESET}  {C_PINK}❯ {BOLD}{opt}{RESET}{' ' * pad}  {C_VIOLET}│{RESET}\r\n")
            else:
                prefix = "    "
                item_vis = f"    {opt}  "
                pad = max(0, inner - _vis_len(item_vis))
                sys.stdout.write(f"\r  {C_VIOLET}│{RESET}    {C_GRAY}{opt}{RESET}{' ' * pad}  {C_VIOLET}│{RESET}\r\n")
        sys.stdout.write(f"\r  {C_VIOLET}╰{'─' * inner}╯{RESET}\r\n")
        sys.stdout.flush()

    # Initial draw (reserve space)
    sys.stdout.write("\r\n" * (len(options) + 2))
    render(current_idx)

    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(sys.stdin.fileno())
        while True:
            ch = sys.stdin.read(1)
            
            if ch == '\x03': # Ctrl+C
                raise KeyboardInterrupt
            elif ch in ('\r', '\n'): # Enter
                break
            elif ch == '\x1b': # Escape sequence
                ch2 = sys.stdin.read(1)
                if ch2 == '[':
                    ch3 = sys.stdin.read(1)
                    if ch3 == 'A': # Up Arrow
                        current_idx = (current_idx - 1) % len(options)
                        render(current_idx)
                    elif ch3 == 'B': # Down Arrow
                        current_idx = (current_idx + 1) % len(options)
                        render(current_idx)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    
    return options[current_idx]


# ═══════════════════════════════════════════════════════════════════════
#               PROVIDER UNREACHABLE WARNING
# ═══════════════════════════════════════════════════════════════════════

def print_provider_warning(provider: str, base_url: str):
    """Print a styled warning when the AI provider is unreachable."""
    inner = _safe_inner_width(margin=8, minimum=20)

    def _line(text: str, border_color: str) -> str:
        clipped = text[:max(1, inner - 2)]
        pad = max(0, inner - _vis_len(clipped))
        return f"  {border_color}│{RESET}{clipped}{' ' * pad}{border_color}│{RESET}"

    print(f"\n  {C_HOT_PINK}╭─ {BOLD}WARNING{RESET} {C_HOT_PINK}{'─' * max(0, inner - 11)}╮{RESET}")
    print(_line(f"  {C_YELLOW}AI Provider ({provider}) is unreachable!{RESET}", C_HOT_PINK))
    print(_line(f"  {C_GRAY}Ensure Ollama/Gemini is running at: {base_url}{RESET}", C_RED))
    print(_line(f"  {C_GRAY}RAYS will continue with limited functionality.{RESET}", C_RED))
    print(f"  {C_RED}╰{'─' * inner}╯{RESET}\n")


# ═══════════════════════════════════════════════════════════════════════
#                   GIT STATUS HELPER
# ═══════════════════════════════════════════════════════════════════════

def get_git_status(path: str) -> str:
    """Get a short summary of git status (branch and changes)."""
    import subprocess
    try:
        # Check if it's a git repo
        subprocess.run(['git', 'rev-parse', '--is-inside-work-tree'], 
                       cwd=path, capture_output=True, check=True)
        
        # Get branch
        branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], 
                                         cwd=path).decode().strip()
        
        # Get counts of changed files
        status = subprocess.check_output(['git', 'status', '--porcelain'], 
                                         cwd=path).decode()
        
        changed = 0
        added = 0
        untracked = 0
        
        for line in status.splitlines():
            if line.startswith('??'): untracked += 1
            elif line.startswith(' A'): added += 1
            else: changed += 1
            
        summary = f"{branch} "
        parts = []
        if changed: parts.append(f"~{changed}")
        if added: parts.append(f"+{added}")
        if untracked: parts.append(f"?{untracked}")
        
        if parts:
            summary += f"({', '.join(parts)})"
        else:
            summary += "(clean)"
            
        return summary
    except:
        return ""
