import { ALL_LOG_SOURCES } from './logSources.mjs';
import { formatLogEntry } from './logFormatter.mjs';

/**
 * IMPORTANT: this is an MCP stdio server. stdout is reserved for the
 * JSON-RPC transport - never console.log() here. All human-readable
 * output goes to stderr; structured entries also get appended to the
 * investigation's own log array so the "dashboard > log window" can
 * show them back to the host agent via the `status` action.
 *
 * Every entry also carries a `paragraph` field - a single labeled,
 * human-readable line naming the exact pipeline component the log came
 * from (see logFormatter.mjs). This is what gets printed to stderr for
 * any cmd-connected host (Claude Desktop, Cursor, an Ollama-based MCP
 * client, etc.), and it's also what the dashboard's "run" tab log
 * window renders per entry, so both surfaces show identical formatting.
 */
export function log(session, source, event, payload = {}) {
  if (!ALL_LOG_SOURCES.includes(source)) {
    throw new Error(`Unknown log source: ${source}`);
  }
  const entry = {
    ts: new Date().toISOString(),
    round: session?.round ?? null,
    source,
    event,
    payload,
  };
  entry.paragraph = formatLogEntry(entry);
  if (session) {
    session.logs.push(entry);
  }
  process.stderr.write(`[rays_investigate] ${entry.paragraph}\n`);
  return entry;
}
