import asyncio
import httpx
from fastmcp import FastMCP
import subprocess
import os

mcp = FastMCP(name="RAYS_MCP")
BASE = "http://127.0.0.1:8000"

_deckforge_process = None


@mcp.tool(
    name="Generate presentation",
    description="Generate presentation and return the file path",
)
async def generate_ppt(
    topic: str,
    n_slides: int = 5,
    template: str = "general",
    tone: str = "default",
    export_as: str = "pptx",
    language: str = "English",
    verbosity: str = "standard",
    instructions: str | None = None,
) -> dict:
    """Generate a presentation from a topic and return the file path."""
    async with httpx.AsyncClient(base_url=BASE, timeout=300.0) as client:
        response = await client.post(
            "/api/v1/ppt/presentation/generate",
            json={
                "content": topic,
                "n_slides": n_slides,
                "template": template,
                "export_as": export_as,
                "language": language,
                "tone": tone,
                "verbosity": verbosity,
                "instructions": instructions,
            },
        )
        response.raise_for_status()
        data = response.json()

        # Download the exported file
        file_url = data["path"]
        file_response = await client.get(file_url)
        filename = file_url.split("/")[-1]
        with open(filename, "wb") as f:
            f.write(file_response.content)

        return {
            "presentation_id": data["presentation_id"],
            "file": filename,
            "edit_url": f"http://127.0.0.1:3000{data['edit_path']}",
        }


@mcp.tool(
    name="List templates",
    description="List all available templates for presentation generation",
)
async def list_templates() -> list[dict]:
    """List all available templates for presentation generation."""
    builtin = [
        {"name": "general", "type": "builtin"},
        {"name": "modern", "type": "builtin"},
        {"name": "standard", "type": "builtin"},
        {"name": "swift", "type": "builtin"},
    ]
    async with httpx.AsyncClient(base_url=BASE, timeout=30.0) as client:
        response = await client.get("/api/v1/ppt/template-management/summary")
        if response.status_code == 200:
            data = response.json()
            for p in data.get("presentations", []):
                template_meta = p.get("template") or {}
                builtin.append({
                    "name": f"custom-{p['presentation_id']}",
                    "display_name": template_meta.get("name", "Custom"),
                    "type": "custom",
                    "layouts": p["layout_count"],
                })
    return builtin


@mcp.tool(
    name="List presentations",
    description="List all previously generated presentations",
)
async def list_presentations() -> list[dict]:
    """List all previously generated presentations."""
    async with httpx.AsyncClient(base_url=BASE, timeout=30.0) as client:
        response = await client.get("/api/v1/ppt/presentation/all")
        response.raise_for_status()
        presentations = response.json()
        return [
            {
                "id": p["id"],
                "title": p.get("title", "Untitled"),
                "n_slides": p.get("n_slides"),
                "created_at": p.get("created_at"),
            }
            for p in presentations
        ]

@mcp.tool(
    name="Open DeckForge",
    description="Starts the DeckForge app servers and opens the interactive UI for the user.",
)
def open_deckforge() -> str:
    """Starts the DeckForge app servers for this session."""
    global _deckforge_process
    if _deckforge_process is not None:
        import json
        return json.dumps({
            "__OPEN_APP": True,
            "url": "http://localhost:3000",
            "title": "DeckForge",
            "success": True,
            "message": "DeckForge is already running. The user can access it via the UI button."
        })
        
    script_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    start_script = os.path.join(script_dir, "start-dev.sh")
    
    if os.path.exists(start_script):
        # We spawn the process and let it run
        _deckforge_process = subprocess.Popen(
            ["bash", start_script], 
            cwd=script_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        import json
        return json.dumps({
            "__OPEN_APP": True,
            "url": "http://localhost:3000",
            "title": "DeckForge",
            "success": True,
            "message": "DeckForge started successfully. Click the 'Open DeckForge' button in the chat."
        })
    
    import json
    return json.dumps({"success": False, "message": f"Error: Could not find {start_script}"})


if __name__ == "__main__":
    mcp.run(transport="stdio")

