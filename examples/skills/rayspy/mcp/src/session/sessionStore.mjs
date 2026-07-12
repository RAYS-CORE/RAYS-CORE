import { newInvestigationId } from '../utils/ids.mjs';
import { log } from '../logging/logger.mjs';
import { LogSource } from '../logging/logSources.mjs';

/**
 * Everything about an investigation's persisted state, not tied to any
 * single round. This is region 2 of the diagram: "Session store".
 *
 * Locking model: a CAS (compare-and-swap) lock per investigationId.
 * Each session carries a monotonically increasing `version`. A caller
 * must read the session, do work, then attempt to commit with the
 * version it read - if another call already bumped the version (i.e.
 * two rays_investigate calls raced on the same investigationId), the
 * commit is rejected and the caller must retry. In practice, because
 * a single MCP tool call runs the round loop to completion before
 * returning, contention only happens if a host agent fires two calls
 * for the same investigationId concurrently ("worker blocked").
 */
const sessions = new Map();

export function createSession({ query, maxRounds, timeoutMs }) {
  const id = newInvestigationId();
  const now = Date.now();
  const session = {
    id,
    query,
    targetName: query ? query.trim().toLowerCase().replace(/\s+/g, '_') : null,
    status: 'running', // running | awaiting_guidance | complete | aborted
    round: 0,
    maxRounds,
    timeoutMs,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    version: 0,

    entities: [],
    tasks: [],
    taskAssignments: {},
    findings: [],
    evidence: [],
    graph: { nodes: [], edges: [] },
    claims: [],
    hypotheses: [],

    guidanceRequest: null,
    abortReason: null,
    verification: null,
    report: null,

    logs: [],
  };
  sessions.set(id, session);
  log(session, LogSource.SESSION_STORE, 'investigation_opened', { id, query });
  return session;
}

export function getSession(id) {
  const session = sessions.get(id);
  if (!session) return null;
  checkTimeout(session);
  return session;
}

export function listSessions() {
  return Array.from(sessions.keys());
}

/**
 * Acquire the per-session lock, run `fn(session)`, then commit.
 * `fn` may mutate `session` directly (it's the same object reference) -
 * the CAS is a safety net against overlapping calls, not a deep clone
 * mechanism, which keeps this fast for the common single-caller case.
 */
export async function withLock(id, fn) {
  const session = sessions.get(id);
  if (!session) {
    throw new Error(`No such investigation: ${id}`);
  }
  if (session._locked) {
    throw new Error(
      `Investigation ${id} is currently locked by another call (hard lock, worker blocked).`
    );
  }
  session._locked = true;
  const versionAtStart = session.version;
  try {
    checkTimeout(session);
    const result = await fn(session);
    // compare-and-swap: nothing else could have changed session.version
    // while _locked was true, but we check anyway for defense in depth.
    if (session.version !== versionAtStart) {
      throw new Error(`CAS conflict on investigation ${id}`);
    }
    session.version += 1;
    session.updatedAt = Date.now();
    session.lastActivityAt = Date.now();
    return result;
  } finally {
    session._locked = false;
  }
}

function checkTimeout(session) {
  if (session.status !== 'running' && session.status !== 'awaiting_guidance') return;
  const elapsed = Date.now() - session.lastActivityAt;
  if (elapsed > session.timeoutMs) {
    session.status = 'aborted';
    session.abortReason = `timeout after ${elapsed}ms in status (no callback)`;
    log(session, LogSource.SESSION_STORE, 'timeout_detected', {
      elapsedMs: elapsed,
      timeoutMs: session.timeoutMs,
    });
    log(session, LogSource.SESSION_STORE, 'status_transition', {
      to: 'aborted',
      reason: 'timeout',
    });
  }
}

export function transitionStatus(session, to, extra = {}) {
  const from = session.status;
  session.status = to;
  log(session, LogSource.SESSION_STORE, 'status_transition', { from, to, ...extra });
}
