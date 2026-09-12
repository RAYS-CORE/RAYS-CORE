"""RAYS TUI — OpenCode-style full-screen Text User Interface.

Layout mirrors OpenCode:
  - Left panel (75%): Conversation log + docked input at bottom
  - Right panel (25%): Model info, context, background tasks
  - Status bar (bottom, 2 rows): Plan mode · model name | cwd | RAYS version
  - Slash command overlay: appears above input when '/' is typed
"""
import os
import sys
import threading
import time
from pathlib import Path
from typing import Optional, List

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Center, Middle, Horizontal, Vertical
from textual.css.query import NoMatches
from textual.reactive import reactive
from textual.widgets import (
    Footer, Input, Label, ListItem, ListView,
    RichLog, Static,
)

from .rays_main import RAYS
from . import rays_ui


# ── SLASH COMMANDS for overlay ────────────────────────────────────────
_SLASH_CMDS: List[tuple] = [
    ("/help",         "Show available commands"),
    ("/code <task>",  "Autonomous coding pipeline"),
    ("/chat <q>",     "Read-only Q&A"),
    ("/model <name>", "Switch LLM model"),
    ("/mcp",          "List MCP servers"),
    ("/mode auto",    "Full autonomy mode"),
    ("/mode ask",     "Ask-permission mode"),
    ("/git",          "Summarize git changes"),
    ("/clear",        "Clear the screen"),
    ("/bg",           "Background tasks"),
    ("/exit",         "Exit RAYS"),
]


class SlashItem(ListItem):
    """A single row in the slash-command overlay."""

    def __init__(self, cmd: str, desc: str) -> None:
        label = f"[bold #c77dff]{cmd:<20}[/] [dim #8888aa]{desc}[/]"
        super().__init__(Label(label))
        self.cmd = cmd


class SlashOverlay(ListView):
    """Floating slash-command picker above the input field."""

    DEFAULT_CSS = """
    SlashOverlay {
        height: auto;
        max-height: 12;
        background: #16161f;
        border: solid #560bad;
        display: none;
        layer: overlay;
        dock: bottom;
        offset-y: -3;
        width: 60%;
        margin-left: 2;
    }
    SlashOverlay > ListItem {
        padding: 0 1;
        height: 1;
    }
    SlashOverlay > ListItem.--highlight {
        background: #7b2fbe;
        color: #ffffff;
    }
    SlashOverlay > ListItem > Label {
        width: 100%;
    }
    """

    def show_for(self, query: str) -> None:
        q = query.lstrip("/").lower()
        self.clear()
        matches = [
            (cmd, desc) for cmd, desc in _SLASH_CMDS
            if q in cmd.lower() or q == ""
        ]
        for cmd, desc in matches:
            self.append(SlashItem(cmd, desc))
        self.display = bool(matches)

    def hide(self) -> None:
        self.clear()
        self.display = False

    def selected_cmd(self) -> Optional[str]:
        if self.highlighted_child and isinstance(self.highlighted_child, SlashItem):
            return self.highlighted_child.cmd
        # fallback: first item
        for child in self.children:
            if isinstance(child, SlashItem):
                return child.cmd
        return None


