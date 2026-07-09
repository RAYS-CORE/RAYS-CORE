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

# V8.0 Error Trace Palette
C_NEON_BLUE = "\033[38;5;27m" # Navy Neon Blue
C_CREAM     = "\033[38;5;230m" # Light Creamish Color
C_DIM_CREAM = "\033[38;5;187m" # Muted Cream
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


class OrchestrationHUD:
    """Single top status line: rotating shapes + phase, tokens pinned to the right edge."""

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
        sys.stdout.write(f"\r{' ' * _term_width()}\r\n")
        sys.stdout.flush()

    def set_status(self, phase: str, detail: str = "") -> None:
        self.phase = phase
        self.detail = (detail or "").strip()[:56]

    def add_tokens(self, count: int) -> None:
        if count > 0:
            self.tokens += int(count)

    def print_below(self, text: str) -> None:
        """Print a persistent line above the HUD spinner without losing animation."""
        if not self.active:
            sys.stdout.write(text if text.endswith("\n") else text + "\n")
            sys.stdout.flush()
            return
        with self._lock:
            self._pause_print = True
            time.sleep(0.14)
            sys.stdout.write(f"\r{' ' * _term_width()}\r")
            sys.stdout.write(text if text.endswith("\n") else text + "\n")
            sys.stdout.flush()
            self._pause_print = False

    def _animate(self) -> None:
        has_tty = False
        fd = None
        old_settings = None
        try:
            fd = sys.stdin.fileno()
            old_settings = termios.tcgetattr(fd)
            tty.setcbreak(fd)
            has_tty = True
        except Exception:
            has_tty = False

        try:
            while not self._stop.is_set():
                if self._pause_print:
                    time.sleep(0.04)
                    continue
                process_pending_ui_events()
                s1 = SHAPE_SEQUENCE[self._shape_idx % len(SHAPE_SEQUENCE)]
                s2 = SHAPE_SEQUENCE[(self._shape_idx + 3) % len(SHAPE_SEQUENCE)]
                c1 = THEME_COLORS[self._color_idx % len(THEME_COLORS)]
                c2 = THEME_COLORS[(self._color_idx + 2) % len(THEME_COLORS)]
                left = f" {c1}{s1}{RESET}{c2}{s2}{RESET} {C_LILAC}{self.phase}{RESET}"
                if self.detail:
                    left += f" {C_GRAY}· {self.detail}{RESET}"
                token_label = f"tokens {self.tokens:,}"
                token_part = f"{C_DIM_GRAY}{token_label}{RESET}"
                width = _term_width()
                left_vis = _vis_len(left)
                token_vis = _vis_len(token_label)
                gap = max(2, width - left_vis - token_vis - 1)
                with self._lock:
                    if not self._pause_print:
                        sys.stdout.write(f"\r{left}{' ' * gap}{token_part} ")
                        sys.stdout.flush()
                if has_tty:
                    try:
                        if select.select([sys.stdin], [], [], 0)[0]:
                            char = sys.stdin.read(1)
                            if char == "\x15":  # Ctrl+U — detail toggle
                                _toggle_ui_mode_now()
                            elif char == "\x14":  # Ctrl+T — transcript (some terminals)
                                show_orchestration_transcript()
                    except Exception:
                        pass
                self._shape_idx += 1
                if self._shape_idx % len(SHAPE_SEQUENCE) == 0:
                    self._color_idx += 1
                time.sleep(0.15)
        finally:
            if has_tty and old_settings is not None and fd is not None:
                try:
                    termios.tcsetattr(
                        fd,
                        termios.TCSABRAIN if hasattr(termios, "TCSABRAIN") else termios.TCSADRAIN,
                        old_settings,
                    )
                except Exception:
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
    wrapped = textwrap.wrap(thought.strip(), width=max(40, _term_width() - 10))
    _orch_persistent_print(f"    {C_LILAC}{ITALIC}thinking{RESET}\n")
    for w in wrapped:
        _orch_persistent_print(f"    {C_DIM_GRAY}{ITALIC}{w}{RESET}\n")
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


