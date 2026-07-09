import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, Square, Plus, Image, File, Folder, Link2, Mic, VolumeX, Volume2, Radio, Plug } from "lucide-react";
import { AgentTurnFeed } from "@/components/agent/hermes/AgentTurnFeed";
import { ApprovalPanel } from "@/components/agent/hermes/ApprovalPanel";
import { McpServersModal } from "@/components/agent/McpServersModal";
import type { AgentTurn } from "@/services/agentActivity";
import type { PromptMode } from "@/services/raysSession";
import { useVoiceConversation, useMicRecorder } from "./hooks/useVoice";
import { hostTranscribeAudio, hostSpeakText, hostReadMcpConfig } from "@/services/platformHost";
import { raysSessionStore } from "@/services/raysSession";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Attachment states
  const [showAttachments, setShowAttachments] = useState(false);
  const [attachments, setAttachments] = useState<{ type: string; name: string; path: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [activeMcpServers, setActiveMcpServers] = useState<any[]>([]);

  useEffect(() => {
    return raysSessionStore.subscribe(state => setWorkspaceRoot(state.workspaceRoot));
  }, []);

  useEffect(() => {
    const loadMcpServers = async () => {
      try {
        const config = await hostReadMcpConfig("global", workspaceRoot || undefined);
        setActiveMcpServers(config.mcp_servers || []);
      } catch (e) {
        // ignore
      }
    };
    loadMcpServers();
  }, [workspaceRoot, mcpModalOpen]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Voice features
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const voice = useVoiceConversation({
    busy: running,
    enabled: voiceEnabled,
    onSubmit: (text) => onSend(text, defaultMode),
    onTranscribeAudio: hostTranscribeAudio,
    onSpeakText: hostSpeakText,
    pendingResponse: () => {
      const latestTurn = turns[turns.length - 1];
      if (!latestTurn || latestTurn.role !== "assistant") return null;
      return { id: latestTurn.id, pending: running, text: latestTurn.content };
    },
    consumePendingResponse: () => {},
  });

  const [dictating, setDictating] = useState(false);
  const [transcribingDictation, setTranscribingDictation] = useState(false);
  const dictation = useMicRecorder();

  const handleDictation = async () => {
    if (dictating) {
      setDictating(false);
      setTranscribingDictation(true);
      const result = await dictation.handle.stop();
      if (result?.audio) {
        try {
          const text = await hostTranscribeAudio(result.audio);
          setInput((prev) => (prev ? `${prev} ${text}` : text));
        } catch (e) {
          console.error(e);
        }
      }
      setTranscribingDictation(false);
    } else {
      setDictating(true);
      await dictation.handle.start({
        silenceLevel: 0.05,
        silenceMs: 2000,
        idleSilenceMs: 15000,
        onSilence: async () => {
          setDictating(false);
          setTranscribingDictation(true);
          const result = await dictation.handle.stop();
          if (result?.audio) {
            try {
              const text = await hostTranscribeAudio(result.audio);
              setInput((prev) => (prev ? `${prev} ${text}` : text));
            } catch (e) {
              console.error(e);
            }
          }
          setTranscribingDictation(false);
        },
      });
    }
  };

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
    const url = prompt("Enter URL to attach:");
    if (url && url.trim()) {
      setAttachments((prev) => [...prev, { type: "url", name: url.trim(), path: url.trim() }]);
    }
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
        <div className="min-w-0">
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
          <div className="text-center text-muted-foreground text-sm py-16 px-6 flex flex-col items-center">
            <Sparkles className="mx-auto mb-3 text-rays-lilac" size={28} />
            <p className="text-foreground/80">Ask the agent anything about this workspace.</p>
            <p className="text-xs mt-2 text-muted-foreground/70">
              Use /code for coding pipeline, /chat for chat mode.
            </p>
            {activeMcpServers.length > 0 && (
              <div className="mt-8 flex flex-col items-center max-w-sm w-full">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground/60 mb-3 tracking-wider">Active MCP Contexts</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {activeMcpServers.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 border border-secondary text-[11px] text-foreground/80 cursor-pointer hover:bg-secondary/80 hover:border-secondary-foreground/10 transition-colors" onClick={() => setMcpModalOpen(true)}>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="truncate max-w-[100px]">{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeMcpServers.length === 0 && (
              <div className="mt-8">
                <button onClick={() => setMcpModalOpen(true)} className="text-[11px] px-3 py-1.5 rounded-md border border-dashed border-secondary text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors flex items-center gap-1.5">
                  <Plug size={12} />
                  Configure MCP Servers
                </button>
              </div>
            )}
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

        <div
          className="mx-auto max-w-3xl flex items-end gap-2 rounded-xl border bg-card/40 px-3 py-2 relative"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          {/* Custom Attachments Menu Button */}
          <div className="relative shrink-0 flex items-center h-6">
            <button
              type="button"
              onClick={() => setShowAttachments(!showAttachments)}
              className="p-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Add attachments"
            >
              <Plus size={16} />
            </button>

            {showAttachments && (
              <div className="absolute bottom-9 left-0 z-30 w-44 bg-card border border-border shadow-modal rounded-lg py-1 flex flex-col">
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowAttachments(false);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary text-foreground/80 hover:text-foreground"
                >
                  <File size={12} className="text-rays-pink" />
                  <span>Attach File</span>
                </button>
                <button
                  onClick={() => {
                    imageInputRef.current?.click();
                    setShowAttachments(false);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary text-foreground/80 hover:text-foreground"
                >
                  <Image size={12} className="text-rays-lavender" />
                  <span>Attach Image/Photo</span>
                </button>
                <button
                  onClick={() => {
                    folderInputRef.current?.click();
                    setShowAttachments(false);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary text-foreground/80 hover:text-foreground"
                >
                  <Folder size={12} className="text-rays-mid" />
                  <span>Attach Directory</span>
                </button>
                <button
                  onClick={() => {
                    handleAttachUrl();
                    setShowAttachments(false);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary text-foreground/80 hover:text-foreground"
                >
                  <Link2 size={12} className="text-rays-pink" />
                  <span>Attach URL</span>
                </button>
              </div>
            )}
          </div>

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
            placeholder={dictating ? "Listening..." : transcribingDictation ? "Transcribing..." : "What's next?… (/code, /chat, /mcp)"}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm outline-none placeholder:text-muted-foreground max-h-40 py-0.5"
            disabled={!connected || loading || dictating || transcribingDictation}
          />

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => setMcpModalOpen(true)}
              className={`p-1.5 rounded-full transition-colors bg-secondary text-muted-foreground hover:text-foreground`}
              title="MCP Servers"
            >
              <Plug size={14} />
            </button>

            {running ? (
              <button
                type="button"
                onClick={onStop}
                className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors shrink-0 animate-pulse ml-1"
                title="Stop agent"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="p-1.5 rounded-full bg-rays-violet text-accent-foreground disabled:opacity-40 transition-opacity shrink-0 ml-1"
              >
                <Send size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
      <McpServersModal open={mcpModalOpen} onClose={() => setMcpModalOpen(false)} workspaceRoot={workspaceRoot} />
    </div>
  );
}
