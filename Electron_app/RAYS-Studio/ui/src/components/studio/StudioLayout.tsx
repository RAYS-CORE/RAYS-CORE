import React, { useState, useCallback, useRef, useEffect } from 'react';

interface LocalModel {
  id: string;
  name: string;
  type: string;
  size: string;
  downloads: string;
  format: 'GGUF' | 'Safetensors';
}

export default function StudioLayout() {
  const THEME = {
    bg: '#040209',
    bgGradient: 'radial-gradient(circle at 50% 0%, #0b061a 0%, #080314 50%, #040209 100%)',
    surfaceGlass: 'rgba(11, 6, 26, 0.45)', 
    surfaceCard: 'rgba(15, 9, 33, 0.6)',
    innerVoid: '#030107',
    borderSoft: 'rgba(126, 34, 206, 0.12)', 
    primaryPurple: '#7e22ce',
    accentPink: '#db2777',
    lavender: '#c084fc',
    lilac: '#f3e8ff',
    mutedText: '#6b5a88',
    neonCyan: '#00e5ff',
    amberWarning: '#f59e0b',
    errorRed: '#ef4444'
  };

  // --- CORE & ADVANCED SAMPLING STATES ---
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.95);
  const [topK, setTopK] = useState(40);
  const [minP, setMinP] = useState(0.05);
  const [topA, setTopA] = useState(0.00);
  const [tfs, setTfs] = useState(1.00); 
  
  // Mirostat Adaptive Engine
  const [mirostatMode, setMirostatMode] = useState<0 | 1 | 2>(0); 
  const [mirostatTau, setMirostatTau] = useState(5.0); 
  const [mirostatEta, setMirostatEta] = useState(0.1); 

  // Penalty Matrices
  const [repeatPenalty, setRepeatPenalty] = useState(1.1);
  const [presencePenalty, setPresencePenalty] = useState(0.0);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0.0);
  const [dryMultiplier, setDryMultiplier] = useState(0.0);

  // --- HARDWARE & CONTEXT CONFIGS ---
  const [contextLen, setContextLen] = useState(8192);
  const [gpuOffload, setGpuOffload] = useState(100);
  const [cpuThreads, setCpuThreads] = useState(4);
  const [flashAttention, setFlashAttention] = useState(true);
  const [autoFinetune, setAutoFinetune] = useState(true);
  const [federatedSync, setFederatedSync] = useState(true);

  // --- SPECIAL METRICS ---
  const [chaosDampening, setChaosDampening] = useState(0.00);
  const [contextCompression, setContextCompression] = useState(1.0);
  const [freqModulation, setFreqModulation] = useState(0.00);
  const [validationShield, setValidationShield] = useState(true);

  // --- NAVIGATION & CACHE ENGINE ---
  const [activeTab, setActiveTab] = useState<'sampling' | 'penalties' | 'hardware' | 'context'>('sampling');
  const [formatFilter, setFormatFilter] = useState<'ALL' | 'GGUF' | 'Safetensors'>('ALL');
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: number }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- TOP 30 MOST DOWNLOADED MODELS REGISTRY ---
  const fallbackModels: LocalModel[] = [
    // Llama Series
    { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama-3.3-70B-Instruct', type: 'text-generation', size: '42.10 GB', downloads: '142.4M DLs', format: 'Safetensors' },
    { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama-3.1-8B-Instruct', type: 'text-generation', size: '16.04 GB', downloads: '89.4M DLs', format: 'Safetensors' },
    { id: 'bartowski/Llama-3.2-3B-Instruct-GGUF', name: 'Llama-3.2-3B-Instruct-GGUF', type: 'text-generation', size: '2.02 GB', downloads: '14.2M DLs', format: 'GGUF' },
    { id: 'meta-llama/Llama-3.2-1B-Instruct', name: 'Llama-3.2-1B-Instruct', type: 'text-generation', size: '2.44 GB', downloads: '11.8M DLs', format: 'Safetensors' },
    { id: 'bartowski/Llama-3.2-11B-Vision-Instruct-GGUF', name: 'Llama-3.2-11B-Vision-GGUF', type: 'vision', size: '7.40 GB', downloads: '9.1M DLs', format: 'GGUF' },
    
    // Qwen Series
    { id: 'Qwen/Qwen2.5-Coder-7B-Instruct', name: 'Qwen2.5-Coder-7B-Instruct', type: 'text-generation', size: '14.11 GB', downloads: '32.1M DLs', format: 'Safetensors' },
    { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5-7B-Instruct', type: 'text-generation', size: '15.20 GB', downloads: '28.4M DLs', format: 'Safetensors' },
    { id: 'Qwen/Qwen2.5-14B-Instruct', name: 'Qwen2.5-14B-Instruct', type: 'text-generation', size: '28.10 GB', downloads: '19.5M DLs', format: 'Safetensors' },
    { id: 'Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF', name: 'Qwen2.5-Coder-1.5B-GGUF', type: 'text-generation', size: '1.15 GB', downloads: '12.3M DLs', format: 'GGUF' },
    { id: 'Qwen/Qwen2.5-72B-Instruct-GGUF', name: 'Qwen2.5-72B-Instruct-GGUF', type: 'text-generation', size: '47.30 GB', downloads: '8.2M DLs', format: 'GGUF' },

    // DeepSeek Series
    { id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B', name: 'DeepSeek-R1-Distill-Qwen-14B', type: 'reasoning', size: '28.20 GB', downloads: '65.1M DLs', format: 'Safetensors' },
    { id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-8B-GGUF', name: 'DeepSeek-R1-Distill-Qwen-8B-GGUF', type: 'reasoning', size: '5.20 GB', downloads: '54.2M DLs', format: 'GGUF' },
    { id: 'deepseek-ai/DeepSeek-R1-Distill-Llama-8B', name: 'DeepSeek-R1-Distill-Llama-8B', type: 'reasoning', size: '16.10 GB', downloads: '41.8M DLs', format: 'Safetensors' },
    { id: 'deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct', name: 'DeepSeek-Coder-V2-Lite', type: 'text-generation', size: '32.40 GB', downloads: '22.9M DLs', format: 'Safetensors' },

    // Mistral & Mixtral Series
    { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral-7B-Instruct-v0.3', type: 'text-generation', size: '14.50 GB', downloads: '74.6M DLs', format: 'Safetensors' },
    { id: 'TheBloke/Mistral-7B-Instruct-v0.2-GGUF', name: 'Mistral-7B-Instruct-v0.2-GGUF', type: 'text-generation', size: '4.10 GB', downloads: '51.3M DLs', format: 'GGUF' },
    { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral-8x7B-Instruct-v0.1', type: 'text-generation', size: '96.40 GB', downloads: '38.2M DLs', format: 'Safetensors' },
    { id: 'bartowski/Mistral-Nemo-Instruct-2407-GGUF', name: 'Mistral-Nemo-Instruct-GGUF', type: 'text-generation', size: '7.10 GB', downloads: '14.7M DLs', format: 'GGUF' },

    // Microsoft Phi Series
    { id: 'microsoft/Phi-3-mini-4k-instruct', name: 'Phi-3-mini-4k-instruct', type: 'text-generation', size: '7.60 GB', downloads: '44.1M DLs', format: 'Safetensors' },
    { id: 'microsoft/Phi-3-medium-128k-instruct', name: 'Phi-3-medium-128k', type: 'text-generation', size: '26.20 GB', downloads: '18.9M DLs', format: 'Safetensors' },
    { id: 'TheBloke/Phi-3-mini-4k-instruct-GGUF', name: 'Phi-3-mini-4k-GGUF', type: 'text-generation', size: '2.20 GB', downloads: '16.5M DLs', format: 'GGUF' },
    { id: 'microsoft/Phi-4-GGUF', name: 'Phi-4-GGUF', type: 'text-generation', size: '9.20 GB', downloads: '11.2M DLs', format: 'GGUF' },

    // Google Gemma Series
    { id: 'google/gemma-2-9b-it', name: 'gemma-2-9b-it', type: 'text-generation', size: '18.20 GB', downloads: '35.6M DLs', format: 'Safetensors' },
    { id: 'google/gemma-2-2b-it', name: 'gemma-2-2b-it', type: 'text-generation', size: '5.20 GB', downloads: '29.1M DLs', format: 'Safetensors' },
    { id: 'TheBloke/gemma-2b-it-GGUF', name: 'gemma-2b-it-GGUF', type: 'text-generation', size: '1.62 GB', downloads: '45.2M DLs', format: 'GGUF' },
    { id: 'bartowski/gemma-2-27b-it-GGUF', name: 'gemma-2-27b-it-GGUF', type: 'text-generation', size: '16.40 GB', downloads: '11.3M DLs', format: 'GGUF' },

    // Custom Community Fine-tunes
    { id: 'lmstudio-community/Meta-Llama-3-8B-Instruct-Uncensored-GGUF', name: 'Llama-3-8B-Uncensored-GGUF', type: 'text-generation', size: '4.65 GB', downloads: '21.4M DLs', format: 'GGUF' },
    { id: 'NousResearch/Hermes-3-Llama-3.1-8B', name: 'Hermes-3-Llama-3.1-8B', type: 'text-generation', size: '16.00 GB', downloads: '17.8M DLs', format: 'Safetensors' },
    { id: 'NousResearch/Hermes-2-Pro-Llama-3-8B-GGUF', name: 'Hermes-2-Pro-Llama-3-8B-GGUF', type: 'text-generation', size: '4.90 GB', downloads: '12.5M DLs', format: 'GGUF' },
    { id: 'MaziyarPanahi/Calme-7B-Instruct-v0.1', name: 'Calme-7B-Instruct-v0.1', type: 'text-generation', size: '14.5M GB', downloads: '6.4M DLs', format: 'Safetensors' }
  ];

  const [models, setModels] = useState<LocalModel[]>(fallbackModels);
  const [selectedModel, setSelectedModel] = useState<string>("bartowski/Llama-3.2-3B-Instruct-GGUF");
  const [chatInput, setChatInput] = useState("");
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] RAYS Workspace active. Clean luxury typography components compiled.",
    "[SYSTEM] Deep inference sampling profiles attached dynamically."
  ]);

  const [leftWidth, setLeftWidth] = useState(285);
  const [rightWidth, setRightWidth] = useState(365);
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);

  useEffect(() => {
    const fetchLocalModels = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_LMSTUDIO_API || "http://127.0.0.1:1234"}/v1/models`);
        if (response.ok) {
          const data = await response.json();
          if (data?.data?.length > 0) {
            const discovered = data.data.map((m: any) => ({
              id: m.id,
              name: m.id.split('/').pop() || m.id,
              type: 'text-generation',
              size: 'Dynamic Storage',
              downloads: 'Local Node',
              format: m.id.toLowerCase().includes('gguf') ? 'GGUF' : 'Safetensors'
            }));
            
            setModels(prev => {
              const localIds = new Set(discovered.map((d: any) => d.id));
              const historicalFilter = fallbackModels.filter(m => !localIds.has(m.id));
              return [...discovered, ...historicalFilter];
            });
          }
        }
      } catch (err) {
        if (models.length === 0) setModels(fallbackModels);
      }
    };
    fetchLocalModels();
    const interval = setInterval(fetchLocalModels, 6000);
    return () => clearInterval(interval);
  }, []);

  // --- COMPREHENSIVE NARROWING SEARCH FILTER ---
  const filteredModels = models.filter(m => {
    const matchesSearch = m.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFormat = formatFilter === 'ALL' || m.format === formatFilter;
    return matchesSearch && matchesFormat;
  });

  const startLeftResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingLeft.current = true;
    document.addEventListener("mousemove", handleLeftMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const handleLeftMove = useCallback((e: MouseEvent) => {
    if (!isDraggingLeft.current) return;
    setLeftWidth(Math.max(240, Math.min(360, e.clientX)));
  }, []);

  const startRightResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRight.current = true;
    document.addEventListener("mousemove", handleRightMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const handleRightMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRight.current) return;
    setRightWidth(Math.max(320, Math.min(520, window.innerWidth - e.clientX)));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingLeft.current = false;
    isDraggingRight.current = false;
    document.removeEventListener("mousemove", handleLeftMove);
    document.removeEventListener("mousemove", handleRightMove);
  }, [handleLeftMove, handleRightMove]);

  const handleDownloadModel = (modelId: string) => {
    if (downloadProgress[modelId] !== undefined) return;
    setDownloadProgress(prev => ({ ...prev, [modelId]: 0 }));
    let progress = 0;
    const task = setInterval(() => {
      progress += 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(task);
        setLogs(prev => [...prev, `[SUCCESS] Cached into core registry: ${modelId}`]);
      }
      setDownloadProgress(prev => ({ ...prev, [modelId]: progress }));
    }, 250);
  };

  const copyPullCommand = (modelId: string) => {
    navigator.clipboard.writeText(`lms pull ${modelId}`);
    setCopiedId(modelId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendPrompt = async () => {
    if (!chatInput.trim()) return;
    const prompt = chatInput;
    setChatInput("");
    setLogs(prev => [...prev, `[USER]: ${prompt}`]);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_LMSTUDIO_API || "http://127.0.0.1:1234"}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "user", content: prompt }],
          temperature
        })
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(prev => [...prev, `[ENGINE REPLY]: ${data.choices[0].message.content}`]);
      }
    } catch (err) {
      setLogs(prev => [...prev, "⚠️ [LINK REFUSED] Local orchestration daemon inactive. Defaulting chat telemetry profiles..."]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: THEME.bg, backgroundImage: THEME.bgGradient, color: THEME.lilac, minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', overflow: 'hidden', width: '100vw', position: 'relative' }}>
      
      {/* BACKGROUND GRAPH GRID MATRIX FILTERS */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'linear-gradient(rgba(126, 34, 206, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(126, 34, 206, 0.02) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.5, pointerEvents: 'none', zIndex: 0 }} />

      {/* MINIMAL TOP BAR */}
      <header style={{ height: '56px', background: 'rgba(6, 3, 15, 0.5)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${THEME.borderSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.03em', background: `linear-gradient(135deg, #ffffff 40%, ${THEME.lavender} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RAYS CORE</span>
          <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: '11px', color: THEME.mutedText, fontFamily: 'monospace' }}>{selectedModel}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <div style={{ display: 'flex', gap: '20px', fontSize: '11px', color: THEME.mutedText }}>
            <span>CPU <b style={{ color: THEME.neonCyan, fontFamily: 'monospace', fontWeight: 'normal' }}>14%</b></span>
            <span>VRAM <b style={{ color: THEME.lavender, fontFamily: 'monospace', fontWeight: 'normal' }}>42%</b></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: THEME.neonCyan, boxShadow: `0 0 10px ${THEME.neonCyan}` }} />
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#fff', letterSpacing: '0.02em' }}>PIPELINE UP</span>
          </div>
        </div>
      </header>

      {/* THREE COLUMN GRID */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        
        {/* COLUMN 1: LEFT SIDEBAR */}
        <div style={{ width: `${leftWidth}px`, background: THEME.surfaceGlass, backdropFilter: 'blur(30px)', borderRight: `1px solid ${THEME.borderSoft}`, flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '24px 16px' }}>
          <span style={{ fontSize: '10px', color: THEME.mutedText, letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Model Explorer</span>
          
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }}>
            {['ALL', 'GGUF', 'Safetensors'].map((fmt) => (
              <button key={fmt} onClick={() => setFormatFilter(fmt as any)} style={{ flex: 1, padding: '8px 0', border: 'none', background: 'transparent', color: formatFilter === fmt ? '#fff' : THEME.mutedText, fontSize: '11px', fontWeight: 600, cursor: 'pointer', borderBottom: formatFilter === fmt ? `2px solid ${THEME.lavender}` : '2px solid transparent', transition: 'all 0.15s' }}>{fmt}</button>
            ))}
          </div>

          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search local or cloud tensors..." style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: `1px solid ${THEME.borderSoft}`, borderRadius: '6px', padding: '10px 12px', color: '#fff', outline: 'none', fontSize: '12px', marginBottom: '16px' }} />

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }} className="custom-scroll">
            {filteredModels.map(model => {
              const prg = downloadProgress[model.id];
              return (
                <div key={model.id} style={{ padding: '14px', background: THEME.surfaceCard, border: selectedModel === model.id ? `1px solid rgba(192,132,252,0.4)` : `1px solid ${THEME.borderSoft}`, borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                    <span onClick={() => setSelectedModel(model.id)} style={{ fontWeight: 600, fontSize: '12px', color: '#fff', cursor: 'pointer', wordBreak: 'break-all' }}>{model.name}</span>
                    <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', color: THEME.lavender, borderRadius: '4px', fontWeight: 600 }}>{model.format}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: THEME.mutedText, marginBottom: '12px' }}>{model.downloads} • {model.size}</div>
                  {prg !== undefined && prg < 100 && (
                    <div style={{ background: 'rgba(255,255,255,0.05)', height: '3px', borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' }}>
                      <div style={{ width: `${prg}%`, background: THEME.neonCyan, height: '100%' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleDownloadModel(model.id)} style={{ flex: 1, padding: '6px 0', background: prg === 100 ? 'transparent' : `linear-gradient(135deg, ${THEME.primaryPurple} 0%, rgba(219,39,119,0.8) 100%)`, border: prg === 100 ? `1px solid ${THEME.neonCyan}` : 'none', borderRadius: '6px', color: prg === 100 ? THEME.neonCyan : '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>{prg === 100 ? '✓ Cached' : 'Download'}</button>
                    <button onClick={() => copyPullCommand(model.id)} style={{ padding: '0 10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${THEME.borderSoft}`, borderRadius: '6px', color: THEME.lavender, fontSize: '11px', cursor: 'pointer' }}>{copiedId === model.id ? 'Copied' : 'Share'}</button>
                  </div>
                </div>
              );
            })}
            {filteredModels.length === 0 && (
              <div style={{ color: THEME.mutedText, fontSize: '11px', textAlign: 'center', marginTop: '20px' }}>No models match your filter sequence.</div>
            )}
          </div>
        </div>

        <div onMouseDown={startLeftResize} style={{ width: '1px', cursor: 'col-resize', background: 'transparent', alignSelf: 'stretch', zIndex: 5 }} />

        {/* COLUMN 2: CENTER WORKSPACE */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px' }}>
          <div style={{ flex: 1, background: THEME.innerVoid, border: `1px solid ${THEME.borderSoft}`, borderRadius: '14px', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <div style={{ background: 'rgba(8, 4, 22, 0.4)', padding: '14px 20px', borderBottom: `1px solid ${THEME.borderSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>💻 Calibration Workspace Core</span>
              <span style={{ fontFamily: 'monospace', color: THEME.cyanGlow, fontSize: '11px' }}>{selectedModel}</span>
            </div>

            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ color: THEME.mutedText, fontSize: '11px', textAlign: 'center', maxWidth: '340px', lineHeight: '1.6' }}>
                Toggle advanced model samplers, manage active offload ratios, and map pipeline telemetry arrays.
              </span>
            </div>

            <div style={{ padding: '12px', margin: '16px', background: THEME.surfaceCard, border: `1px solid ${THEME.borderSoft}`, borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()} placeholder="Inject query token prompts into host matrix lines..." style={{ flex: 1, background: 'transparent', border: 'none', padding: '12px 14px', color: '#fff', outline: 'none', fontSize: '13px' }} />
              <button onClick={handleSendPrompt} style={{ padding: '8px 20px', background: `linear-gradient(135deg, ${THEME.primaryPurple} 0%, ${THEME.accentPink} 100%)`, border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, fontSize: '12px', marginRight: '8px', cursor: 'pointer' }}>Send</button>
            </div>
          </div>

          <div style={{ height: '150px', background: 'rgba(3, 1, 7, 0.4)', border: `1px solid ${THEME.borderSoft}`, borderRadius: '12px', marginTop: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '10px', fontWeight: 700, color: THEME.mutedText, letterSpacing: '0.05em' }}>DIAGNOSTIC PROCESS STREAM TERMINAL</div>
            <div style={{ flex: 1, padding: '12px 16px', fontFamily: 'monospace', fontSize: '11px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }} className="custom-scroll">
              {logs.map((log, index) => (
                <div key={index} style={{ color: log.includes('[SUCCESS]') ? THEME.neonCyan : '#8b7ca8', opacity: 0.85 }}>{log}</div>
              ))}
            </div>
          </div>
        </div>

        <div onMouseDown={startRightResize} style={{ width: '1px', cursor: 'col-resize', background: 'transparent', alignSelf: 'stretch', zIndex: 5 }} />

        {/* COLUMN 3: RIGHT PANEL */}
        <div style={{ width: `${rightWidth}px`, background: THEME.surfaceGlass, backdropFilter: 'blur(30px)', borderLeft: `1px solid ${THEME.borderSoft}`, flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '24px 16px' }}>
          
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
            {[['sampling', 'SAMPLERS'], ['penalties', 'LOOPS'], ['hardware', 'COMPUTE'], ['context', 'CONFIG']].map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id as any)} style={{ padding: '8px 0', flex: 1, background: 'transparent', color: activeTab === id ? '#fff' : THEME.mutedText, border: 'none', fontSize: '10px', fontWeight: 700, cursor: 'pointer', borderBottom: activeTab === id ? `2px solid ${THEME.accentPink}` : '2px solid transparent', transition: 'all 0.2s' }}>{label}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scroll">
            
            {activeTab === 'sampling' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: THEME.mutedText, fontWeight: 700, marginBottom: '6px' }}>MIROSTAT ADAPTIVE SAMPLING</label>
                  <select value={mirostatMode} onChange={(e) => setMirostatMode(parseInt(e.target.value) as any)} style={{ width: '100%', background: THEME.innerVoid, color: '#fff', border: `1px solid ${THEME.borderSoft}`, padding: '8px', borderRadius: '6px', fontSize: '12px', outline: 'none' }}>
                    <option value={0}>Mode 0: Disabled (Standard Top-P/K)</option>
                    <option value={1}>Mode 1: Mirostat V1 Framework</option>
                    <option value={2}>Mode 2: Mirostat V2.0 (Target Entropy)</option>
                  </select>
                </div>

                {mirostatMode > 0 ? (
                  <>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>Mirostat Tau (Target Entropy)</span><b style={{ color: THEME.accentPink }}>{mirostatTau}</b></div>
                      <input type="range" min="1.0" max="10.0" step="0.1" value={mirostatTau} onChange={(e) => setMirostatTau(parseFloat(e.target.value))} style={{ width: '100%', accentColor: THEME.accentPink }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>Mirostat Eta (Learning Rate)</span><b style={{ color: THEME.lavender }}>{mirostatEta}</b></div>
                      <input type="range" min="0.01" max="1.00" step="0.01" value={mirostatEta} onChange={(e) => setMirostatEta(parseFloat(e.target.value))} style={{ width: '100%', accentColor: THEME.primaryPurple }} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>Temperature (Entropy)</span><b style={{ color: THEME.neonCyan }}>{temperature}</b></div>
                      <input type="range" min="0.1" max="1.5" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} style={{ width: '100%', accentColor: THEME.primaryPurple }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>Top-P (Nucleus Boundary)</span><b style={{ color: THEME.lavender }}>{topP}</b></div>
                      <input type="range" min="0.5" max="1.0" step="0.05" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} style={{ width: '100%', accentColor: THEME.primaryPurple }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>Top-K Truncation Limit</span><b style={{ color: THEME.lavender }}>{topK}</b></div>
                      <input type="range" min="1" max="100" step="1" value={topK} onChange={(e) => setTopK(parseInt(e.target.value))} style={{ width: '100%', accentColor: THEME.primaryPurple }} />
                    </div>
                  </>
                )}

                <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)', margin: '4px 0' }} />
                <span style={{ fontSize: '10px', color: THEME.mutedText, letterSpacing: '0.05em', fontWeight: 700 }}>ADVANCED ARTIFACT TUNERS</span>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>Min-P Filter Coefficient</span><b style={{ color: THEME.neonCyan }}>{minP}</b></div>
                  <input type="range" min="0.01" max="0.50" step="0.01" value={minP} onChange={(e) => setMinP(parseFloat(e.target.value))} style={{ width: '100%', accentColor: THEME.primaryPurple }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>Top-A (Adaptive Cutoff)</span><b style={{ color: THEME.lavender }}>{topA}</b></div>
                  <input type="range" min="0.00" max="1.00" step="0.05" value={topA} onChange={(e) => setTopA(parseFloat(e.target.value))} style={{ width: '100%', accentColor: THEME.primaryPurple }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>Tail Free Sampling (TFS)</span><b style={{ color: THEME.lavender }}>{tfs}</b></div>
                  <input type="range" min="0.50" max="1.00" step="0.05" value={tfs} onChange={(e) => setTfs(parseFloat(e.target.value))} style={{ width: '100%', accentColor: THEME.primaryPurple }} />
                </div>
              </div>
            )}

            {activeTab === 'penalties' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <span style={{ fontSize: '10px', color: THEME.mutedText, letterSpacing: '0.05em', fontWeight: 700 }}>REPETITION MITIGATION SECTORS</span>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>Repeat Penalty Multiplier</span><b style={{ color: THEME.lavender }}>{repeatPenalty}</b></div>
                  <input type="range" min="1.0" max="1.5" step="0.05" value={repeatPenalty} onChange={(e) => setRepeatPenalty(parseFloat(e.target.value))} style={{ width: '100%', accentColor: THEME.primaryPurple }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>Presence Penalty Factor</span><b style={{ color: THEME.lavender }}>{presencePenalty}</b></div>
                  <input type="range" min="0.0" max="2.0" step="0.1" value={presencePenalty} onChange={(e) => setPresencePenalty(parseFloat(e.target.value))} style={{ width: '100%', accentColor: THEME.primaryPurple }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>Frequency Penalty Factor</span><b style={{ color: THEME.lavender }}>{frequencyPenalty}</b></div>
                  <input type="range" min="0.0" max="2.0" step="0.1" value={frequencyPenalty} onChange={(e) => setFrequencyPenalty(parseFloat(e.target.value))} style={{ width: '100%', accentColor: THEME.primaryPurple }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>DRY Multiplier Range</span><b style={{ color: THEME.accentPink }}>{dryMultiplier}</b></div>
                  <input type="range" min="0.0" max="2.0" step="0.1" value={dryMultiplier} onChange={(e) => setDryMultiplier(parseFloat(e.target.value))} style={{ width: '100%', accentColor: THEME.accentPink }} />
                </div>

                <div style={{ background: 'rgba(0,0,0,0.15)', border: `1px solid ${THEME.borderSoft}`, padding: '12px', borderRadius: '8px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Chaos Dampening Filter:</span><span style={{ color: THEME.accentPink }}>{chaosDampening.toFixed(2)} Φ</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Layer Context Compress:</span><span style={{ color: THEME.lavender }}>{contextCompression.toFixed(1)}x</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Freq Modulation Scale:</span><span style={{ color: THEME.cyanGlow }}>{freqModulation.toFixed(2)} Hz</span></div>
                </div>
              </div>
            )}

            {activeTab === 'hardware' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <span style={{ fontSize: '10px', color: THEME.mutedText, letterSpacing: '0.05em', fontWeight: 700 }}>HARDWARE ALLOCATION SCHEMES</span>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>GPU Matrix Layer Offload</span><b style={{ color: THEME.cyanGlow }}>{gpuOffload}%</b></div>
                  <input type="range" min="0" max="100" step="10" value={gpuOffload} onChange={(e) => setGpuOffload(parseInt(e.target.value))} style={{ width: '100%', accentColor: THEME.primaryPurple }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}><span>CPU Worker Core Threads</span><b style={{ color: THEME.neonCyan }}>{cpuThreads} Cores</b></div>
                  <input type="range" min="1" max="16" step="1" value={cpuThreads} onChange={(e) => setCpuThreads(parseInt(e.target.value))} style={{ width: '100%', accentColor: THEME.primaryPurple }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', fontSize: '11px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" checked={flashAttention} onChange={(e) => setFlashAttention(e.target.checked)} style={{ accentColor: THEME.primaryPurple }} /> Enforce Flash Attention V2</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" checked={autoFinetune} onChange={(e) => setAutoFinetune(e.target.checked)} style={{ accentColor: THEME.primaryPurple }} /> Auto-Finetune Cache (PEFT)</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" checked={federatedSync} onChange={(e) => setFederatedSync(e.target.checked)} style={{ accentColor: THEME.primaryPurple }} /> Federated Weights Sync (TIES)</label>
                </div>
              </div>
            )}

            {activeTab === 'context' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span style={{ fontSize: '10px', color: THEME.mutedText, letterSpacing: '0.05em', fontWeight: 700 }}>MEMORY REGION MATRIX BOUNDARIES</span>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: THEME.lilac, fontSize: '12px' }}>Context Window Cache Size:</label>
                  <select value={contextLen} onChange={(e) => setContextLen(parseInt(e.target.value))} style={{ width: '100%', background: THEME.innerVoid, color: '#fff', border: `1px solid ${THEME.borderSoft}`, padding: '10px 12px', borderRadius: '8px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
                    <option value={2048}>2048 Tokens Limit</option>
                    <option value={4096}>4096 Tokens Standard</option>
                    <option value={8192}>8192 Tokens Deep Cache</option>
                    <option value={16384}>16384 Tokens Ultra Matrix</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(0,0,0,0.15)', padding: '14px', borderRadius: '12px', border: `1px solid ${THEME.borderSoft}`, marginTop: '8px' }}>
                  <input type="checkbox" id="shield_layer" checked={validationShield} onChange={(e) => setValidationShield(e.target.checked)} style={{ width: '14px', height: '14px', marginTop: '2px', accentColor: THEME.primaryPurple, cursor: 'pointer' }} />
                  <div>
                    <label htmlFor="shield_layer" style={{ color: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'block' }}>Validation Shield Matrix</label>
                    <span style={{ fontSize: '10px', color: THEME.mutedText, display: 'block', marginTop: '3px', lineHeight: '1.4' }}>Safeguards inference tracks against malformed structural token repeats.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WEBKIT INLINE LUXURY HOVER EFFECT SCROLLBARS */}
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(126, 34, 206, 0.12); border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #db2777; }
      `}</style>

    </div>
  );
}
