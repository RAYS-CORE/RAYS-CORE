# Architecture overview

RAYS-CORE is a terminal-first orchestration layer around static indexing, embeddings, LLM-guided analysis, planning, permission negotiation, code generation, optional shell execution, and session memory.

## High-level pipeline (edit mode)

1. **Config** — `config.yaml` (bundled + user-updated defaults); CLI startup can persist provider/model choices.
2. **Indexing** (`indexing.py` / native builder) — populates `.rays/` with symbol/relationship/registries consumed by retrieval.
3. **Vector DB** (`chunk_generator.py`) — Chroma-compatible store for semantic candidate lookup.
4. **Task analysis** (`task_analyzer.py`) — classifies intent, extracts keywords/tools, heuristic scores (SDS/IES).
5. **Symbol workflow** (`symbol_detection.py`) — retrieval, merging, explicit-mention parsing, optional deep-scan branch.
6. **Planning** (`planning.py`) — structured implementation plans within permission envelopes.
7. **Permissions** (`permission.py`) — negotiates scopes before edits/application.
8. **Anchoring** (`anchoring.py`, `*_anchor.py`) — resolves where new symbols/files belong.
9. **Execution** (`execution.py`, `code_generator.py`, `code_executor.py`) — emits and applies edits.
10. **Terminal engine** (`terminal_engine.py`) — optional command intents with safety modes (ask/autonomous).
11. **Memory** (`memory.py`) — summaries/embeddings tied to `.rays`/session.

## Alternate paths

- **Default prompt (no slash)** — **Agent orchestrator** (`agent_orchestrator.py`): discovers skills + MCP servers, plans mixed steps, runs skill sub-agents (`skills_orchestrator.py`) or MCP sub-agents (`mcp_orchestrator.py` + `mcp_manager.py`). Does not run the symbol/edit coding pipeline.
- **`/code`** — full coding pipeline via `rays.run()` (indexing, symbols, planning, execution). Intentionally separate from skills/MCP.
- **`/chat`** — read-only retrieval + answer synthesis (`rays_core.rays_main.run_chat_mode`, `chat_context_pipeline.py`).
- **`/mcp`** — list configured MCP servers and connection status.
- **New codebase** route — only under `/code` / `rays.run()` when the repo looks empty (`_generate_new_codebase`).

### Agent orchestrator flow

1. `discover_skills()` — `skills/` and `~/.rays/skills/`
2. `MCPManager.connect_all()` — stdio MCP servers from `mcp_servers` in config / `~/.rays/mcp.json` (child stderr quiet by default)
3. LLM selects `required_skills` and `required_mcp_servers`
4. LLM builds a spawn plan: which skill/MCP sub-agents to run, with `spawn_reason` per step (no fixed `mcp_tasks` tool chains)
5. Per step: each sub-agent runs a **dynamic loop** (many tool calls) until it returns `status: completed`; prior steps pass **full transcripts** (tool + args + results), not LLM summaries
6. Re-plan loop (max 3) and completion check using those transcripts

Prompts in `config.yaml`: `agent_orchestrator_prompts`, `mcp_orchestrator_prompts` (`mcp_subagent_turn`), and updated `skills_orchestrator_prompts` (`execute_skill_step`).

## Extension points for tests

Orchestration is centered on **`RAYS`** in `rays_core/rays_main.py`; swapping `AIClient` or subcomponents with mocks is the normal way to add deterministic CI without hitting real LLMs.

For file layout rationale and contribution flow, see **CONTRIBUTING.md** and **README.md**.

## Extending the agent orchestrator

- **[MCP_SERVERS.md](./MCP_SERVERS.md)** — configure stdio MCP servers (`~/.rays/mcp.json`, tool policy, examples).
- **[SKILLS.md](./SKILLS.md)** — author `skills/<name>/SKILL.md` for local workspace workflows.
