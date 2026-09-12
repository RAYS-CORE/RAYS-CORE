import React from "react";
import { Mic, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VoiceActivityState {
  status: "idle" | "listening" | "recording" | "transcribing";
  elapsedSeconds: number;
  level: number;
}

function formatElapsed(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function VoiceLevelBars({ level, active }: { active: boolean; level: number }) {
  const normalized = Math.max(0, Math.min(level, 1));
  const bars = [0.5, 0.78, 1, 0.78, 0.5];

  return (
    <div aria-hidden="true" className="flex h-3.5 items-center gap-0.5 text-foreground/70">
      {bars.map((weight, index) => {
        const height = active ? 0.25 + Math.min(0.72, normalized * weight) : 0.25;

        return (
          <span
            key={index}
            className={cn(
              "w-0.5 rounded-full bg-current transition-[height,opacity] duration-100 ease-out",
              active ? "opacity-90 text-rays-pink" : "animate-pulse opacity-40 text-muted-foreground"
            )}
            style={{ height: `${height * 100}%` }}
          />
        );
      })}
    </div>
  );
}

export function VoiceActivity({ state }: { state: VoiceActivityState }) {
  if (state.status === "idle") {
    return null;
  }

  const isListeningOrRecording = state.status === "listening" || state.status === "recording";
  const title =
    state.status === "listening"
      ? "Listening"
      : state.status === "recording"
      ? "Dictating"
      : "Transcribing";

  return (
    <div
      aria-live="polite"
      role="status"
      className={cn(
        "flex h-8 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#1a1728]/95 px-2.5 text-xs text-muted-foreground mb-1.5",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm animate-in fade-in slide-in-from-top-1 duration-150"
      )}
    >
      <div
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full",
          isListeningOrRecording ? "bg-rays-pink/20 text-rays-pink" : "bg-rays-violet/25 text-rays-lilac"
        )}
      >
        {isListeningOrRecording ? (
          <Mic size={11} className="text-rays-pink" />
        ) : (
          <Loader2 size={11} className="animate-spin text-rays-lilac" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-medium text-foreground/90">{title}</span>
        <span className="font-mono text-[11px] text-muted-foreground/80">
          {formatElapsed(state.elapsedSeconds)}
        </span>
      </div>

      <VoiceLevelBars active={isListeningOrRecording} level={state.level} />
    </div>
  );
}
