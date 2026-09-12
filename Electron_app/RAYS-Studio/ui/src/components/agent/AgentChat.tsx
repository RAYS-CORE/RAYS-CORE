import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Square,
  Plus,
  Image,
  File,
  Folder,
  Link2,
  ChevronDown,
  CheckSquare2,
  CircleDot,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Ear,
  EarOff,
  AudioLines,
  Radio,
  ListOrdered,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentTurnFeed } from "@/components/agent/hermes/AgentTurnFeed";
import { ApprovalPanel } from "@/components/agent/hermes/ApprovalPanel";
import { VoiceActivity, VoiceLevelBars } from "@/components/agent/hermes/VoiceActivity";
import { voiceEngine } from "@/services/voiceService";
import type { AgentTurn, ActivityItem } from "@/services/agentActivity";
import type { PromptMode } from "@/services/raysSession";

type AgentChatProps = {
  turns: AgentTurn[];
  connected: boolean;
  running: boolean;
  loading?: boolean;
  hudPhase?: string;
  hudDetail?: string;
  tokenCount?: number;
  pendingApproval?: { id: string; message: string } | null;
  defaultMode?: PromptMode;
  onSend: (prompt: string, mode?: PromptMode) => void;
  onApprove?: (approved: boolean) => void;
  onStop?: () => void;
};

