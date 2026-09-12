import { BookOpen, ChevronLeft, ChevronRight, FolderOpen, Loader2, MessageSquarePlus, Plug, Plus, Radio, Sparkles } from "lucide-react";
import { useAgentSessions } from "@/hooks/useAgentSessions";
import { workspaceLabel, type AgentSession } from "@/services/agentSessionStorage";

type AgentSidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeSessionId: string | null;
  openingSessionId: string | null;
  isGeneralConversationActive?: boolean;
  onOpenGeneralConversation: () => void;
  onNewAgent: () => void;
  onNewChat: () => void;
  onSelectSession: (session: AgentSession) => void;
  onOpenSkills: () => void;
  onOpenMcp: () => void;
};

export function AgentSidebar({
  collapsed,
  onToggleCollapse,
  activeSessionId,
  openingSessionId,
  isGeneralConversationActive = false,
  onOpenGeneralConversation,
  onNewAgent,
  onNewChat,
  onSelectSession,
  onOpenSkills,
  onOpenMcp,
}: AgentSidebarProps) {
  const { sessions, grouped } = useAgentSessions();
  const workspacePaths = Object.keys(grouped).sort((a, b) => {
    const aMax = Math.max(...grouped[a].map((s) => s.updatedAt));
    const bMax = Math.max(...grouped[b].map((s) => s.updatedAt));
    return bMax - aMax;
  });

  if (collapsed) {
    return (
      <div className="h-full w-10 bg-card border-r flex flex-col items-center py-2 gap-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <button type="button" onClick={onToggleCollapse} className="p-1.5 rounded hover:bg-secondary" title="Expand sidebar">
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={onOpenGeneralConversation}
          className={`p-1.5 rounded transition-colors ${
            isGeneralConversationActive
              ? "bg-rays-violet/20 text-rays-pink shadow-[0_0_10px_rgba(236,72,153,0.3)]"
              : "hover:bg-secondary text-muted-foreground hover:text-white"
          }`}
          title="General Conversation Router"
        >
          <Radio size={16} className={isGeneralConversationActive ? "animate-pulse text-rays-pink" : ""} />
        </button>
        <button type="button" onClick={onNewAgent} className="p-1.5 rounded hover:bg-secondary" title="New agent">
          <Plus size={16} />
        </button>
        <button type="button" onClick={onNewChat} className="p-1.5 rounded hover:bg-secondary" title="New chat">
          <MessageSquarePlus size={16} />
        </button>
        <button type="button" onClick={onOpenSkills} className="p-1.5 rounded hover:bg-secondary" title="Skills — add skill folder">
          <BookOpen size={16} />
        </button>
        <button type="button" onClick={onOpenMcp} className="p-1.5 rounded hover:bg-secondary" title="MCP Servers">
          <Plug size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card border-r" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <div className="px-2.5 py-2 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">Sessions</span>
        <button type="button" onClick={onToggleCollapse} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-white" title="Collapse sidebar">
          <ChevronLeft size={13} />
        </button>
      </div>

      <div className="p-1.5 space-y-0.5 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <button
          type="button"
          onClick={onOpenGeneralConversation}
          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors text-left font-medium ${
            isGeneralConversationActive
              ? "bg-gradient-to-r from-rays-violet/20 to-rays-pink/15 text-white border border-rays-violet/30 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
              : "hover:bg-secondary text-foreground/80 hover:text-white"
          }`}
        >
          <Radio size={13} className={isGeneralConversationActive ? "text-rays-pink animate-pulse" : "text-rays-lilac"} />
          <span>General Conversation</span>
        </button>
        <button
          type="button"
          onClick={onNewAgent}
          className="w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-secondary text-foreground/80 hover:text-white transition-colors text-left"
        >
          <Plus size={13} className="text-muted-foreground" />
          <span>New Agent</span>
        </button>
        <button
          type="button"
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-secondary text-foreground/80 hover:text-white transition-colors text-left"
        >
          <MessageSquarePlus size={13} className="text-muted-foreground" />
          <span>New Chat</span>
        </button>
        <button
          type="button"
          onClick={onOpenSkills}
          className="w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-secondary text-foreground/80 hover:text-white transition-colors text-left"
        >
          <BookOpen size={13} className="text-muted-foreground" />
          <span>Add Skill…</span>
        </button>
        <button
          type="button"
          onClick={onOpenMcp}
          className="w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-secondary text-foreground/80 hover:text-white transition-colors text-left"
        >
          <Plug size={13} className="text-muted-foreground" />
          <span>MCP Servers</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-2.5 min-h-0">
        {workspacePaths.length === 0 && (
          <div className="px-2 py-3 text-[10px] text-muted-foreground/70">
            No chats yet. Open a folder or skill above.
          </div>
        )}
        {workspacePaths.map((workspacePath) => (
          <div key={workspacePath}>
            <div className="flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/70">
              <FolderOpen size={11} className="text-rays-lavender shrink-0" />
              <span className="truncate" title={workspacePath}>
                {workspaceLabel(workspacePath)}
              </span>
            </div>
            <div className="space-y-0.5 mt-0.5">
              {grouped[workspacePath].map((session) => {
                const isActive = activeSessionId === session.id;
                const isOpening = openingSessionId === session.id;
                return (
                  <button
                    key={session.id}
                    type="button"
                    disabled={false}
                    onClick={() => onSelectSession(session)}
                    className={`w-full text-left px-2 py-1 rounded text-[11px] truncate transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? "bg-secondary text-foreground font-medium"
                        : "text-muted-foreground/80 hover:bg-secondary/60 hover:text-foreground"
                    } disabled:opacity-40`}
                    title={session.title}
                  >
                    {isOpening && <Loader2 size={11} className="shrink-0 animate-spin" />}
                    <span className="truncate">{session.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="px-2.5 py-1.5 border-t text-[9.5px] text-muted-foreground/70" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        {sessions.length} chat{sessions.length === 1 ? "" : "s"} — click to reopen
      </div>
    </div>
  );
}
