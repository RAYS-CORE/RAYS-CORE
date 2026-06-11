# Skills (agent orchestrator)

**Skills** teach the default agent orchestrator how to work in your **local workspace**: list files, run shell commands, read/write/patch files, and use bundled scripts or templates shipped with the skill.

Skills complement **MCP servers** (external apps). Typical flow: `workspace` skill maps the repo → `docx` or MCP `blender` does the specialized work.

Skills are **not** used by the **`/code`** coding pipeline. That path uses symbol detection, planning, and `CodeExecutor` instead.

---

## How it works

1. RAYS scans skill directories and loads every folder that contains `SKILL.md`.
2. For each user prompt, the orchestrator selects **required skill names** (e.g. `workspace`, `docx`).
3. The planner emits **spawn steps** (`skill`, `spawn_reason`) — not a fixed list of shell commands.
4. Each skill runs as a **dynamic sub-agent**: it loops on allowed tools until `status: completed` (up to `skill_subagent_max_turns`, default 15).
5. Full tool transcripts are passed to later steps (skills or MCP); there is no LLM “summary” step between them.

---

## Where skills live

RAYS discovers skills from **two** directories (project overrides global when names collide):

| Location | Scope |
|----------|--------|
| `<project>/skills/<skill-name>/` | This repository only — **commit these** for team workflows |
| `~/.rays/skills/<skill-name>/` | All projects on this machine — personal or shared installs |

Discovery order: local `skills/` first, then `~/.rays/skills/`. The **first** `name` wins; duplicates in the second directory are skipped.

---

## Skill directory layout

```
skills/
└── my-skill/
    ├── SKILL.md          # Required — instructions + YAML frontmatter
    ├── scripts/          # Optional — helpers the agent can run via shell
    │   └── build.sh
    ├── templates/        # Optional — doc templates, snippets
    └── LICENSE.txt       # Optional
```

The agent’s **workspace root** is the directory you passed to `rays` (your codebase root). The **skill root** is the absolute path to `skills/my-skill/` — use it to reference bundled files:

```bash
python /path/to/project/skills/my-skill/scripts/build.sh
```

---

## SKILL.md format

### Required frontmatter

```markdown
---
name: my-skill
description: One line explaining what this skill does and when the orchestrator should select it.
---

# My Skill

Body: instructions, constraints, examples.
```

| Field | Rules |
|-------|--------|
| `name` | Lowercase identifier; must match the directory name in practice. Max ~64 chars. |
| `description` | Shown to the capability-selection model. Say **what** and **when**, not installation steps. |

Optional frontmatter (convention only; RAYS currently reads `name` and `description`):

```yaml
compatibility: rays
```

If there is no `---` frontmatter, RAYS uses the folder name and the first markdown heading line as the description.

### Writing good descriptions

The selection model only sees `name` + `description` (+ your prompt). Examples:

| Weak | Strong |
|------|--------|
| “Docx skill” | “Create and edit Word .docx files in the workspace using bundled Node scripts and templates.” |
| “Workspace” | “Explore the project directory: list files, read sources, run safe shell commands before external MCP actions.” |

---

## Built-in tools (skill sub-agent)

Every skill sub-agent may use **only** these tools (enforced in code):

| Tool | Purpose |
|------|---------|
| `list_directory(path)` | List entries under workspace root (default `.`). |
| `read_file(path)` | Read a file relative to workspace root. |
| `write_file(path, content)` | Create or overwrite a file under workspace root. |
| `patch_file(path, search, replace)` | Replace first occurrence of `search` with `replace`. |
| `run_shell_command(command)` | Run a shell command with **cwd = workspace root**. |

Rules baked into prompts:

- Do **not** `cd` in commands — cwd is already the workspace root.
- Write outputs (documents, generated code) into the workspace unless the skill says otherwise.
- Reference skill assets by **absolute path** under `skill_root`.

---

## Example: `workspace` skill

The orchestrator often auto-inserts a `workspace` step before MCP when both are needed. If you don’t have one yet, add:

**`skills/workspace/SKILL.md`**

