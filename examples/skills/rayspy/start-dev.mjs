import { spawn } from 'child_process';

const proxy = spawn('node', ['proxy-server.mjs'], { stdio: 'inherit', shell: true });
const vite = spawn('npx', ['vite'], { stdio: 'inherit', shell: true });

let killed = false;
function cleanup() {
  if (killed) return;
  killed = true;
  proxy.kill();
  vite.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
proxy.on('exit', cleanup);
vite.on('exit', cleanup);
