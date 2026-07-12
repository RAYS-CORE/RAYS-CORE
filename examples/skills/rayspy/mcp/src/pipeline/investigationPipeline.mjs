import * as planner from './planner.mjs';
import * as scheduler from './scheduler.mjs';
import * as evidenceManager from '../evidence/evidenceManager.mjs';
import * as verification from './verification.mjs';
import * as report from './report.mjs';
import { assertTransition } from '../session/stateMachine.mjs';
import { log } from '../logging/logger.mjs';
import { LogSource } from '../logging/logSources.mjs';

/**
 * Runs a single round (Figure 2): planner kernel -> scheduler/agent pool
 * -> evidence & knowledge graph -> planner evaluate.
 */
async function runRound(session) {
  session.round += 1;

  const tasks = planner.buildTasks(session);
  session.tasks = tasks;

  const roundFindings = await scheduler.dispatch(session, tasks);

  evidenceManager.collect(session, roundFindings);
  const touched = evidenceManager.dedupeAndPromote(session, roundFindings);
  evidenceManager.deriveClaims(session, touched);
  evidenceManager.formHypotheses(session);

  return planner.evaluate(session, roundFindings);
}

function finalize(session, reason) {
  session.verification = verification.run(session);
  session.report = report.build(session, reason);
  assertTransition(session, 'complete', { reason });
}

/**
 * Drives rounds until the investigation blocks (awaiting_guidance),
 * finishes (complete), or aborts. This is what backs both the initial
 * `start` action and continuing after `guidance` is supplied - the host
 * agent never has to manually step rounds.
 */
export async function runUntilBlocked(session) {
  log(session, LogSource.HOST_BOUNDARY, 'run_started', { investigationId: session.id });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const decision = await runRound(session);

    if (decision.needsGuidance) {
      session.guidanceRequest = decision.guidanceRequest;
      assertTransition(session, 'awaiting_guidance', { reason: decision.reason });
      return session;
    }

    if (!decision.continue) {
      finalize(session, decision.reason);
      return session;
    }
    // else: loop continues automatically into the next round
  }
}

export function resumeWithGuidance(session, guidanceText) {
  session.guidanceContext = [...(session.guidanceContext ?? []), guidanceText];
  session.guidanceRequest = null;
  assertTransition(session, 'running', { reason: 'guidance received, resumes' });
}