```markdown
---
name: workspace
description: Map the local project — list directories, read key files, and run read-only shell commands before using external MCP tools.
---

# Workspace skill

## Goals
- Understand what files exist in the user's current project directory.
- Read README, config, or user-mentioned paths.
- Do not modify files unless the user explicitly asked for local file changes.

## Typical steps
1. `list_directory` on `.` or paths the user mentioned.
2. `read_file` on README, package manifests, or obvious entry points.
3. Optionally `run_shell_command` for read-only commands (`git status --short`, `ls -la`).

## Output
When done, set `status: completed` with a short `exit_message` listing what you found (paths, relevant file names). No separate summary field.
```

A copy-ready template lives at [`examples/skills/workspace/SKILL.md`](../examples/skills/workspace/SKILL.md).

---

## Example: document skill with scripts

**`skills/docx/SKILL.md`** (simplified)

```markdown
---
name: docx
description: Generate Word .docx documents in the workspace using the bundled docx generator script and markdown source files.
---

# docx skill

## Workflow
1. Ensure source content exists (read from workspace or prior workspace step).
2. Run the generator:
   `node {skill_root}/ai_agents_document.js --input content.md --output report.docx`
   (Use the actual script name from this skill folder.)
3. Confirm the `.docx` file exists under workspace root via `list_directory`.

## Constraints
- Output files must live under the workspace root.
- Do not install npm packages globally; use `skill_root/node_modules` if present.
```

Ship `node_modules` or document `npm install` in the skill body so the sub-agent knows to run it once.

---

## Planner behavior

The planner (`generate_agent_execution_plan` in `config.yaml`) emits steps like:

```json
{
  "step": 1,
  "type": "skill",
  "skill": "workspace",
  "spawn_reason": "Map local project context before external MCP actions"
}
```

It does **not** emit individual tool calls. The skill sub-agent decides those at runtime.

Common patterns:

- **workspace → docx** — gather paths/content, then generate a document.
- **workspace → MCP** — understand repo layout, then drive Blender/browser/API.
- **skill only** — pure local task (organize files, run a project script).

If `workspace` is required but missing from the plan, RAYS **prepends** a workspace step automatically when the skill exists on disk.

---

## Skills-only orchestrator path

`SkillsOrchestrator` (`skills_orchestrator.py`) can still run skills without MCP (legacy/direct path). The **default CLI** uses `AgentOrchestrator`, which combines skills + MCP. Documentation above applies to both; MCP is the extra layer in the default prompt.

---

## Testing a new skill

1. Create `skills/<name>/SKILL.md` in your project.
2. Start RAYS from that project root: `rays` or `rays /path/to/project`.
3. Ask something that clearly needs the skill:
   - workspace: *“What files are in this project?”*
   - docx: *“Turn `content.md` into a Word document in this folder.”*
4. Watch the orchestrator UI: **Plan** → **skill/…** section → `• Listed`, `• Read`, `• Ran` bullets.
5. **Ctrl+T** for full transcript if something went wrong.

---

## Security notes

- `run_shell_command` runs with your user permissions in the workspace directory.
- `write_file` / `patch_file` can change any file under the workspace root the model chooses.
- Use **ask mode** (`/mode ask`) if you want confirmation for risky MCP tools; skill tools do not have a separate confirmation UI today beyond execution mode for MCP.
- Do not put secrets in `SKILL.md`; use environment variables and document them in the skill body.

---

## Packaging skills for others

1. Put the skill under `skills/<name>/` in the repo.
2. Document dependencies (Node, pandoc, etc.) in `SKILL.md`.
3. Add a short note in the project README pointing to the skill.
4. Optional: publish the same folder to `~/.rays/skills/<name>/` for personal reuse across repos.

---

## Configuration knobs (`config.yaml`)

| Key | Default | Meaning |
|-----|---------|---------|
| `skill_subagent_max_turns` | `15` | Max tool loops per skill spawn |
| `skills_orchestrator_prompts` | (bundled) | Prompts for selection, planning, `execute_skill_step`, completion |

Advanced: edit prompts only if you need different selection behavior; normal users only add `SKILL.md` files.

---

## Related

- [MCP_SERVERS.md](./MCP_SERVERS.md) — external tools (Blender, GitHub, …)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — orchestrator overview
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — MCP and CLI issues
