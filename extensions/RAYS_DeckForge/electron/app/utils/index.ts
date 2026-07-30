import net from 'net'
import treeKill from 'tree-kill'
import fs from 'fs'
import { localhost, tempDir, userConfigPath } from './constants'

export function setUserConfig(userConfig: UserConfig) {
  let existingConfig: UserConfig = {}

  if (fs.existsSync(userConfigPath)) {
    const configData = fs.readFileSync(userConfigPath, 'utf-8')
    existingConfig = JSON.parse(configData)
  }
  const definedIncomingEntries = Object.entries(userConfig).filter(([, value]) => value !== undefined)
  const mergedConfig: UserConfig = {
    ...existingConfig,
    ...Object.fromEntries(definedIncomingEntries),
  }
  fs.writeFileSync(userConfigPath, JSON.stringify(mergedConfig))
}

export function getUserConfig(): UserConfig {
  if (!fs.existsSync(userConfigPath)) {
    return {}
  }
  const configData = fs.readFileSync(userConfigPath, 'utf-8')
  return JSON.parse(configData)
}

export function setupEnv(fastApiPort: number, nextjsPort: number) {
  const { app } = require('electron');
  process.env.APP_VERSION = app.getVersion();
  process.env.NEXT_PUBLIC_FAST_API = `${localhost}:${fastApiPort}`;
  process.env.FASTAPI_PUBLIC_URL = process.env.NEXT_PUBLIC_FAST_API;
  process.env.TEMP_DIRECTORY = tempDir;
  process.env.NEXT_PUBLIC_USER_CONFIG_PATH = userConfigPath;
  process.env.NEXT_PUBLIC_URL = `${localhost}:${nextjsPort}`;
  
  // Set environment variables for NextJS API routes
  process.env.USER_CONFIG_PATH = userConfigPath;
  // Read CAN_CHANGE_KEYS from existing env or default to true
  if (process.env.CAN_CHANGE_KEYS === undefined) {
    process.env.CAN_CHANGE_KEYS = "true";
  }
}


export function killProcess(pid: number, signal: NodeJS.Signals = "SIGTERM") {
  return new Promise((resolve, reject) => {
    treeKill(pid, signal, (err: any) => {
      if (err) {
        console.error(`Error killing process ${pid}:`, err)
        reject(err)
      } else {
        console.log(`Process ${pid} killed (${signal})`)
        resolve(true)
      }
    })
  })
}

export async function findUnusedPorts(startPort: number = 40000, count: number = 2): Promise<number[]> {
  const ports: number[] = [];
  console.log(`Finding ${count} unused ports starting from ${startPort}`);

  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => {
        resolve(false);
      });
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
  };

  let currentPort = startPort;
  while (ports.length < count) {
    if (await isPortAvailable(currentPort)) {
      ports.push(currentPort);
    }
    currentPort++;
  }

  return ports;
}


export function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|]/g, '_');
}