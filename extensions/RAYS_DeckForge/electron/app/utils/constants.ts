import { app } from "electron"
import path from "path"
import fs from "fs"

export const localhost = "http://127.0.0.1"


export const isDev = !app.isPackaged;
export const baseDir = app.getAppPath();
export const fastapiDir = isDev
  ? path.resolve(baseDir, "..", "servers", "fastapi")
  : path.join(baseDir, "resources/fastapi");
export const nextjsDir = isDev
  ? path.resolve(baseDir, "..", "servers", "nextjs")
  : path.join(baseDir, "resources/nextjs");

export const tempDir = path.join(app.getPath("temp"), "presenton")
export const userDataDir = app.getPath("userData")
export const appDataDir = isDev ? path.join(baseDir, "app_data") : app.getPath("userData")
export const downloadsDir = app.getPath("downloads")
export const userConfigPath = path.join(userDataDir, "userConfig.json")
export const logsDir = path.join(userDataDir, "logs")

// Ensure required directories exist
export function ensureDirectoriesExist() {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(appDataDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });
}