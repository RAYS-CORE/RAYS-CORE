import { ipcMain } from "electron";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { userDataDir } from "../utils/constants";

export function setupUploadImage() {
  ipcMain.handle("upload-image", async (_, file: Buffer) => {
    try {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(userDataDir, "uploads");
      fs.mkdirSync(uploadsDir, { recursive: true });

      // Generate unique filename
      const filename = `${crypto.randomBytes(16).toString('hex')}.png`;
      const filePath = path.join(uploadsDir, filename);

      // Write file to disk
      await fs.writeFileSync(filePath, file);

      // Return the path with file:// protocol for Electron
      return `file://${filePath}`;
    } catch (error) {
      console.error("Error saving image:", error);
      throw error;
    }
  });
}