---
name: pptx
description: Generate PowerPoint (.pptx) presentations in the workspace.
---

# PPTX generation (RAYS skill sub-agent)

Tools: `run_shell_command`, `write_file`, `read_file`, `list_directory`, `patch_file`.
"Bash" in docs means **`run_shell_command`**.

## Workflow

1. `write_file` — outline in `slides.md` (title + bullet slides) or a small Python script.
2. `run_shell_command` — build the deck, e.g. with python-pptx:
   ```bash
   python3 -c "from pptx import Presentation; ..."
   ```
   or pandoc if available:
   ```bash
   pandoc slides.md -o output.pptx
   ```
3. Verify with `list_directory` before `status: completed`.

## Rules

- Output `.pptx` must land in the workspace root (or path named in spawn_reason).
- Never mark completed without at least one successful tool call.
