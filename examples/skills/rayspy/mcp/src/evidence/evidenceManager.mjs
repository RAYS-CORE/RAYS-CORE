import { log } from '../logging/logger.mjs';
import { LogSource } from '../logging/logSources.mjs';
import * as knowledgeGraph from './knowledgeGraph.mjs';

const CLAIM_CONFIDENCE_THRESHOLD = 0.6;

/** Raw findings collected this round, appended to session.findings untouched. */
export function collect(session, rawFindings) {
  session.findings.push(...rawFindings);
  log(session, LogSource.EVIDENCE_GRAPH, 'raw_findings_collected', {
    round: session.round,
    count: rawFindings.length,
  });
  return rawFindings;
}

/**
 * Dedupe by evidence id (same tool hit can validly show up again if a
 * later round re-queries the same target), promoting confidence when a
 * duplicate is seen more than once, then merges into session.evidence.
 * Returns just the batch that was newly added/updated this round.
 */
export function dedupeAndPromote(session, rawFindings) {
  const byId = new Map(session.evidence.map((e) => [e.id, e]));
  const touched = [];

  for (const f of rawFindings) {
    const existing = byId.get(f.id);
    if (existing) {
      existing.confidence = Math.min(0.99, existing.confidence + 0.05);
      existing.seenCount = (existing.seenCount ?? 1) + 1;
      touched.push(existing);
    } else {
      const promoted = { ...f, seenCount: 1 };
      byId.set(f.id, promoted);
      touched.push(promoted);
    }
  }

  session.evidence = [...byId.values()];

  log(session, LogSource.EVIDENCE_GRAPH, 'evidence_deduped_promoted', {
    round: session.round,
    newOrUpdated: touched.length,
    totalEvidence: session.evidence.length,
  });

  knowledgeGraph.update(session, touched);
  return touched;
}

/** Evidence above the confidence threshold becomes a "claim". */
export function deriveClaims(session, evidenceBatch) {
  const newClaims = evidenceBatch
    .filter((e) => e.confidence >= CLAIM_CONFIDENCE_THRESHOLD)
    .map((e) => ({
      id: `claim_${e.id}`,
      statement: `${e.agent} evidence suggests: ${e.summary}`,
      confidence: e.confidence,
      evidenceIds: [e.id],
      target: e.target,
    }));

  const existingIds = new Set(session.claims.map((c) => c.id));
  const added = newClaims.filter((c) => !existingIds.has(c.id));
  session.claims.push(...added);

  log(session, LogSource.EVIDENCE_GRAPH, 'claims_derived', {
    round: session.round,
    added: added.length,
    totalClaims: session.claims.length,
  });

  return added;
}

/** Groups claims by target into a hypothesis with an aggregate confidence. */
export function formHypotheses(session) {
  const byTarget = new Map();
  for (const c of session.claims) {
    if (!byTarget.has(c.target)) byTarget.set(c.target, []);
    byTarget.get(c.target).push(c);
  }

  session.hypotheses = [...byTarget.entries()].map(([target, claims]) => ({
    id: `hyp_${target}`,
    target,
    claimIds: claims.map((c) => c.id),
    confidence: claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length,
  }));

  log(session, LogSource.EVIDENCE_GRAPH, 'hypotheses_formed', {
    round: session.round,
    totalHypotheses: session.hypotheses.length,
  });

  return session.hypotheses;
}
