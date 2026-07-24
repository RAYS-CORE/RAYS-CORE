/**
 * Turns a raw { ts, round, source, event, payload } log entry into a single
 * human-readable paragraph, labeled with the pipeline component it came
 * from (Figure 4's 7 log-source regions, refined down to the individual
 * agent/tool when the entry is from the OSINT agent pool).
 *
 * Used in two places:
 *   1. logger.mjs writes this paragraph to stderr instead of a raw JSON
 *      dump, so any cmd-connected host (Claude Desktop, Cursor, an
 *      Ollama-based MCP client, etc.) gets organized, labeled output.
 *   2. The dashboard's "run" tab log window renders this same paragraph
 *      per entry (via the `paragraph` field on entries returned by the
 *      `status` action), so cmd and dashboard show identical formatting.
 */

const COMPONENT_LABELS = {
  host_boundary: 'Host Boundary (rays_investigate entrypoint)',
  session_store: 'Session Store (investigation lifecycle)',
  planning_dispatch: 'Planning & Dispatch (Planner kernel + Scheduler)',
  osint_agent_pool: 'OSINT Agent Pool',
  evidence_graph: 'Evidence & Knowledge Graph',
  planner_evaluate: 'Planner (Evaluate)',
  final_stage: 'Final Stage (Verification + Report)',
};

/** Readable one-line rendering of a payload value; long arrays get summarized. */
function humanizeValue(value) {
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function humanizePayload(payload) {
  const entries = Object.entries(payload || {});
  if (!entries.length) return 'no additional details.';
  return entries.map(([key, value]) => `${key}: ${humanizeValue(value)}`).join(', ') + '.';
}

/** The specific component within a region, e.g. "entity agent (spiderfoot)". */
function componentLabel(entry) {
  const base = COMPONENT_LABELS[entry.source] || entry.source;
  if (entry.source === 'osint_agent_pool' && entry.payload?.agent) {
    const tool = entry.payload.tool ? ` (${entry.payload.tool})` : '';
    return `${base} \u2192 ${entry.payload.agent} agent${tool}`;
  }
  return base;
}

/** Formats one log entry as a single labeled paragraph. */
export function formatLogEntry(entry) {
  const roundLabel = entry.round === null || entry.round === undefined ? 'pre-round' : `round ${entry.round}`;
  return (
    `[${entry.ts}] [${roundLabel}] ` +
    `Source: ${componentLabel(entry)} | ` +
    `Event: ${entry.event} | ` +
    `Details: ${humanizePayload(entry.payload)}`
  );
}
