import { log } from '../logging/logger.mjs';
import { LogSource } from '../logging/logSources.mjs';

/** Builds the final report and logs the "ships" event (region 7). */
export function build(session, completionReason) {
  const durationMs = Date.now() - session.createdAt;
  const perTool = {};
  for (const e of session.evidence) {
    perTool[e.tool] = (perTool[e.tool] ?? 0) + 1;
  }

  const report = {
    investigationId: session.id,
    query: session.query,
    completionReason,
    roundsRun: session.round,
    durationMs,
    entityCount: session.entities.length,
    findingCount: session.findings.length,
    evidenceCount: session.evidence.length,
    claimCount: session.claims.length,
    hypothesisCount: session.hypotheses.length,
    evidenceByTool: perTool,
    verification: session.verification,
    hypotheses: session.hypotheses,
    graphSize: { nodes: session.graph.nodes.length, edges: session.graph.edges.length },
  };

  log(session, LogSource.FINAL_STAGE, 'report_shipped', {
    roundsRun: report.roundsRun,
    evidenceCount: report.evidenceCount,
    hypothesisCount: report.hypothesisCount,
  });

  return report;
}
