import { useState, useEffect } from "react";
import { 
  Play, Square, Download, Settings, Cpu, Database, 
  RefreshCw, CheckCircle, Flame, Sliders, Server, Search
} from "lucide-react";
import { AppHeader } from "@/components/ide/AppHeader";

export default function StudioLayout() {
  const [searchInput, setSearchInput] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [serverActive, setServerActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] RAYS Studio backend daemon initialized.",
    "[SYSTEM] Ready to host local GGUF models.",
  ]);
  const [modelsCatalog, setModelsCatalog] = useState<any[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<Record<str, string>>({});
  const [selectedModel, setSelectedModel] = useState("");
  const [loadedModel, setLoadedModel] = useState<string | null>(null);

  // Chat Interface State
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isInferencing, setIsInferencing] = useState(false);
  
  // Settings sliders
  const [temp, setTemp] = useState(0.1);
  const [contextLength, setContextLength] = useState(8192);
  const [gpuOffload, setGpuOffload] = useState(100);

  const fetchCatalog = async () => {
    setIsSearching(true);
    try {
      const res = await fetch(`http://localhost:8000/v1/models/catalog?search=${encodeURIComponent(modelSearch)}`);
      const data = await res.json();
      setModelsCatalog(data.models || []);
      setIsOffline(false);
    } catch (err) {
      console.error("Failed to fetch catalog", err);
      setIsOffline(true);
    } finally {
      setIsSearching(false);
    }
  };

  // Live Search against Backend
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCatalog();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [modelSearch]);

  // Polling statuses
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:8000/v1/models/status");
        const data = await res.json();
        setDownloadStatus(data);
      } catch (err) {
        console.error("Failed to fetch status", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleStartDaemon = async () => {
    if ((window as any).raysDesktop?.startDaemon) {
      await (window as any).raysDesktop.startDaemon();
      setLogs(prev => [...prev, "[SYSTEM] Instructed Electron to spawn background daemon..."]);
      // It will take a few seconds, the polling mechanism will automatically clear isOffline when it connects.
    } else {
      setLogs(prev => [...prev, "[ERROR] Not running inside RAYS Electron app. Please run `rays --studio --start` manually in your terminal."]);
    }
  };

  const handleStartServer = async () => {
    if (!loadedModel) {
      alert("Please load a model first!");
      return;
    }
    
    if (serverActive) {
      setServerActive(false);
      setLogs(prev => [...prev, "[SYSTEM] Local API server stopped."]);
      return;
    }

    setLogs(prev => [...prev, `[SYSTEM] Instructing daemon to load ${loadedModel} into memory...`]);
    try {
      await fetch("http://localhost:8000/v1/models/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: loadedModel })
      });
      setServerActive(true);
      setLogs(prev => [...prev, 
        `[SYSTEM] Loaded ${loadedModel} into memory.`,
        `[SYSTEM] Exposing OpenAI-compatible endpoints at http://localhost:8000`,
        `[API] POST /v1/chat/completions - Listening...`
      ]);
    } catch (err) {
      setLogs(prev => [...prev, `[ERROR] Failed to connect to daemon: ${err}`]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput || !serverActive) return;

    const newMsgs = [...messages, { role: "user", content: chatInput }];
    setMessages(newMsgs);
    setChatInput("");
    setIsInferencing(true);

    try {
      const res = await fetch("http://localhost:8000/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: loadedModel,
          messages: newMsgs,
          temperature: temp,
          max_tokens: 512
        })
      });
      const data = await res.json();
      if (data.choices && data.choices[0]) {
        const assistantMessage = data.choices[0].message;
        let displayContent = assistantMessage.content || "";
        if (assistantMessage.reasoning_content) {
          displayContent = `<think>\n${assistantMessage.reasoning_content}\n</think>\n\n` + displayContent;
        }
        if (!displayContent.trim()) displayContent = "[Empty Response from Model]";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: displayContent },
        ]);
      } else if (data.error) {
        setLogs(prev => [...prev, `[ERROR] Inference failed: ${data.error}`]);
      } else {
        setLogs(prev => [...prev, `[ERROR] Unexpected response: ${JSON.stringify(data)}`]);
      }
    } catch (err) {
      setLogs(prev => [...prev, `[ERROR] Connection failed during inference: ${err}`]);
    } finally {
      setIsInferencing(false);
    }
  };

  const handleDownload = async (name: string) => {
    setSelectedModel(name);
    try {
      await fetch("http://localhost:8000/v1/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: name })
      });
      setLogs(prev => [...prev, `[DOWNLOAD] Requested Hugging Face download for ${name}...`]);
    } catch (err) {
      setLogs(prev => [...prev, `[ERROR] Failed to start download for ${name}`]);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background font-sans">
      <AppHeader
        onOpenSettings={() => {}}
        onOpenSkills={() => {}}
        onOpenMcp={() => {}}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* 1. Left Section: Model Catalog */}
      <div className="w-1/3 border-r border-border bg-card flex flex-col p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold tracking-wider text-rays-pink uppercase flex items-center gap-2">
            <Database size={16} /> Model Catalog
          </h2>
          <button onClick={fetchCatalog} className="text-muted-foreground hover:text-foreground transition-colors" title="Refresh Catalog">
            <RefreshCw size={14} />
          </button>
        </div>
        <form 
          onSubmit={(e) => { e.preventDefault(); setModelSearch(searchInput); }}
          className="relative mb-4"
        >
          <Search size={14} className="absolute left-2.5 top-2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search HuggingFace models... (Press Enter to query global database)" 
            className="w-full bg-secondary/50 border border-border rounded pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-rays-violet"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          <button type="submit" className="hidden">Search</button>
        </form>
        
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isOffline ? (
             <div className="text-destructive font-bold text-xs p-3 text-center border border-destructive/50 rounded bg-destructive/10 flex flex-col items-center gap-2">
               <span>Backend Offline.</span>
               <button 
                 onClick={handleStartDaemon}
                 className="bg-destructive text-destructive-foreground hover:bg-destructive/80 px-3 py-1.5 rounded transition-colors"
               >
                 Start Local Daemon
               </button>
             </div>
          ) : isSearching ? (
             <div className="text-muted-foreground text-xs p-3 text-center">Searching Hugging Face...</div>
          ) : modelsCatalog.length === 0 ? (
             <div className="text-muted-foreground text-xs p-3 text-center">No models found.</div>
          ) : modelsCatalog.filter(m => m.name.toLowerCase().includes(searchInput.toLowerCase())).map(m => {
            const status = downloadStatus[m.name];
            return (
              <div key={m.name} className="p-3 border border-border/60 rounded bg-background/50 hover:bg-background transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-bold text-foreground truncate max-w-[70%]">{m.name}</span>
                  <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{m.size}</span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{m.desc}</p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                  <span className="text-[10px] text-muted-foreground">{m.downloads} DLs</span>
                  {status === "downloading" || status === "starting" ? (
                    <span className="text-[10px] text-rays-pink font-bold animate-pulse">Downloading base...</span>
                  ) : status === "compiling" ? (
                    <span className="text-[10px] text-rays-violet font-bold animate-pulse flex items-center gap-1"><Flame size={10} /> Compiling GGUF...</span>
                  ) : status && status.startsWith("completed") ? (
                    <span className="text-[10px] text-green-500 font-bold flex items-center gap-1">
                      <CheckCircle size={10} /> {status.includes("(v") ? status.split("(")[1].replace(")", "") : "Saved"}
                    </span>
                  ) : (
                    <button 
                      onClick={() => handleDownload(m.name)}
                      className="flex items-center gap-1 text-[10px] bg-rays-violet hover:bg-rays-violet/80 text-white font-medium px-2 py-1 rounded transition-colors"
                    >
                      <Download size={10} /> Download
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Middle Section: Local Server controls & Developer Logs */}
      <div className="flex-1 flex flex-col p-4 bg-background">
        <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
          <div>
            <h1 className="text-sm font-bold flex items-center gap-2">
              <Server size={16} className="text-rays-pink" /> Local Inference & Fine-Tuning Server
            </h1>
            <p className="text-[11px] text-muted-foreground">Expose local models to your agent workflows and track adapter health.</p>
          </div>
          <div className="flex items-center gap-2">
            <select 
              className="bg-card border border-border text-xs rounded px-2.5 py-1.5 focus:outline-none"
              onChange={e => setLoadedModel(e.target.value)}
              value={loadedModel || ""}
            >
              <option value="">Select a downloaded model</option>
              {modelsCatalog.map(m => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
            <button 
              onClick={handleStartServer}
              className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded transition-all shadow-lg ${
                serverActive 
                  ? "bg-destructive hover:bg-destructive/80 text-white" 
                  : "bg-green-600 hover:bg-green-500 text-white"
              }`}
            >
              {serverActive ? (
                <>
                  <Square size={13} fill="white" /> Stop Server
                </>
              ) : (
                <>
                  <Play size={13} fill="white" /> Run Server
                </>
              )}
            </button>
          </div>
        </div>

        {/* Chat / Playground Panel */}
        <div className="flex-1 bg-card border border-border/60 rounded flex flex-col overflow-hidden mb-4 relative min-h-[300px]">
           <div className="bg-secondary/50 border-b border-border/40 px-3 py-1.5 flex justify-between items-center">
             <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Test Inference</span>
           </div>
           <div className="flex-1 p-4 overflow-y-auto space-y-3">
             {messages.length === 0 ? (
               <div className="text-xs text-muted-foreground text-center mt-10">Select a downloaded model, Run Server, and say hello!</div>
             ) : messages.map((m, i) => (
               <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`text-xs px-3 py-2 rounded max-w-[80%] ${m.role === 'user' ? 'bg-rays-violet text-white' : 'bg-secondary text-foreground'}`}>
                   {m.content}
                 </div>
               </div>
             ))}
             {isInferencing && (
               <div className="flex justify-start">
                 <div className="text-xs px-3 py-2 rounded bg-secondary text-foreground animate-pulse">Thinking...</div>
               </div>
             )}
           </div>
           <div className="p-3 border-t border-border/40 bg-secondary/20">
             <form onSubmit={handleSendMessage} className="flex gap-2">
               <input 
                 type="text" 
                 className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-rays-violet"
                 placeholder="Send a message to the model..." 
                 value={chatInput}
                 onChange={e => setChatInput(e.target.value)}
                 disabled={!serverActive || isInferencing}
               />
               <button 
                 type="submit" 
                 disabled={!serverActive || isInferencing || !chatInput}
                 className="bg-rays-pink hover:bg-rays-pink/80 text-white px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50 transition-colors"
               >
                 Send
               </button>
             </form>
           </div>
        </div>

        {/* Console / Server Output Panel */}
        <div className="h-48 bg-black/40 border border-border/60 rounded flex flex-col overflow-hidden shrink-0">
          <div className="bg-card/80 border-b border-border/40 px-3 py-1.5 flex justify-between items-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Developer Logs</span>
            <button onClick={() => setLogs([])} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
          </div>
          <div className="flex-1 p-3 font-mono text-[11px] space-y-1 overflow-y-auto text-green-400">
            {logs.map((log, idx) => (
              <div key={idx} className="whitespace-pre-wrap">{log}</div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Right Sidebar: Adjustments, Hardware Offload & Fine-Tuning */}
      <div className="w-80 border-l border-border bg-card flex flex-col p-4 overflow-y-auto">
        <h2 className="text-sm font-bold tracking-wider text-rays-pink mb-3 uppercase flex items-center gap-2">
          <Sliders size={16} /> Parameters
        </h2>
        
        {/* Model Adjustments */}
        <div className="space-y-4 mb-6">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-muted-foreground">Temperature</span>
              <span className="text-rays-violet font-bold">{temp}</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.1" 
              value={temp} onChange={e => setTemp(parseFloat(e.target.value))}
              className="w-full accent-rays-violet"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-muted-foreground">Context Length</span>
              <span className="text-rays-violet font-bold">{contextLength} tokens</span>
            </div>
            <input 
              type="range" min="2048" max="32768" step="2048" 
              value={contextLength} onChange={e => setContextLength(parseInt(e.target.value))}
              className="w-full accent-rays-violet"
            />
          </div>
        </div>

        <h2 className="text-sm font-bold tracking-wider text-rays-pink mb-3 uppercase flex items-center gap-2 border-t border-border/40 pt-4">
          <Cpu size={16} /> Hardware & Fine-Tuning
        </h2>

        {/* Hardware settings */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-muted-foreground">GPU Offload</span>
              <span className="text-rays-violet font-bold">{gpuOffload}%</span>
            </div>
            <input 
              type="range" min="0" max="100" step="10" 
              value={gpuOffload} onChange={e => setGpuOffload(parseInt(e.target.value))}
              className="w-full accent-rays-violet"
            />
          </div>

          {/* Autonomous fine-tuning options */}
          <div className="bg-secondary/40 border border-border/50 rounded p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Auto-Finetune (SB-ZGA)</span>
              <input type="checkbox" defaultChecked className="accent-rays-violet" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Federated Sync (TIES)</span>
              <input type="checkbox" defaultChecked className="accent-rays-violet" />
            </div>
            <button className="w-full bg-rays-violet/20 border border-rays-violet text-rays-pink hover:bg-rays-violet/30 transition-colors text-xs font-semibold py-1.5 rounded flex items-center justify-center gap-1">
              <RefreshCw size={12} /> Force Federated Sync
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
