import React, { useEffect, useState } from "react";
import { Mic, Loader2, Ear, Check, Square, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { voiceEngine, VoiceState } from "@/services/voiceService";

export function GlobalVoiceIsland() {
  const [voiceState, setVoiceState] = useState<VoiceState>(voiceEngine.state);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isWakeArmed, setIsWakeArmed] = useState<boolean>(voiceEngine.passiveWakeListening);
  const [isContinuous, setIsContinuous] = useState<boolean>(voiceEngine.continuousActive);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [lastPromptSent, setLastPromptSent] = useState<string>("");
  const [showSentNotification, setShowSentNotification] = useState<boolean>(false);
  const [wakePulse, setWakePulse] = useState<boolean>(false);

  // Sync with VoiceEngine state
  useEffect(() => {
    const handleState = (s: VoiceState) => {
      setVoiceState(s);
      setIsContinuous(voiceEngine.continuousActive);
      setIsWakeArmed(voiceEngine.passiveWakeListening);
    };

    const handleLevel = (lvl: number) => {
      setAudioLevel(lvl);
    };

    const handleWake = () => {
      setWakePulse(true);
      setTimeout(() => setWakePulse(false), 2000);
      setIsContinuous(true);
    };

    const handleFinalUtterance = (prompt: string) => {
      if (prompt.trim()) {
        setLastPromptSent(prompt.trim());
        setShowSentNotification(true);
        setTimeout(() => setShowSentNotification(false), 2400);
      }
    };

    const handleStop = () => {
      setIsContinuous(false);
      setElapsedSeconds(0);
      setIsWakeArmed(voiceEngine.passiveWakeListening);
    };

    // Attach multi-subscriber listeners so we never overwrite other components
    const unState = voiceEngine.addStateListener(handleState);
    const unLevel = voiceEngine.addLevelListener(handleLevel);
    const unWake = voiceEngine.addWakeWordListener(handleWake);
    const unUtterance = voiceEngine.addFinalUtteranceListener(handleFinalUtterance);
    const unStop = voiceEngine.addStopWordListener(handleStop);

    const interval = setInterval(() => {
      if (voiceEngine.continuousActive || voiceEngine.state === "recording" || voiceEngine.state === "listening") {
        setElapsedSeconds((prev) => prev + 1);
      } else {
        setElapsedSeconds(0);
      }
      setIsWakeArmed(voiceEngine.passiveWakeListening);
      setIsContinuous(voiceEngine.continuousActive);
    }, 1000);

    return () => {
      unState();
      unLevel();
      unWake();
      unUtterance();
      unStop();
      clearInterval(interval);
    };
  }, []);

  const handleStopClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    voiceEngine.stop();
    setIsContinuous(false);
    setElapsedSeconds(0);
  };

  const handleToggleHearing = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isWakeArmed;
    setIsWakeArmed(next);
    void voiceEngine.setPassiveWakeListening(next);
  };

  // Only render if continuous conversation is active, wake word triggered, or actively transcribing
  const isListening = voiceState === "listening" || isContinuous;
  const isTranscribing = voiceState === "transcribing";
  const isRecording = voiceState === "recording";
  const isSpeaking = voiceState === "speaking";

  const isVisible = isListening || isTranscribing || isRecording || isSpeaking || showSentNotification || wakePulse;

  if (!isVisible) {
    return null;
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      aria-label="Dynamic Voice Island"
      className="fixed top-3.5 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto select-none transition-all duration-300 ease-out animate-in fade-in zoom-in-95"
    >
      <div
        className={cn(
          "relative flex items-center gap-2.5 px-4 py-1.5 rounded-full border text-xs text-white shadow-2xl transition-all duration-300 ease-out backdrop-blur-2xl",
          "bg-[#180a2b]/90 border-white/20 shadow-[0_12px_45px_rgba(133,20,240,0.45),0_0_1px_1px_rgba(255,255,255,0.18)]",
          wakePulse && "ring-2 ring-purple-400 scale-105 shadow-[0_0_50px_rgba(179,51,255,0.8)]",
          isListening && "border-purple-400/40 bg-[#1c0b36]/90 shadow-[0_14px_50px_rgba(140,26,242,0.55)]",
          isTranscribing && "border-purple-400/50 bg-[#220e40]/95"
        )}
      >
        {/* State Indicator Icon */}
        <div className="flex items-center justify-center size-5 rounded-full bg-purple-500/20 text-purple-300">
          {showSentNotification ? (
            <Check size={11} className="text-emerald-400 animate-in zoom-in-50 duration-200" />
          ) : isTranscribing ? (
            <Loader2 size={11} className="animate-spin text-purple-300" />
          ) : isListening ? (
            <Mic size={11} className="text-purple-300 animate-pulse" />
          ) : (
            <Sparkles size={11} className="text-violet-300 animate-spin" />
          )}
        </div>

        {/* Text and Title */}
        <div className="flex items-center gap-2 text-[11.5px] font-medium">
          {showSentNotification ? (
            <span className="text-emerald-300 font-semibold truncate max-w-[220px]">
              Prompt Sent: "{lastPromptSent}"
            </span>
          ) : isTranscribing ? (
            <span className="text-purple-200 flex items-center gap-1.5">
              <span>Transcribing…</span>
              <span className="font-mono text-[10px] text-purple-300/70">{formatTimer(elapsedSeconds)}</span>
            </span>
          ) : isListening ? (
            <span className="text-purple-100 flex items-center gap-1.5">
              <span className="font-semibold text-purple-300">Hey Rays</span>
              <span className="text-white/50">·</span>
              <span>Listening</span>
              <span className="font-mono text-[10px] text-purple-300/80">{formatTimer(elapsedSeconds)}</span>
            </span>
          ) : (
            <span className="text-violet-200">Rays Speaking…</span>
          )}
        </div>

        {/* Dynamic Voice Bars (Listening / Recording) */}
        {(isListening || isRecording) && (
          <div className="flex items-center gap-0.5 h-3 px-1">
            {[0.4, 0.75, 1.0, 0.75, 0.4].map((weight, i) => {
              const h = Math.max(0.2, Math.min(1.0, (audioLevel * 1.6 * weight) + 0.2));
              return (
                <span
                  key={i}
                  className="w-0.5 rounded-full bg-purple-400 transition-all duration-75 ease-out shadow-[0_0_6px_rgba(179,51,255,0.7)]"
                  style={{ height: `${h * 100}%` }}
                />
              );
            })}
          </div>
        )}

        {/* Quick Stop Pill Button */}
        {isListening && (
          <button
            type="button"
            onClick={handleStopClick}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-white/90 transition-all border border-white/15"
            title="Stop Continuous Conversation"
          >
            <Square size={8} className="fill-current" />
            <span>End</span>
          </button>
        )}

        {/* Ear Toggle Button when idle */}
        {!isListening && isWakeArmed && (
          <button
            type="button"
            onClick={handleToggleHearing}
            className="text-[10px] text-white/50 hover:text-white/90 transition-all ml-0.5 hover:underline"
            title="Turn off passive wake listener"
          >
            Mute
          </button>
        )}
      </div>
    </div>
  );
}