def _format_tool_verb(tool: str, arguments: Any) -> Tuple[str, str]:
    args = arguments if isinstance(arguments, dict) else {}
    if tool == "list_directory":
        return "Listed", f"`{args.get('path', '.')}`"
    if tool == "read_file":
        return "Read", f"`{args.get('path', '?')}`"
    if tool == "write_file":
        return "Wrote", f"`{args.get('path', '?')}`"
    if tool == "patch_file":
        return "Edited", f"`{args.get('path', '?')}`"
    if tool == "run_shell_command":
        cmd = str(args.get("command", "")).strip()
        return "Ran", f"`{truncate_for_display(cmd, 64)}`"
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

def display_banner():
    """Display a full-width framed banner with centered content."""
    inner = max(60, _safe_inner_width(margin=8, minimum=60))

    def _create_line(content: str) -> str:
        visible_len = _vis_len(content)
        left_pad = max(0, (inner - visible_len) // 2)
        right_pad = max(0, inner - visible_len - left_pad)
        return f"{C_PURPLE}║{RESET}{' ' * left_pad}{content}{' ' * right_pad}{C_PURPLE}║{RESET}"

    hdr = f"{C_PURPLE}╔{'═' * inner}╗{RESET}"
    ftr = f"{C_PURPLE}╚{'═' * inner}╝{RESET}"
    gap = f"{C_PURPLE}║{' ' * inner}║{RESET}"

    lines = [
        hdr,
        gap,
        _create_line(f"{C_PINK}██████╗   {C_LAVENDER}█████╗  {C_LILAC}██╗   ██╗ {C_MID}███████╗"),
        _create_line(f"{C_PINK}██╔══██╗ {C_LAVENDER}██╔══██╗ {C_LILAC}╚██╗ ██╔╝ {C_MID}██╔════╝"),
        _create_line(f"{C_PINK}██████╔╝ {C_LAVENDER}███████║  {C_LILAC}╚████╔╝  {C_MID}███████╗"),
        _create_line(f"{C_PINK}██╔══██╗ {C_LAVENDER}██╔══██║   {C_LILAC}╚██╔╝   {C_MID}╚════██║"),
        _create_line(f"{C_PINK}██║  ██║ {C_LAVENDER}██║  ██║    {C_LILAC}██║    {C_MID}███████║"),
        _create_line(f"{C_PINK}╚═╝  ╚═╝ {C_LAVENDER}╚═╝  ╚═╝    {C_LILAC}╚═╝    {C_MID}╚══════╝"),
        gap,
        _create_line(f"{C_LAVENDER}Vivid Shapes Development Assistant"),
        _create_line(f"{C_LILAC}github.com/markknoffler/RAYS-CORE-CLI"),
        gap,
        ftr,
    ]

    print()
    for line in lines:
        print(line)
    print()


# ═══════════════════════════════════════════════════════════════════════
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
                # Cycle messages every 4 seconds
                if tick % 25 == 0:
                    self.message = self.cool_messages[msg_idx % len(self.cool_messages)]
                    msg_idx += 1
                
                # Dual unsynchronized rotating shapes
                s1 = SHAPE_SEQUENCE[(shape_idx) % len(SHAPE_SEQUENCE)]
                s2 = SHAPE_SEQUENCE[(shape_idx + 3) % len(SHAPE_SEQUENCE)]  # offset by 3 for desync
                c1 = THEME_COLORS[(color_idx) % len(THEME_COLORS)]
                c2 = THEME_COLORS[(color_idx + 2) % len(THEME_COLORS)]  # different color
                
                # Formatting: Dual shapes + phase message
                main_text = f" {c1}{s1}{RESET}{c2}{s2}{RESET} {C_LILAC}{self.title}: {C_WHITE}{self.message}{RESET}"
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
    """Print a styled phase header OR trigger a vivid animation."""
    global _ACTIVE_SPINNER
    
    # Auto-Vivid Logic: If moving between major phases, start appropriate animation
    if title == "Planning edits":
        if _ACTIVE_SPINNER: _ACTIVE_SPINNER.stop()
        _ACTIVE_SPINNER = CoolAnimation("PLANNING", PLANNING_MESSAGES)
        _ACTIVE_SPINNER.start()
    elif title == "Generating Code":
        if _ACTIVE_SPINNER: _ACTIVE_SPINNER.stop()
        _ACTIVE_SPINNER = CoolAnimation("GENERATING", GENERATION_MESSAGES)
        _ACTIVE_SPINNER.start()
        
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
    force: bool = False,
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

def print_diff(file_path: str, search_block: str, replace_block: str, reason: str = ""):
    """Print a professional full-width diff with line numbers and background highlights."""
    prefix = get_shape_prefix()
    
    # Calculate counts
    s_lines = search_block.splitlines()
    r_lines = replace_block.splitlines()
    removed_count = len(s_lines)
    added_count = len(r_lines)
    
    out = []
    
    header = f"\n  {prefix} {BOLD}{C_WHITE}Update({C_LAVENDER}{file_path}{C_WHITE}){RESET}\n"
    header += f"  {C_MID}⎿{RESET}  {C_PINK}Added {added_count} lines, removed {removed_count} lines{RESET}\n"
    if reason:
        header += f"    {C_LAVENDER}{reason}{RESET}\n"
    header += "\n"
    
    out.append(header)

    # Generate unified diff
    diff = list(difflib.unified_diff(
        s_lines, r_lines,
        fromfile='original', tofile='modified',
        lineterm='', n=3
    ))
    
    if not diff:
        return

    w = shutil.get_terminal_size().columns
    lineno_left = 0
    lineno_right = 0
    
    for line in diff:
        if line.startswith('---') or line.startswith('+++'):
            continue
            
        if line.startswith('@@'):
            # Parse @@ -1,7 +1,7 @@
            match = re.search(r'@@ -(\d+),?\d* \+(\d+),?\d* @@', line)
            if match:
                lineno_left = int(match.group(1))
                lineno_right = int(match.group(2))
            out.append(f"     {C_DIM_GRAY}...\n") # Use plain ANSI for buffering
            continue
            
        # Format the line with numbering and content
        if line.startswith('+'):
            marking = "+"
            content = line[1:]
            num_str = f"{' ' * 6}{lineno_right:>5} {marking} "
            lineno_right += 1
            bg_style = "on #003300" # Rich Green
            markup = f"[{bg_style}][bold white]{num_str}{content.ljust(w - len(num_str))}[/]"
        elif line.startswith('-'):
            marking = "-"
            content = line[1:]
            num_str = f"{lineno_left:>6}{' ' * 6}{marking} "
            lineno_left += 1
            bg_style = "on #440022" # Hot Pink / Forget Red
            markup = f"[{bg_style}][bold white]{num_str}{content.ljust(w - len(num_str))}[/]"
        else:
            marking = " "
            content = line[1:]
            num_str = f"{lineno_left:>6} {lineno_right:>5} {marking} "
            lineno_left += 1
            lineno_right += 1
            markup = f"[dim white]{num_str}[/][white]{content}[/]"
            
        _console.print(Text.from_markup(markup))


def print_file_created(file_path: str, content: str):
    """Print a file creation display with line numbers and full-width highlights."""
    prefix = get_shape_prefix()
    import shutil
    lines = content.splitlines()
    num_lines = len(lines)
    
    print(f"\n  {prefix} {BOLD}{C_WHITE}Write({C_LAVENDER}{file_path}{C_WHITE}){RESET}")
    print(f"  {C_MID}⎿{RESET}  {C_PINK}Wrote {num_lines} lines to {file_path}{RESET}")
    print()
    
    w = shutil.get_terminal_size().columns
    preview_limit = 15
    for i, line in enumerate(lines[:preview_limit], 1):
        num_str = f"{i:>6} + "
        bg_style = "on #003300" # Rich Green
        markup = f"[{bg_style}][bold white]{num_str}{line.ljust(w - len(num_str))}[/]"
        _console.print(Text.from_markup(markup))
    
    if num_lines > preview_limit:
        print(f"     {C_LILAC}… +{num_lines - preview_limit} lines (ctrl+o to expand){RESET}")


def print_file_modified(file_path: str, edits_count: int):
    """Print a modification header (Shape Update style)."""
    prefix = get_shape_prefix()
    print(f"\n  {prefix} {BOLD}{C_WHITE}Update({C_LAVENDER}{file_path}{C_WHITE}){RESET}")
    print(f"  {C_MID}⎿{RESET}  {C_LILAC}Applied {edits_count} edit(s){RESET}")


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
    """Print the session info block after the banner."""
    # total printed width = inner + 4
    inner = _safe_inner_width(margin=8, minimum=20)
    
    def _line(label: str, val: str, is_mode: bool = False):
        if is_mode:
            display_val = "Autonomous" if val == "autonomous" else "Ask Permission"
            v_color = C_YELLOW if val == "autonomous" else C_GREEN
            v_str = f"{v_color}{display_val}{RESET}"
            val_for_len = display_val
        else:
            max_val_len = max(8, inner - len(label) - 8)
            if len(val) > max_val_len:
                display_val = "..." + val[-(max_val_len-3):]
            else:
                display_val = val
            v_color = C_WHITE if label == 'Codebase:' else C_PINK
            if label == "Session:": v_color = C_LILAC
            v_str = f"{v_color}{display_val}{RESET}"
            val_for_len = display_val
            
        interior = f"  {label}  {val_for_len}  "
        pad = max(0, inner - len(interior))
        print(f"  {C_PURPLE}│{RESET}  {C_GRAY}{label}{RESET}  {v_str}{' ' * (pad + 1)} {C_PURPLE}│{RESET}")

    print(f"  {C_PURPLE}┌{'─' * inner}┐{RESET}")
    _line("Codebase:", codebase_path)
    _line("Model:   ", model)
    _line("Exec Mode:", execution_mode, is_mode=True)
    if conversation_id:
        _line("Session: ", conversation_id)
    print(f"  {C_PURPLE}└{'─' * inner}┘{RESET}")
    print()


def print_help():
    """Print slash command help."""
    prefix = get_shape_prefix()
    print(f"\n  {prefix} {BOLD}{C_WHITE}Available Commands{RESET}\n")
    commands = [
        ("/help",          "Show this help message"),
        ("/exit",          "Exit RAYS"),
        ("/code <prompt>", "Execute coding pipeline (edit, create, etc.)"),
        ("/mcp",           "List configured MCP servers and connection status"),
        ("/model <name>",  "Switch to a different model"),
        ("/chat <prompt>", "Read-only contextual Q&A (no edit pipeline)"),
        ("/mode auto",     "Switch to autonomous execution (no confirmations)"),
        ("/mode ask",      "Switch to ask-permission execution"),
        ("/done",          "Submit a multi-line paste"),
        ("/git",           "Summarize current git changes"),
        ("/clear",         "Clear the screen"),
    ]
    for cmd, desc in commands:
        print(f"    {C_LILAC}{cmd:<18}{RESET} {C_GRAY}{desc}{RESET}")
    print()


# ═══════════════════════════════════════════════════════════════════════
#                   PROMPT INPUT & HISTORY
# ═══════════════════════════════════════════════════════════════════════

_history_path = None


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


def get_user_prompt() -> Optional[str]:
    """
    Get user input with multi-line support and persistent history.
    Uses readline for Arrows (history) and better interactive experience.
    """
    # Removed horizontal lining as requested
    
    try:
        # Standard interactive input with readline support
        user_input = input(_readline_safe_prompt(f"  {C_PINK}❯{RESET} ")).strip()
    except EOFError:
        return None
    except KeyboardInterrupt:
        print(f"\n  {C_LAVENDER}Interrupted — returning to prompt{RESET}")
        return ""
    
    if not user_input:
        return ""
        
    # Handle slash commands immediately
    if user_input.startswith('/'):
        return user_input
    
    # Multi-line continuation support (trailing \)
    if user_input.endswith('\\'):
        lines = [user_input[:-1].strip()]
        print(f"    {C_DIM_GRAY}(continue typing, use /done or empty Enter to submit){RESET}")
        while True:
            try:
                line = input(_readline_safe_prompt(f"  {C_GRAY}…{RESET} ")).strip()
                if not line or line.lower() == '/done':
                    break
                if line.endswith('\\'):
                    lines.append(line[:-1].strip())
                else:
                    lines.append(line)
                    break # Auto-submit on single line without \
            except (EOFError, KeyboardInterrupt):
                break
        return "\n".join(lines).strip()
    
    return user_input


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
                if not choice:
                    continue
                idx = int(choice) - 1
                if 0 <= idx < len(options):
                    return options[idx]
            except EOFError:
                # Non-interactive pipe closed; bail out with default.
                print(f"    {C_GRAY}(no input — using default: {options[default_idx]}){RESET}")
                return options[default_idx]
            except (ValueError, KeyboardInterrupt):
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
