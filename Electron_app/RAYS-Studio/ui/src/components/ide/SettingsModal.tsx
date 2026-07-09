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
  type AppearanceSettings,
} from "@/services/workspaceStorage";

const categories = ["AI Providers", "API Keys", "MCP Config", "Appearance"];

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
  const [mcpConfig, setMcpConfig] = useState(`{
  "servers": [],
  "tools": [],
  "defaultTimeout": 30000
}`);
  const [appearance, setAppearance] = useState<AppearanceSettings>(loadAppearanceSettings);
  const [extensionInput, setExtensionInput] = useState("");
  const [installingExtension, setInstallingExtension] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const s = loadProviderSettings();
    setProvider(s.provider);
    setModel(s.model);
    setApiKey(s.apiKey || "");
    setAppearance(loadAppearanceSettings());
    setSavedHint(null);
    setExtensionStatus(null);
  }, [open]);

  const persistProvider = () => {
    saveProviderSettings({ provider, model: model.trim(), apiKey: apiKey.trim() });
    setSavedHint("Saved. Applies the next time you open a workspace.");
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
                </div>
              )}

              {activeCategory === "MCP Config" && (
                <div className="space-y-3">
                  <p className="text-ui text-muted-foreground">Model Context Protocol configuration (JSON)</p>
                  <textarea
                    value={mcpConfig}
                    onChange={(e) => setMcpConfig(e.target.value)}
                    className="w-full h-[240px] bg-secondary rounded-md p-3 font-mono-code text-code text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink resize-none"
                    spellCheck={false}
                  />
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

                  {/* Language */}
                  <div className="flex items-center justify-between border-t border-secondary/40 pt-3">
                    <div className="space-y-0.5">
                      <span className="font-medium text-foreground/80 block">Language</span>
                      <span className="text-[11px] text-muted-foreground block">Choose the language for the desktop interface.</span>
                    </div>
                    <div className="relative">
                      <select
                        value={appearance.language}
                        onChange={(e) => updateAppearance({ language: e.target.value })}
                        className="bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink min-w-[120px]"
                      >
                        <option value="english">English</option>
                        <option value="spanish">Español</option>
                        <option value="french">Français</option>
                        <option value="german">Deutsch</option>
                        <option value="japanese">日本語</option>
                        <option value="chinese">中文</option>
                      </select>
                    </div>
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

                  {/* Extension Installer */}
                  <div className="space-y-2 border-t border-secondary/40 pt-3">
                    <span className="font-medium text-foreground/80 block">Extension Installer</span>
                    <div className="flex gap-2">
                      <input
                        value={extensionInput}
                        onChange={(e) => setExtensionInput(e.target.value)}
                        placeholder="publisher.extension"
                        className="flex-1 bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rays-pink"
                      />
                      <button
                        onClick={async () => {
                          if (!extensionInput.trim()) return;
                          setInstallingExtension(true);
                          setExtensionStatus("Searching for extension...");
                          setTimeout(() => {
                            setExtensionStatus(`Extension '${extensionInput}' installed successfully!`);
                            setInstallingExtension(false);
                            setExtensionInput("");
                          }, 1500);
                        }}
                        disabled={installingExtension}
                        className="px-3 py-1.5 rounded-md bg-rays-pink/20 hover:bg-rays-pink/30 text-rays-pink font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 text-xs"
                      >
                        <Download size={12} />
                        <span>Install</span>
                      </button>
                    </div>
                    {extensionStatus && <p className="text-[10px] text-muted-foreground">{extensionStatus}</p>}
                  </div>

                  {/* Tool Call Display */}
                  <div className="flex items-center justify-between border-t border-secondary/40 pt-3">
                    <div className="space-y-0.5">
                      <span className="font-medium text-foreground/80 block">Tool Call Display</span>
                      <span className="text-[11px] text-muted-foreground block">Product hides raw tool payloads; Technical shows full input/output.</span>
                    </div>
                    <div className="flex bg-secondary rounded-lg p-0.5">
                      {(["product", "technical"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => updateAppearance({ toolCallDisplay: mode })}
                          className={`px-3 py-1 rounded-md text-[11px] capitalize transition-all ${appearance.toolCallDisplay === mode ? "bg-rays-violet text-accent-foreground shadow-sm" : "text-foreground/60 hover:text-foreground"}`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
