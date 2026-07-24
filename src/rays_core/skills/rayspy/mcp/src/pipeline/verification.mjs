import { log } from '../logging/logger.mjs';
import { LogSource } from '../logging/logSources.mjs';

const LOW_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Verification agent - runs once, after the round loop exits with
 * "no more evidence needed". Flags low-confidence evidence, checks
 * for orphaned claims (claim referencing evidence no longer present),
 * and computes an overall confidence score for the investigation.
 */
export function run(session) {
  const corrections = [];

  const lowConfidence = session.evidence.filter((e) => e.confidence < LOW_CONFIDENCE_THRESHOLD);
  for (const e of lowConfidence) {
    corrections.push({ type: 'low_confidence', evidenceId: e.id, confidence: e.confidence });
  }

  const evidenceIds = new Set(session.evidence.map((e) => e.id));
  const orphanedClaims = session.claims.filter(
    (c) => !c.evidenceIds.every((id) => evidenceIds.has(id))
  );
  for (const c of orphanedClaims) {
    corrections.push({ type: 'orphaned_claim', claimId: c.id });
  }

  const overallConfidence = session.evidence.length
    ? session.evidence.reduce((sum, e) => sum + e.confidence, 0) / session.evidence.length
    : 0;

  const result = {
    checkedEvidenceCount: session.evidence.length,
    checkedClaimCount: session.claims.length,
    corrections,
    overallConfidence: Math.round(overallConfidence * 100) / 100,
  };

  log(session, LogSource.FINAL_STAGE, 'verification_complete', result);
  return result;
}
