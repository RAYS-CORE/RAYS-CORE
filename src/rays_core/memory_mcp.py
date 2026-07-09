import sys
import os
import json
import logging
from pathlib import Path

from mcp.server.fastmcp import FastMCP
from .persistent_memory import MemoryStore

logger = logging.getLogger(__name__)

# Initialize MemoryStore with the codebase root
# We default to cwd since this will be spawned in the workspace root by the mcp manager
codebase_root = Path(os.environ.get("RAYS_WORKSPACE_ROOT", os.getcwd())).resolve()
memory_store = MemoryStore(codebase_root)

# Create the MCP server instance
mcp = FastMCP("persistent_memory")

@mcp.tool()
def memory(
    action: str, 
    target: str = "memory", 
    content: str = "", 
    old_text: str = "", 
    operations: str = ""
) -> str:
    """Manage persistent agent memory and user context. Use this to remember facts, user preferences, and project guidelines across sessions.
    
    Args:
        action: The operation to perform ('add', 'replace', 'remove', 'batch').
        target: The target store ('memory' for agent notes, 'user' for user profile).
        content: The new text to add or replace with.
        old_text: The unique substring of an existing entry to replace or remove.
        operations: A JSON string of a list of operations for 'batch' action. Each operation must have 'action', and optionally 'content' and 'old_text'.
    """
    try:
        if action == "batch" and operations:
            try:
                ops = json.loads(operations)
                result = memory_store.apply_batch(target, ops)
            except json.JSONDecodeError as e:
                result = {"success": False, "error": f"Failed to parse operations JSON: {e}"}
        elif action == "add":
            result = memory_store.add(target, content)
        elif action == "replace":
            result = memory_store.replace(target, old_text, content)
        elif action == "remove":
            result = memory_store.remove(target, old_text)
        elif action in ("read", "list", "get", "view", "show"):
            # Read/list the current memory contents
            memory_store._reload_target(target, skip_drift=True)
            if target == "user":
                entries = memory_store.user_entries
            else:
                entries = memory_store.memory_entries
            result = {"success": True, "entries": entries}
        else:
            result = {"success": False, "error": f"Unknown or invalid action: {action}. Valid actions: add, replace, remove, read, batch"}  
            
        return json.dumps(result, indent=2)
    except Exception as e:
        logger.exception("Memory tool failed")
        return json.dumps({"success": False, "error": str(e)}, indent=2)

def main():
    mcp.run()

if __name__ == "__main__":
    main()
