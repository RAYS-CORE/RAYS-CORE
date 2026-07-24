import { log } from '../logging/logger.mjs';
import { LogSource } from '../logging/logSources.mjs';
import { stableHash } from '../utils/ids.mjs';

/**
 * Timeline agent: no external tool call. It synthesizes ordered timeline
 * entries from the timestamps already present on evidence (this round's
 * fresh findings + everything accumulated in session.evidence so far).
 * It runs after the other four agents in a round, since it depends on
 * their output.
 */
export async function runTimelineAgent(session, task, roundFindings) {
  const pool = [...session.evidence, ...roundFindings].filter((f) => f.timestamp);
  const sorted = [...pool].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const entries = sorted.map((f) => ({
    id: `tl_${stableHash(f.id)}`,
    agent: 'timeline',
    taskId: task.id,
    target: task.target,
    summary: `${f.timestamp}: ${f.summary}`,
    confidence: f.confidence,
    timestamp: f.timestamp,
    sourceId: f.id,
  }));

  log(session, LogSource.OSINT_AGENT_POOL, 'tool_call', {
    agent: 'timeline',
    tool: 'timeline_synthesis',
    target: task.target,
    status: 'ok',
    durationMs: 0,
    hitCount: entries.length,
  });

  return entries;
}
