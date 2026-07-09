import { useEffect, useState } from "react";
import { X, Check, Download, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  loadProviderSettings,
  saveProviderSettings,
  type StoredProviderSettings,
  loadAppearanceSettings,
  saveAppearanceSettings,
  applyAppearanceSettings,
  loadToolSettings,
  saveToolSettings,
  type ToolSettings,
  loadMemorySettings,
  saveMemorySettings,
  type MemorySettings,
  loadWorkspaceSettings,
  saveWorkspaceSettings,
  type WorkspaceSettings,
} from "@/services/workspaceStorage";
import { hostWriteMcpJson, hostSelectFolder } from "@/services/platformHost";
import { TOOL_REGISTRY } from "@/data/toolRegistry";
import { McpSettingsTab } from "../settings/McpSettingsTab";

const categories = ["AI Providers", "API Keys", "Tools & Keys", "MCP Config", "Workspace", "Appearance", "Memory & Context"];

const providers: { id: StoredProviderSettings["provider"]; label: string }[] = [
  { id: "ollama", label: "Ollama (Local)" },
  { id: "gemini", label: "Google Gemini" },
  { id: "openai", label: "OpenAI" },
  { id: "groq", label: "Groq" },
  { id: "claude", label: "Anthropic Claude" },
];

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState("AI Providers");
  const [provider, setProvider] = useState<StoredProviderSettings["provider"]>("ollama");
  const [model, setModel] = useState("qwen3-coder:30b");
  const [apiKey, setApiKey] = useState("");
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<AppearanceSettings>(loadAppearanceSettings);
  const [toolSettings, setToolSettings] = useState<ToolSettings>(loadToolSettings);
  const [memorySettings, setMemorySettings] = useState<MemorySettings>(loadMemorySettings);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(loadWorkspaceSettings);

  useEffect(() => {
    if (!open) return;
    const s = loadProviderSettings();
    setProvider(s.provider);
    setModel(s.model);
    setApiKey(s.apiKey || "");
    setAppearance(loadAppearanceSettings());
    setToolSettings(loadToolSettings());
    setMemorySettings(loadMemorySettings());
    setWorkspaceSettings(loadWorkspaceSettings());
    setSavedHint(null);
  }, [open]);

  const persistProvider = () => {
    saveProviderSettings({ provider, model: model.trim(), apiKey: apiKey.trim() });
    setSavedHint("Saved. Applies the next time you open a workspace.");
  };

  const persistToolSettings = () => {
    saveToolSettings(toolSettings);
    setSavedHint("Tool settings saved.");
  };

  const persistMemorySettings = () => {
    saveMemorySettings(memorySettings);
    setSavedHint("Memory & Context settings saved.");
  };

  const persistWorkspaceSettings = () => {
    saveWorkspaceSettings(workspaceSettings);
    setSavedHint("Workspace settings saved.");
  };

  const handlePickWorkingDir = async () => {
    try {
      const folder = await hostSelectFolder();
      if (folder) {
        setWorkspaceSettings({ ...workspaceSettings, workingDirectory: folder });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateAppearance = (updates: Partial<AppearanceSettings>) => {
    const next = { ...appearance, ...updates };
    setAppearance(next);
    saveAppearanceSettings(next);
    applyAppearanceSettings(next);
  };



  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-[640px] max-h-[500px] bg-card rounded-lg shadow-modal overflow-hidden flex"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-[180px] bg-secondary/50 py-4 space-y-0.5">
              <div className="px-4 pb-3 text-heading font-bold text-rays-pink">Settings</div>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`w-full text-left px-4 py-1.5 text-ui transition-colors ${activeCategory === cat ? "bg-accent text-accent-foreground border-l-2 border-rays-pink" : "text-foreground/60 hover:text-foreground hover:bg-secondary"}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-foreground">{activeCategory}</h2>
                <button
                  onClick={onClose}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {activeCategory === "AI Providers" && (
                <div className="space-y-3">
                  <p className="text-ui text-muted-foreground mb-3">
                    Default provider and model for new workspace sessions.
                  </p>
                  <div className="flex gap-1 bg-secondary rounded-lg p-0.5">
                    {providers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setProvider(p.id)}
                        className={`flex-1 px-2 py-1.5 rounded-md text-ui transition-all ${provider === p.id ? "bg-rays-violet text-accent-foreground shadow-sm" : "text-foreground/60 hover:text-foreground"}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <label className="text-ui font-medium text-foreground/80">Model</label>
                    <input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder={
                        provider === "ollama"
                          ? "qwen2.5-coder:latest"
                          : provider === "gemini"
                            ? "gemini-1.5-flash"
                            : provider === "groq"
                              ? "llama-3.3-70b-versatile"
                              : provider === "claude"
                                ? "claude-3-5-sonnet-20241022"
                                : "gpt-4o"
                      }
                      className="w-full bg-secondary rounded-md px-3 py-2 text-ui text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                    />
                  </div>
                  {provider !== "ollama" && (
                    <div className="space-y-2">
                      <label className="text-ui font-medium text-foreground/80">API Key</label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full bg-secondary rounded-md px-3 py-2 text-ui text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                      />
                    </div>
                  )}
                  <button
                    onClick={persistProvider}
                    className="mt-2 px-4 py-1.5 rounded-md bg-rays-pink/20 text-rays-pink text-ui font-medium hover:bg-rays-pink/30 transition-colors"
                  >
                    Save
                  </button>
                  {savedHint && <p className="text-xs text-muted-foreground">{savedHint}</p>}
                </div>
              )}

              {activeCategory === "API Keys" && (
                <div className="space-y-4">
                  <p className="text-ui text-muted-foreground">
                    API keys are stored locally and used for the provider selected above.
                  </p>
                  <div>
                    <label className="text-ui font-medium text-foreground/80 block mb-1">API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter API key…"
                      className="w-full bg-secondary rounded-md px-3 py-2 text-ui text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                    />
                  </div>
                  <button
                    onClick={persistProvider}
                    className="px-4 py-1.5 rounded-md bg-rays-pink/20 text-rays-pink text-ui font-medium hover:bg-rays-pink/30 transition-colors"
                  >
                    Save Keys
                  </button>
                  {savedHint && <p className="text-xs text-muted-foreground">{savedHint}</p>}
                </div>
              )}

              {activeCategory === "Tools & Keys" && (
                <div className="space-y-4">
                  <p className="text-ui text-muted-foreground">
                    Configure API keys and endpoints for advanced tools and integrations.
                  </p>
                  <div className="space-y-4">
                    {Object.entries(TOOL_REGISTRY).map(([key, info]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-ui font-medium text-foreground/80">{info.prompt}</label>
                          {info.url && (
                            <a href={info.url} target="_blank" rel="noreferrer" className="text-[11px] text-rays-violet hover:underline">
                              Get key ↗
                            </a>
                          )}
                        </div>
                        <input
                          type={info.password ? "password" : "text"}
                          value={toolSettings[key] || ""}
                          onChange={(e) => setToolSettings({ ...toolSettings, [key]: e.target.value })}
                          placeholder={info.description}
                          className="w-full bg-secondary rounded-md px-3 py-2 text-ui text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={persistToolSettings}
                    className="px-4 py-1.5 rounded-md bg-rays-pink/20 text-rays-pink text-ui font-medium hover:bg-rays-pink/30 transition-colors"
                  >
                    Save Tool Settings
                  </button>
                  {savedHint && <p className="text-xs text-muted-foreground">{savedHint}</p>}
                </div>
              )}

              {activeCategory === "MCP Config" && (
                <McpSettingsTab workspaceRoot={null} />
              )}

              {activeCategory === "Workspace" && (
                <div className="space-y-5 text-ui pb-10">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1 text-xs">Working Directory</h3>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Default project folder for tool and terminal work.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        value={workspaceSettings.workingDirectory}
                        onChange={(e) => setWorkspaceSettings({ ...workspaceSettings, workingDirectory: e.target.value })}
                        placeholder="~"
                        className="flex-1 bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                      />
                      <button
                        onClick={handlePickWorkingDir}
                        className="px-3 py-1.5 bg-secondary/80 hover:bg-secondary rounded-md text-xs font-medium text-foreground transition-colors"
                      >
                        Browse
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 border-t border-secondary/40 pt-3">
                    <h3 className="font-semibold text-foreground mb-1 text-xs">Code Execution Mode</h3>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      How strictly code execution is scoped to the current project.
                    </p>
                    <select
                      value={workspaceSettings.codeExecutionMode}
                      onChange={(e) => setWorkspaceSettings({ ...workspaceSettings, codeExecutionMode: e.target.value as "project" | "strict" })}
                      className="w-full bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                    >
                      <option value="project">Project</option>
                      <option value="strict">Strict</option>
                    </select>
                  </div>

                  <div className="space-y-1 border-t border-secondary/40 pt-3">
                    <label className="flex items-center gap-2 cursor-pointer mb-1">
                      <input
                        type="checkbox"
                        checked={workspaceSettings.persistentShell}
                        onChange={(e) => setWorkspaceSettings({ ...workspaceSettings, persistentShell: e.target.checked })}
                        className="rounded border-secondary text-rays-pink focus:ring-rays-pink"
                      />
                      <span className="font-semibold text-foreground text-xs">Persistent Shell</span>
                    </label>
                    <p className="text-[11px] text-muted-foreground pl-6">
                      Keep shell state between commands when the backend supports it.
                    </p>
                  </div>

                  <div className="space-y-1 border-t border-secondary/40 pt-3">
                    <h3 className="font-semibold text-foreground mb-1 text-xs">Environment Passthrough</h3>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Environment variables to pass into tool execution. Comma-separated.
                    </p>
                    <input
                      type="text"
                      value={workspaceSettings.envPassthrough}
                      onChange={(e) => setWorkspaceSettings({ ...workspaceSettings, envPassthrough: e.target.value })}
                      placeholder="e.g. AWS_PROFILE, NODE_ENV"
                      className="w-full bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                    />
                  </div>

                  <div className="space-y-1 border-t border-secondary/40 pt-3">
                    <h3 className="font-semibold text-foreground mb-1 text-xs">File Read Limit</h3>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Maximum characters Hermes can read from one file request.
                    </p>
                    <input
                      type="number"
                      value={workspaceSettings.fileReadLimit}
                      onChange={(e) => setWorkspaceSettings({ ...workspaceSettings, fileReadLimit: parseInt(e.target.value) || 0 })}
                      className="w-full bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                    />
                  </div>

                  <button
                    onClick={persistWorkspaceSettings}
                    className="mt-4 px-4 py-1.5 rounded-md bg-rays-pink/20 text-rays-pink text-ui font-medium hover:bg-rays-pink/30 transition-colors"
                  >
                    Save Workspace Settings
                  </button>
                  {savedHint && <p className="text-xs text-muted-foreground mt-2">{savedHint}</p>}
                </div>
              )}

              {activeCategory === "Appearance" && (
                <div className="space-y-5 text-ui">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1 text-xs">Appearance</h3>
                    <p className="text-[11px] text-muted-foreground">
                      These are desktop-only display preferences. Mode controls brightness; theme controls the accent palette and chat surface styling.
                    </p>
                  </div>


                  {/* Color Mode */}
                  <div className="flex items-center justify-between border-t border-secondary/40 pt-3">
                    <div className="space-y-0.5">
                      <span className="font-medium text-foreground/80 block">Color Mode</span>
                      <span className="text-[11px] text-muted-foreground block">Pick a fixed mode or let Hermes follow your system setting.</span>
                    </div>
                    <div className="flex bg-secondary rounded-lg p-0.5">
                      {(["light", "dark", "system"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => updateAppearance({ colorMode: mode })}
                          className={`px-3 py-1 rounded-md text-[11px] capitalize transition-all ${appearance.colorMode === mode ? "bg-rays-violet text-accent-foreground shadow-sm" : "text-foreground/60 hover:text-foreground"}`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Themes */}
                  <div className="space-y-2 border-t border-secondary/40 pt-3">
                    <div>
                      <span className="font-medium text-foreground/80 block">Theme</span>
                      <span className="text-[11px] text-muted-foreground block">Desktop palettes only. The selected mode is applied on top.</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {[
                        { id: "nous", label: "Nous", desc: "Glass neutrals with Nous blue accents" },
                        { id: "midnight", label: "Midnight", desc: "Deep blue-violet with cool accents" },
                        { id: "ember", label: "Ember", desc: "Warm crimson and bronze - forge vibes" },
                        { id: "mono", label: "Mono", desc: "Clean grayscale - minimal and focused" },
                        { id: "cyberpunk", label: "Cyberpunk", desc: "Neon green on black - matrix terminal" },
                        { id: "slate", label: "Slate", desc: "Cool slate blue - focused developer theme" },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => updateAppearance({ theme: t.id as any })}
                          className={`flex flex-col text-left p-3 rounded-lg border transition-all hover:bg-secondary/40 relative ${appearance.theme === t.id ? "border-rays-pink bg-secondary/30 ring-1 ring-rays-pink" : "border-secondary"}`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className="font-bold text-foreground text-xs capitalize">{t.label}</span>
                            {appearance.theme === t.id && (
                              <div className="w-4 h-4 rounded-full bg-rays-pink flex items-center justify-center">
                                <Check size={10} className="text-white" />
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground leading-tight">{t.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>




                </div>
              )}
              
              {activeCategory === "Memory & Context" && (
                <div className="space-y-5 text-ui pb-10">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1 text-xs">Persistent Memory</h3>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Save durable memories that can help future sessions, and maintain a compact profile of user preferences.
                    </p>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={memorySettings.memoryEnabled}
                          onChange={(e) => setMemorySettings({ ...memorySettings, memoryEnabled: e.target.checked })}
                          className="rounded border-secondary text-rays-pink focus:ring-rays-pink"
                        />
                        <span className="text-foreground/90">Enable Memory Engine</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={memorySettings.userProfileEnabled}
                          onChange={(e) => setMemorySettings({ ...memorySettings, userProfileEnabled: e.target.checked })}
                          className="rounded border-secondary text-rays-pink focus:ring-rays-pink"
                        />
                        <span className="text-foreground/90">Enable User Profile</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-foreground/80">Memory Budget (chars)</label>
                      <input
                        type="number"
                        value={memorySettings.memoryCharLimit}
                        onChange={(e) => setMemorySettings({ ...memorySettings, memoryCharLimit: parseInt(e.target.value) || 0 })}
                        className="w-full bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-foreground/80">Profile Budget (chars)</label>
                      <input
                        type="number"
                        value={memorySettings.userCharLimit}
                        onChange={(e) => setMemorySettings({ ...memorySettings, userCharLimit: parseInt(e.target.value) || 0 })}
                        className="w-full bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 border-t border-secondary/40 pt-3">
                    <label className="text-[11px] font-medium text-foreground/80">Memory Provider</label>
                    <select
                      value={memorySettings.provider}
                      onChange={(e) => setMemorySettings({ ...memorySettings, provider: e.target.value })}
                      className="w-full bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                    >
                      <option value="builtin">Built-in (ChromaDB)</option>
                      <option value="none">None</option>
                    </select>
                  </div>

                  <div className="border-t border-secondary/40 pt-4 mt-2">
                    <h3 className="font-semibold text-foreground mb-1 text-xs">Auto-Compression</h3>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Summarize older context when conversations get large to save context space.
                    </p>
                    
                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                      <input
                        type="checkbox"
                        checked={memorySettings.compressionEnabled}
                        onChange={(e) => setMemorySettings({ ...memorySettings, compressionEnabled: e.target.checked })}
                        className="rounded border-secondary text-rays-pink focus:ring-rays-pink"
                      />
                      <span className="text-foreground/90">Enable Auto-Compression</span>
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground/80">Compression Threshold (tokens)</label>
                        <input
                          type="number"
                          value={memorySettings.compressionThreshold}
                          onChange={(e) => setMemorySettings({ ...memorySettings, compressionThreshold: parseInt(e.target.value) || 0 })}
                          className="w-full bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground/80">Protected Recent Messages</label>
                        <input
                          type="number"
                          value={memorySettings.protectLastN}
                          onChange={(e) => setMemorySettings({ ...memorySettings, protectLastN: parseInt(e.target.value) || 0 })}
                          className="w-full bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={persistMemorySettings}
                    className="mt-4 px-4 py-1.5 rounded-md bg-rays-pink/20 text-rays-pink text-ui font-medium hover:bg-rays-pink/30 transition-colors"
                  >
                    Save Memory Settings
                  </button>
                  {savedHint && <p className="text-xs text-muted-foreground mt-2">{savedHint}</p>}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
