# RAYSpy Investigation Pipeline (MCP)

A standalone MCP server exposing **one tool**, `rays_investigate`, that runs a
multi-agent OSINT investigation pipeline. Any host agent (Cursor, Claude
Desktop, etc.) calls this single action-routed tool; the pipeline runs
rounds automatically until it completes, needs guidance, or aborts.

This package is new - it does not touch the existing RAYSpy Cesium
frontend. It lives at `mcp/` so it can be developed, versioned, and run
independently of the Vite app.

## Quick start

```bash
cd mcp
npm install
npm test      # runs the smoke test (no MCP transport needed)
npm start     # starts the actual MCP server on stdio
```

To connect it from an MCP host (e.g. Claude Desktop / Cursor), point your
MCP config at:

```json
{
  "mcpServers": {
    "rayspy-investigate": {
      "command": "node",
      "args": ["/absolute/path/to/RAYSpy-main/mcp/src/index.mjs"]
    }
  }
}
```

### Connecting from any other MCP-capable model (Ollama, LangChain, raw MCP clients, etc.)

`mcp/src/index.mjs` is a standard MCP server on the stdio transport
(`@modelcontextprotocol/sdk`'s `StdioServerTransport`) — it isn't special-cased
for Claude or Cursor. **Any** client that speaks MCP over stdio can connect
the same way: spawn `node /absolute/path/to/mcp/src/index.mjs` as a
subprocess and talk JSON-RPC over its stdin/stdout. That includes:

- **Ollama-based agents** — most Ollama tool-calling setups go through an
  MCP-client shim (e.g. `mcp` Python package, `ollama-mcp-bridge`, or a
  LangChain/LlamaIndex MCP adapter). Point whichever bridge you're using at
  the same `command`/`args` shown above; from its perspective this server
  is indistinguishable from any other stdio MCP server.
- **A raw MCP client script** (Python `mcp` SDK, TypeScript `@modelcontextprotocol/sdk`
  client, etc.) — connect a `StdioClientTransport`/`ClientSession` to
  `node mcp/src/index.mjs` and call `rays_investigate` like any other tool.
- **Claude Code / Cursor / Claude Desktop** — same `mcpServers` config block
  above.

No code changes are needed per-client; the tool schema (`action`, `query`,
`investigationId`, `guidance`, `maxRounds`, `timeoutMs`) is host-agnostic.

### Log output when connected via cmd

Every log line written to stderr (visible to whichever terminal spawned the
process, or captured by your MCP client's logging) is a single labeled
paragraph, e.g.:

```
[rays_investigate] [2026-07-07T05:36:38.683Z] [round 1] Source: OSINT Agent Pool → geo agent (overpass_turbo) | Event: tool_call | Details: agent: geo, tool: overpass_turbo, target: 40.7128,-74.0060, status: ok, durationMs: 265, hitCount: 4.
```

Each paragraph names the exact pipeline component the log came from (see
`logging/logFormatter.mjs`) — one of the 7 regions in Figure 4, refined down
to the specific agent + tool for OSINT calls. The same `paragraph` string is
also attached to every entry returned by `action: 'status'`, so any surface
reading the logs (a host agent, this README's dashboard bridge below, etc.)
gets identical formatting.

## The tool

`rays_investigate` takes an `action` and routes to one of four flows:

| action     | required args                  | what it does |
|------------|---------------------------------|--------------|
| `start`    | `query`                        | Opens a new investigation, runs rounds until blocked |
| `guidance` | `investigationId`, `guidance`  | Answers a pending question, resumes rounds |
| `status`   | `investigationId`               | Returns current state + full log window |
| `abort`    | `investigationId`               | Cancels a running/awaiting investigation |

Optional on `start`: `maxRounds` (default 4), `timeoutMs` (default 5 min).

## Architecture, mapped to the diagram

```
mcp/src/
  index.mjs                    <- MCP server entry (stdio transport)
  mcpTool.mjs                  <- single tool schema + action router (host agent <-> rays_investigate)

  session/
    sessionStore.mjs           <- Figure "State Machine" region 2: session store, CAS lock per investigation
    stateMachine.mjs           <- Figure 1: running / awaiting_guidance / complete / aborted transitions

  pipeline/
    planner.mjs                <- region 3a (kernel: builds task list) + region 6 (evaluate: continue/guidance/stop)
    scheduler.mjs               <- region 3b: dispatches tasks to the agent pool
    investigationPipeline.mjs  <- Figure 2 "Each Round" loop + re-dispatch loop, wires everything together
    verification.mjs           <- region 7: checks, confidence scoring, corrections
    report.mjs                 <- region 7: summary stats, ships (flips session to `complete`)

  agents/
    agentPool.mjs               <- Figure 3: adapter layer, swap agents freely
    entityAgent.mjs             <- SpiderFoot, Sherlock, Holehe, SERP
    imageAgent.mjs               <- InsightFace, Epieos
    geoAgent.mjs                  <- Overpass Turbo
    networkAgent.mjs             <- SpiderFoot + Sherlock, relationship mode
    timelineAgent.mjs            <- no external tool; synthesizes from evidence timestamps

  evidence/
    evidenceManager.mjs         <- region 5: raw findings -> dedup/promote -> claims -> hypotheses
    knowledgeGraph.mjs          <- region 5: nodes/edges + graph snapshot

  tools/                        <- one file per OSINT tool; ALL STUBS right now (see below)
  logging/
    logSources.mjs              <- the 7 log-source regions from Figure 4
    logger.mjs                  <- structured logger -> session.logs (never console.log; stdout is the MCP transport)
```

### State machine (Figure 1)

```
running --(decision reached, needs guidance)--> awaiting_guidance --(guidance received)--> running
running --(all rounds done)--> complete
running / awaiting_guidance --(timeout)--> aborted   ("no callback")
```

Enforced in `session/stateMachine.mjs`; `sessionStore.withLock()` provides
the "hard lock, worker blocked" behavior - only one `rays_investigate`
call can be actively mutating a given investigation at a time.

### Round loop (Figure 2)

Each round, in order:
1. **Planner (kernel)** - builds this round's task list (`planner.buildTasks`)
2. **Scheduler** - dispatches tasks to the OSINT agent pool (`scheduler.dispatch`)
3. **OSINT agent pool** - entity/image/geo/network run concurrently, timeline runs last (depends on their output)
4. **Evidence & knowledge graph** - collect -> dedupe/promote -> derive claims -> form hypotheses
5. **Planner (evaluate)** - decides `complete` / `continue` (re-dispatch loop) / `needs_guidance`

If `needs_guidance`, the loop stops and the session sits in
`awaiting_guidance` until a `guidance` call resumes it. Otherwise it keeps
looping automatically - the host agent never manually steps rounds.

### Log taxonomy (Figure 4)

Every log line is tagged with one of 7 regions (`logging/logSources.mjs`):
`host_boundary`, `session_store`, `planning_dispatch`, `osint_agent_pool`,
`evidence_graph`, `planner_evaluate`, `final_stage`. `status` returns the
full list so a dashboard "log window" can filter/group by region without
knowing about individual modules.

## Current state: 5 of 7 tools are real, 2 are stubs

`src/tools/` is a generic, single-target lookup layer (domain/email/
username/coordinate → hits) - never bound to a specific named person or
harvest workflow. That's a deliberate scope boundary, not an oversight:
see "Scope boundary" below.

**Real, wired to actual CLIs/APIs:**
- **spiderfoot.mjs** - shells out to `sf.py` in a SpiderFoot checkout. Requires `SPIDERFOOT_SF_PY` (absolute path to `sf.py`) in `.env`; module set per target type is conservative by default (override with `SPIDERFOOT_MODULES`).
- **sherlock.mjs** - shells out to the real `sherlock` CLI (`pip install sherlock-project`). Parses found-account URLs from stdout.
- **holehe.mjs** - shells out to the real `holehe` CLI (`pip install holehe`). Parses `[+] domain` lines from stdout (verified against live output - the tool also prints a legend line that starts with `[+]`, which the parser deliberately excludes).
- **serp.mjs** - real web search via DuckDuckGo's no-JS "lite" endpoint (no API key needed). Set `SERP_API_KEY` + fill in the marked `TODO` to swap in a hosted provider (SerpAPI, Brave Search API) instead.
- **overpassTurbo.mjs** - real POST to `https://overpass-api.de/api/interpreter` (the exact same endpoint `src/providers/OSMProvider.js` in the main RAYSpy frontend already talks to) - looks up named landmarks/POIs within a radius of a `lat,lon` target.

**Still stubs (deliberately, not yet):**
- **insightface.mjs**, **epieos.mjs** - identity/face-matching tools. Left mocked; see "Scope boundary."

### Test mode

Every real adapter checks `process.env.OSINT_MOCK === '1'` at call time and
returns fast, deterministic stub data instead of doing real work when it's
set. `npm test` sets this automatically so the smoke test stays offline and
fast (~2s instead of minutes of live network calls). Unset (or `0`) means
real calls - that's the default for `npm start`.

### Setup for real calls

```bash
cp .env.example .env
# fill in SPIDERFOOT_SF_PY at minimum; sherlock/holehe just need the
# CLIs on PATH (pip install sherlock-project holehe); overpass/serp
# need no keys by default.
```

Swapping any adapter for a different backend only requires changing that
one file's `run()` body - it must keep returning
`{ tool, target, status, durationMs, hits }`. Nothing in `agents/`,
`pipeline/`, or `evidence/` needs to change.

### Scope boundary (read before extending this)

This package intentionally stops at generic, single-target OSINT lookups.
It does **not** include, and won't be extended to include: browser
automation that scrapes a named person's social media accounts, face
verification that ties scraped photos to a reference image of a real
person, follower/following graph building, or photo-based location
inference compiled into a dossier. That combination of capabilities is a
stalking/surveillance tool regardless of framing, and building it isn't
something this project takes on - independent of what any particular
caller's stated intent is, since nothing here can verify consent or
authorization. If you're looking at extending `insightface.mjs` /
`epieos.mjs` beyond a generic per-target lookup, that's the line.

## Known scaffold-level simplifications

These are acceptable for a first pass but worth knowing about:

- **Entity extraction is a stub heuristic** (`planner.js`'s `classify`/`extractEntities`):
  splits on commas/`and`, classifies by regex (email, coordinate pair,
  image URL, else generic). Real entity resolution (NER, alias merging)
  is a later upgrade.
- **"New relationship leads"** in `planner.evaluate` currently treat a
  network-agent hit's mock `id` as a new target for the next round. With
  real tools this becomes genuine entity extraction from relationship
  data (e.g. a discovered handle/email), but the round-loop mechanics
  (planner evaluate -> new tasks -> re-dispatch) don't change.
- **Evidence IDs from stub tools can collide across agents** when the
  same target is queried by both the entity and network agents (both
  call spiderfoot/sherlock) - the dedupe logic treats this as a genuine
  duplicate and promotes confidence, which is the correct dedupe
  *behavior*, just worth knowing the stub data can trigger it more than
  real tool output would.
- **Guidance ambiguity trigger** is a simple threshold (more than 4
  distinct entities resolved on round 1) rather than genuine confidence-
  based ambiguity detection - easy to replace once real tools produce
  meaningfully varying confidence scores.
- **In-memory session store only** - restarting the process loses all
  investigations. Fine for a single long-lived MCP server process; add
  a persistence layer (SQLite/file) before running this in anything
  that gets restarted mid-investigation.

## Testing

`test/smoke.mjs` calls the tool handler directly (no MCP transport
needed) and actually runs full investigations end-to-end:
- normal completion (asserts all 7 log regions appear, a report exists)
- the guidance flow (deliberately triggers `awaiting_guidance`, resumes it)
- abort
- basic error paths (missing args, unknown investigation id)

Run with `npm test`. This is a genuine correctness check, not a syntax
check - it exercises the real round loop, dedup, claim/hypothesis
formation, and state transitions with the stub tools.

## Dashboard "RUN" tab (browser, no separate host agent needed)

The Cesium dashboard (`src/worldview/ui.js`) has a fourth tab next to
OPS/INTEL/ASSETS called **RUN**, with:
- a target input + max-rounds field + **run investigation** button, and
- a log window that renders every log entry as its own labeled paragraph
  (same `paragraph` text described above).

This doesn't spawn a second copy of the pipeline - it's a plain HTTP bridge.
`proxy-server.mjs` (already running as part of `npm run dev`) imports
`mcp/src/mcpTool.mjs`'s `handle()` directly and exposes it as:

| route                              | mirrors MCP action |
|-------------------------------------|---------------------|
| `POST /rayspy-mcp/start`            | `start`             |
| `GET  /rayspy-mcp/status?investigationId=` | `status`     |
| `POST /rayspy-mcp/guidance`         | `guidance`          |
| `POST /rayspy-mcp/abort`            | `abort`             |

Clicking **run investigation** calls `/rayspy-mcp/start`, then polls
`/rayspy-mcp/status` until the investigation reaches a terminal state
(`complete`, `aborted`, or `awaiting_guidance`), rendering the log window
from `data.logs` each time. It's the exact same `rays_investigate` tool a
cmd-connected host agent would call - just triggered by a button instead of
a model, and displayed in the browser instead of a terminal.

By default the dashboard's runs use mock OSINT data (`OSINT_MOCK=1`, set
automatically by `proxy-server.mjs` unless you override it), so **RUN**
works with no external tools installed. Set `OSINT_MOCK=0` in your shell
before `npm run dev` if you want it to shell out to real tools instead.
