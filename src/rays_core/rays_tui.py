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
from textual.containers import Horizontal, Vertical
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
        background: #2a1a4a;
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


class RAYSTui(App):
    """OpenCode-style full-screen TUI for RAYS."""

    TITLE = "RAYS"
    SUB_TITLE = "Vivid Shapes Development Assistant"

    CSS = """
    /* ── Base ─────────────────────────────────────────── */
    Screen {
        background: #0d0d12;
        color: #d4d4d4;
        layers: base overlay;
    }

    /* ── Main split ────────────────────────────────────── */
    #main_layout {
        height: 1fr;
        width: 100%;
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
        padding: 1 0;
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
        color: #560bad;
        text-style: bold;
        margin-top: 1;
    }
    .sidebar_value {
        color: #9d4edd;
        padding-left: 1;
    }
    #bg_log {
        height: 1fr;
        background: #111118;
        border: none;
        margin-top: 1;
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

    /* ── Message styling ─────────────────────────────────── */
    /* Applied via RichLog markup, not CSS */
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
                yield Label("Context", classes="sidebar_section_label")
                yield Label("0 / 0", id="tokens_label", classes="sidebar_value")
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
                    "[dim]ctrl+p commands  RAYS 2.0[/dim]",
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
        # Welcome message
        chat.write("")
        chat.write("[bold #c77dff]RAYS[/bold #c77dff]  [dim #560bad]Vivid Shapes Development Assistant[/dim #560bad]")
        chat.write(f"[dim #444466]Workspace: {self.codebase_root}[/dim #444466]")
        chat.write("")
        chat.write("[dim #555577]Type a message and press Enter. Use [bold #c77dff]/help[/bold #c77dff] for commands.[/dim #555577]")
        chat.write("")
        self.query_one("#input_box", Input).focus()
        # Initialize engine in background
        threading.Thread(target=self._init_engine, daemon=True).start()

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
                f"[bold red]Init error:[/bold red] {exc}",
            )

    def _patch_rays_ui(self) -> None:
        """Redirect RAYS print functions to the TUI chat log."""
        chat = self.query_one("#chat_log", RichLog)
        bg = self.query_one("#bg_log", RichLog)

        def _chat(text: str, *a, **kw) -> None:
            self.call_from_thread(chat.write, str(text))

        def _chat_ok(text: str) -> None:
            self.call_from_thread(chat.write, f"[green]{text}[/green]")

        def _chat_warn(text: str) -> None:
            self.call_from_thread(chat.write, f"[#9d4edd]{text}[/#9d4edd]")

        def _chat_err(text: str) -> None:
            self.call_from_thread(chat.write, f"[bold #c77dff]{text}[/bold #c77dff]")

        rays_ui.print_info = _chat
        rays_ui.print_step = _chat
        rays_ui.print_success = _chat_ok
        rays_ui.print_warning = _chat_warn
        rays_ui.print_error = _chat_err

        _orig_bg_start = rays_ui.bg_task_start
        _orig_bg_done = rays_ui.bg_task_done

        def _bg_start(task_id: str, description: str) -> None:
            _orig_bg_start(task_id, description)
            self.call_from_thread(bg.write, f"[#9d4edd]+ {description}[/#9d4edd]  [dim]{task_id}[/dim]")

        def _bg_done(task_id: str) -> None:
            _orig_bg_done(task_id)
            self.call_from_thread(bg.write, f"[green]done[/green]  [dim]{task_id}[/dim]")

        rays_ui.bg_task_start = _bg_start
        rays_ui.bg_task_done = _bg_done

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

        event.input.value = ""
        overlay = self.query_one("#slash_overlay", SlashOverlay)
        overlay.hide()
        self._overlay_open = False

        chat = self.query_one("#chat_log", RichLog)

        # Render user message block (OpenCode style)
        chat.write("")
        chat.write(f"[bold #c77dff]> {user_input}[/bold #c77dff]")
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

        # Agent turn header
        chat.write("[bold #560bad]── RAYS[/bold #560bad]")
        chat.write("")

        # Run agent in background thread
        threading.Thread(
            target=self._run_agent,
            args=(user_input,),
            daemon=True,
        ).start()

    def _show_help(self, chat: RichLog) -> None:
        chat.write("[bold #c77dff]Available Commands[/bold #c77dff]")
        for cmd, desc in _SLASH_CMDS:
            chat.write(f"  [#9d4edd]{cmd:<20}[/#9d4edd]  [dim]{desc}[/dim]")
        chat.write("")

    def _run_agent(self, user_input: str) -> None:
        chat = self.query_one("#chat_log", RichLog)
        if not self.rays_engine:
            self.call_from_thread(
                chat.write,
                "[dim #555577]Agent still initializing — please wait...[/dim #555577]",
            )
            return
        try:
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
                f"[#d7af00]+ Thought: {elapsed}s[/#d7af00]",
            )
        except Exception as exc:
            self.call_from_thread(
                chat.write,
                f"[bold #c77dff]Error:[/bold #c77dff] {exc}",
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
