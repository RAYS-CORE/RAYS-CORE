import * as overpassTurbo from '../tools/overpassTurbo.mjs';
import { log } from '../logging/logger.mjs';
import { LogSource } from '../logging/logSources.mjs';

/**
 * Geo agent: Overpass Turbo lat/lon queries for a location-shaped target.
 */
export async function runGeoAgent(session, task) {
  const { target } = task;
  const r = await overpassTurbo.run(target);

  log(session, LogSource.OSINT_AGENT_POOL, 'tool_call', {
    agent: 'geo',
    tool: r.tool,
    target: r.target,
    status: r.status,
    durationMs: r.durationMs,
    hitCount: r.hits.length,
  });

  return r.hits.map((hit) => ({ ...hit, agent: 'geo', taskId: task.id, target }));
}
