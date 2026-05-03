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

- **`/chat`** — read-only retrieval + answer synthesis (`rays_core.rays_main.run_chat_mode`, `chat_context_pipeline.py`).
- **New codebase** route — heuristic trigger when the repo looks empty and prompts request a greenfield project (`_generate_new_codebase`).

## Extension points for tests

Orchestration is centered on **`RAYS`** in `rays_core/rays_main.py`; swapping `AIClient` or subcomponents with mocks is the normal way to add deterministic CI without hitting real LLMs.

For file layout rationale and contribution flow, see **CONTRIBUTING.md** and **README.md**.
