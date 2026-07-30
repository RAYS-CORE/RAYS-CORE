import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("setupInstaller", {
  getStatus: () => ipcRenderer.invoke("setup:get-status"),

  installLibreOffice: () => ipcRenderer.invoke("lo:start-install"),
  installChrome: () => ipcRenderer.invoke("setup:install-chrome"),
  installImageMagick: () => ipcRenderer.invoke("setup:install-imagemagick"),
  checkImageMagick: () => ipcRenderer.invoke("setup:check-imagemagick"),

  done: () => ipcRenderer.send("setup:done"),

  onLibreOfficeProgress: (
    cb: (data: { phase: string; percent?: number; message?: string }) => void
  ) => {
    ipcRenderer.on("lo:progress", (_event, data) => cb(data));
  },
  onLibreOfficeLog: (cb: (data: { level: string; text: string }) => void) => {
    ipcRenderer.on("lo:log", (_event, data) => cb(data));
  },

  onChromeProgress: (
    cb: (data: { phase: string; percent?: number; message?: string }) => void
  ) => {
    ipcRenderer.on("setup:chrome-progress", (_event, data) => cb(data));
  },
  onChromeLog: (cb: (data: { level: string; text: string }) => void) => {
    ipcRenderer.on("setup:chrome-log", (_event, data) => cb(data));
  },

  onImageMagickProgress: (
    cb: (data: { phase: string; percent?: number; message?: string }) => void
  ) => {
    ipcRenderer.on("setup:imagemagick-progress", (_event, data) => cb(data));
  },
  onImageMagickLog: (cb: (data: { level: string; text: string }) => void) => {
    ipcRenderer.on("setup:imagemagick-log", (_event, data) => cb(data));
  },
});
