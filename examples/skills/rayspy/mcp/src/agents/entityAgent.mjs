import * as spiderfoot from '../tools/spiderfoot.mjs';
import * as sherlock from '../tools/sherlock.mjs';
import * as holehe from '../tools/holehe.mjs';
import * as serp from '../tools/serp.mjs';
import { log } from '../logging/logger.mjs';
import { LogSource } from '../logging/logSources.mjs';

/**
 * Entity agent: SpiderFoot, Sherlock, Holehe, SERP.
 * Runs the general-purpose "who/what is this" tools for a resolved entity.
 */
export async function runEntityAgent(session, task) {
  const { target } = task;
  const calls = [
    spiderfoot.run(target, { mode: 'entity' }),
    sherlock.run(target, { mode: 'entity' }),
    serp.run(target),
  ];
  // holehe is email-specific; only call it when the target looks like an email
  const looksLikeEmail = /\S+@\S+\.\S+/.test(target);
  if (looksLikeEmail) calls.push(holehe.run(target));

  const results = await Promise.all(calls);
  for (const r of results) {
    log(session, LogSource.OSINT_AGENT_POOL, 'tool_call', {
      agent: 'entity',
      tool: r.tool,
      target: r.target,
      status: r.status,
      durationMs: r.durationMs,
      hitCount: r.hits.length,
    });
  }

  return results.flatMap((r) =>
    r.hits.map((hit) => ({ ...hit, agent: 'entity', taskId: task.id, target }))
  );
}
