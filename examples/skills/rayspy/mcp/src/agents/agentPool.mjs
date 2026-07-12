import { runEntityAgent } from './entityAgent.mjs';
import { runImageAgent } from './imageAgent.mjs';
import { runGeoAgent } from './geoAgent.mjs';
import { runNetworkAgent } from './networkAgent.mjs';
import { runTimelineAgent } from './timelineAgent.mjs';
import { runSocialAgent } from './socialAgent.mjs';

/**
 * Adapter layer: maps a task's `type` to the agent that handles it.
 * Swapping an agent implementation (or adding a new specialist) never
 * touches the scheduler or the pipeline - just register/replace an
 * entry here.
 */
const AGENTS = {
  entity: runEntityAgent,
  image: runImageAgent,
  geo: runGeoAgent,
  network: runNetworkAgent,
  social: runSocialAgent,
  // timeline is intentionally excluded here - it runs after the others
  // (see investigationPipeline.mjs) because it depends on their output.
};

/** Runs the concurrent, tool-calling agents (everything except timeline). */
export async function runConcurrentAgents(session, tasks) {
  const runnable = tasks.filter((t) => t.type in AGENTS);
  const results = await Promise.all(
    runnable.map((task) => AGENTS[task.type](session, task))
  );
  return results.flat();
}

export async function runTimeline(session, task, roundFindings) {
  return runTimelineAgent(session, task, roundFindings);
}

export const AGENT_TYPES = Object.freeze([...Object.keys(AGENTS), 'timeline']);
