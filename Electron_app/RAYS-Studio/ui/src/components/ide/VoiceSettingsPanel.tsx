import { useState, useEffect } from "react";
import {
  Mic,
  Volume2,
  Ear,
  Play,
  Settings2,
  ChevronDown,
} from "lucide-react";
import {
  voiceEngine,
} from "@/services/voiceService";
import {
  loadVoiceSettings,
  saveVoiceSettings,
  AVAILABLE_TTS_PROVIDERS,
  AVAILABLE_EDGE_VOICES,
  AVAILABLE_OPENAI_VOICES,
  AVAILABLE_STT_PROVIDERS,
  type VoiceSettings,
} from "@/services/voiceSettingsStorage";

function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none bg-[#111113] border border-white/10 hover:border-white/20 text-white text-[11.5px] rounded-md px-2.5 py-1.5 pr-7 outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-foreground/90">{label}</div>
        {description && <div className="text-[11px] text-muted-foreground/60 mt-0.5 leading-snug">{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors ${checked ? "bg-rays-violet" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  displayValue,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
  displayValue: string;
}) {
  return (
    <div className="py-2">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[12px] font-medium text-foreground/90">{label}</span>
        <span className="text-[11px] font-mono text-rays-lilac">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full bg-white/10 accent-[#9b87f5] cursor-pointer outline-none"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground/40 mt-0.5">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function VoiceSettingsPanel() {
  const [settings, setSettings] = useState<VoiceSettings>(loadVoiceSettings);
  const [testState, setTestState] = useState<"idle" | "testing" | "done" | "error">("idle");
  const [voices, setVoices] = useState<{ id: string; label: string }[]>([]);

  // Fetch Edge TTS voices list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let data: any = null;
        if ((window as any).raysDesktop?.listVoices) {
          data = await (window as any).raysDesktop.listVoices();
        } else {
          const res = await fetch("/api/voice/voices");
          if (res.ok) data = await res.json();
        }
        if (!cancelled && data?.voices?.length) {
          setVoices(
            data.voices.map((v: any) => {
              // Python backend returns {name, gender, locale}; raw edge-tts returns {ShortName, Gender, Locale}
              const id = v.name || v.ShortName || v.id || (typeof v === "string" ? v : "");
              const gender = v.gender || v.Gender || "";
              const locale = v.locale || v.Locale || "";
              return {
                id,
                label: `${id} (${gender} ${locale})`.trim(),
              };
            })
          );
        }
      } catch {
        // fallback to static list
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Static edge voices as base; merge fetched voices
  const edgeVoiceOptions = voices.length > 0 ? voices : AVAILABLE_EDGE_VOICES.map(v => ({ id: v.id, label: v.label }));

  const openAiVoiceOptions = AVAILABLE_OPENAI_VOICES.map(v => ({ id: v.id, label: v.label }));
  const ttsVoiceOptions =
    settings.ttsProvider === "openai" ? openAiVoiceOptions : edgeVoiceOptions;

  function applyAndSave(patch: Partial<VoiceSettings>) {
    const next: VoiceSettings = { ...settings, ...patch };
    setSettings(next);
    voiceEngine.applyVoiceSettings(next);
  }

  async function handleTestVoice() {
    setTestState("testing");
    try {
      await voiceEngine.testVoice("Hello! RAYS voice is working perfectly with neural speech synthesis.");
      setTestState("done");
      setTimeout(() => setTestState("idle"), 3000);
    } catch {
      setTestState("error");
      setTimeout(() => setTestState("idle"), 3000);
    }
  }

  return (
    <div className="space-y-5 text-sm">
      {/* TTS Provider */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rays-lilac uppercase tracking-wider">
          <Volume2 size={12} />
          Text-to-Speech (TTS)
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11.5px] text-muted-foreground/80">Provider</label>
            <Select
              value={settings.ttsProvider}
              onChange={(v) => applyAndSave({ ttsProvider: v as VoiceSettings["ttsProvider"] })}
              options={AVAILABLE_TTS_PROVIDERS.map(p => ({ id: p.id, label: p.label }))}
            />
            <div className="text-[10.5px] text-muted-foreground/50 leading-snug">
              {AVAILABLE_TTS_PROVIDERS.find(p => p.id === settings.ttsProvider)?.description}
            </div>
          </div>

          {(settings.ttsProvider === "auto" || settings.ttsProvider === "edge") && (
            <div className="space-y-1.5">
              <label className="text-[11.5px] text-muted-foreground/80">Edge TTS Voice</label>
              <Select
                value={settings.ttsVoice}
                onChange={(v) => applyAndSave({ ttsVoice: v })}
                options={edgeVoiceOptions}
              />
            </div>
          )}

          {settings.ttsProvider === "openai" && (
            <div className="space-y-1.5">
              <label className="text-[11.5px] text-muted-foreground/80">OpenAI Voice</label>
              <Select
                value={settings.ttsVoice}
                onChange={(v) => applyAndSave({ ttsVoice: v })}
                options={openAiVoiceOptions}
              />
            </div>
          )}

          <Slider
            label="Speed"
            value={settings.ttsSpeed}
            min={0.5}
            max={2.0}
            step={0.05}
            onChange={(v) => applyAndSave({ ttsSpeed: v })}
            displayValue={`${settings.ttsSpeed.toFixed(2)}×`}
          />

          <button
            type="button"
            onClick={handleTestVoice}
            disabled={testState === "testing"}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11.5px] font-medium transition-all ${
              testState === "testing"
                ? "bg-rays-violet/20 text-rays-lilac animate-pulse cursor-wait"
                : testState === "done"
                ? "bg-green-500/20 text-green-400"
                : testState === "error"
                ? "bg-red-500/20 text-red-400"
                : "bg-rays-violet/15 hover:bg-rays-violet/25 text-rays-lilac cursor-pointer"
            }`}
          >
            <Play size={11} />
            {testState === "testing" ? "Generating…" : testState === "done" ? "✓ Voice OK" : testState === "error" ? "✗ Failed" : "Test Voice"}
          </button>
        </div>
      </div>

      {/* STT Provider */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rays-pink uppercase tracking-wider">
          <Mic size={12} />
          Speech-to-Text (STT)
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11.5px] text-muted-foreground/80">Provider</label>
            <Select
              value={settings.sttProvider}
              onChange={(v) => applyAndSave({ sttProvider: v as VoiceSettings["sttProvider"] })}
              options={AVAILABLE_STT_PROVIDERS.map(p => ({ id: p.id, label: p.label }))}
            />
          </div>
          <div className="text-[10.5px] text-muted-foreground/50 leading-snug">
            Auto tries faster-whisper (local/offline) first, then Groq (if key set), then OpenAI, then Google (always free).
            API keys are read from env vars: <span className="font-mono text-rays-lilac/70">GROQ_API_KEY</span>, <span className="font-mono text-rays-lilac/70">OPENAI_API_KEY</span>
          </div>
        </div>
      </div>

      {/* Behaviour */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
          <Settings2 size={12} />
          Behaviour
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 divide-y divide-white/[0.04]">
          <Toggle
            checked={settings.autoSpeakReplies}
            onChange={(v) => applyAndSave({ autoSpeakReplies: v })}
            label="Auto-speak replies"
            description="RAYS speaks each assistant response aloud (neural TTS)"
          />
          <Toggle
            checked={settings.bargeInEnabled}
            onChange={(v) => applyAndSave({ bargeInEnabled: v })}
            label="Barge-in interruption"
            description="Detect when you speak while RAYS is talking and immediately cut playback"
          />
          <Toggle
            checked={settings.wakeWordEnabled}
            onChange={(v) => applyAndSave({ wakeWordEnabled: v })}
            label='Wake word: "Hey RAYS"'
            description="Keep mic passively listening; activates continuous conversation on wake word"
          />
          <Slider
            label="Silence timeout"
            value={settings.silenceTimeoutMs / 1000}
            min={0.6}
            max={3.0}
            step={0.05}
            onChange={(v) => applyAndSave({ silenceTimeoutMs: Math.round(v * 1000) })}
            displayValue={`${(settings.silenceTimeoutMs / 1000).toFixed(2)}s`}
          />
        </div>
      </div>

      {/* Capability summary */}
      <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3 text-[10.5px] text-muted-foreground/50 space-y-1">
        <div className="flex items-center gap-1.5 text-rays-lilac/70 font-semibold text-[11px]">
          <Ear size={11} />
          Voice Features Available
        </div>
        <div className="space-y-0.5 pl-1">
          <div>✓ Push-to-talk dictation (single turn)</div>
          <div>✓ Continuous voice conversation (auto re-arm after TTS)</div>
          <div>✓ Wake word detection ("Hey RAYS")</div>
          <div>✓ Auto-speak replies with neural TTS</div>
          <div>✓ Stop words ("stop", "never mind", "bye"…)</div>
          <div>✓ Barge-in interruption during playback</div>
          <div>✓ Works in browser dev mode and Electron desktop</div>
          <div>✓ Cross-platform: Windows, macOS, Linux</div>
        </div>
      </div>
    </div>
  );
}
