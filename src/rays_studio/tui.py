import os
import shutil
from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.widgets import Header, Footer, Button, Static, Log, ProgressBar, ListView, ListItem, Label
from textual.reactive import reactive

class ModelSidebar(Static):
    """Sidebar to list available GGUF models."""
    def compose(self) -> ComposeResult:
        yield Label("Available Models", id="sidebar_title")
        yield ListView(
            ListItem(Label("llama-3-8b-instruct.gguf")),
            ListItem(Label("qwen-2.5-7b.gguf")),
            ListItem(Label("gemma-2b-it.gguf")),
            id="model_list"
        )
        yield Button("Load Model & Start API", id="btn_start_server", variant="success")

class DashboardPane(Static):
    """Main dashboard showing API status and Agent interactions."""
    def compose(self) -> ComposeResult:
        yield Label("API Dashboard (OpenAI Compatible)", classes="panel_title")
        yield Label("Status: OFFLINE", id="api_status")
        yield Label("Endpoint: http://localhost:8000/v1")
        yield Log(id="api_log", auto_scroll=True)

class TrainingMonitorPane(Static):
    """Monitors the background ROCm SB-ZGA fine-tuning."""
    def compose(self) -> ComposeResult:
        yield Label("Autonomous Fine-Tuning Monitor", classes="panel_title")
        yield Label("Waiting for RAYS CORE Agent Logs...", id="training_status")
        yield ProgressBar(total=100, show_eta=False, id="training_progress")
        yield Horizontal(
            Button("Force Sync to Enterprise Server", id="btn_federated_sync", variant="primary"),
            id="sync_container"
        )

class LMStudioConfigPane(Static):
    """Configuration options mimicking LM Studio."""
    def compose(self) -> ComposeResult:
        yield Label("Model Configuration (llama.cpp)", classes="panel_title")
        yield Horizontal(Label("Temperature: 0.8"), id="conf_temp")
        yield Horizontal(Label("Context Length: 8192"), id="conf_ctx")
        yield Horizontal(Label("GPU Offload: Max"), id="conf_gpu")
        
        yield Label("Federated Hub Options", classes="panel_title", id="hub_title")
        yield Horizontal(
            Button("Generate Server Hash", id="btn_gen_hash", variant="success"),
            Label("   Client URL: "),
            Label("Client Hash: "),
        )
        yield Horizontal(
            Button("Connect as Client", id="btn_connect_client", variant="primary")
        )

class RAYSStudioTUI(App):
    """The main Textual Application for RAYS Studio."""
    
    CSS = """
    Screen {
        layout: horizontal;
        background: #09090b;
        color: #f4f4f5;
    }
    
    ModelSidebar {
        width: 30;
        dock: left;
        padding: 1;
        background: #18181b;
        border-right: solid #8b5cf6;
    }
    
    #sidebar_title {
        text-style: bold;
        padding-bottom: 1;
        color: #f4f4f5;
    }
    
    #model_list {
        height: 1fr;
        margin-bottom: 1;
        background: #18181b;
    }
    
    #btn_start_server {
        width: 100%;
        background: #8b5cf6;
        color: white;
    }
    #btn_start_server:hover {
        background: #a78bfa;
    }
    
    .main_content {
        width: 1fr;
        height: 100%;
        layout: vertical;
    }
    
    DashboardPane {
        height: 2fr;
        padding: 1;
        border-bottom: solid #8b5cf6;
        background: #09090b;
    }
    
    TrainingMonitorPane {
        height: 1fr;
        padding: 1;
        background: #09090b;
    }
    
    .panel_title {
        text-style: bold;
        color: #ec4899;
        padding-bottom: 1;
    }
    
    #api_log {
        height: 1fr;
        border: solid #27272a;
        background: #18181b;
        color: #a1a1aa;
    }
    
    #training_progress {
        margin-top: 1;
        margin-bottom: 1;
    }
    
    #sync_container {
        align: center middle;
    }
    
    #btn_federated_sync {
        background: #ec4899;
        color: white;
    }
    #btn_federated_sync:hover {
        background: #f472b6;
    }
    
    LMStudioConfigPane {
        height: 2fr;
        padding: 1;
        border-top: solid #27272a;
        background: #09090b;
    }
    
    #hub_title {
        margin-top: 1;
        color: #f59e0b;
    }
    
    #btn_gen_hash {
        background: #10b981;
        color: white;
    }
    #btn_connect_client {
        background: #3b82f6;
        color: white;
    }
    """

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        yield ModelSidebar()
        with Container(classes="main_content"):
            yield DashboardPane()
            yield TrainingMonitorPane()
            yield LMStudioConfigPane()
        yield Footer()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle button clicks."""
        api_log = self.query_one("#api_log", Log)
        api_status = self.query_one("#api_status", Label)
        
        if event.button.id == "btn_start_server":
            api_status.update("Status: [magenta]ONLINE[/magenta]")
            api_log.write_line("[SYSTEM] Loaded selected GGUF model via llama.cpp (zero-copy mmap).")
            api_log.write_line("[SYSTEM] FastAPI Server started at 0.0.0.0:8000")
            api_log.write_line("[SYSTEM] Background training daemon listening on ~/.rays/logs/success/")
            
        elif event.button.id == "btn_federated_sync":
            api_log.write_line("[FEDERATION] Packaging local SB-ZGA adapters...")
            api_log.write_line("[FEDERATION] Connecting to RAYS Enterprise Server...")
            api_log.write_line("[FEDERATION] Upload successful. TIES-Merging completed globally.")
            
    # In a real integration, we would use Textual's Workers to poll the daemon.py state
    # and update the UI in real-time when a training burst happens.

C_PURPLE = "\033[35m"
C_PINK = "\033[95m"
C_LAVENDER = "\033[94m"
C_LILAC = "\033[36m"
C_MID = "\033[34m"
RESET = "\033[0m"

def _vis_len(s):
    import re
    return len(re.sub(r'\033\[[0-9;]*m', '', s))

def _safe_inner_width(margin=8, minimum=60):
    cols, _ = shutil.get_terminal_size()
    return max(minimum, cols - margin)

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

if __name__ == "__main__":
    display_banner()
    app = RAYSStudioTUI()
    app.run()
