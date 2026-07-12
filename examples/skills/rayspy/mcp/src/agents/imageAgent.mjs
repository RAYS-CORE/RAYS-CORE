import * as insightface from '../tools/insightface.mjs';
import { log } from '../logging/logger.mjs';
import { LogSource } from '../logging/logSources.mjs';

/**
 * Image agent: InsightFace (face detection/analysis on image URLs).
 */
export async function runImageAgent(session, task) {
  const { target } = task;
  const results = [await insightface.run(target)];

  for (const r of results) {
    log(session, LogSource.OSINT_AGENT_POOL, 'tool_call', {
      agent: 'image',
      tool: r.tool,
      target: r.target,
      status: r.status,
      durationMs: r.durationMs,
      hitCount: r.hits.length,
    });
  }

  return results.flatMap((r) =>
    r.hits.map((hit) => ({ ...hit, agent: 'image', taskId: task.id, target }))
  );
}