export function AgentChat({
  turns,
  connected,
  running,
  loading = false,
  hudPhase,
  hudDetail,
  tokenCount = 0,
  pendingApproval,
  defaultMode = "agent",
  onSend,
  onApprove,
  onStop,
}: AgentChatProps) {
  const [input, setInput] = useState("");
  const [planOpen, setPlanOpen] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [promptQueue, setPromptQueue] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-dequeue next prompt when agent finishes running
  useEffect(() => {
    if (!running && promptQueue.length > 0) {
      const [nextPrompt, ...rest] = promptQueue;
      setPromptQueue(rest);
      onSend(nextPrompt, defaultMode);
    }
  }, [running, promptQueue, onSend, defaultMode]);

  // Hermes Voice States
  const [isDictating, setIsDictating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isContinuousVoice, setIsContinuousVoice] = useState(false);
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveInterim, setLiveInterim] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for voice activity elapsed seconds
  useEffect(() => {
    let interval: any = null;
    if (isDictating || isTranscribing || isContinuousVoice) {
      interval = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDictating, isTranscribing, isContinuousVoice]);

  // Auto-speak assistant final replies when enabled or in continuous voice
  const spokenTurnIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!autoSpeak && !isContinuousVoice) return;
    const latest = turns[turns.length - 1];
    if (latest && latest.finalSummary && latest.status === "done" && !spokenTurnIds.current.has(latest.id)) {
      spokenTurnIds.current.add(latest.id);
      voiceEngine.speak(latest.finalSummary);
    }
  }, [turns, autoSpeak, isContinuousVoice]);

  // Persistent refs for voice callbacks so re-renders NEVER kill the voice engine
  const runningRef = useRef(running);
  const onSendRef = useRef(onSend);
  const isContinuousVoiceRef = useRef(isContinuousVoice);
  const isWakeWordActiveRef = useRef(isWakeWordActive);
  const defaultModeRef = useRef(defaultMode);

  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { onSendRef.current = onSend; }, [onSend]);
  useEffect(() => { isContinuousVoiceRef.current = isContinuousVoice; }, [isContinuousVoice]);
  useEffect(() => { isWakeWordActiveRef.current = isWakeWordActive; }, [isWakeWordActive]);
  useEffect(() => { defaultModeRef.current = defaultMode; }, [defaultMode]);

  // Connect VoiceEngine callbacks ONCE on mount
  useEffect(() => {
    const unState = voiceEngine.addStateListener((state) => {
      setIsDictating(state === "recording");
      setIsTranscribing(state === "transcribing");
      if (state === "listening" || state === "recording") {
        setIsContinuousVoice(voiceEngine.continuousActive);
      }
    });

    const unLevel = voiceEngine.addLevelListener((level) => {
      setAudioLevel(level);
    });

    const unTranscript = voiceEngine.addTranscriptListener((transcript, isFinal) => {
      if (isFinal) {
        setLiveInterim("");
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      } else {
        setLiveInterim(transcript);
      }
    });

    const unWake = voiceEngine.addWakeWordListener(() => {
      setIsContinuousVoice(true);
    });

    const unStop = voiceEngine.addStopWordListener(() => {
      setIsContinuousVoice(false);
      setIsDictating(false);
      setIsTranscribing(false);
      setLiveInterim("");
      voiceEngine.stop();
      voiceEngine.stopSpeech();
      if (isWakeWordActiveRef.current) {
        voiceEngine.setPassiveWakeListening(true);
      }
    });

    const unUtterance = voiceEngine.addFinalUtteranceListener((utterance) => {
      setLiveInterim("");
      const clean = utterance.trim();
      if (isContinuousVoiceRef.current && clean.length > 0) {
        if (runningRef.current) {
          // Model is busy executing -> queue prompt seamlessly!
          setPromptQueue((prev) => [...prev, clean]);
        } else {
          // Model is idle -> dispatch immediately
          onSendRef.current(clean, defaultModeRef.current);
          setInput("");
        }
      }
    });

    return () => {
      unState();
      unLevel();
      unTranscript();
      unWake();
      unStop();
      unUtterance();
      voiceEngine.stop();
      voiceEngine.stopSpeech();
    };
  }, []);

  // Re-arm continuous voice when agent finishes running turn
  useEffect(() => {
    if (!running && isContinuousVoice && !voiceEngine.speaking) {
      const timer = setTimeout(() => {
        if (!running && isContinuousVoice && !voiceEngine.speaking) {
          void voiceEngine.start(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [running, isContinuousVoice]);

  // Single-turn dictation toggle (1-click start, 1-click stop & transcribe!)
  const toggleDictation = async () => {
    if (isDictating) {
      setIsDictating(false);
      setIsTranscribing(true);
      setLiveInterim("");
      try {
        const text = await voiceEngine.stopAndTranscribe();
        if (text && text.trim()) {
          const clean = text.trim();
          setInput((prev) => {
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
      if (isContinuousVoice) {
        setIsContinuousVoice(false);
        voiceEngine.stop();
      }
      setLiveInterim("");
      const ok = await voiceEngine.start(false);
      setIsDictating(ok);
    }
  };

  // Continuous conversation toggle (1-click start, 1-click stop)
  const toggleContinuousVoice = async () => {
    if (isContinuousVoice) {
      setIsContinuousVoice(false);
      voiceEngine.stop();
    } else {
      if (isDictating) {
        setIsDictating(false);
        voiceEngine.stop();
      }
      const ok = await voiceEngine.start(true);
      setIsContinuousVoice(ok);
    }
  };

  // Wake word passive listening toggle
  const toggleWakeWord = () => {
    const next = !isWakeWordActive;
    setIsWakeWordActive(next);
    voiceEngine.setPassiveWakeListening(next);
  };

  // AutoSpeak replies toggle
  const toggleAutoSpeak = () => {
    const next = !autoSpeak;
    setAutoSpeak(next);
    voiceEngine.setTtsEnabled(next);
  };

  // Active plan from the latest turn
  const activePlan = useMemo(() => {
    const latestTurn = turns[turns.length - 1];
    if (!latestTurn) return null;
    const plan = latestTurn.items.find(
      (i): i is Extract<ActivityItem, { kind: "plan" }> => i.kind === "plan"
    );
    return plan || null;
  }, [turns]);

  // Attachment states
  const [showAttachments, setShowAttachments] = useState(false);
  const [urlInputVisible, setUrlInputVisible] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [attachments, setAttachments] = useState<{ type: string; name: string; path: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const canSend = useMemo(
    () => connected && (input.trim().length > 0 || attachments.length > 0),
    [connected, input, attachments]
  );

  const handleSend = () => {
    if (!canSend) return;
    let text = input.trim();
    if (attachments.length > 0) {
      const attachmentText = attachments
        .map((a) => `[Attachment (${a.type}): ${a.name} (${a.path})]`)
        .join("\n");
      text = text ? `${attachmentText}\n\n${text}` : attachmentText;
    }
    let mode = defaultMode;
    if (text.startsWith("/code")) mode = "code";
    else if (text.startsWith("/chat")) mode = "chat";

    if (running) {
      // Enqueue prompt to run after active turn finishes
      setPromptQueue((prev) => [...prev, text]);
    } else {
      onSend(text, mode);
    }
    setInput("");
    setAttachments([]);
  };

  const handleAttachFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const next = Array.from(e.target.files).map((f) => ({
      type: "file",
      name: f.name,
      path: f.path || f.name,
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const handleAttachImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const next = Array.from(e.target.files).map((f) => ({
      type: "image",
      name: f.name,
      path: f.path || f.name,
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const handleAttachFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const next = Array.from(e.target.files).map((f) => ({
      type: f.type.startsWith("image/") ? "image" : "file",
      name: f.name,
      path: f.path || f.name,
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const handleAttachUrl = () => {
    setUrlInputVisible(true);
    setShowAttachments(true);
  };

  // Drag and Drop recursive parsing
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (!e.dataTransfer.items) return;

    const fileList: { type: string; name: string; path: string }[] = [];

    const traverseEntry = async (entry: any, currentPath: string = "") => {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          entry.file(resolve, reject);
        });
        fileList.push({
          type: file.type.startsWith("image/") ? "image" : "file",
          name: file.name,
          path: file.path || (currentPath ? `${currentPath}/${file.name}` : file.name),
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const readAllEntries = async (): Promise<any[]> => {
          let allEntries: any[] = [];
          const read = async (): Promise<void> => {
            const results = await new Promise<any[]>((resolve, reject) => {
              dirReader.readEntries(resolve, reject);
            });
            if (results.length > 0) {
              allEntries = allEntries.concat(results);
              await read();
            }
          };
          await read();
          return allEntries;
        };
        const entries = await readAllEntries();
        for (const childEntry of entries) {
          await traverseEntry(childEntry, currentPath ? `${currentPath}/${entry.name}` : entry.name);
        }
      }
    };

    const promises: Promise<void>[] = [];
    for (let i = 0; i < e.dataTransfer.items.length; i++) {
      const item = e.dataTransfer.items[i];
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          promises.push(traverseEntry(entry));
        }
      }
    }

    await Promise.all(promises);
    setAttachments((prev) => [...prev, ...fileList]);
  };

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, running, pendingApproval]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    const next = Math.min(textareaRef.current.scrollHeight, 160);
    textareaRef.current.style.height = `${next}px`;
  }, [input]);

  const showEmpty = turns.length === 0 && !running;

  return (
    <div
      className={`h-full flex flex-col bg-background agent-chat-shell transition-all duration-200 ${isDragging ? "ring-2 ring-rays-pink/50 bg-secondary/15" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="px-4 py-2 border-b flex items-center justify-between gap-2 shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <div className="min-w-0 flex items-center gap-2">
          <div className="text-sm font-medium truncate">
            {loading ? "Loading chat…" : hudPhase || (connected ? "Ready" : "Connecting…")}
          </div>
          {hudDetail && <div className="text-[11px] text-muted-foreground truncate">{hudDetail}</div>}
        </div>

        <div className="text-[10px] text-muted-foreground shrink-0">
          {tokenCount > 0 ? `${tokenCount.toLocaleString()} tokens` : connected ? "Connected" : "Offline"}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        {showEmpty && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 select-none relative overflow-hidden">
            {/* Ambient Deep Cosmic Glow */}
            <div className="absolute w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle_at_center,rgba(245,41,153,0.22)_0%,rgba(148,31,224,0.15)_40%,transparent_75%)] blur-3xl pointer-events-none" />
            <div className="absolute w-[450px] h-[450px] rounded-full bg-[radial-gradient(circle_at_center,rgba(250,133,209,0.25)_0%,transparent_70%)] blur-2xl pointer-events-none" />

            {/* Giant Unique Artistic RAYS Banner — Pure Theme Typography */}
            <div className="relative z-10 space-y-6 max-w-lg flex flex-col items-center">
              {/* Massive Unique Sculpted RAYS Typography */}
              <div className="text-9xl sm:text-[135px] font-black tracking-[0.2em] leading-none text-transparent bg-clip-text bg-gradient-to-r from-[#f52999] via-[#fa85d1] via-[#c084fc] to-[#941fe0] drop-shadow-[0_0_60px_rgba(245,41,153,0.65)] drop-shadow-[0_0_120px_rgba(148,31,224,0.45)] select-none transition-transform hover:scale-[1.02] duration-300">
                RAYS
              </div>

              {/* Action Command Badges (Hermes Minimalist Styling) */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInput("/code ")}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-[#f52999]/40 text-[11px] font-medium text-foreground transition-all shadow-sm group"
                >
                  <span className="font-mono text-[#f52999] font-semibold">/code</span>
                  <span className="text-muted-foreground group-hover:text-foreground">coding pipeline</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInput("/chat ")}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-[#c084fc]/40 text-[11px] font-medium text-foreground transition-all shadow-sm group"
                >
                  <span className="font-mono text-[#c084fc] font-semibold">/chat</span>
                  <span className="text-muted-foreground group-hover:text-foreground">chat mode</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInput("/help")}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-[#fa85d1]/40 text-[11px] font-medium text-foreground transition-all shadow-sm group"
                >
                  <span className="font-mono text-[#fa85d1] font-semibold">/help</span>
                  <span className="text-muted-foreground group-hover:text-foreground">commands</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <AgentTurnFeed turns={turns} />

        {pendingApproval && (
          <div className="mx-auto max-w-3xl px-4 pb-4">
            <ApprovalPanel
              message={pendingApproval.message}
              onApprove={() => onApprove?.(true)}
              onDeny={() => onApprove?.(false)}
            />
          </div>
        )}
      </div>

      <div className="p-3 border-t shrink-0" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        {/* Hidden inputs for picker actions */}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleAttachFiles} />
        <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleAttachImages} />
        <input ref={folderInputRef} type="file" webkitdirectory="" directory="" className="hidden" onChange={handleAttachFolder} />

        {/* Attachment Pills */}
        {attachments.length > 0 && (
          <div className="mx-auto max-w-3xl flex flex-wrap gap-2 pb-2.5 max-h-24 overflow-y-auto">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/80 text-foreground text-[10px] border border-border/40"
              >
                {att.type === "file" && <File size={10} className="text-rays-pink" />}
                {att.type === "image" && <Image size={10} className="text-rays-lavender" />}
                {att.type === "directory" && <Folder size={10} className="text-rays-mid" />}
                {att.type === "url" && <Link2 size={10} className="text-rays-pink" />}
                <span className="truncate max-w-[120px] font-medium">{att.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-muted-foreground hover:text-foreground font-bold ml-1 text-xs"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mx-auto max-w-3xl flex flex-col shadow-2xl relative">
          {/* Planning Phase Todos Checklist (Attached right above prompt) */}
          {activePlan && activePlan.todos.length > 0 && (
            <div className="rounded-t-2xl border-t border-x border-white/10 bg-[#161619]/95 backdrop-blur-md px-4 py-3 shadow-xl -mb-px transition-all">
              <div
                onClick={() => setPlanOpen(!planOpen)}
                className="flex items-center justify-between cursor-pointer select-none pb-1"
              >
                <span className="text-xs font-semibold text-muted-foreground/80">
                  {activePlan.todos.filter((t) => t.status === "completed").length} of {activePlan.todos.length} todos completed
                </span>
                <ChevronDown
                  size={14}
                  className={cn(
                    "text-muted-foreground/50 transition-transform duration-200",
                    planOpen && "rotate-180"
                  )}
                />
              </div>
              {planOpen && (
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {activePlan.todos.map((todo) => {
                    const isCompleted = todo.status === "completed";
                    const isInProgress = todo.status === "in_progress";
                    return (
                      <div key={todo.id} className="flex items-start gap-2.5 text-xs leading-relaxed">
                        {isCompleted ? (
                          <CheckSquare2 size={14} className="text-muted-foreground/40 shrink-0 mt-0.5" />
                        ) : isInProgress ? (
                          <div className="relative shrink-0 mt-0.5 flex items-center justify-center size-3.5">
                            <span className="absolute size-2.5 rounded-full bg-amber-400/30 animate-ping" />
                            <CircleDot size={14} className="text-amber-400 relative z-10" />
                          </div>
                        ) : (
                          <Square size={14} className="text-muted-foreground/30 shrink-0 mt-0.5" />
                        )}
                        <span
                          className={cn(
                            isCompleted && "text-muted-foreground/40 line-through select-none",
                            isInProgress && "text-foreground font-medium",
                            !isCompleted && !isInProgress && "text-muted-foreground/65"
                          )}
                        >
                          {todo.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Hermes Voice Conversation Toast */}
          {isContinuousVoice && (
            <div className="absolute -top-9 right-2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1c1c24]/95 border border-rays-pink/30 text-white/90 text-[10px] font-medium shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
              <Mic size={11} className="text-rays-pink animate-pulse" />
              <span>Say &quot;stop&quot; to end the voice conversation</span>
            </div>
          )}

          {/* Main Prompt Card */}
          <div
            className={cn(
              "flex flex-col border border-white/10 bg-[#161619] p-2.5 shadow-2xl relative transition-all focus-within:border-white/20",
              activePlan && activePlan.todos.length > 0 ? "rounded-b-2xl border-t-0" : "rounded-2xl"
            )}
          >
            {/* Hermes VoiceActivity Ribbon (Dictating / Transcribing with live timer and level meter) */}
            <VoiceActivity
              state={{
                status: isTranscribing
                  ? "transcribing"
                  : isDictating
                  ? "recording"
                  : isContinuousVoice
                  ? "listening"
                  : "idle",
                elapsedSeconds,
                level: audioLevel,
              }}
            />

            {/* Main Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything, / for commands, @ for context…"
              rows={1}
              className="w-full bg-transparent resize-none text-[11.5px] leading-relaxed outline-none placeholder:text-muted-foreground/60 max-h-36 min-h-[28px] py-0.5 text-foreground"
              disabled={!connected || loading}
            />

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5">
              {/* Attachments Menu Button */}
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setShowAttachments(!showAttachments)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground/70 hover:text-foreground transition-colors"
                  title="Add attachments"
                >
                  <Plus size={15} />
                </button>

                {showAttachments && !urlInputVisible && (
                  <div className="absolute bottom-9 left-0 z-30 w-44 bg-[#1c1c20] border border-white/10 shadow-2xl rounded-xl py-1.5 flex flex-col">
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                        setShowAttachments(false);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-white/[0.06] text-foreground/80 hover:text-foreground"
                    >
                      <File size={13} className="text-sky-400" />
                      <span>Attach File</span>
                    </button>
                    <button
                      onClick={() => {
                        imageInputRef.current?.click();
                        setShowAttachments(false);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-white/[0.06] text-foreground/80 hover:text-foreground"
                    >
                      <Image size={13} className="text-purple-400" />
                      <span>Attach Image</span>
                    </button>
                    <button
                      onClick={() => {
                        folderInputRef.current?.click();
                        setShowAttachments(false);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-white/[0.06] text-foreground/80 hover:text-foreground"
                    >
                      <Folder size={13} className="text-amber-400" />
                      <span>Attach Directory</span>
                    </button>
                    <button
                      onClick={() => {
                        handleAttachUrl();
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-white/[0.06] text-foreground/80 hover:text-foreground"
                    >
                      <Link2 size={13} className="text-pink-400" />
                      <span>Attach URL</span>
                    </button>
                  </div>
                )}

                {showAttachments && urlInputVisible && (
                  <div className="absolute bottom-9 left-0 z-30 w-64 bg-[#1c1c20] border border-white/10 shadow-2xl rounded-xl p-2.5 flex flex-col gap-2">
                    <input
                      autoFocus
                      type="url"
                      placeholder="Enter URL..."
                      className="w-full bg-background/50 border border-white/10 rounded-lg px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-rays-pink"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (urlInput.trim()) {
                            setAttachments((prev) => [
                              ...prev,
                              { type: "url", name: urlInput.trim(), path: urlInput.trim() },
                            ]);
                          }
                          setUrlInputVisible(false);
                          setShowAttachments(false);
                          setUrlInput("");
                        } else if (e.key === "Escape") {
                          setUrlInputVisible(false);
                          setShowAttachments(false);
                        }
                      }}
                    />
                    <div className="flex justify-end gap-1.5 mt-1">
                      <button
                        type="button"
                        onClick={() => setUrlInputVisible(false)}
                        className="text-xs px-2 py-1 hover:bg-white/[0.05] rounded text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (urlInput.trim()) {
                            setAttachments((prev) => [
                              ...prev,
                              { type: "url", name: urlInput.trim(), path: urlInput.trim() },
                            ]);
                          }
                          setUrlInputVisible(false);
                          setShowAttachments(false);
                          setUrlInput("");
                        }}
                        className="text-xs px-3 py-1 bg-rays-pink text-background font-semibold rounded hover:bg-rays-pink/90 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mode indicator pill */}
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] text-muted-foreground/80 hover:text-foreground hover:bg-white/[0.07] transition-colors text-xs font-medium cursor-pointer select-none">
                <span>{defaultMode === "code" ? "Build" : defaultMode === "chat" ? "Chat" : "Agent"}</span>
              </div>

              {/* Engine indicator pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-muted-foreground/80 hover:text-foreground hover:bg-white/[0.07] transition-colors text-xs font-medium cursor-pointer select-none">
                <Sparkles size={11} className="text-rays-lilac" />
                <span>RAYS Core</span>
              </div>

              {/* Prompt Queue badge */}
              {promptQueue.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rays-pink/15 border border-rays-pink/30 text-rays-pink text-[10px] font-semibold">
                  <ListOrdered size={10} />
                  <span>{promptQueue.length} queued</span>
                </div>
              )}
            </div>

            {/* Right Hermes-Style Control Suite: Model Pill, Dictation, AutoSpeak, Ear Wake-Word, and Wave / Send */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* 1. Model Selector Pill */}
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground/80 hover:text-white text-[10px] font-mono cursor-pointer transition-all border border-white/[0.04]"
                title="Active RAYS Model"
              >
                <span>rays:35b · Med</span>
                <ChevronDown size={10} className="text-muted-foreground/50" />
              </div>

              {/* 2. Dictation Mic Button (Single Turn Push-to-Talk) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void toggleDictation();
                }}
                disabled={isContinuousVoice || isTranscribing}
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

              {/* 3. AutoSpeak Button (Read replies aloud) */}
              <button
                type="button"
                onClick={toggleAutoSpeak}
                className={`p-1.5 rounded-md flex items-center justify-center transition-all ${
                  autoSpeak
                    ? "text-rays-lilac bg-rays-violet/20"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.06]"
                }`}
                title={autoSpeak ? "Replies read aloud (Click to mute)" : "Read replies aloud"}
              >
                {autoSpeak ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>

              {/* 4. Wake-Word Ear Button (Passively listens for 'Hey RAYS') */}
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

              {/* 5. Continuous Conversation Wave Button / Conversation Pill */}
              {isContinuousVoice ? (
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
                    toggleContinuousVoice();
                  }}
                  disabled={isDictating || isTranscribing}
                  className="size-7 rounded-full bg-[#d8b4fe]/90 hover:bg-[#d8b4fe] hover:scale-105 active:scale-95 flex items-center justify-center text-zinc-950 shadow-sm transition-all disabled:opacity-30 cursor-pointer"
                  title="Start continuous voice conversation"
                >
                  <AudioLines size={14} className="text-zinc-950" />
                </button>
              )}

              {/* Primary Submit / Stop Agent button */}
              {running ? (
                <div className="flex items-center gap-1">
                  {input.trim() && (
                    <button
                      type="button"
                      onClick={handleSend}
                      className="px-2 py-1 rounded-lg bg-rays-violet/80 hover:bg-rays-violet text-white text-[10.5px] font-medium flex items-center gap-1 transition-all shadow-sm"
                      title="Add prompt to queue"
                    >
                      <ListOrdered size={11} />
                      <span>Queue</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onStop}
                    className="size-6 rounded-md bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center transition-all shadow-sm animate-pulse"
                    title="Stop agent"
                  >
                    <Square size={10} fill="currentColor" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  className="size-6 rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 flex items-center justify-center transition-all shadow-sm ml-0.5 cursor-pointer disabled:cursor-not-allowed"
                  title="Send prompt"
                >
                  <Send size={11} className="text-background" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
