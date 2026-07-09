---
name: docx
description: Generate Microsoft Word (.docx) documents in the workspace using markdown + pandoc.
---

# DOCX generation (RAYS skill sub-agent)

You run inside RAYS with these tools only: `run_shell_command`, `write_file`, `read_file`, `list_directory`, `patch_file`.
When SKILL.md says "bash", use **`run_shell_command`**.

## Workflow

1. `write_file` — create `content.md` (or similar) in the **workspace root** with full document text.
2. `run_shell_command` — convert to `.docx`, e.g.:
   ```bash
   pandoc content.md -o output.docx
   ```
3. If pandoc is missing, install or use python-docx via a one-off script under the skill root.
4. `list_directory` — confirm the `.docx` file exists before `status: completed`.

## Rules

- Paths are relative to the workspace root unless absolute under skill root.
- Do not exit with `completed` until a `.docx` file exists in the workspace.
- Ignore prior MCP agents; file creation is your job.
