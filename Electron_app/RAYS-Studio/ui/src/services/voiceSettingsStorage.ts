/**
 * Persistent Voice Settings Storage for RAYS Studio
 * Mirrors Hermes voice capabilities and settings across Windows, macOS, and Linux.
 */

export interface VoiceSettings {
  ttsProvider: "auto" | "edge" | "openai" | "elevenlabs" | "pyttsx3" | "browser";
  ttsVoice: string; // e.g. "en-US-AriaNeural"
  ttsSpeed: number; // 0.5 to 2.0 (default 1.0)
  sttProvider: "auto" | "faster-whisper" | "groq" | "openai" | "google";
  autoSpeakReplies: boolean; // Speak assistant replies aloud
  wakeWordEnabled: boolean; // Passive wake word "Hey RAYS"
  bargeInEnabled: boolean; // Interrupt assistant by speaking while audio plays
  silenceTimeoutMs: number; // VAD silence threshold (1000 - 2500ms)
}

export const VOICE_SETTINGS_STORAGE_KEY = "rays-studio:voice-settings";

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  ttsProvider: "auto",
  ttsVoice: "en-US-AriaNeural",
  ttsSpeed: 1.0,
  sttProvider: "auto",
  autoSpeakReplies: false,
  wakeWordEnabled: false,
  bargeInEnabled: true,
  silenceTimeoutMs: 1250,
};

export const AVAILABLE_TTS_PROVIDERS = [
  { id: "auto", label: "Auto (Best Available - Edge Neural)", description: "Tries Edge TTS, OpenAI, ElevenLabs, pyttsx3, then OS" },
  { id: "edge", label: "Edge TTS (Microsoft Neural - Free)", description: "High-quality neural speech, free, no API key needed" },
  { id: "openai", label: "OpenAI TTS (tts-1)", description: "Natural OpenAI voices, requires OPENAI_API_KEY" },
  { id: "elevenlabs", label: "ElevenLabs (Premium)", description: "Realistic cloned voices, requires ELEVENLABS_API_KEY" },
  { id: "pyttsx3", label: "Offline System TTS (pyttsx3)", description: "Zero internet dependency, uses Windows SAPI / macOS / Linux espeak" },
  { id: "browser", label: "Browser Web Speech API", description: "Built-in browser speech synthesis" },
] as const;

export const AVAILABLE_EDGE_VOICES = [
  { id: "en-US-AriaNeural", label: "Aria (US Female - Natural Neural)", gender: "Female", region: "US" },
  { id: "en-US-GuyNeural", label: "Guy (US Male - Natural Neural)", gender: "Male", region: "US" },
  { id: "en-US-JennyNeural", label: "Jenny (US Female - Expressive)", gender: "Female", region: "US" },
  { id: "en-US-ChristopherNeural", label: "Christopher (US Male - Deep)", gender: "Male", region: "US" },
  { id: "en-GB-SoniaNeural", label: "Sonia (UK Female - Smooth)", gender: "Female", region: "UK" },
  { id: "en-GB-RyanNeural", label: "Ryan (UK Male - Conversational)", gender: "Male", region: "UK" },
  { id: "en-AU-NatashaNeural", label: "Natasha (Australian Female)", gender: "Female", region: "AU" },
  { id: "en-IN-NeerjaNeural", label: "Neerja (Indian Female - Clear)", gender: "Female", region: "IN" },
  { id: "en-IN-PrabhatNeural", label: "Prabhat (Indian Male - Clear)", gender: "Male", region: "IN" },
];

export const AVAILABLE_OPENAI_VOICES = [
  { id: "alloy", label: "Alloy (Neutral, Balanced)" },
  { id: "echo", label: "Echo (Warm, Rounded)" },
  { id: "fable", label: "Fable (Expressive, British Accent)" },
  { id: "onyx", label: "Onyx (Deep, Authoritative)" },
  { id: "nova", label: "Nova (Energetic, Friendly)" },
  { id: "shimmer", label: "Shimmer (Clear, Melodic)" },
];

export const AVAILABLE_STT_PROVIDERS = [
  { id: "auto", label: "Auto (Waterfall: Local -> Groq -> OpenAI -> Google)" },
  { id: "faster-whisper", label: "faster-whisper (Local Offline Whisper)" },
  { id: "groq", label: "Groq Whisper (Ultra-fast Cloud STT)" },
  { id: "openai", label: "OpenAI Whisper (Cloud STT)" },
  { id: "google", label: "Google STT (Free Fallback)" },
] as const;

export function loadVoiceSettings(): VoiceSettings {
  if (typeof window === "undefined") return { ...DEFAULT_VOICE_SETTINGS };
  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VOICE_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ttsProvider: parsed.ttsProvider ?? DEFAULT_VOICE_SETTINGS.ttsProvider,
      ttsVoice: parsed.ttsVoice ?? DEFAULT_VOICE_SETTINGS.ttsVoice,
      ttsSpeed: typeof parsed.ttsSpeed === "number" ? parsed.ttsSpeed : DEFAULT_VOICE_SETTINGS.ttsSpeed,
      sttProvider: parsed.sttProvider ?? DEFAULT_VOICE_SETTINGS.sttProvider,
      autoSpeakReplies: parsed.autoSpeakReplies ?? DEFAULT_VOICE_SETTINGS.autoSpeakReplies,
      wakeWordEnabled: parsed.wakeWordEnabled ?? DEFAULT_VOICE_SETTINGS.wakeWordEnabled,
      bargeInEnabled: parsed.bargeInEnabled ?? DEFAULT_VOICE_SETTINGS.bargeInEnabled,
      silenceTimeoutMs: typeof parsed.silenceTimeoutMs === "number" ? parsed.silenceTimeoutMs : DEFAULT_VOICE_SETTINGS.silenceTimeoutMs,
    };
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

export function saveVoiceSettings(updates: Partial<VoiceSettings>): VoiceSettings {
  const current = loadVoiceSettings();
  const next: VoiceSettings = { ...current, ...updates };
  try {
    localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}
