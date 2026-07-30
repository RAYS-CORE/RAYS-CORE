import { ipcMain } from "electron";
import fs from "fs";
import path from "path";
export function setupReadFile() {
  ipcMain.handle("read-file", async (_, filePath: string) => {
    try {
      const normalizedPath = path.normalize(filePath);
      const content = fs.readFileSync(normalizedPath, 'utf-8');
      return { content };
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  });
}