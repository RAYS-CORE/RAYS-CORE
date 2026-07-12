import { newTaskId } from '../utils/ids.mjs';
import { runConcurrentAgents, runTimeline } from '../agents/agentPool.mjs';
import { logDispatch } from './planner.mjs';

/**
 * Scheduler - dispatches this round's tasks to the OSINT agent pool.
 * Entity/image/geo/network run concurrently (they're independent tool
 * calls); timeline runs last since it synthesizes from their output.
 */
export async function dispatch(session, tasks) {
  logDispatch(session, tasks);

  const concurrentFindings = await runConcurrentAgents(session, tasks);

  const timelineTask = { id: newTaskId(), type: 'timeline', target: session.query };
  const timelineFindings = await runTimeline(session, timelineTask, concurrentFindings);

  return [...concurrentFindings, ...timelineFindings];
}
