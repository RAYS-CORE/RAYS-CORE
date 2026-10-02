/**
 * RAYS Voice Engine — Full Hermes Turn-Based Voice Architecture
 * 
 * 1. Push-to-talk Dictation: 1-click start -> speaks -> 1-click stop -> transcribes -> inserts to input
 * 2. Continuous Voice: 
 *    - Opens mic and streams level to UI
 *    - Adaptive VAD: monitors speech energy (rms / 42)
 *    - When user stops speaking (1.25s silence):
 *      -> Transitions state to 'transcribing' (triggers VoiceActivity animation)
 *      -> Finalizes audio Blob & sends to STT
 *      -> Checks stop words ("stop", "stop rays", "never mind", "bye", "cancel")
 *      -> Submits prompt to active chat / queue
 *      -> Re-arms listening automatically for the next utterance!
 * 3. Passive Wake-Word (Hearing Mode / Ear button):
 *    - Dual-Engine: Web Speech API fast-path + Backend STT VAD listener
 *    - Listens for "Hey RAYS", "Hey rays", "Rays"
 *    - On wake word -> plays melodic chime -> activates Continuous Conversation mode
 *    - On "stop" / "stop rays" -> exits Continuous Mode, remains passively listening for "Hey RAYS"!
 */

import {
  loadVoiceSettings,
  saveVoiceSettings,
  type VoiceSettings,
} from "./voiceSettingsStorage";

export interface VoiceLevelCallback {
  (level: number): void;
}

export interface VoiceTranscriptCallback {
  (transcript: string, isFinal: boolean): void;
}

export type VoiceState = "idle" | "listening" | "recording" | "transcribing" | "thinking" | "speaking";

// ── Whisper Hallucination Filter (ported from Hermes voice_mode_transcript.py) ──────────
// Whisper commonly outputs these phrases on silent/near-silent audio.
const WHISPER_HALLUCINATIONS = new Set([
  "thank you", "thanks for watching", "subscribe to my channel", "like and subscribe",
  "please subscribe", "thank you for watching", "bye", "you", "the end",
  "thanks", "ok", "okay", "hmm", "ah", "oh", "um", "uh",
  // Non-English hallucinations
  "sous-titres", "amara.org", "www.mooji.org",
]);
const HALLUCINATION_REPEAT_RE = /^(?:thank you|thanks|bye|you|ok|okay|the end|\.|,|!|\s)+$/i;

export function isWhisperHallucination(transcript: string): boolean {
  const cleaned = transcript.trim().toLowerCase();
  if (!cleaned) return true;
  const stripped = cleaned.replace(/[.!]+$/, "");
  return WHISPER_HALLUCINATIONS.has(stripped) || HALLUCINATION_REPEAT_RE.test(cleaned);
}

// ── TTS Echo Guard (ported from Hermes voice_mode_transcript.py) ────────────────────────
// When barge-in fires during TTS, the mic might capture RAYS's own speech.
// This detects when a transcript is just an echo of what RAYS is saying.
const TTS_ECHO_SIMILARITY_THRESHOLD = 0.55;
const MIN_FRAGMENT_LENGTH_FOR_ECHO = 8;

function normalizeForEchoCompare(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  // Simple bigram similarity (Dice coefficient) — fast, language-agnostic
  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.substring(i, i + 2));
  const bigramsB = new Set<string>();
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.substring(i, i + 2));
  let intersection = 0;
  for (const bg of bigramsA) if (bigramsB.has(bg)) intersection++;
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

export function isTtsEcho(transcript: string, spokenText: string): boolean {
  const a = normalizeForEchoCompare(transcript || "");
  const b = normalizeForEchoCompare(spokenText || "");
  if (!a || !b) return false;
  if (stringSimilarity(a, b) >= TTS_ECHO_SIMILARITY_THRESHOLD) return true;
  // Sliding window for fragments (mic captures a portion of the TTS output)
  if (a.length < MIN_FRAGMENT_LENGTH_FOR_ECHO || a.length >= b.length) return false;
  for (let start = 0; start <= b.length - a.length; start++) {
    if (stringSimilarity(a, b.substring(start, start + a.length)) >= TTS_ECHO_SIMILARITY_THRESHOLD) {
      return true;
    }
  }
  return false;
}

// ── Thinking Chime Generator (Hermes plays a tone while agent processes) ────────────────
function playThinkingChime(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    // Two-tone ascending chime: gentle notification that RAYS is thinking
    [440, 554].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.3);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch { /* AudioContext unavailable — silent fallback */ }
}

