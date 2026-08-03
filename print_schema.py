import sys
sys.path.append("/Users/samreedhbhuyan/Desktop/Win_C/RAYS-CORE/extensions/RAYS_DeckForge/servers/fastapi")
import rays_mcp

for tool in rays_mcp.mcp._tools:
    if tool.name == "Generate presentation":
        print(tool.model_json_schema())
