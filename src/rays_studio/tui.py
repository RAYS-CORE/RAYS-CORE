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

class RAYSStudioTUI(App):
    """The main Textual Application for RAYS Studio."""
    
    CSS = """
    Screen {
        layout: horizontal;
    }
    
    ModelSidebar {
        width: 30;
        dock: left;
        padding: 1;
        background: $panel;
        border-right: solid $primary;
    }
    
    #sidebar_title {
        text-style: bold;
        padding-bottom: 1;
    }
    
    #model_list {
        height: 1fr;
        margin-bottom: 1;
    }
    
    #btn_start_server {
        width: 100%;
    }
    
    .main_content {
        width: 1fr;
        height: 100%;
        layout: vertical;
    }
    
    DashboardPane {
        height: 2fr;
        padding: 1;
        border-bottom: solid $primary;
    }
    
    TrainingMonitorPane {
        height: 1fr;
        padding: 1;
    }
    
    .panel_title {
        text-style: bold;
        color: $accent;
        padding-bottom: 1;
    }
    
    #api_log {
        height: 1fr;
        border: solid $secondary;
        background: $surface;
    }
    
    #training_progress {
        margin-top: 1;
        margin-bottom: 1;
    }
    
    #sync_container {
        align: center middle;
    }
    """

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        yield ModelSidebar()
        with Container(classes="main_content"):
            yield DashboardPane()
            yield TrainingMonitorPane()
        yield Footer()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle button clicks."""
        api_log = self.query_one("#api_log", Log)
        api_status = self.query_one("#api_status", Label)
        
        if event.button.id == "btn_start_server":
            api_status.update("Status: [green]ONLINE[/green]")
            api_log.write_line("[SYSTEM] Loaded selected GGUF model via llama.cpp (zero-copy mmap).")
            api_log.write_line("[SYSTEM] FastAPI Server started at 0.0.0.0:8000")
            api_log.write_line("[SYSTEM] Background training daemon listening on ~/.rays_core/logs/success/")
            
        elif event.button.id == "btn_federated_sync":
            api_log.write_line("[FEDERATION] Packaging local SB-ZGA adapters...")
            api_log.write_line("[FEDERATION] Connecting to RAYS Enterprise Server...")
            api_log.write_line("[FEDERATION] Upload successful. TIES-Merging completed globally.")
            
    # In a real integration, we would use Textual's Workers to poll the daemon.py state
    # and update the UI in real-time when a training burst happens.

if __name__ == "__main__":
    app = RAYSStudioTUI()
    app.run()
