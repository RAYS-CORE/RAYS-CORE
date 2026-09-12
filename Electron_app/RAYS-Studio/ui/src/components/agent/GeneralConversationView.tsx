import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Radio,
  Terminal,
  Activity,
  ChevronDown,
  Layers,
  FolderOpen,
  Ear,
  EarOff,
  AudioLines,
  Square,
  Loader2,
} from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { FluidGlobeVisualizer } from "./FluidGlobeVisualizer";
import { VoiceActivity, VoiceLevelBars } from "@/components/agent/hermes/VoiceActivity";
import { voiceEngine, type VoiceState } from "@/services/voiceService";

export interface RoutedAnswerItem {
  id: string;
  agentName: string;
  sessionId: string;
  prompt: string;
  answer: string;
  timestamp: number;
  confidence?: number;
}

interface GeneralConversationViewProps {
  onSendPrompt: (prompt: string) => void;
  answers: RoutedAnswerItem[];
  isRouting?: boolean;
  routingStatus?: string;
  connectedSessionsCount?: number;
  activeSessions?: Array<{ id: string; name: string; cwd: string }>;
  workspaceRoot?: string | null;
}

export const GeneralConversationView: React.FC<GeneralConversationViewProps> = ({
  onSendPrompt,
  answers,
  isRouting = false,
  routingStatus = "Ready to route",
  connectedSessionsCount,
  activeSessions: externalSessions = [],
  workspaceRoot = null,
}) => {
  const [inputPrompt, setInputPrompt] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [isDictating, setIsDictating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isContinuousListening, setIsContinuousListening] = useState(false);
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showAgentsModal, setShowAgentsModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [liveSessions, setLiveSessions] = useState<Array<{ id: string; name: string; cwd: string }>>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Timer for voice activity elapsed seconds
  useEffect(() => {
    let interval: any = null;
    if (isDictating || isTranscribing || isContinuousListening) {
      interval = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDictating, isTranscribing, isContinuousListening]);

  // Auto-fetch actual running terminal sessions from Electron backend
  const fetchLiveAgents = async () => {
    try {
      if ((window as any).raysDesktop?.listConnectedAgents) {
        const res = await (window as any).raysDesktop.listConnectedAgents(workspaceRoot || "");
        if (Array.isArray(res) && res.length > 0) {
          setLiveSessions(res);
          return;
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void fetchLiveAgents();
    const interval = setInterval(() => {
      void fetchLiveAgents();
    }, 4000);
    return () => clearInterval(interval);
  }, [workspaceRoot]);

  // Determine current active sessions list
  const currentSessions = useMemo(() => {
    if (liveSessions.length > 0) return liveSessions;
    if (externalSessions.length > 0) return externalSessions;
    return [
      { id: "ttys001", name: "RAYS Core Terminal", cwd: "~/Desktop/Win_C/RAYS-CORE" },
      { id: "ttys006", name: "PMCN Worker Agent", cwd: "~/Desktop/Win_C/RAYS-CORE" },
      { id: "ttys009", name: "STDP Engine Agent", cwd: "~/Desktop/Win_C/RAYS-CORE" },
    ];
  }, [liveSessions, externalSessions]);

  const actualCount = connectedSessionsCount !== undefined && connectedSessionsCount > 0
    ? connectedSessionsCount
    : currentSessions.length;

  // Auto-expire answers older than 15 minutes (15 * 60 * 1000 ms)
  const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Filter out answers older than 15 minutes, maintain max 3 FIFO answers
  const visibleAnswers = useMemo(() => {
    const fresh = answers.filter((a) => currentTime - a.timestamp < FIFTEEN_MINUTES_MS);
    return fresh.slice(-3);
  }, [answers, currentTime]);

  // Read aloud new answers when TTS is enabled
  const spokenAnswerIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!ttsEnabled) return;
    for (const item of answers) {
      if (!spokenAnswerIds.current.has(item.id)) {
        spokenAnswerIds.current.add(item.id);
        const speechHeader = `${item.agentName} says: `;
        voiceEngine.speak(`${speechHeader} ${item.answer}`);
      }
    }
  }, [answers, ttsEnabled]);

  const [wakeActive, setWakeActive] = useState(false);

  // Persistent refs for voice callbacks
  const isContinuousListeningRef = useRef(isContinuousListening);
  const isWakeWordActiveRef = useRef(isWakeWordActive);
  const onSendPromptRef = useRef(onSendPrompt);

  useEffect(() => { isContinuousListeningRef.current = isContinuousListening; }, [isContinuousListening]);
  useEffect(() => { isWakeWordActiveRef.current = isWakeWordActive; }, [isWakeWordActive]);
  useEffect(() => { onSendPromptRef.current = onSendPrompt; }, [onSendPrompt]);

  // Connect VoiceEngine callbacks ONCE on mount
  useEffect(() => {
    const unLevel = voiceEngine.addLevelListener((level) => {
      setAudioLevel(level);
    });

    const unState = voiceEngine.addStateListener((state) => {
      setVoiceState(state);
      setIsDictating(state === "recording");
      setIsTranscribing(state === "transcribing");
      if (state === "listening" || state === "recording") {
        setIsContinuousListening(voiceEngine.continuousActive);
      }
    });

    const unWake = voiceEngine.addWakeWordListener(() => {
      setWakeActive(true);
      setTimeout(() => setWakeActive(false), 2400);
      setIsContinuousListening(true);
    });

    const unTranscript = voiceEngine.addTranscriptListener((transcript, isFinal) => {
      if (isFinal) {
        setInputPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setInterimTranscript("");
      } else {
        setInterimTranscript(transcript);
      }
    });

    const unUtterance = voiceEngine.addFinalUtteranceListener((utterance) => {
      const clean = utterance.trim();
      if (isContinuousListeningRef.current && clean.length > 0) {
        onSendPromptRef.current(clean);
        setInputPrompt("");
        setInterimTranscript("");
      }
    });

    const unStop = voiceEngine.addStopWordListener(() => {
      setIsContinuousListening(false);
      setIsDictating(false);
      setIsTranscribing(false);
      setInterimTranscript("");
      voiceEngine.stop();
      voiceEngine.stopSpeech();
      if (isWakeWordActiveRef.current) {
        voiceEngine.setPassiveWakeListening(true);
      }
    });

    return () => {
      unLevel();
      unState();
      unWake();
      unTranscript();
      unUtterance();
      unStop();
      voiceEngine.stop();
      voiceEngine.stopSpeech();
    };
  }, []);

  // Push-to-talk single-turn dictation
  const toggleDictation = async () => {
    if (isDictating) {
      setIsDictating(false);
      setIsTranscribing(true);
      setInterimTranscript("");
      try {
        const text = await voiceEngine.stopAndTranscribe();
        if (text && text.trim()) {
          const clean = text.trim();
          setInputPrompt((prev) => {
            const current = prev.trim();
            if (current.includes(clean)) return current;
            return current ? `${current} ${clean}` : clean;
          });
        }
      } finally {
        setIsTranscribing(false);
        textareaRef.current?.focus();
      }
    } else {
      if (isContinuousListening) {
        setIsContinuousListening(false);
        voiceEngine.stop();
      }
      setInterimTranscript("");
      const ok = await voiceEngine.start(false);
      setIsDictating(ok);
    }
  };

  const toggleContinuousVoice = async () => {
    if (isContinuousListening) {
      setIsContinuousListening(false);
      voiceEngine.stop();
    } else {
      if (isDictating) {
        setIsDictating(false);
        voiceEngine.stop();
      }
      setInterimTranscript("");
      const ok = await voiceEngine.start(true);
      setIsContinuousListening(ok);
    }
  };

  const toggleWakeWord = () => {
    const next = !isWakeWordActive;
    setIsWakeWordActive(next);
    voiceEngine.setPassiveWakeListening(next);
  };

  const handleToggleTts = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    voiceEngine.setTtsEnabled(next);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = inputPrompt.trim();
    if (prompt) {
      onSendPrompt(prompt);
      setInputPrompt("");
      setInterimTranscript("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#090812] via-[#0d0c18] to-[#080710] select-none text-[11px]">
      {/* ────────────────────────────────────────────────────────────────────
          TOP CONTROL BAR (Ultra-Compact Hermes Styling)
          ──────────────────────────────────────────────────────────────────── */}
      <div className="relative z-30 flex items-center justify-between px-4 py-2 border-b border-white/[0.05] bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rays-violet/15 border border-rays-violet/25 text-rays-lilac text-[10px] font-medium tracking-wide">
            <Radio size={11} className="text-rays-pink animate-pulse" />
            <span>General Router</span>
          </div>

          {/* Clickable Connected Agents Pill with Scrollable Dropdown Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                void fetchLiveAgents();
                setShowAgentsModal((prev) => !prev);
              }}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.04] transition-all cursor-pointer"
            >
              <Terminal size={10} className="text-rays-lavender" />
              <span>
                {actualCount} Connected Agent{actualCount !== 1 ? "s" : ""}
              </span>
              <ChevronDown size={9} className={`text-muted-foreground/50 transition-transform duration-200 ${showAgentsModal ? "rotate-180" : ""}`} />
            </button>

            {/* Connected Agents Popover Dropdown (Scrollable) */}
            {showAgentsModal && (
              <div className="absolute top-7 left-0 w-72 rounded-xl bg-[#14101e]/95 border border-white/[0.1] shadow-2xl backdrop-blur-xl p-2.5 z-50 space-y-2 pointer-events-auto">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06] text-[10.5px] font-semibold text-white/90">
                  <span className="flex items-center gap-1.5">
                    <Layers size={11} className="text-rays-pink" />
                    <span>Active Agents ({actualCount})</span>
                  </span>
                  <span className="text-[9px] text-rays-lilac font-mono">live</span>
                </div>

                <div className="space-y-1 max-h-48 overflow-y-auto pr-1 select-text overscroll-contain">
                  {currentSessions.map((sess, idx) => (
                    <div
                      key={`${sess.id}-${idx}`}
                      className="p-1.5 rounded bg-white/[0.03] border border-white/[0.04] flex items-center justify-between text-[10px]"
                    >
                      <div className="space-y-0.5 truncate mr-2">
                        <div className="font-medium text-white/90 truncate flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="truncate">{sess.name}</span>
                        </div>
                        <div className="text-[9px] font-mono text-muted-foreground/70 truncate flex items-center gap-1">
                          <span>{sess.id}</span>
                          {sess.cwd && (
                            <>
                              <span>·</span>
                              <span className="truncate">{sess.cwd.split(/[/\\]/).pop()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isRouting && (
            <div className="flex items-center gap-1 text-[10px] text-rays-pink animate-pulse">
              <Activity size={10} />
              <span>Routing…</span>
            </div>
          )}
        </div>

        {/* Right status badge */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
          <span className="font-mono">{routingStatus}</span>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────
          CENTER STAGE: 3D SOLAR PLASMA GLOBE & TOP-LEFT FLOATING ANSWERS
          ──────────────────────────────────────────────────────────────────── */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center min-h-0 overflow-hidden">
        {/* Centered Audio-Reactive 3D Solar Plasma Globe */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <FluidGlobeVisualizer
            audioLevel={audioLevel}
            isActive={isContinuousListening || Boolean(inputPrompt) || wakeActive}
            isSpeaking={voiceState === "speaking"}
            isRouting={isRouting}
            size={780}
          />
        </div>

        {/* Ambient Subtle Glow Backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.05)_0%,transparent_70%)] pointer-events-none" />

        {/* ──────────────────────────────────────────────────────────────────
            TOP-LEFT FLOATING ANSWER FEED (FIFO 3 ITEMS, 15-MIN AUTO-FADE)
            When empty, renders NOTHING so only the plasma globe is visible!
            ────────────────────────────────────────────────────────────────── */}
        {visibleAnswers.length > 0 && (
          <div className="absolute left-5 top-5 w-full max-w-md z-20 flex flex-col justify-start pointer-events-none pb-2">
            <div className="space-y-2.5 pointer-events-auto max-h-[calc(100vh-200px)] overflow-y-auto no-scrollbar pr-1">
              <AnimatePresence initial={false} mode="popLayout">
                {visibleAnswers.map((item) => {
                  const htmlAnswer = DOMPurify.sanitize(marked.parse(item.answer) as string);
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -60, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        x: -180,
                        scale: 0.9,
                        transition: { duration: 0.45, ease: "easeInOut" },
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 24 }}
                      className="relative p-3 rounded-lg border border-white/[0.08] bg-black/50 backdrop-blur-xl shadow-2xl text-white group hover:border-rays-violet/40 transition-colors"
                    >
                      {/* Glow Accent Stripe */}
                      <div className="absolute top-0 left-0 w-1 h-full rounded-l-lg bg-gradient-to-b from-rays-pink via-rays-violet to-rays-lavender" />

                      {/* Header Origin Tag */}
                      <div className="flex items-center justify-between gap-2 mb-1 pb-1 border-b border-white/[0.05]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[10px] tracking-wide uppercase text-transparent bg-clip-text bg-gradient-to-r from-rays-pink to-rays-lilac">
                            {item.agentName}
                          </span>
                          <span className="text-[9px] font-mono text-muted-foreground/70 bg-white/[0.04] px-1 py-0.2 rounded">
                            {item.sessionId}
                          </span>
                        </div>
                        <span className="text-[9px] text-muted-foreground/60 font-mono">
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* Markdown Answer Content in Crisp Compact Typography */}
                      <div
                        className="prose prose-invert prose-sm max-w-none text-white text-[11px] leading-relaxed select-text font-normal [&_p]:my-0.5 [&_ul]:my-0.5 [&_li]:my-0.5 [&_strong]:text-white [&_strong]:font-semibold [&_pre]:bg-black/60 [&_pre]:border [&_pre]:border-white/10 [&_code]:text-rays-lilac"
                        dangerouslySetInnerHTML={{ __html: htmlAnswer }}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────
          BOTTOM COMPOSER & VOICE BAR (Hermes Minimalist Floating Style)
          ──────────────────────────────────────────────────────────────────── */}
      <div className="relative z-30 p-3 border-t border-white/[0.06] bg-black/50 backdrop-blur-xl">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex flex-col gap-1.5">
          {/* Hermes VoiceActivity Ribbon (Dictating / Transcribing with live timer and level meter) */}
          <VoiceActivity
            state={{
              status: isTranscribing
                ? "transcribing"
                : isDictating
                ? "recording"
                : isContinuousListening
                ? "listening"
                : "idle",
              elapsedSeconds,
              level: audioLevel,
            }}
          />

          <div className="flex items-center gap-2 bg-[#161619]/90 border border-white/10 focus-within:border-white/20 rounded-2xl p-2 shadow-2xl transition-all">
            {/* Prompt Input Box */}
            <div className="relative flex-1 flex items-center px-1 py-0.5">
              <textarea
                ref={textareaRef}
                value={interimTranscript ? `${inputPrompt} ${interimTranscript}` : inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isContinuousListening ? "Listening live… Speak your prompt…" : "Type or speak your prompt across active terminal agents…"}
                rows={1}
                className="w-full bg-transparent text-[11.5px] text-white placeholder:text-muted-foreground/50 outline-none resize-none max-h-24 overflow-y-auto leading-relaxed select-text"
              />
            </div>

            {/* Right Hermes-Style Control Suite: Dictation, AutoSpeak, Ear Wake-Word, and Continuous Wave / Send */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* 1. Dictation Mic Button (Single Turn Push-to-Talk) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void toggleDictation();
                }}
                disabled={isContinuousListening || isTranscribing}
                className={`p-1.5 rounded-md flex items-center justify-center transition-all ${
                  isDictating
                    ? "bg-rays-pink text-white shadow-[0_0_12px_rgba(236,72,153,0.6)] animate-pulse"
                    : isTranscribing
                    ? "bg-rays-violet/30 text-rays-pink"
                    : "text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.06]"
                } disabled:opacity-30`}
                title={isTranscribing ? "Transcribing audio..." : isDictating ? "Click to stop dictation and insert prompt" : "Dictate prompt (Push to Talk)"}
              >
                {isTranscribing ? (
                  <Loader2 size={13} className="animate-spin text-rays-pink" />
                ) : isDictating ? (
                  <Square size={13} className="fill-current text-white" />
                ) : (
                  <Mic size={13} />
                )}
              </button>

              {/* 2. AutoSpeak Button (Read replies aloud) */}
              <button
                type="button"
                onClick={handleToggleTts}
                className={`p-1.5 rounded-md flex items-center justify-center transition-all ${
                  ttsEnabled
                    ? "text-rays-lilac bg-rays-violet/20"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.06]"
                }`}
                title={ttsEnabled ? "Replies read aloud (Click to mute)" : "Read replies aloud"}
              >
                {ttsEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>

              {/* 3. Wake-Word Ear Button (Passively listens for 'Hey RAYS') */}
              <button
                type="button"
                onClick={toggleWakeWord}
                className={`p-1.5 rounded-md flex items-center justify-center transition-all ${
                  isWakeWordActive
                    ? "text-rays-pink bg-rays-pink/15 shadow-[0_0_10px_rgba(236,72,153,0.3)] animate-pulse"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.06]"
                }`}
                title={isWakeWordActive ? 'Wake word: "hey rays" — listening' : 'Enable wake word: "hey rays"'}
              >
                {isWakeWordActive ? <Ear size={13} /> : <EarOff size={13} />}
              </button>

              {/* 4. Continuous Conversation Wave Button / Conversation Pill */}
              {isContinuousListening ? (
                <button
                  type="button"
                  onClick={toggleContinuousVoice}
                  className="flex items-center gap-2 bg-[#d8b4fe] hover:bg-[#c084fc] text-zinc-950 px-3 py-1 rounded-full shadow-md shadow-purple-500/20 transition-all cursor-pointer select-none"
                  title='Click to end voice conversation (or say "stop")'
                >
                  <VoiceLevelBars active={true} level={audioLevel} />
                  <span className="font-semibold text-[11px] text-zinc-950 tracking-wide">End</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void toggleContinuousVoice();
                  }}
                  disabled={isDictating || isTranscribing}
                  className="size-7 rounded-full bg-[#d8b4fe]/90 hover:bg-[#d8b4fe] hover:scale-105 active:scale-95 flex items-center justify-center text-zinc-950 shadow-sm transition-all disabled:opacity-30 cursor-pointer"
                  title="Start continuous voice conversation"
                >
                  <AudioLines size={14} className="text-zinc-950" />
                </button>
              )}

              {/* 5. Submit prompt button */}
              <button
                type="submit"
                disabled={!inputPrompt.trim() && !interimTranscript.trim()}
                className="p-1.5 rounded-lg bg-rays-violet/80 hover:bg-rays-violet text-white disabled:opacity-30 transition-all shadow-sm shrink-0 cursor-pointer disabled:cursor-not-allowed ml-0.5"
                title="Send prompt to active agents"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