// ── Advanced TTS Text Normalizer (ported from Hermes tts_text_normalize.py) ─────────────
function prepareSpokeText(raw: string): string {
  if (!raw) return "";
  let text = raw;
  // Strip <think>...</think> reasoning blocks (models with reasoning enabled)
  text = text.replace(/<think[\s>].*?<\/think>/gis, " ");
  text = text.replace(/<think[\s>].*$/gis, " ");  // Unterminated block
  // Strip code blocks
  text = text.replace(/```[\s\S]*?```/g, " Code block omitted. ");
  // Strip images, keep alt text
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt) => alt ? ` ${alt} ` : " ");
  // Links: keep label, drop URL
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Strip bare URLs
  text = text.replace(/https?:\/\/\S+/g, "");
  // Inline code: keep content
  text = text.replace(/`([^`]+)`/g, "$1");
  // Bold / italic / strikethrough
  text = text.replace(/\*\*(.+?)\*\*/gs, "$1");
  text = text.replace(/__(.+?)__/gs, "$1");
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/gs, "$1");
  text = text.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/gs, "$1");
  text = text.replace(/~~(.+?)~~/gs, "$1");
  // Headings → plain text with comma lead-in
  text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, "$1,");
  // Blockquotes
  text = text.replace(/^\s*>\s?/gm, "");
  // List markers
  text = text.replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "");
  // Horizontal rules
  text = text.replace(/^\s*[-*_]{3,}\s*$/gm, "");
  // Table pipes → pause
  text = text.replace(/\s*\|\s*/g, "; ");
  // Degree symbols → words
  text = text.replace(/(\d+)\s*°\s*C\b/gi, "$1 degrees Celsius");
  text = text.replace(/(\d+)\s*°\s*F\b/gi, "$1 degrees Fahrenheit");
  text = text.replace(/(\d+)\s*°/g, "$1 degrees");
  // Common units
  text = text.replace(/(?<=\d)\s*km\s*\/\s*h\b/gi, " kilometres per hour");
  text = text.replace(/(?<=\d)\s*mm\b/g, " millimetres");
  text = text.replace(/(?<=\d)\s*cm\b/g, " centimetres");
  // Currency
  text = text.replace(/\$\s*([\d,]*\d(?:\.\d+)?)/g, "$1 dollars");
  text = text.replace(/€\s*([\d,]*\d(?:\.\d+)?)/g, "$1 euros");
  text = text.replace(/£\s*([\d,]*\d(?:\.\d+)?)/g, "$1 pounds");
  // Percentage
  text = text.replace(/(?<=\d)\s*%/g, " percent");
  // Symbols
  text = text.replace(/&/g, " and ");
  text = text.replace(/→/g, " to ");
  text = text.replace(/⇒/g, " to ");
  text = text.replace(/≈/g, " about ");
  text = text.replace(/~/g, " about ");
  // Emojis (broad unicode ranges)
  text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, "");
  // Collapse whitespace
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[ \t]{2,}/g, " ");
  text = text.replace(/\s+([,.;:!?])/g, "$1");
  // Flatten newlines for TTS
  text = text.replace(/\n{2,}/g, ". ");
  text = text.replace(/(?<=[.!?;:,])\n/g, " ");
  text = text.replace(/\n/g, ". ");
  text = text.replace(/\.\s*\./g, ".");
  // Length cap
  if (text.length > 4000) text = text.substring(0, 4000).trimEnd();
  return text.trim();
}

const STOP_PHRASES: readonly string[] = [
  "stop",
  "stop listening",
  "stop it",
  "stop please",
  "please stop",
  "stop now",
  "stop recording",
  "stop conversation",
  "stop continuous conversation",
  "that is all",
  "that's all",
  "never mind",
  "nevermind",
  "end conversation",
  "end the conversation",
  "goodbye",
  "good bye",
  "bye",
  "cancel",
  "exit",
  "halt",
  "quit",
];

const ADDRESS_WORDS: readonly string[] = [
  "hey rays",
  "hey razor",
  "hey razer",
  "hey raze",
  "hey raise",
  "hey race",
  "hey ray",
  "hey hermes",
  "hey google",
  "hey waze",
  "hey ways",
  "ok google",
  "okay google",
  "ok rays",
  "okay rays",
  "ok hermes",
  "okay hermes",
  "rays",
  "razor",
  "razer",
  "raze",
  "raise",
  "race",
  "ray",
  "google",
  "waze",
  "ways",
  "hermes",
  "siri",
  "alexa",
  "ok",
  "okay",
  "hey",
  "please",
  "now",
];

export function isVoiceStopCommand(text: string): boolean {
  if (!text) return false;
  let normalized = text
    .toLowerCase()
    .replace(/[.,!?;:…\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Direct exact match
  if (STOP_PHRASES.includes(normalized)) return true;

  // Single word command
  if (/^(stop|cancel|quit|halt|nevermind|bye)$/i.test(normalized)) return true;

  // Prefix match
  for (const prefix of ADDRESS_WORDS) {
    if (normalized.startsWith(`${prefix} `)) {
      const rest = normalized.slice(prefix.length + 1).trim();
      if (STOP_PHRASES.includes(rest) || /^(stop|cancel|quit|halt|nevermind|bye)$/i.test(rest)) {
        return true;
      }
    }
  }

  // Suffix match
  for (const suffix of ADDRESS_WORDS) {
    if (normalized.endsWith(` ${suffix}`)) {
      const rest = normalized.slice(0, -(suffix.length + 1)).trim();
      if (STOP_PHRASES.includes(rest) || /^(stop|cancel|quit|halt|nevermind|bye)$/i.test(rest)) {
        return true;
      }
    }
  }

  // Flexible Regex pattern for all combinations
  if (/^(hey\s*|ok\s*|okay\s*)?(rays?|raz[eo]r|google|waz[ey]s?|hermes|siri|alexa)?\s*(stop|cancel|never\s*mind|end\s*conversation|bye)\s*(rays?|raz[eo]r|google|waz[ey]s?|hermes|siri|alexa|please|now)?$/i.test(normalized)) {
    return true;
  }

  return false;
}

export function isWakeWordPhrase(text: string): boolean {
  if (!text) return false;
  const normalized = text
    .toLowerCase()
    .replace(/[.,!?;:…\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /\b(hey\s*rays?|hey\s*ray|hey\s*raze|hey\s*raise|hey\s*rais|hey\s*race|hey\s*raz[eo]r|hey\s*google|ok\s*google|okay\s*google|google|hey\s*waz[ey]s?|waz[ey]s?|hey\s*hermes|ok\s*rays?|rays?|rais|raise|hermes|siri|alexa)\b/i.test(normalized);
}

export class VoiceEngine {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private chunks: Blob[] = [];

  // Passive wake-word stream
  private wakeStream: MediaStream | null = null;
  private wakeAudioCtx: AudioContext | null = null;
  private wakeAnalyser: AnalyserNode | null = null;
  private wakeRecorder: MediaRecorder | null = null;
  private wakeChunks: Blob[] = [];
  private wakeAnimId: number | null = null;
  private wakeHeardSpeech = false;
  private wakeSilenceStartedAt: number | null = null;
  private wakeEvaluating = false;

  private recognition: any = null;
  private recognitionActive = false;

  private isContinuousMode = false;
  private isWakeListening = false;
  private ttsEnabled = false;
  private isSpeaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private ttsQueue: string[] = [];
  private turnClosing = false;

  // Hermes VAD Tuning
  private speechThreshold = 0.05; // RMS / 42 threshold
  private silenceMs = 1250; // 1.25s silence completes turn
  private heardSpeech = false;
  private silenceStartedAt: number | null = null;
  private recordingMimeType = "audio/webm";
  private lastLiveTranscript = "";
  private accumulatedTranscript = "";
  private stopResolver: ((blob: Blob | null) => void) | null = null;

  // Backend TTS (Edge TTS / OpenAI / ElevenLabs / pyttsx3 / OS)
  // 'auto' = try backend first, fallback to browser speechSynthesis
  private ttsProvider: string = "auto";
  private ttsVoice: string | null = null;
  private ttsSpeed: number = 1.0;
  private backendTtsAvailable: boolean | null = null; // null = not yet probed
  private currentAudio: HTMLAudioElement | null = null;

  // STT Provider ('auto' | 'faster-whisper' | 'groq' | 'openai' | 'google')
  private sttProvider: string = "auto";

  // Hermes-style Barge-in interruption
  private bargeInEnabled: boolean = true;
  private bargeInMonitorActive = false;
  private bargeInAnimId: number | null = null;

  // TTS Echo Guard: tracks what RAYS is currently speaking to filter self-captures
  private lastSpokenText: string = "";

  // Thinking chime: plays a gentle tone when processing user speech
  private thinkingChimeEnabled: boolean = true;

  public state: VoiceState = "idle";
  public onStateChange?: (state: VoiceState) => void;
  public onLevelChange?: VoiceLevelCallback;
  public onTranscript?: VoiceTranscriptCallback;
  public onFinalUtterance?: (utterance: string) => void;
  public onWakeWord?: () => void;
  public onStopWord?: () => void;

  private stateListeners = new Set<(state: VoiceState) => void>();
  private levelListeners = new Set<VoiceLevelCallback>();
  private transcriptListeners = new Set<VoiceTranscriptCallback>();
  private finalUtteranceListeners = new Set<(utterance: string) => void>();
  private wakeWordListeners = new Set<() => void>();
  private stopWordListeners = new Set<() => void>();

  public addStateListener(fn: (state: VoiceState) => void) {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }
  public addLevelListener(fn: VoiceLevelCallback) {
    this.levelListeners.add(fn);
    return () => this.levelListeners.delete(fn);
  }
  public addTranscriptListener(fn: VoiceTranscriptCallback) {
    this.transcriptListeners.add(fn);
    return () => this.transcriptListeners.delete(fn);
  }
  public addFinalUtteranceListener(fn: (utterance: string) => void) {
    this.finalUtteranceListeners.add(fn);
    return () => this.finalUtteranceListeners.delete(fn);
  }
  public addWakeWordListener(fn: () => void) {
    this.wakeWordListeners.add(fn);
    return () => this.wakeWordListeners.delete(fn);
  }
  public addStopWordListener(fn: () => void) {
    this.stopWordListeners.add(fn);
    return () => this.stopWordListeners.delete(fn);
  }

  constructor() {
    this.initRecognition();
    this.loadConfiguredSettings();
  }

  private setState(next: VoiceState) {
    if (this.state !== next) {
      this.state = next;
      this.onStateChange?.(next);
      this.stateListeners.forEach((fn) => {
        try { fn(next); } catch (e) { console.error(e); }
      });
    }
  }

  private emitLevel(lvl: number) {
    this.onLevelChange?.(lvl);
    this.levelListeners.forEach((fn) => {
      try { fn(lvl); } catch (e) { console.error(e); }
    });
  }

  private emitTranscript(text: string, isFinal: boolean) {
    this.onTranscript?.(text, isFinal);
    this.transcriptListeners.forEach((fn) => {
      try { fn(text, isFinal); } catch (e) { console.error(e); }
    });
  }

  private emitFinalUtterance(utterance: string) {
    this.onFinalUtterance?.(utterance);
    this.finalUtteranceListeners.forEach((fn) => {
      try { fn(utterance); } catch (e) { console.error(e); }
    });
  }

  private emitStopWord() {
    this.onStopWord?.();
    this.stopWordListeners.forEach((fn) => {
      try { fn(); } catch (e) { console.error(e); }
    });
  }

  private initRecognition() {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";
      this.recognition.maxAlternatives = 3;

      this.recognition.onresult = (event: any) => {
        let interim = "";
        let finalChunk = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk = (finalChunk ? finalChunk + " " : "") + chunk.trim();
            this.accumulatedTranscript = (this.accumulatedTranscript ? this.accumulatedTranscript + " " : "") + chunk.trim();
          } else {
            interim += chunk;
          }
        }

        const fullText = (this.accumulatedTranscript + (interim ? " " + interim : "")).trim();
        if (fullText) {
          this.lastLiveTranscript = fullText;

          // Passive wake word detection
          if (this.isWakeListening && !this.isContinuousMode && isWakeWordPhrase(fullText)) {
            this.accumulatedTranscript = "";
            this.lastLiveTranscript = "";
            this.triggerWakeWordActivated();
            return;
          }

          this.heardSpeech = true;
          this.silenceStartedAt = null;

          if (finalChunk) {
            this.emitTranscript(finalChunk, true);
          }
          if (interim) {
            this.emitTranscript(interim, false);
          }
        }
      };

      this.recognition.onerror = () => {
        this.recognitionActive = false;
      };

      this.recognition.onend = () => {
        this.recognitionActive = false;
        if (this.isContinuousMode || this.isWakeListening) {
          setTimeout(() => {
            if ((this.isContinuousMode || this.isWakeListening) && !this.recognitionActive) {
              try {
                this.recognition?.start();
                this.recognitionActive = true;
              } catch {
                // ignore
              }
            }
          }, 100);
        }
      };
    } catch {
      // ignore
    }
  }

  /** Melodic rising chime for Wake-Word */
  public playWakeChime() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {
      // ignore
    }
  }

  private triggerWakeWordActivated() {
    this.playWakeChime();
    this.stopPassiveWakeEngine();
    this.onWakeWord?.();
  }

  /** Start recording or continuous voice session */
  public async start(continuous = false): Promise<boolean> {
    this.stopPassiveWakeEngine();
    this.isContinuousMode = continuous;
    this.turnClosing = false;
    this.chunks = [];
    this.heardSpeech = false;
    this.silenceStartedAt = null;
    this.lastLiveTranscript = "";

    try {
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }

      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.75;

      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);

      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/wav",
      ];
      this.recordingMimeType =
        mimeTypes.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ||
        "audio/webm";

      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: this.recordingMimeType,
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const fullBlob = new Blob(this.chunks, { type: this.recordingMimeType });
        const resolver = this.stopResolver;
        this.stopResolver = null;
        resolver?.(fullBlob);
      };

      this.mediaRecorder.start();
      this.setState(continuous ? "listening" : "recording");

      // Adaptive Dynamic Noise Floor Calibration
      let ambientFloor = 0.015;
      let turnStartedAt = Date.now();

      const pcmData = new Uint8Array(this.analyser.fftSize);
      const tick = () => {
        if (!this.mediaRecorder || this.mediaRecorder.state === "inactive" || !this.analyser) return;
        this.analyser.getByteTimeDomainData(pcmData);

        let sum = 0;
        for (let i = 0; i < pcmData.length; i++) {
          const centered = pcmData[i] - 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / pcmData.length);
        const normalized = Math.min(1, rms / 42);
        const now = Date.now();

        this.emitLevel(normalized);

        // Track background noise floor when not speaking
        if (!this.heardSpeech) {
          ambientFloor = ambientFloor * 0.95 + normalized * 0.05;
        }

        const dynamicSpeechThreshold = Math.max(0.022, ambientFloor * 2.0 + 0.015);
        const dynamicSilenceThreshold = Math.max(0.012, ambientFloor * 1.25 + 0.008);

        // Hermes Adaptive Voice Activity Detection
        if (normalized >= dynamicSpeechThreshold) {
          this.heardSpeech = true;
          this.silenceStartedAt = null;
        } else if (this.heardSpeech && this.isContinuousMode && !this.turnClosing) {
          if (normalized < dynamicSilenceThreshold) {
            if (this.silenceStartedAt === null) {
              this.silenceStartedAt = now;
            } else if (now - this.silenceStartedAt >= this.silenceMs || (now - turnStartedAt >= 18000)) {
              // Silence detected or max safety duration reached -> end this turn, transcribe and submit!
              this.turnClosing = true;
              void this.handleContinuousTurnSilence();
              return;
            }
          } else {
            this.silenceStartedAt = null;
          }
        }

        this.animFrameId = requestAnimationFrame(tick);
      };
      tick();

      if (this.recognition && !this.recognitionActive) {
        try {
          this.recognition.start();
          this.recognitionActive = true;
        } catch {
          // ignore
        }
      }

      return true;
    } catch (err) {
      console.error("Failed to start voice:", err);
      this.stop();
      return false;
    }
  }

  /** When silence is detected in continuous mode: stop recorder, transcribe, and submit */
  private async handleContinuousTurnSilence() {
    if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
      this.turnClosing = false;
      return;
    }

    this.setState("transcribing");

    const stopPromise = new Promise<Blob | null>((resolve) => {
      this.stopResolver = resolve;
      try {
        this.mediaRecorder?.stop();
      } catch {
        this.stopResolver = null;
        resolve(null);
      }
    });

    const audioBlob = await stopPromise;

    let transcript = "";
    if (audioBlob && audioBlob.size > 100) {
      transcript = await this.callSttService(audioBlob, this.recordingMimeType);
    }

    const finalUtterance = (transcript || this.lastLiveTranscript || this.accumulatedTranscript).trim();
    this.accumulatedTranscript = "";
    this.lastLiveTranscript = "";
    this.chunks = [];
    this.heardSpeech = false;
    this.silenceStartedAt = null;
    this.turnClosing = false;

    // ── Whisper Hallucination Filter (Hermes parity) ──
    // Silent audio often produces "thank you", "thanks for watching", etc.
    if (isWhisperHallucination(finalUtterance)) {
      if (this.isContinuousMode) void this.start(true);
      return;
    }

    // ── TTS Echo Guard (Hermes parity) ──
    // If barge-in caught RAYS's own TTS output replayed through the mic, ignore it
    if (this.lastSpokenText && isTtsEcho(finalUtterance, this.lastSpokenText)) {
      if (this.isContinuousMode) void this.start(true);
      return;
    }

    // Check stop word
    if (isVoiceStopCommand(finalUtterance)) {
      this.emitStopWord();
      this.stop();
      return;
    }

    if (finalUtterance.length > 0) {
      // Clean leading wake phrases
      const cleanPrompt = finalUtterance
        .replace(/^(hey\s*rays?|hey\s*ray|hey\s*raze|hey\s*raise|hey\s*race|hey\s*raz[eo]r|hey\s*google|ok\s*google|okay\s*google|google|hey\s*waz[ey]s?|waz[ey]s?|hey\s*hermes|ok\s*rays?|rays?|rais|raise|hermes|siri|alexa)[,\s]*/i, "")
        .trim();

      // ── Thinking Chime (Hermes parity) ──
      if (this.thinkingChimeEnabled) playThinkingChime();

      this.setState("thinking");
      this.emitFinalUtterance(cleanPrompt || finalUtterance);

      // In continuous mode, re-arm listening for the next turn after TTS finishes
      // Use 1200ms delay to let TTS begin before we check isSpeaking state
      if (this.isContinuousMode) {
        setTimeout(() => {
          // Only re-arm if TTS hasn't started (drainTtsQueue handles re-arm after speech ends)
          if (
            this.isContinuousMode &&
            !this.isSpeaking &&
            this.state !== "recording" &&
            this.state !== "listening" &&
            this.state !== "speaking"
          ) {
            void this.start(true);
          }
        }, 1200);
      }
    } else if (this.isContinuousMode) {
      // Empty turn -> re-arm listening
      void this.start(true);
    }
  }

  public get speaking(): boolean {
    return this.isSpeaking || this.state === "speaking";
  }

  /** Universal STT dispatcher: handles Electron IPC bridge + Vite browser dev mode */
  private async callSttService(blob: Blob, mimeType: string): Promise<string> {
    const fetchPromise = (async () => {
      try {
        const base64 = await this.blobToBase64(blob);

        // 1. Electron App Mode
        if ((window as any).raysDesktop?.transcribeAudio) {
          const res = await (window as any).raysDesktop.transcribeAudio(
            base64,
            mimeType,
            this.sttProvider !== "auto" ? this.sttProvider : undefined
          );
          if (res && res.success && res.transcript) {
            return res.transcript.trim();
          }
        }

        // 2. Browser Dev Mode (npm run dev)
        const res = await fetch("/api/voice/transcribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            audioBase64: base64,
            mimeType,
            provider: this.sttProvider !== "auto" ? this.sttProvider : undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.transcript) {
            return data.transcript.trim();
          }
        }
      } catch (err) {
        console.warn("STT service error:", err);
      }
      return "";
    })();

    const timeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve(""), 8000);
    });

    return Promise.race([fetchPromise, timeoutPromise]);
  }

  /** Stop 1-turn dictation and return transcribed text */
  public async stopAndTranscribe(): Promise<string> {
    this.setState("transcribing");
    const liveBackup = (this.lastLiveTranscript || this.accumulatedTranscript).trim();

    if (liveBackup.length > 0) {
      this.stop();
      this.accumulatedTranscript = "";
      this.lastLiveTranscript = "";
      this.setState("idle");
      return liveBackup;
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        this.cleanup();
        this.setState("idle");
        resolve(liveBackup);
        return;
      }

      this.stopResolver = async (blob) => {
        let transcript = "";
        if (blob && blob.size > 100) {
          try {
            transcript = await this.callSttService(blob, this.recordingMimeType);
          } catch {
            // ignore
          }
        }
        const result = (transcript || liveBackup || this.lastLiveTranscript || this.accumulatedTranscript).trim();
        this.cleanup();
        this.accumulatedTranscript = "";
        this.lastLiveTranscript = "";
        this.setState("idle");
        resolve(result);
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        this.cleanup();
        this.setState("idle");
        resolve(liveBackup);
      }
    });
  }

  /** Stop all recording and listeners */
  public stop() {
    this.isContinuousMode = false;
    this.turnClosing = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.cleanup();
    this.setState("idle");
  }

  private cleanup() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
        this.recognitionActive = false;
      } catch {
        // ignore
      }
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.onLevelChange?.(0);
    this.heardSpeech = false;
    this.silenceStartedAt = null;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  public get continuousActive(): boolean {
    return this.isContinuousMode;
  }

  /**
   * Robust Dual-Engine Passive Wake-Word Listener (Hearing Mode / Ear button)
   * 1. Runs Web Speech API if supported
   * 2. Runs lightweight local VAD Audio Snippet STT listener as a guaranteed fallback!
   */
  public async setPassiveWakeListening(enabled: boolean) {
    this.isWakeListening = enabled;
    if (enabled) {
      if (this.isContinuousMode) return;

      // Start Web Speech API listener
      this.initRecognition();
      if (this.recognition && !this.recognitionActive) {
        try {
          this.recognition.start();
          this.recognitionActive = true;
        } catch {
          // ignore
        }
      }

      // Start Background VAD STT wake detector
      void this.startPassiveWakeEngine();
    } else {
      this.stopPassiveWakeEngine();
      if (!this.isContinuousMode) {
        if (this.recognition) {
          try {
            this.recognition.stop();
            this.recognitionActive = false;
          } catch {
            // ignore
          }
        }
      }
    }
  }

  private async startPassiveWakeEngine() {
    if (this.wakeStream || this.isContinuousMode) return;

    try {
      this.wakeStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.wakeAudioCtx = new AudioContextClass();
      if (this.wakeAudioCtx.state === "suspended") {
        await this.wakeAudioCtx.resume();
      }

      this.wakeAnalyser = this.wakeAudioCtx.createAnalyser();
      this.wakeAnalyser.fftSize = 256;
      this.wakeAnalyser.smoothingTimeConstant = 0.50;

      const src = this.wakeAudioCtx.createMediaStreamSource(this.wakeStream);
      src.connect(this.wakeAnalyser);

      const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/wav"];
      const mime = mimeTypes.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "audio/webm";

      this.wakeHeardSpeech = false;
      this.wakeSilenceStartedAt = null;
      this.wakeEvaluating = false;
      this.wakeChunks = [];

      let wakeAmbientFloor = 0.010;
      let wakePhraseStartedAt = 0;

      const pcmData = new Uint8Array(this.wakeAnalyser.fftSize);
      const wakeTick = () => {
        if (!this.wakeAnalyser || !this.isWakeListening || this.isContinuousMode) return;

        this.wakeAnalyser.getByteTimeDomainData(pcmData);
        let sum = 0;
        for (let i = 0; i < pcmData.length; i++) {
          const c = pcmData[i] - 128;
          sum += c * c;
        }
        const rms = Math.sqrt(sum / pcmData.length);
        const norm = rms / 36;
        const now = Date.now();

        // Track ambient floor
        if (!this.wakeHeardSpeech) {
          wakeAmbientFloor = wakeAmbientFloor * 0.92 + norm * 0.08;
        }

        const dynamicTrigger = Math.max(0.012, wakeAmbientFloor * 1.5 + 0.008);
        const dynamicSilence = Math.max(0.008, wakeAmbientFloor * 1.15 + 0.004);

        // Speech energy detected -> start recording this wake phrase
        if (norm >= dynamicTrigger && !this.wakeHeardSpeech && !this.wakeEvaluating) {
          this.wakeHeardSpeech = true;
          this.wakeSilenceStartedAt = null;
          this.wakeChunks = [];
          wakePhraseStartedAt = now;

          try {
            this.wakeRecorder = new MediaRecorder(this.wakeStream!, { mimeType: mime });
            this.wakeRecorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) this.wakeChunks.push(e.data);
            };
            this.wakeRecorder.start();
          } catch (e) {
            this.wakeHeardSpeech = false;
          }
        } else if (this.wakeHeardSpeech && !this.wakeEvaluating) {
          const isSilent = norm < dynamicSilence;
          const isMaxTimeout = now - wakePhraseStartedAt >= 3000;

          if (isSilent) {
            if (this.wakeSilenceStartedAt === null) {
              this.wakeSilenceStartedAt = now;
            } else if (now - this.wakeSilenceStartedAt >= 400 || isMaxTimeout) {
              // Pause detected -> finish phrase and evaluate with STT
              this.wakeEvaluating = true;
              void this.finalizePassiveWakeUtterance(mime);
              return;
            }
          } else if (isMaxTimeout) {
            this.wakeEvaluating = true;
            void this.finalizePassiveWakeUtterance(mime);
            return;
          } else {
            this.wakeSilenceStartedAt = null;
          }
        }

        this.wakeAnimId = requestAnimationFrame(wakeTick);
      };
      wakeTick();
    } catch (err) {
      console.warn("Passive wake engine start error:", err);
    }
  }

  private async finalizePassiveWakeUtterance(mime: string) {
    if (!this.wakeRecorder || this.wakeRecorder.state === "inactive") {
      this.resumePassiveWakeLoop();
      return;
    }

    const blobPromise = new Promise<Blob>((resolve) => {
      this.wakeRecorder!.onstop = () => {
        resolve(new Blob(this.wakeChunks, { type: mime }));
      };
      try {
        this.wakeRecorder!.stop();
      } catch {
        resolve(new Blob(this.wakeChunks, { type: mime }));
      }
    });

    const fullBlob = await blobPromise;
    this.wakeChunks = [];

    if (fullBlob.size > 200) {
      try {
        const transcript = await this.callSttService(fullBlob, mime);
        if (transcript && isWakeWordPhrase(transcript) && this.isWakeListening && !this.isContinuousMode) {
          this.triggerWakeWordActivated();
          return;
        }
      } catch {
        // ignore
      }
    }

    this.resumePassiveWakeLoop();
  }

  private resumePassiveWakeLoop() {
    this.wakeHeardSpeech = false;
    this.wakeSilenceStartedAt = null;
    this.wakeEvaluating = false;
    if (this.isWakeListening && !this.isContinuousMode) {
      if (this.wakeAnimId) {
        cancelAnimationFrame(this.wakeAnimId);
        this.wakeAnimId = null;
      }
      this.stopPassiveWakeEngine();
      void this.startPassiveWakeEngine();
    }
  }

  private stopPassiveWakeEngine() {
    if (this.wakeAnimId) {
      cancelAnimationFrame(this.wakeAnimId);
      this.wakeAnimId = null;
    }
    if (this.wakeRecorder && this.wakeRecorder.state !== "inactive") {
      try {
        this.wakeRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.wakeRecorder = null;
    this.wakeChunks = [];
    if (this.wakeStream) {
      this.wakeStream.getTracks().forEach((t) => t.stop());
      this.wakeStream = null;
    }
    if (this.wakeAudioCtx) {
      void this.wakeAudioCtx.close();
      this.wakeAudioCtx = null;
    }
    this.wakeAnalyser = null;
    this.wakeHeardSpeech = false;
    this.wakeSilenceStartedAt = null;
    this.wakeEvaluating = false;
  }

  public get passiveWakeListening(): boolean {
    return this.isWakeListening;
  }

  public setTtsEnabled(enabled: boolean) {
    this.ttsEnabled = enabled;
    if (!enabled) {
      this.stopSpeech();
    }
  }

  public get isTtsEnabled(): boolean {
    return this.ttsEnabled;
  }

  /** Configure backend TTS provider ('auto'|'edge'|'openai'|'elevenlabs'|'pyttsx3'|'system'|'browser') */
  public loadConfiguredSettings() {
    const s = loadVoiceSettings();
    this.ttsProvider = s.ttsProvider;
    this.ttsVoice = s.ttsVoice;
    this.ttsSpeed = s.ttsSpeed;
    this.sttProvider = s.sttProvider;
    this.ttsEnabled = s.autoSpeakReplies;
    this.bargeInEnabled = s.bargeInEnabled;
    this.silenceMs = s.silenceTimeoutMs;
    if (s.wakeWordEnabled) {
      void this.setPassiveWakeListening(true);
    }
  }

  public applyVoiceSettings(s: VoiceSettings) {
    this.ttsProvider = s.ttsProvider;
    this.ttsVoice = s.ttsVoice;
    this.ttsSpeed = s.ttsSpeed;
    this.sttProvider = s.sttProvider;
    this.ttsEnabled = s.autoSpeakReplies;
    this.bargeInEnabled = s.bargeInEnabled;
    this.silenceMs = s.silenceTimeoutMs;
    this.backendTtsAvailable = null;
    saveVoiceSettings(s);
  }

  public get currentSettings(): VoiceSettings {
    return {
      ttsProvider: this.ttsProvider as any,
      ttsVoice: this.ttsVoice || "en-US-AriaNeural",
      ttsSpeed: this.ttsSpeed,
      sttProvider: this.sttProvider as any,
      autoSpeakReplies: this.ttsEnabled,
      wakeWordEnabled: this.isWakeListening,
      bargeInEnabled: this.bargeInEnabled,
      silenceTimeoutMs: this.silenceMs,
    };
  }

  public setSttProvider(provider: string) {
    this.sttProvider = provider;
    saveVoiceSettings({ sttProvider: provider as any });
  }

  public get sttCurrentProvider(): string {
    return this.sttProvider;
  }

  public setBargeInEnabled(enabled: boolean) {
    this.bargeInEnabled = enabled;
    saveVoiceSettings({ bargeInEnabled: enabled });
  }

  public get isBargeInEnabled(): boolean {
    return this.bargeInEnabled;
  }

  /** Quick voice audition test */
  public async testVoice(sampleText = "Hello! This is RAYS with neural voice synthesis."): Promise<boolean> {
    const clean = this.sanitizeForSpeech(sampleText);
    this.stopSpeech();
    return this.speakViaBackend(clean).then((ok) => {
      if (!ok) {
        this._speakViaBrowser(clean);
      }
      return true;
    });
  }

  /** Configure backend TTS provider ('auto'|'edge'|'openai'|'elevenlabs'|'pyttsx3'|'system'|'browser') */
  public setTtsProvider(provider: string) {
    this.ttsProvider = provider;
    this.backendTtsAvailable = null; // reset probe cache on provider change
    saveVoiceSettings({ ttsProvider: provider as any });
  }

  /** Set Edge TTS voice name (e.g. 'en-US-AriaNeural', 'en-GB-SoniaNeural') */
  public setTtsVoice(voice: string | null) {
    this.ttsVoice = voice;
    if (voice) saveVoiceSettings({ ttsVoice: voice });
  }

  /** Set TTS speed (0.5–2.0, 1.0 = normal) */
  public setTtsSpeed(speed: number) {
    this.ttsSpeed = Math.max(0.5, Math.min(2.0, speed));
    saveVoiceSettings({ ttsSpeed: this.ttsSpeed });
  }

  public get ttsCurrentProvider(): string { return this.ttsProvider; }
  public get ttsCurrentVoice(): string | null { return this.ttsVoice; }

  private startBargeInMonitor() {
    if (!this.bargeInEnabled || this.bargeInMonitorActive) return;
    this.bargeInMonitorActive = true;
    let speechCounter = 0;

    const monitorTick = () => {
      if (!this.isSpeaking || !this.bargeInMonitorActive) {
        this.bargeInMonitorActive = false;
        return;
      }

      if (this.analyser) {
        const pcmData = new Uint8Array(this.analyser.fftSize);
        this.analyser.getByteTimeDomainData(pcmData);
        let sum = 0;
        for (let i = 0; i < pcmData.length; i++) {
          const centered = pcmData[i] - 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / pcmData.length);
        const normalized = Math.min(1, rms / 42);

        // Hermes barge-in threshold during playback (>= 0.12)
        if (normalized >= 0.12) {
          speechCounter++;
          if (speechCounter >= 8) { // sustained user speech detected -> interrupt!
            this.bargeInMonitorActive = false;
            this.stopSpeech();
            if (this.isContinuousMode) {
              void this.start(true);
            }
            return;
          }
        } else {
          speechCounter = Math.max(0, speechCounter - 1);
        }
      }

      this.bargeInAnimId = requestAnimationFrame(monitorTick);
    };

    this.bargeInAnimId = requestAnimationFrame(monitorTick);
  }

  private stopBargeInMonitor() {
    this.bargeInMonitorActive = false;
    if (this.bargeInAnimId) {
      cancelAnimationFrame(this.bargeInAnimId);
      this.bargeInAnimId = null;
    }
  }

  /**
   * Backend TTS via /api/voice/tts (Edge TTS / OpenAI / ElevenLabs / pyttsx3 / OS)
   * Returns base64 audio that plays via HTMLAudioElement — much better quality than Web Speech API.
   */
  private async speakViaBackend(text: string): Promise<boolean> {
    if (this.ttsProvider === "browser") return false;

    try {
      let data: any;

      if ((window as any).raysDesktop?.synthesizeSpeech) {
        // Use Electron IPC
        data = await (window as any).raysDesktop.synthesizeSpeech(
          text,
          this.ttsProvider !== "auto" ? this.ttsProvider : undefined,
          this.ttsVoice || undefined,
          this.ttsSpeed
        );
      } else {
        // Use Vite Proxy
        const body: Record<string, unknown> = { text, speed: this.ttsSpeed };
        if (this.ttsProvider !== "auto") body.provider = this.ttsProvider;
        if (this.ttsVoice) body.voice = this.ttsVoice;

        const res = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout ? AbortSignal.timeout(32000) : undefined,
        });

        if (!res.ok) return false;
        data = await res.json();
      }

      if (!data?.success || !data.audioBase64) return false;

      // Mark backend as available
      this.backendTtsAvailable = true;

      // Play via HTMLAudioElement (works in all browsers, no voice-list quirks)
      return new Promise<boolean>((resolve) => {
        const audio = new Audio(`data:${data.mimeType || "audio/mpeg"};base64,${data.audioBase64}`);
        this.currentAudio = audio;

        audio.onended = () => {
          this.currentAudio = null;
          resolve(true);
          this._onTtsDone();
        };
        audio.onerror = () => {
          this.currentAudio = null;
          resolve(false); // fallback to browser TTS
        };

        audio.play().catch(() => {
          this.currentAudio = null;
          resolve(false);
        });
      });
    } catch {
      this.backendTtsAvailable = false;
      return false;
    }
  }

  /** Called when TTS audio finishes (backend or browser) — re-arms continuous mode */
  private _onTtsDone() {
    this.stopBargeInMonitor();
    this.isSpeaking = false;
    this.currentUtterance = null;
    if (this.ttsQueue.length > 0) {
      this.drainTtsQueue();
    } else if (this.isContinuousMode) {
      // Auto re-arm: immediately restart listening after TTS finishes (Hermes behavior)
      void this.start(true);
    } else {
      this.setState("idle");
    }
  }

  /**
   * Speak text aloud.
   * Uses Hermes-level text normalization (strips markdown, code blocks, <think> blocks,
   * converts symbols/units/currency to words, strips emojis).
   * Priority: Backend TTS (Edge/OpenAI/ElevenLabs/pyttsx3) → Web Speech Synthesis fallback.
   * In continuous mode, re-arms listening automatically when done (Hermes style).
   */
  public speak(text: string) {
    const clean = prepareSpokeText(text);
    if (!clean) return;

    // Track for TTS echo guard — barge-in will compare captured audio against this
    this.lastSpokenText = clean;

    this.ttsQueue.push(clean);
    if (!this.isSpeaking) {
      this.drainTtsQueue();
    }
  }

  private drainTtsQueue() {
    if (this.ttsQueue.length === 0) {
      this._onTtsDone();
      return;
    }

    const nextText = this.ttsQueue.shift();
    if (!nextText) { this.drainTtsQueue(); return; }

    this.isSpeaking = true;
    this.setState("speaking");
    this.startBargeInMonitor();

    // Try backend TTS first (unless provider is explicitly 'browser')
    if (this.ttsProvider !== "browser" && typeof window !== "undefined" && window.fetch) {
      void this.speakViaBackend(nextText).then((didPlay) => {
        if (!didPlay) {
          // Backend unavailable — fall through to browser Web Speech API
          this._speakViaBrowser(nextText);
        }
        // If didPlay is true, _onTtsDone() was already called from audio.onended
      });
    } else {
      this._speakViaBrowser(nextText);
    }
  }

  /** Browser Web Speech Synthesis fallback (always works in Chrome/Edge, limited on Firefox/Linux) */
  private _speakViaBrowser(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      this._onTtsDone();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.ttsSpeed;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    // Priority order: high-quality voices first, broad English fallback for any OS
    // macOS: Samantha, Alex, Daniel | Windows: Zira, Hazel, David | Linux: any en voice
    const preferredVoice =
      voices.find((v) => v.name === "Samantha" && v.lang.startsWith("en")) ||       // macOS best
      voices.find((v) => v.name === "Alex" && v.lang.startsWith("en")) ||            // macOS alt
      voices.find((v) => v.name.includes("Zira") && v.lang.startsWith("en")) ||     // Windows female
      voices.find((v) => v.name.includes("Hazel") && v.lang.startsWith("en")) ||    // Windows alt
      voices.find((v) => v.name.includes("David") && v.lang.startsWith("en")) ||    // Windows male
      voices.find((v) => v.name.includes("Daniel") && v.lang.startsWith("en")) ||   // macOS/iOS
      voices.find((v) => v.name.includes("Google") && v.lang.startsWith("en")) ||   // Chrome
      voices.find((v) => v.name.includes("Natural") && v.lang.startsWith("en")) ||  // Neural voices
      voices.find((v) => v.name.includes("English") && v.lang.startsWith("en")) ||  // Generic en
      voices.find((v) => v.lang === "en-US") ||                                      // Any en-US
      voices.find((v) => v.lang.startsWith("en")) ||                                 // Any English
      voices[0] || null;                                                              // Ultimate fallback
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      this.currentUtterance = null;
      this._onTtsDone();
    };
    utterance.onerror = () => {
      this.currentUtterance = null;
      this._onTtsDone();
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  public stopSpeech() {
    this.stopBargeInMonitor();
    this.ttsQueue = [];

    // Stop HTMLAudioElement (backend TTS)
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.src = "";
      } catch {}
      this.currentAudio = null;
    }

    // Stop Web Speech Synthesis
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    this.isSpeaking = false;
    this.currentUtterance = null;
    if (this.state === "speaking") {
      this.setState("idle");
    }
  }

  /** @deprecated Use prepareSpokeText() instead — kept for backward compat */
  private sanitizeForSpeech(raw: string): string {
    return prepareSpokeText(raw);
  }
}

export const voiceEngine = new VoiceEngine();

