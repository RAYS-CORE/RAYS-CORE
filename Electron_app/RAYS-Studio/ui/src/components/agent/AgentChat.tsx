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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentTurnFeed } from "@/components/agent/hermes/AgentTurnFeed";
import { ApprovalPanel } from "@/components/agent/hermes/ApprovalPanel";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const canSend = useMemo(() => connected && (input.trim().length > 0 || attachments.length > 0) && !running, [connected, input, attachments, running]);

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
    onSend(text, mode);
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {showEmpty && (
          <div className="text-center text-muted-foreground text-sm py-16 px-6">
            <Sparkles className="mx-auto mb-3 text-rays-lilac" size={28} />
            <p className="text-foreground/80">Ask the agent anything about this workspace.</p>
            <p className="text-xs mt-2 text-muted-foreground/70">
              Use /code for coding pipeline, /chat for chat mode, /mcp for MCP status.
            </p>
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

          {/* Main Prompt Card */}
          <div
            className={cn(
              "flex flex-col border border-white/10 bg-[#161619] p-3 shadow-2xl relative transition-all focus-within:border-white/20",
              activePlan && activePlan.todos.length > 0 ? "rounded-b-2xl border-t-0" : "rounded-2xl"
            )}
          >
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
              className="w-full bg-transparent resize-none text-[13.5px] leading-relaxed outline-none placeholder:text-muted-foreground/60 max-h-40 min-h-[32px] py-1 text-foreground"
              disabled={!connected || loading}
            />

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/[0.04]">
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
            </div>

            {/* Right button: Stop or Send */}
            <div>
              {running ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="size-7 rounded-lg bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center transition-all shadow-sm animate-pulse"
                  title="Stop agent"
                >
                  <Square size={11} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  className="size-7 rounded-lg bg-white/10 hover:bg-white/20 text-foreground disabled:opacity-30 flex items-center justify-center transition-all shadow-sm"
                  title="Send prompt"
                >
                  <Send size={12} />
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
