import { useEffect, useRef, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/services/agentActivity";
import { useElapsedSeconds } from "./useElapsedSeconds";

type ThinkingDisclosureProps = {
  text: string;
  pending: boolean;
  durationMs?: number;
  timerKey?: string;
};

export function ThinkingDisclosure({ text, pending, durationMs, timerKey }: ThinkingDisclosureProps) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const [displayText, setDisplayText] = useState("");
  const elapsed = useElapsedSeconds(pending, timerKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const open = userOpen ?? pending;
  const isPreview = pending && userOpen === null;

  useEffect(() => {
    if (!pending) {
      setDisplayText(text);
      return;
    }

    const full = text.trim() || "Analyzing context and planning next steps…";
    let index = 0;
    setDisplayText("");

    const tick = () => {
      index += Math.max(2, Math.ceil(full.length / 80));
      if (index >= full.length) {
        setDisplayText(full);
        return;
      }
      setDisplayText(full.slice(0, index));
      window.setTimeout(tick, 28);
    };

    const timer = window.setTimeout(tick, 80);
    return () => window.clearTimeout(timer);
  }, [pending, text, timerKey]);

  useEffect(() => {
    if (!isPreview) return;
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;

    const pin = () => {
      el.scrollTop = el.scrollHeight;
    };
    pin();
    const observer = new ResizeObserver(pin);
    observer.observe(content);
    return () => observer.disconnect();
  }, [isPreview, open, displayText]);

  const timerLabel = pending
    ? elapsed > 0
      ? `${elapsed}s`
      : undefined
    : durationMs
      ? formatDuration(durationMs)
      : undefined;

  return (
    <div className="w-full my-1.5" data-slot="thinking-disclosure">
      {/* Single line interactive row */}
      <div
        onClick={() => setUserOpen(!open)}
        className="group flex items-center justify-between cursor-pointer py-1 px-1 rounded-md hover:bg-white/[0.04] transition-all select-none"
      >
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span
            className={cn(
              "font-semibold text-muted-foreground transition-colors",
              pending && "text-foreground hermes-shimmer"
            )}
          >
            Thinking
          </span>
          {timerLabel && (
            <span className="text-[9.5px] font-mono text-muted-foreground/60 tabular-nums">{timerLabel}</span>
          )}
          {pending && <span className="size-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" />}
        </div>
        <ChevronDown
          size={13}
          className={cn(
            "text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-transform duration-200 shrink-0",
            open && "rotate-180"
          )}
        />
      </div>

      {/* Expanded Thought Frame */}
      {open && displayText && (
        <div
          ref={scrollRef}
          className={cn(
            "mt-1 mb-2 rounded-lg border border-white/10 bg-[#131316] p-2.5 text-[10.5px] leading-relaxed text-muted-foreground/90 font-mono shadow-lg transition-all custom-scrollbar",
            isPreview ? "max-h-40 overflow-y-auto" : "max-h-72 overflow-y-auto"
          )}
        >
          <div ref={contentRef} className="whitespace-pre-wrap">
            {displayText}
            {pending && <span className="inline-block w-1 h-2.5 bg-amber-400 ml-1 animate-pulse" />}
          </div>
        </div>
      )}
    </div>
  );
}
