import { transitionStatus } from './sessionStore.mjs';

/**
 * Figure 1 - State Machine:
 *
 *   running --(decision reached, needs guidance)--> awaiting_guidance
 *   awaiting_guidance --(guidance received)--> running (resumes)
 *   running --(all rounds done)--> complete
 *   running/awaiting_guidance --(timeout, aborts)--> aborted
 *
 * This module only enforces legal transitions; the pipeline decides
 * *when* a transition should happen.
 */

const TRANSITIONS = {
  running: new Set(['running', 'awaiting_guidance', 'complete', 'aborted']),
  awaiting_guidance: new Set(['running', 'aborted']),
  complete: new Set([]), // terminal
  aborted: new Set([]),  // terminal
};

export function canTransition(from, to) {
  return TRANSITIONS[from]?.has(to) ?? false;
}

export function assertTransition(session, to, extra = {}) {
  if (!canTransition(session.status, to)) {
    throw new Error(
      `Illegal state transition for investigation ${session.id}: ${session.status} -> ${to}`
    );
  }
  transitionStatus(session, to, extra);
}

export function isTerminal(status) {
  return status === 'complete' || status === 'aborted';
}
