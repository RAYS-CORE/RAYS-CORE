/**
 * The 7 log-source regions from the architecture diagram (Figure 4).
 * Every log line emitted anywhere in the pipeline is tagged with exactly
 * one of these, so the dashboard "log window" can group/filter by region
 * without needing to know about individual modules.
 */
export const LogSource = Object.freeze({
  HOST_BOUNDARY: 'host_boundary',       // 1. moment a call crosses into rays_investigate
  SESSION_STORE: 'session_store',       // 2. investigation lifecycle + status transitions
  PLANNING_DISPATCH: 'planning_dispatch', // 3. planner (kernel) + scheduler, once per round
  OSINT_AGENT_POOL: 'osint_agent_pool', // 4. per-tool hits/status/duration, once per tool call
  EVIDENCE_GRAPH: 'evidence_graph',     // 5. evidence manager + knowledge graph, once per round
  PLANNER_EVALUATE: 'planner_evaluate', // 6. completeness assessment + continue/stop decision
  FINAL_STAGE: 'final_stage',           // 7. verification + final report, once per investigation
});

export const ALL_LOG_SOURCES = Object.values(LogSource);
