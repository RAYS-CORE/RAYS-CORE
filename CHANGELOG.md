# Changelog

All notable changes to RAYS-CORE will be documented in this file.

## [Unreleased]

## [1.6.0] - 2026-06-03

### Added

- **Agent orchestrator** (default CLI): unified skills + MCP planning, dynamic sub-agents, full execution transcripts between steps, Codex-style HUD (Ctrl+T transcript, Ctrl+U detail), boxed session summary with step updates and prose wrap-up.
- MCP integration: `MCPManager`, `MCPOrchestrator`, `ToolPolicy`, `/mcp` status, lazy server connect, backend failure fail-fast and re-plan limits.
- Skills sub-agent hardening: reject `completed` without tool calls; programmatic docx/pptx completion checks.
- Config: `mcp_servers` merge (`config.yaml` → `~/.rays/mcp.json` → `<project>/.rays/mcp.json`), `mcp_tool_policy`, orchestrator prompts, MCP health/retry tunables.
- `workspace_paths.resolve_workspace_path()` for cross-platform file tools in the skills orchestrator (forward/back slash safe on Windows).
- Docs: `docs/MCP_SERVERS.md`, `docs/SKILLS.md`, `docs/PUBLISHING.md`, `examples/mcp/`, expanded `TROUBLESHOOTING.md`.
- Tests: orchestrator, MCP health, execution context, workspace paths, tool policy.

### Changed

- Default prompt path uses `AgentOrchestrator`; **`/code` coding pipeline unchanged**.
- Package layout: `src/rays_core/` with bundled `config.yaml`; CLI entrypoint `rays_core.rays_main:main`.
- GitHub Actions CI on Ubuntu, macOS, and Windows (install, pytest, build + `twine check`).

## [1.5.4] - 2026-04-25

### Changed

- Bumped package version to `1.5.4` for a fresh TestPyPI/PyPI upload cycle.

## [1.5.3] - 2026-04-25

### Fixed

- Resolved Windows startup crash caused by missing `readline` module.
- Added graceful fallbacks for environments without `tty`/`termios`.
- Guarded `SIGQUIT` registration for platforms that do not expose it.

### Changed

- Bumped package version to `1.5.3` in `pyproject.toml` and `setup.py`.

## [1.5.2] - 2026-04-25

### Changed

- Confirmed all public repository links point to `https://github.com/markknoffler/RAYS-CORE-CLI`.
- Updated package version to `1.5.2` in `pyproject.toml` and `setup.py`.
- Fixed README clone flow to `cd RAYS-CORE-CLI`.

## [1.0.0] - 2026-04-24

### Added

- Standalone `RAYS-CORE` repository structure.
- Professional OSS documentation (`README`, `CONTRIBUTING`, `SECURITY`).
- Modern Python packaging via `pyproject.toml`.
- Strict `.gitignore` for runtime state, secrets, and build artifacts.

### Changed

- Project metadata aligned for public release and PyPI publishing.
- Documentation expanded for providers, environment setup, modes, prompts, and pipeline.

### Removed

- Local runtime artifacts (`.rays`, `__pycache__`, compiled binaries).
- `trial_codebases` from publish-ready tree.
- Unused Node metadata files.

