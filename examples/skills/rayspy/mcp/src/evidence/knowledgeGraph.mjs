import { log } from '../logging/logger.mjs';
import { LogSource } from '../logging/logSources.mjs';

/**
 * Adds nodes/edges for a batch of (already deduped) evidence and
 * returns a snapshot of the graph as it stands after this round.
 */
export function update(session, evidenceBatch) {
  const { nodes, edges } = session.graph;
  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const e of evidenceBatch) {
    if (!nodeIds.has(e.target)) {
      nodes.push({ id: e.target, kind: 'target', label: e.target });
      nodeIds.add(e.target);
    }
    if (!nodeIds.has(e.id)) {
      nodes.push({ id: e.id, kind: 'evidence', label: e.summary, tool: e.tool, agent: e.agent });
      nodeIds.add(e.id);
    }
    edges.push({ from: e.target, to: e.id, relation: e.relationship ? 'relates_to' : 'evidence_for' });
  }

  log(session, LogSource.EVIDENCE_GRAPH, 'graph_updated', {
    round: session.round,
    nodesAdded: evidenceBatch.length * 2, // upper bound; target nodes may be shared
    totalNodes: nodes.length,
    totalEdges: edges.length,
  });

  return { nodes: [...nodes], edges: [...edges] };
}