# ── OPENCODE-STYLE STARTUP LOGO (RAYS SIGNATURE THEME) ───────────────
WELCOME_LOGO = """
[#ff79c6]██████╗   [/#ff79c6][#e0aaff]█████╗  [/#e0aaff][#c77dff]██╗   ██╗ [/#c77dff][#9d4edd]███████╗[/#9d4edd]
[#ff79c6]██╔══██╗ [/#ff79c6][#e0aaff]██╔══██╗ [/#e0aaff][#c77dff]╚██╗ ██╔╝ [/#c77dff][#9d4edd]██╔════╝[/#9d4edd]
[#ff79c6]██████╔╝ [/#ff79c6][#e0aaff]███████║  [/#e0aaff][#c77dff]╚████╔╝  [/#c77dff][#9d4edd]███████╗[/#9d4edd]
[#ff79c6]██╔══██╗ [/#ff79c6][#e0aaff]██╔══██║   [/#e0aaff][#c77dff]╚██╔╝   [/#c77dff][#9d4edd]╚════██║[/#9d4edd]
[#ff79c6]██║  ██║ [/#ff79c6][#e0aaff]██║  ██║    [/#e0aaff][#c77dff]██║    [/#c77dff][#9d4edd]███████║[/#9d4edd]
[#ff79c6]╚═╝  ╚═╝ [/#ff79c6][#e0aaff]╚═╝  ╚═╝    [/#e0aaff][#c77dff]╚═╝    [/#c77dff][#9d4edd]╚══════╝[/#9d4edd]
"""


