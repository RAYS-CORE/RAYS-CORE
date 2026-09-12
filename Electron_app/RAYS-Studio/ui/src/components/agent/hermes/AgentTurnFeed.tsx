import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { AgentTurn, ActivityItem } from "@/services/agentActivity";
import { formatDuration } from "@/services/agentActivity";
import { ThinkingDisclosure } from "./ThinkingDisclosure";
import { ActivityItemView } from "./ActivityRows";

function UserPromptBox({ text }: { text: string }) {
  return (
    <div className="flex justify-end mb-4 w-full" data-slot="user-prompt">
      <div className="max-w-[85%] rounded-xl border border-white/10 bg-[#1c1c20] px-3 py-1.5 text-[11.5px] leading-relaxed text-foreground/90 shadow-sm">
        <span className="whitespace-pre-wrap break-words">{text}</span>
      </div>
    </div>
  );
}

function FinalSummaryBlock({ content }: { content: string }) {
  const html = useMemo(() => {
    try {
      return DOMPurify.sanitize(marked.parse(content, { async: false }) as string);
    } catch {
      return "";
    }
  }, [content]);

  if (!html) {
    return (
      <div
        className="my-2 text-[11.5px] leading-relaxed text-foreground/90 whitespace-pre-wrap font-normal"
        data-slot="final-summary"
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className="my-2 text-[11.5px] leading-relaxed text-foreground/90 font-normal prose prose-invert max-w-none prose-p:my-1 prose-headings:text-foreground prose-headings:my-1 prose-code:text-amber-300 prose-code:bg-white/[0.06] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[#131316] prose-pre:border prose-pre:border-white/10"
      data-slot="final-summary"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function TurnActivityItems({ items }: { items: ActivityItem[] }) {
  const thinkingItems = items.filter((i): i is Extract<ActivityItem, { kind: "thinking" }> => i.kind === "thinking");
  const planItems = items.filter((i): i is Extract<ActivityItem, { kind: "plan" }> => i.kind === "plan");
  const otherItems = items.filter((i) => i.kind !== "thinking" && i.kind !== "plan");

  return (
    <div className="mt-2 space-y-1 w-full">
      {otherItems.map((item) => (
        <ActivityItemView key={item.id} item={item} />
      ))}
      {thinkingItems.map((item) => (
        <ThinkingDisclosure
          key={item.id}
          text={item.text}
          pending={item.status === "running"}
          durationMs={item.durationMs}
          timerKey={item.id}
        />
      ))}
      {planItems.map((item) => (
        <ActivityItemView key={item.id} item={item} />
      ))}
    </div>
  );
}

function AgentTurnBlock({ turn, isLatest }: { turn: AgentTurn; isLatest: boolean }) {
  const showLiveThinking =
    isLatest &&
    turn.status === "running" &&
    !turn.items.some((i) => i.kind === "thinking") &&
    !turn.finalSummary;

  return (
    <div className="agent-turn py-5 border-b border-white/[0.06] last:border-b-0 w-full">
      <UserPromptBox text={turn.userPrompt} />
      <TurnActivityItems items={turn.items} />
      {showLiveThinking && (
        <div className="mt-2">
          <ThinkingDisclosure
            text=""
            pending
            timerKey={`live-${turn.id}`}
          />
        </div>
      )}
      {turn.finalSummary && (
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <FinalSummaryBlock content={turn.finalSummary} />
        </div>
      )}
      {turn.status === "done" && turn.endedAt && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground/40 font-mono tabular-nums">
          <span className="inline-block size-1.5 rounded-full bg-emerald-500/50" aria-hidden />
          <span>Completed in {formatDuration(turn.endedAt - turn.startedAt)}</span>
        </div>
      )}
    </div>
  );
}

type AgentTurnFeedProps = {
  turns: AgentTurn[];
};

export function AgentTurnFeed({ turns }: AgentTurnFeedProps) {
  if (turns.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-2">
      {turns.map((turn, index) => (
        <AgentTurnBlock key={turn.id} turn={turn} isLatest={index === turns.length - 1} />
      ))}
    </div>
  );
}
