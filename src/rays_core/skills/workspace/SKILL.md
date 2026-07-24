---
name: workspace
description: Map the local project — list directories, read key files, and run read-only shell commands before using external MCP tools.
---

# Workspace skill

## Goals

- Understand what files exist in the user's current project directory (workspace root).
- Read README, config, or paths the user mentioned.
- Avoid modifying files unless the user explicitly asked for local file changes.

## Typical steps

1. `list_directory` on `.` or paths from the user prompt.
2. `read_file` on README, `package.json`, `pyproject.toml`, or other obvious entry points.
3. Optionally `run_shell_command` for read-only inspection (`git status --short`, `find . -maxdepth 2 -type f`).

## Rules

- All paths are relative to the **workspace root** (the directory where `rays` was started).
- Do not `cd` in shell commands.
- When finished, set `status: completed` and a brief `exit_message` listing what you found (not a long summary).

## When the orchestrator spawns you

Usually as step 1 before MCP (Blender, browser, APIs) so later sub-agents know which files and layout exist in the repo.
