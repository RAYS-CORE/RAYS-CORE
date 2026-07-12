import { newTaskId } from '../utils/ids.mjs';
import { log } from '../logging/logger.mjs';
import { LogSource } from '../logging/logSources.mjs';

const EMAIL_RE = /\S+@\S+\.\S+/;
const COORD_RE = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
const COORD_SCAN_RE = /-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?/g;
const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;
const NAME_RE = /^(?:Profile|Person|Find|Search|Lookup):\s+.+/i;
const PERSON_NAME_RE = /^[A-Z][a-z]+\s+[A-Z][a-z]+/;

function classify(token) {
  if (COORD_RE.test(token)) return ['geo'];
  if (IMAGE_RE.test(token)) return ['image'];
  if (EMAIL_RE.test(token)) return ['entity'];
  // Person names (e.g. "John Doe", "Profile: John Doe") get the social
  // agent which searches social media platforms by name and cross-matches
  // face embeddings to identify the real person behind the name.
  if (NAME_RE.test(token) || PERSON_NAME_RE.test(token)) {
    return ['social', 'entity'];
  }
  return ['entity', 'network'];
}

/** Extracts candidate entities from the free-text query (stub NLP). */
function extractEntities(query) {
  // Strip leading "Profile:" / "Person:" / "Find:" / "Search:" / "Lookup:" prefix
  const cleaned = query.replace(/^(?:Profile|Person|Find|Search|Lookup):\s*/i, '').trim();

  // Pull out "lat,lon" coordinate pairs first so the comma inside them
  // survives - otherwise the generic comma split below would shred a
  // coordinate pair into two bare numbers before COORD_RE ever saw it,
  // and it would fall through to ['entity', 'network'] instead of ['geo'].
  const coordTokens = [];
  const remainder = cleaned.replace(COORD_SCAN_RE, (match) => {
    coordTokens.push(match.trim());
    return '\u0000';
  });

  const rest = remainder
    .split(/[,\n]| and /i)
    .map((t) => t.trim())
    .filter((t) => Boolean(t) && t !== '\u0000');

  return [...coordTokens, ...rest];
}

/**
 * Planner (kernel) - Figure 2, region 3a. Builds the task list for
 * the current round. Round 1 tasks come from the query itself; later
 * rounds come from new leads surfaced by planner.evaluate() in the
 * previous round (session._pendingTargets).
 */
export function buildTasks(session) {
  let targets;
  if (session.round === 1) {
    targets = extractEntities(session.query).map((t) => ({ target: t, types: classify(t) }));
  } else {
    targets = session._pendingTargets ?? [];
  }

  for (const t of targets) {
    if (!session.entities.some((e) => e.target === t.target)) {
      session.entities.push({ target: t.target, types: t.types, discoveredRound: session.round });
    }
  }

  const tasks = targets.flatMap(({ target, types }) =>
    types.map((type) => ({ id: newTaskId(), type, target }))
  );

  log(session, LogSource.PLANNING_DISPATCH, 'tasks_built', {
    round: session.round,
    taskCount: tasks.length,
    resolvedEntityCount: session.entities.length,
  });

  return tasks;
}

/** Region 3b log helper - the actual dispatch/assignment mapping. */
export function logDispatch(session, tasks) {
  const assignments = Object.fromEntries(tasks.map((t) => [t.id, { type: t.type, target: t.target }]));
  session.taskAssignments = assignments;
  log(session, LogSource.PLANNING_DISPATCH, 'tasks_dispatched', {
    round: session.round,
    assignments,
  });
}

const MAX_NEW_TARGETS_PER_ROUND = 5;
const AMBIGUITY_ENTITY_THRESHOLD = 4;

/**
 * Planner (evaluate) - Figure 2, region 6. Decides whether the
 * investigation has enough evidence, needs another round, or needs
 * host guidance before continuing.
 */
export function evaluate(session, roundFindings) {
  // Too many distinct candidate identities resolved on round 1 -> ask the
  // host agent to narrow things down before burning more tool calls.
  if (session.round === 1 && session.entities.length > AMBIGUITY_ENTITY_THRESHOLD) {
    const reasoning = `Round 1 resolved ${session.entities.length} distinct candidate entities ` +
      `(threshold ${AMBIGUITY_ENTITY_THRESHOLD}). Too ambiguous to continue automatically.`;
    log(session, LogSource.PLANNER_EVALUATE, 'decision', {
      decision: 'needs_guidance',
      reasoning,
    });
    return {
      continue: false,
      needsGuidance: true,
      reason: reasoning,
      guidanceRequest: {
        question: 'Multiple candidate identities were found. Which should I prioritize?',
        candidates: session.entities.map((e) => e.target),
      },
    };
  }

  if (session.round >= session.maxRounds) {
    const reasoning = `Reached maxRounds (${session.maxRounds}).`;
    log(session, LogSource.PLANNER_EVALUATE, 'decision', { decision: 'complete', reasoning });
    return { continue: false, needsGuidance: false, reason: reasoning };
  }

  if (roundFindings.length === 0) {
    const reasoning = 'No new findings this round.';
    log(session, LogSource.PLANNER_EVALUATE, 'decision', { decision: 'complete', reasoning });
    return { continue: false, needsGuidance: false, reason: reasoning };
  }

  // New leads: relationship hits from the network agent that point at a
  // target we haven't already resolved as an entity.  Internal tool IDs
  // (sherlock_12345, timeline_678, claim_abc, hyp_xyz) are rejected
  // because they are not real usernames / handles / domains — they are
  // artifact hashes that would cause the pipeline to chase its own tail.
  const TOOL_ID_RE = /^(sherlock|timeline|claim|hyp)_/;
  const knownTargets = new Set(session.entities.map((e) => e.target));
  const newLeadTargets = [
    ...new Set(
      roundFindings
        .filter((f) => f.relationship && f.url && !TOOL_ID_RE.test(f.summary))
        .map((f) => f.summary)
    ),
  ].slice(0, MAX_NEW_TARGETS_PER_ROUND);

  if (newLeadTargets.length === 0) {
    const reasoning = 'No new relationship leads to follow up on.';
    log(session, LogSource.PLANNER_EVALUATE, 'decision', { decision: 'complete', reasoning });
    return { continue: false, needsGuidance: false, reason: reasoning };
  }

  session._pendingTargets = newLeadTargets.map((t) => ({ target: t, types: ['entity', 'network'] }));
  const reasoning = `Found ${newLeadTargets.length} new relationship lead(s) to investigate.`;
  log(session, LogSource.PLANNER_EVALUATE, 'decision', {
    decision: 'continue',
    reasoning,
    newTasks: session._pendingTargets.length,
  });
  return { continue: true, needsGuidance: false, reason: reasoning };
}
