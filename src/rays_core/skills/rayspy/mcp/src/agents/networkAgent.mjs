import * as spiderfoot from '../tools/spiderfoot.mjs';
import * as sherlock from '../tools/sherlock.mjs';
import { log } from '../logging/logger.mjs';
import { LogSource } from '../logging/logSources.mjs';

/**
 * Network agent: SpiderFoot + Sherlock, but in "relationships" mode -
 * looking for connections between the target and other entities already
 * in the graph, rather than raw identity hits.
 */
export async function runNetworkAgent(session, task) {
  const { target } = task;
  const results = await Promise.all([
    spiderfoot.run(target, { mode: 'network' }),
    sherlock.run(target, { mode: 'network' }),
  ]);

  for (const r of results) {
    log(session, LogSource.OSINT_AGENT_POOL, 'tool_call', {
      agent: 'network',
      tool: r.tool,
      target: r.target,
      status: r.status,
      durationMs: r.durationMs,
      hitCount: r.hits.length,
    });
  }

  // Only tag spiderfoot hits as "relationships" — they can connect
  // different entities (email → domain, handle → email, etc.).  Sherlock
  // checks a single username across many sites, which is the *same*
  // entity, not a cross-entity relationship.  Tagging sherlock hits as
  // relationships was causing the planner to treat internal sherlock
  // result IDs (sherlock_12345) as newly discovered entities and
  // recursively investigate them — chasing its own tail.
  return results.flatMap((r) => {
    const isRelationship = r.tool === 'spiderfoot';
    return r.hits.map((hit) => ({
      ...hit, agent: 'network', taskId: task.id, target,
      relationship: isRelationship,
    }));
  });
}
