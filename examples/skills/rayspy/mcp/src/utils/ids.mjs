import { randomUUID } from 'node:crypto';

export function newInvestigationId() {
  return `inv_${randomUUID()}`;
}

export function newTaskId() {
  return `task_${randomUUID()}`;
}

/** Small deterministic hash so stub tool output is stable per-target (helps testing). */
export function stableHash(input) {
  let h = 0;
  const str = String(input);
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
