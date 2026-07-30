import os
import sys
from pathlib import Path

def main():
    # Attempt to find the DeckForge payload
    # 1. Dev environment: RAYS-CORE/extensions/RAYS_DeckForge
    # 2. Prod environment: ~/.rays/apps/deckforge
    
    # Check Dev environment first
    # This script is located at src/rays_core/skills/deckforge/mcp_launcher.py
    # RAYS-CORE is 4 levels up
    rays_core_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
    dev_path = rays_core_dir / "extensions" / "RAYS_DeckForge" / "servers" / "fastapi" / "rays_mcp.py"
    
    # Check Prod environment (e.g. ~/.rays/apps/deckforge)
    prod_path = Path.home() / ".rays" / "apps" / "deckforge" / "servers" / "fastapi" / "rays_mcp.py"
    
    target_mcp = None
    if dev_path.exists():
        target_mcp = dev_path
    elif prod_path.exists():
        target_mcp = prod_path
        
    if not target_mcp:
        # Fallback or error
        sys.stderr.write("[RAYS DeckForge MCP] Error: Could not locate RAYS_DeckForge payload.\n")
        sys.stderr.write(f"Checked DEV: {dev_path}\n")
        sys.stderr.write(f"Checked PROD: {prod_path}\n")
        sys.exit(1)
        
    # Replace the current process with the real MCP script so stdio stays perfectly hooked
    os.execv(sys.executable, [sys.executable, "-u", str(target_mcp)])

if __name__ == "__main__":
    main()
