import { spawn } from 'node:child_process';

/**
 * Runs a CLI command with a timeout, collecting stdout/stderr.
 * Never throws on non-zero exit - callers decide what a given exit
 * code / stderr means for their tool (e.g. "0 results" isn't an error).
 */
export function runCommand(cmd, args, { timeoutMs = 30_000, env = {} } = {}) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(cmd, args, {
      env: { ...process.env, ...env },
      shell: false,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        code: -1,
        stdout,
        stderr: `${stderr}\n${err.message}`,
        timedOut: false,
        durationMs: Date.now() - startedAt,
        spawnError: true,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut, durationMs: Date.now() - startedAt, spawnError: false });
    });
  });
}
