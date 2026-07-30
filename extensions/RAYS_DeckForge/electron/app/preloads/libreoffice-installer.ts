import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("loInstaller", {
  startInstall: () => ipcRenderer.invoke("lo:start-install"),
  skip: () => ipcRenderer.send("lo:skip"),
  onProgress: (cb: (data: { phase: string; percent?: number; message?: string }) => void) => {
    ipcRenderer.on("lo:progress", (_event, data) => cb(data));
  },
  onLog: (cb: (data: { level: string; text: string }) => void) => {
    ipcRenderer.on("lo:log", (_event, data) => cb(data));
  },
});