class RAYSTui(App):
    """OpenCode-style full-screen TUI for RAYS with centered startup transition."""

    TITLE = "RAYS"
    SUB_TITLE = "Vivid Shapes Development Assistant"

    CSS = """
    /* ── Base ─────────────────────────────────────────── */
    Screen {
        background: #0d0d12;
        color: #d4d4d4;
        layers: base overlay;
    }

    /* ── Centered OpenCode-style Welcome Screen ───────── */
    #welcome_view {
        width: 100%;
        height: 100%;
        background: #0d0d12;
    }
    #welcome_logo {
        width: auto;
        text-align: center;
        margin-bottom: 1;
    }
    #welcome_card {
        width: 70;
        max-width: 80;
        height: auto;
        background: #14141e;
        border: solid #7b2cbf;
        padding: 0 1;
        margin-bottom: 1;
    }
    #welcome_input {
        width: 100%;
        background: #14141e;
        border: none;
        color: #ffffff;
        height: 1;
        padding: 0;
    }
    #welcome_input:focus {
        border: none;
    }
    #welcome_meta {
        color: #c77dff;
    }
    #welcome_hint {
        color: #8888aa;
    }

    /* ── Main 2-Panel Workspace ────────────────────────── */
    #main_layout {
        height: 1fr;
        width: 100%;
        display: none;
    }

    /* ── Conversation panel (left 75%) ─────────────────── */
    #chat_panel {
        width: 75%;
        height: 100%;
        background: #0d0d12;
    }
    #chat_log {
        height: 1fr;
        background: #0d0d12;
        border: none;
        padding: 0 1;
    }

    /* ── Input area ─────────────────────────────────────── */
    #input_area {
        height: 3;
        background: #0d0d12;
        border-top: solid #2a1040;
        padding: 0 1;
    }
    #input_box {
        background: #0d0d12;
        border: none;
        color: #e0e0e0;
        height: 1;
        padding: 0 1;
    }
    #input_box:focus {
        border: none;
        background: #0d0d12;
    }
    #input_hint {
        color: #444466;
        height: 1;
        padding: 0;
    }

    /* ── Sidebar (right 25%) ──────────────────────────── */
    #sidebar {
        width: 25%;
        height: 100%;
        background: #111118;
        border-left: solid #2a1040;
        padding: 1 1;
    }
    #sidebar_title {
        color: #c77dff;
        text-style: bold;
        margin-bottom: 1;
    }
    .sidebar_section_label {
        color: #9d4edd;
        text-style: bold;
        margin-top: 1;
    }
    .sidebar_value {
        color: #c4b5e8;
        padding-left: 1;
    }
    #subagents_log {
        height: 1fr;
        background: #161622;
        border: solid #2a1040;
        margin-top: 1;
        padding: 0 1;
    }
    #bg_log {
        height: 1fr;
        background: #161622;
        border: solid #2a1040;
        margin-top: 1;
        padding: 0 1;
    }

    /* ── Status bar (bottom 2 rows) ─────────────────────── */
    #status_bar {
        height: 2;
        background: #16161f;
        border-top: solid #2a1040;
    }
    #status_row1 {
        height: 1;
        background: #16161f;
    }
    #status_row2 {
        height: 1;
        background: #111118;
    }
    .status-left {
        width: 1fr;
        padding: 0 1;
        color: #8888aa;
    }
    .status-right {
        width: auto;
        padding: 0 1;
        color: #555577;
    }
    """

    BINDINGS = [
        Binding("ctrl+c", "quit", "Quit"),
        Binding("ctrl+d", "quit", "Quit", show=False),
        Binding("escape", "close_overlay", "Close overlay", show=False),
        Binding("tab", "complete_cmd", "Complete command", show=False),
    ]

    model_name: reactive[str] = reactive("loading...")
    ctx_tokens: reactive[str] = reactive("0 / 0")

    def __init__(self, codebase_root: str, config_path: str, conversation_id: str) -> None:
        super().__init__()
        self.codebase_root = codebase_root
        self.config_path = config_path
        self.conversation_id = conversation_id
        self.rays_engine: Optional[RAYS] = None
        self._overlay_open = False

    # ─── Layout ────────────────────────────────────────────────────────

    def compose(self) -> ComposeResult:
        # Initial Centered OpenCode-style Welcome Screen
        with Middle(id="welcome_view"):
            with Center():
                yield Static(WELCOME_LOGO, id="welcome_logo")
            with Center():
                with Vertical(id="welcome_card"):
                    yield Input(
                        placeholder="Ask anything... \"Fix broken tests\"",
                        id="welcome_input",
                    )
                    yield Label(
                        f"[#c77dff]{self.model_name}[/]",
                        id="welcome_meta",
                        markup=True,
                    )
            with Center():
                yield Label(
                    "[#8888aa]tab agents  ctrl+p commands  /help for all commands[/]",
                    id="welcome_hint",
                    markup=True,
                )

        # Full 2-panel Workspace (Chat log left 75%, Sidebar right 25%)
        with Horizontal(id="main_layout"):
            # Left: chat + input
            with Vertical(id="chat_panel"):
                yield RichLog(id="chat_log", wrap=True, markup=True, highlight=False)
                with Vertical(id="input_area"):
                    yield Input(
                        placeholder="> type a message or / for commands",
                        id="input_box",
                    )
                    yield Label(
                        "[dim]ctrl+c quit  /code <task>  /chat <q>  /mcp  /bg  /exit[/dim]",
                        id="input_hint",
                        markup=True,
                    )

            # Right: sidebar
            with Vertical(id="sidebar"):
                yield Static("RAYS", id="sidebar_title")
                yield Label("Model", classes="sidebar_section_label")
                yield Label("...", id="model_label", classes="sidebar_value")
                yield Label("Context Tokens", classes="sidebar_section_label")
                yield Label("0 / 0", id="tokens_label", classes="sidebar_value")
                yield Label("Sub-Agents", classes="sidebar_section_label")
                yield RichLog(id="subagents_log", wrap=True, markup=True, highlight=False)
                yield Label("Background Tasks", classes="sidebar_section_label")
                yield RichLog(id="bg_log", wrap=True, markup=True, highlight=False)

        # Status bar
        with Vertical(id="status_bar"):
            with Horizontal(id="status_row1"):
                yield Label("", id="status_r1_l", classes="status-left")
                yield Label(
                    f"[dim]{Path(self.codebase_root).name}[/dim]",
                    classes="status-right",
                    markup=True,
                )
            with Horizontal(id="status_row2"):
                yield Label(
                    f"[dim]{self.codebase_root}[/dim]",
                    classes="status-left",
                    markup=True,
                )
                yield Label(
                    "[dim]ctrl+p commands  RAYS 1.7.1[/dim]",
                    classes="status-right",
                    markup=True,
                )

        # Slash overlay (hidden by default, floats above input)
        yield SlashOverlay(id="slash_overlay")

    # ─── Watchers ──────────────────────────────────────────────────────

    def watch_model_name(self, value: str) -> None:
        try:
            self.query_one("#model_label", Label).update(value)
            self.query_one("#status_r1_l", Label).update(
                f"[bold #9d4edd]auto[/]  [dim]·[/]  [#c77dff]{value}[/]"
            )
            self.query_one("#welcome_meta", Label).update(
                f"[#c77dff]{value}[/]"
            )
        except NoMatches:
            pass

    def watch_ctx_tokens(self, value: str) -> None:
        try:
            self.query_one("#tokens_label", Label).update(value)
        except NoMatches:
            pass

    # ─── Lifecycle ─────────────────────────────────────────────────────

    async def on_mount(self) -> None:
        chat = self.query_one("#chat_log", RichLog)
        # Welcome message inside chat panel
        chat.write("")
        chat.write("[bold #c77dff]RAYS[/]  [#560bad]Vivid Shapes Development Assistant[/]")
        chat.write(f"[#444466]Workspace: {self.codebase_root}[/]")
        chat.write("")
        chat.write("[#555577]Type a message and press Enter. Use [bold #c77dff]/help[/] for commands.[/]")
        chat.write("")
        # Focus initial welcome input
        try:
            self.query_one("#welcome_input", Input).focus()
        except NoMatches:
            self.query_one("#input_box", Input).focus()
        # Periodic sidebar refresh for live subagents & bg tasks
        self.set_interval(0.5, self._refresh_sidebar)
        # Initialize engine in background
        threading.Thread(target=self._init_engine, daemon=True).start()

    def _refresh_sidebar(self) -> None:
        """Poll and update subagents, bg tasks, and token metrics reactively."""
        try:
            if rays_ui._SESSION_MODEL:
                self.model_name = rays_ui._SESSION_MODEL
            ctx_used = rays_ui._SESSION_CTX_USED
            ctx_limit = rays_ui._SESSION_CTX_LIMIT
            pct = int(100 * ctx_used / max(ctx_limit, 1)) if ctx_limit > 0 else 0
            self.ctx_tokens = f"{ctx_used:,} / {ctx_limit:,} ({pct}%)"
            
            # Refresh active subagents
            sub_log = self.query_one("#subagents_log", RichLog)
            active_subs = rays_ui.get_active_subagents()
            sub_log.clear()
            if active_subs:
                for tid, data in active_subs:
                    role = data.get("role", "subagent")
                    action = data.get("action", "working...")
                    elapsed = int(time.time() - data.get("start_time", time.time()))
                    sub_log.write(
                        f"[bold #e0aaff]• Agent({role})[/]\n  [#d8b4fe]{action[:35]}[/] [dim #8888aa]· {elapsed}s[/]"
                    )
            else:
                sub_log.write("[#444466]No active subagents[/]")

            # Refresh background services
            bg_log = self.query_one("#bg_log", RichLog)
            with rays_ui._BG_LOCK:
                tasks = list(rays_ui._BACKGROUND_TASKS.items())
            bg_log.clear()
            if tasks:
                for tid, (desc, st) in tasks:
                    elapsed = int(time.time() - st)
                    bg_log.write(
                        f"[bold #00d7af]• [{tid}][/] [#ffffff]{desc[:30]}[/]\n  [dim #8888aa]running {elapsed}s[/]"
                    )
            else:
                bg_log.write("[#444466]No background services[/]")
        except Exception:
            pass

    # ─── Engine init ───────────────────────────────────────────────────

    def _init_engine(self) -> None:
        try:
            self.rays_engine = RAYS(
                codebase_root=self.codebase_root,
                config_path=self.config_path,
                conversation_id=self.conversation_id,
            )
            model = getattr(self.rays_engine.ai_client, "model", "unknown")
            self.call_from_thread(setattr, self, "model_name", model)
            self.call_from_thread(self._patch_rays_ui)
            threading.Thread(target=self._token_poll_loop, daemon=True).start()
        except Exception as exc:
            self.call_from_thread(
                self.query_one("#chat_log", RichLog).write,
                f"[bold red]Init error:[/] {exc}",
            )

    def _patch_rays_ui(self) -> None:
        """Redirect RAYS print functions to the TUI chat log."""
        chat = self.query_one("#chat_log", RichLog)
        bg = self.query_one("#bg_log", RichLog)

        def _chat(text: str, *a, **kw) -> None:
            self.call_from_thread(chat.write, str(text))

        def _chat_ok(text: str) -> None:
            self.call_from_thread(chat.write, f"[green]{text}[/]")

        def _chat_warn(text: str) -> None:
            self.call_from_thread(chat.write, f"[#9d4edd]{text}[/]")

        def _chat_err(text: str) -> None:
            self.call_from_thread(chat.write, f"[bold #c77dff]{text}[/]")

        rays_ui.print_info = _chat
        rays_ui.print_step = _chat
        rays_ui.print_success = _chat_ok
        rays_ui.print_warning = _chat_warn
        rays_ui.print_error = _chat_err

        _orig_bg_start = rays_ui.bg_task_start
        _orig_bg_done = rays_ui.bg_task_done

        def _bg_start(task_id: str, description: str) -> None:
            _orig_bg_start(task_id, description)
            self.call_from_thread(bg.write, f"[#9d4edd]+ {description}[/]  [dim]{task_id}[/dim]")

        def _bg_done(task_id: str) -> None:
            _orig_bg_done(task_id)
            self.call_from_thread(bg.write, f"[green]done[/]  [dim]{task_id}[/dim]")

        rays_ui.bg_task_start = _bg_start
        rays_ui.bg_task_done = _bg_done

        # Patch animated spinners to prevent ANSI corruption in TUI
        app_self = self
        class DummySpinnerMock:
            def __init__(self, message="Working", *args, **kwargs):
                self.message = message
            def __enter__(self):
                if self.message:
                    app_self.call_from_thread(chat.write, f"[#c77dff]… {self.message}[/]")
                return self
            def __exit__(self, *args): pass
            def start(self): pass
            def stop(self, final_message="", success=True): pass
            def set_sub_message(self, msg=""): pass
            def set_message(self, msg=""): pass

        def _dummy_spinner_ctx(message: str = "Working", *args, **kwargs):
            return DummySpinnerMock(message)

        rays_ui.spinner = _dummy_spinner_ctx
        rays_ui.local_shape_spinner = _dummy_spinner_ctx
        rays_ui.thinking = _dummy_spinner_ctx
        rays_ui.AnimatedShapeSpinner = DummySpinnerMock
        rays_ui.CoolAnimation = DummySpinnerMock

    def _token_poll_loop(self) -> None:
        while True:
            time.sleep(3)
            if self.rays_engine:
                try:
                    used = getattr(self.rays_engine.ai_client, "total_tokens_used", 0)
                    limit = getattr(self.rays_engine.ai_client, "context_window", 131072)
                    self.call_from_thread(
                        setattr,
                        self,
                        "ctx_tokens",
                        f"{used:,} / {limit:,}",
                    )
                except Exception:
                    pass

    # ─── Input handling ────────────────────────────────────────────────

    async def on_input_changed(self, event: Input.Changed) -> None:
        val = event.value
        overlay = self.query_one("#slash_overlay", SlashOverlay)
        if val.startswith("/"):
            overlay.show_for(val)
            self._overlay_open = True
        else:
            overlay.hide()
            self._overlay_open = False

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        # If overlay is open, select highlighted command
        if self._overlay_open:
            overlay = self.query_one("#slash_overlay", SlashOverlay)
            cmd = overlay.selected_cmd()
            if cmd:
                event.input.value = cmd + " "
                event.input.cursor_position = len(event.input.value)
                overlay.hide()
                self._overlay_open = False
                return

        user_input = event.value.strip()
        if not user_input:
            return

        user_input = rays_ui.expand_pasted_text(user_input)

        # If submitted from the centered welcome screen, transition smoothly to 2-panel workspace
        if event.input.id == "welcome_input":
            try:
                self.query_one("#welcome_view").display = False
                self.query_one("#main_layout").display = True
                self.query_one("#input_box", Input).focus()
            except NoMatches:
                pass

        event.input.value = ""
        overlay = self.query_one("#slash_overlay", SlashOverlay)
        overlay.hide()
        self._overlay_open = False

        chat = self.query_one("#chat_log", RichLog)

        # Render user message block (OpenCode style)
        chat.write("")
        chat.write(f"[bold #c77dff]> {user_input}[/]")
        chat.write("")

        # Handle slash commands locally
        if user_input.startswith("/"):
            parts = user_input.split(maxsplit=1)
            cmd = parts[0].lower()
            if cmd in ("/exit", "/quit"):
                self.exit()
                return
            if cmd == "/clear":
                chat.clear()
                return
            if cmd == "/help":
                self._show_help(chat)
                return
            if cmd in ("/gc_start", "/general_conversation_start"):
                from rays_core.general_conversation import get_gc_manager
                gc_mgr = get_gc_manager()
                sessions = gc_mgr.start_mode()
                chat.write("[bold #c77dff]✺ General Conversation Mode Active[/]")
                if not sessions:
                    chat.write("[dim]No external terminal sessions found. (Open a tmux pane or Kitty window)[/]")
                else:
                    chat.write(f"[#9d4edd]Connected Sessions ({len(sessions)} active):[/]")
                    for idx, s in enumerate(sessions, 1):
                        chat.write(f"  [{idx}] [green]{s.display_label}[/]")
                chat.write("[dim]Type your prompt. Citations like @file resolve from ANY directory.[/]")
                chat.write("[dim]Type /gc_exit to return to normal mode.[/]")
                return
            if cmd in ("/gc_exit", "/general_conversation_exit"):
                from rays_core.general_conversation import get_gc_manager
                gc_mgr = get_gc_manager()
                gc_mgr.exit_mode()
                chat.write("[dim]← Exited General Conversation Mode.[/]")
                return
            if cmd == "/gc_list":
                from rays_core.general_conversation import get_gc_manager
                gc_mgr = get_gc_manager()
                sessions = gc_mgr.refresh_sessions()
                chat.write(f"[#9d4edd]Connected Sessions ({len(sessions)} active):[/]")
                for idx, s in enumerate(sessions, 1):
                    chat.write(f"  [{idx}] [green]{s.display_label}[/]")
                return
            if cmd in ("/gc_connect", "/general_conversation_connect", "/gc_add"):
                from rays_core.general_conversation import get_gc_manager
                gc_mgr = get_gc_manager()
                arg = parts[1].strip() if len(parts) > 1 else ""
                if not arg:
                    chat.write("[#d7af00]Usage: /gc_connect <PID | tmux_pane (%0) | session_name | TTY>[/]")
                else:
                    ok, detail, sess = gc_mgr.connect_session(arg)
                    if ok and sess:
                        chat.write(f"[bold green]✓ Connected to session:[/] {sess.display_label}")
                    else:
                        chat.write(f"[#d7af00]⚠ Connection error:[/] {detail}")
                return
            if cmd in ("/gc_disconnect", "/general_conversation_disconnect", "/gc_remove"):
                from rays_core.general_conversation import get_gc_manager
                gc_mgr = get_gc_manager()
                arg = parts[1].strip() if len(parts) > 1 else ""
                if not arg:
                    chat.write("[#d7af00]Usage: /gc_disconnect <session_id | target>[/]")
                else:
                    ok, detail = gc_mgr.disconnect_session(arg)
                    chat.write(f"[{'green' if ok else '#d7af00'}]{detail}[/]")
                return

        # Agent turn header
        chat.write("[bold #560bad]── RAYS[/]")
        chat.write("")

        # Run agent in background thread
        threading.Thread(
            target=self._run_agent,
            args=(user_input,),
            daemon=True,
        ).start()

    def _show_help(self, chat: RichLog) -> None:
        chat.write("[bold #c77dff]Available Commands[/]")
        for cmd, desc in _SLASH_CMDS:
            chat.write(f"  [#9d4edd]{cmd:<20}[/]  [dim]{desc}[/dim]")
        chat.write("")

    def _run_agent(self, user_input: str) -> None:
        chat = self.query_one("#chat_log", RichLog)
        if not self.rays_engine:
            self.call_from_thread(
                chat.write,
                "[#555577]Agent still initializing — please wait...[/]",
            )
            return
        try:
            from rays_core.general_conversation import get_gc_manager
            gc_mgr = get_gc_manager()
            if gc_mgr.active:
                self.call_from_thread(chat.write, "[#c77dff]Routing prompt across terminal sessions...[/]")
                res = gc_mgr.process_prompt(user_input, self.rays_engine.ai_client)
                if not res.get("ok"):
                    self.call_from_thread(chat.write, f"[bold #c77dff]Routing error:[/] {res.get('error')}")
                else:
                    target_sess = res["target_session"]
                    decision = res["decision"]
                    obs = res.get("observation")
                    self.call_from_thread(
                        chat.write,
                        f"[bold green]⚡ Routed to {target_sess.agent_name} ({target_sess.session_id})[/]\n[dim]Reason: {decision.reasoning}[/]"
                    )
                    if obs and getattr(obs, "status", "") == "completed":
                        self.call_from_thread(
                            chat.write,
                            f"[bold #ffffff]{target_sess.agent_name} Finished Response:[/]\n{obs.full_output}"
                        )
                    elif obs:
                        self.call_from_thread(
                            chat.write,
                            f"[#d7af00]⊙ {target_sess.agent_name} (In Progress):[/]\n{obs.summary or 'Executing tools in background...'}"
                        )
                return

            t0 = time.time()
            if user_input.lower().startswith("/code "):
                self.rays_engine.run(user_input[6:].strip())
            elif user_input.lower().startswith("/chat "):
                self.rays_engine.run_chat_mode(user_input[6:].strip())
            else:
                self.rays_engine.agent_orchestrator.run(user_prompt=user_input)
            elapsed = round(time.time() - t0, 1)
            self.call_from_thread(
                chat.write,
                f"[#d7af00]+ Thought: {elapsed}s[/]",
            )
        except Exception as exc:
            self.call_from_thread(
                chat.write,
                f"[bold #c77dff]Error:[/] {exc}",
            )

    # ─── Actions ───────────────────────────────────────────────────────

    def action_close_overlay(self) -> None:
        overlay = self.query_one("#slash_overlay", SlashOverlay)
        overlay.hide()
        self._overlay_open = False

    def action_complete_cmd(self) -> None:
        if self._overlay_open:
            overlay = self.query_one("#slash_overlay", SlashOverlay)
            cmd = overlay.selected_cmd()
            if cmd:
                inp = self.query_one("#input_box", Input)
                inp.value = cmd + " "
                inp.cursor_position = len(inp.value)
                overlay.hide()
                self._overlay_open = False

    # ─── List selection ────────────────────────────────────────────────

    async def on_list_view_selected(self, event: ListView.Selected) -> None:
        if event.list_view.id == "slash_overlay":
            if isinstance(event.item, SlashItem):
                inp = self.query_one("#input_box", Input)
                inp.value = event.item.cmd + " "
                inp.cursor_position = len(inp.value)
                self.query_one("#slash_overlay", SlashOverlay).hide()
                self._overlay_open = False
                inp.focus()


def launch_tui(codebase_root: str, config_path: str, conversation_id: str) -> None:
    """Entry point called by `rays --tui`."""
    app = RAYSTui(codebase_root, config_path, conversation_id)
    app.run()
