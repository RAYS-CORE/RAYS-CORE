const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("raysDesktop", {
  isElectron: true,
  getInstallEpoch: () => ipcRenderer.invoke("rays:get-install-epoch"),
  saveImage: (base64) => ipcRenderer.invoke("rays:save-image", { base64 }),
  selectFolder: () => ipcRenderer.invoke("rays:select-folder"),
  readFile: (workspaceRoot, relativePath) =>
    ipcRenderer.invoke("rays:read-file", { workspaceRoot, relativePath }),
  startSession: (workspacePath, runtimeOverrides, conversationId) =>
    ipcRenderer.invoke("rays:session-start", { workspacePath, runtimeOverrides, conversationId }),
  stopSession: (sessionId) => ipcRenderer.invoke("rays:session-stop", { sessionId }),
  startDaemon: () => ipcRenderer.invoke("rays:daemon-start"),
  stopDaemon: () => ipcRenderer.invoke("rays:daemon-stop"),
  readMcpConfig: (scope, workspaceRoot) =>
    ipcRenderer.invoke("rays:read-mcp-config", { scope, workspaceRoot }),
  writeMcpConfig: (scope, workspaceRoot, server) =>
    ipcRenderer.invoke("rays:write-mcp-config", { scope, workspaceRoot, server }),
  removeMcpServer: (scope, workspaceRoot, name) =>
    ipcRenderer.invoke("rays:remove-mcp-server", { scope, workspaceRoot, name }),
  loadMcpExample: () => ipcRenderer.invoke("rays:load-mcp-example"),
  selectSkillFolder: () => ipcRenderer.invoke("rays:select-skill-folder"),
  installSkill: (scope, workspaceRoot, sourceDir) =>
    ipcRenderer.invoke("rays:install-skill", { scope, workspaceRoot, sourceDir }),
  openSkillsDirectory: (scope, workspaceRoot) =>
    ipcRenderer.invoke("rays:open-skills-directory", { scope, workspaceRoot }),
  routeGeneralPrompt: (prompt, workspaceRoot) =>
    ipcRenderer.invoke("rays:route-general-prompt", { prompt, workspaceRoot }),
  listConnectedAgents: (workspaceRoot) =>
    ipcRenderer.invoke("rays:list-connected-agents", { workspaceRoot }),
  transcribeAudio: (audioBase64, mimeType) =>
    ipcRenderer.invoke("rays:transcribe-audio", { audioBase64, mimeType }),
  onMenuAction: (callback) => {
    const listener = (_event, payload) => callback(payload?.action, payload);
    ipcRenderer.on("rays:menu-action", listener);
    return () => ipcRenderer.removeListener("rays:menu-action", listener);
  },
});
