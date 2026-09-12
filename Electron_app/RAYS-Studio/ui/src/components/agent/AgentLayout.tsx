import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Sparkles, FolderOpen, ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/ide/AppHeader";
import { SettingsModal } from "@/components/ide/SettingsModal";
import { AgentSidebar } from "@/components/agent/AgentSidebar";
import { AgentChat } from "@/components/agent/AgentChat";
import { AgentExplorer } from "@/components/agent/AgentExplorer";
import { McpManagerPanel } from "@/components/agent/McpManagerPanel";
import { SkillsManagerPanel } from "@/components/agent/SkillsManagerPanel";
import { GeneralConversationView, type RoutedAnswerItem } from "@/components/agent/GeneralConversationView";
import { useRaysSession } from "@/hooks/useRaysSession";
import {
  AGENT_EXPLORER_WIDTH_KEY,
  AGENT_SIDEBAR_WIDTH_KEY,
  LAST_AGENT_SESSION_KEY,
} from "@/services/appStorage";
import { isElectronHost } from "@/services/platformHost";
import {
  bumpAgentSession,
  createAgentSession,
  listAgentSessions,
  type AgentSession,
} from "@/services/agentSessionStorage";
import { loadProviderSettings } from "@/services/workspaceStorage";

export default function AgentLayout() {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [showMcp, setShowMcp] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isGeneralMode, setIsGeneralMode] = useState(false);
  const [gcAnswers, setGcAnswers] = useState<RoutedAnswerItem[]>([]);
  const [isRouting, setIsRouting] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(
    () => Number(localStorage.getItem(AGENT_SIDEBAR_WIDTH_KEY)) || 280
  );
  const [explorerWidth, setExplorerWidth] = useState(
    () => Number(localStorage.getItem(AGENT_EXPLORER_WIDTH_KEY)) || 300
  );
  const [activeSession, setActiveSession] = useState<AgentSession | null>(null);
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const resumeAttempted = useRef(false);

  const {
    state,
    switchSession,
    stopSession,
    submitPrompt,
    respondApproval,
    setExecutionMode,
    refreshTree,
    selectFolder,
    reloadMcp,
    cancelCurrentTask,
  } = useRaysSession();

  const running = state.status === "running";
  const hasActiveChat = Boolean(
    state.sessionId || state.conversationId || state.turns.length > 0 || startingSession
  );

  const openSession = useCallback(
    async (session: AgentSession) => {
      setIsGeneralMode(false);
      if (
        state.conversationId === session.id &&
        state.sessionId &&
        state.connected &&
        !startingSession
      ) {
        setActiveSession(session);
        bumpAgentSession(session.id);
        return;
      }

      setOpeningSessionId(session.id);
      setStartingSession(true);
      setStartError(null);
      setActiveSession(session);

      try {
        await switchSession(session.workspacePath, session.id, loadProviderSettings());
        bumpAgentSession(session.id);
        localStorage.setItem(LAST_AGENT_SESSION_KEY, session.id);
      } catch (err) {
        setStartError(err instanceof Error ? err.message : "Failed to start session");
      } finally {
        setStartingSession(false);
        setOpeningSessionId(null);
      }
    },
    [
      startingSession,
      switchSession,
      state.connected,
      state.conversationId,
      state.sessionId,
    ]
  );

  const handleNewAgent = useCallback(async () => {
    setIsGeneralMode(false);
    const path = await selectFolder();
    if (!path) return;
    const session = createAgentSession(path);
    await openSession(session);
  }, [openSession, selectFolder]);

  const handleNewChat = useCallback(async () => {
    setIsGeneralMode(false);
    const workspacePath = state.workspaceRoot || activeSession?.workspacePath;
    if (!workspacePath) {
      await handleNewAgent();
      return;
    }
    const session = createAgentSession(workspacePath);
    await openSession(session);
  }, [activeSession?.workspacePath, handleNewAgent, openSession, state.workspaceRoot]);

  const [connectedAgents, setConnectedAgents] = useState<Array<{ id: string; name: string; cwd: string }>>([]);

  const refreshConnectedAgents = useCallback(async () => {
    try {
      if ((window as any).raysDesktop?.listConnectedAgents) {
        const workspace = state.workspaceRoot || activeSession?.workspacePath || "";
        const agents = await (window as any).raysDesktop.listConnectedAgents(workspace);
        if (Array.isArray(agents) && agents.length > 0) {
          setConnectedAgents(agents);
        }
      }
    } catch {
      // ignore
    }
  }, [activeSession?.workspacePath, state.workspaceRoot]);

  useEffect(() => {
    void refreshConnectedAgents();
    const interval = setInterval(() => {
      void refreshConnectedAgents();
    }, 4000);
    return () => clearInterval(interval);
  }, [refreshConnectedAgents]);

  const handleSendGcPrompt = useCallback(
    async (prompt: string) => {
      setIsRouting(true);
      try {
        if (window.raysDesktop?.routeGeneralPrompt) {
          const workspace = state.workspaceRoot || activeSession?.workspacePath || "";
          const result = await window.raysDesktop.routeGeneralPrompt(prompt, workspace);
          if (result && result.answer) {
            setGcAnswers((prev) => [
              ...prev,
              {
                id: `gc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                agentName: result.agent_name || "Agent",
                sessionId: result.target_session || "Terminal",
                prompt,
                answer: result.answer,
                timestamp: Date.now(),
              },
            ]);
          } else if (result && result.error) {
            setGcAnswers((prev) => [
              ...prev,
              {
                id: `gc-${Date.now()}`,
                agentName: "Router Error",
                sessionId: "System",
                prompt,
                answer: `⚠️ ${result.error}`,
                timestamp: Date.now(),
              },
            ]);
          }
        }
      } catch (err) {
        console.error("General Conversation Route Error:", err);
      } finally {
        setIsRouting(false);
      }
    },
    [activeSession?.workspacePath, state.workspaceRoot]
  );

  useEffect(() => {
    if (resumeAttempted.current || state.sessionId || state.conversationId || startingSession) return;
    const sessions = listAgentSessions();
    if (sessions.length === 0) return;
    resumeAttempted.current = true;
    const lastId = localStorage.getItem(LAST_AGENT_SESSION_KEY);
    const session = (lastId && sessions.find((s) => s.id === lastId)) || sessions[0];
    void openSession(session);
  }, [openSession, startingSession, state.sessionId]);

  useEffect(() => {
    if (!isElectronHost() || !window.raysDesktop?.onMenuAction) return;
    return window.raysDesktop.onMenuAction(async (action) => {
      if (action === "open-folder") {
        await handleNewAgent();
        return;
      }
      if (action === "close-workspace") {
        if (state.sessionId) await stopSession();
        setActiveSession(null);
        return;
      }
      if (action === "navigate-ide") {
        navigate("/ide");
      }
    });
  }, [handleNewAgent, navigate, state.sessionId, stopSession]);

  const beginHorizontalResize = useCallback(
    (event: ReactMouseEvent, side: "left" | "right") => {
      event.preventDefault();
      const startX = event.clientX;
      const startLeft = sidebarWidth;
      const startRight = explorerWidth;
      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        if (side === "left") {
          const next = Math.max(200, Math.min(480, startLeft + delta));
          setSidebarWidth(next);
          localStorage.setItem(AGENT_SIDEBAR_WIDTH_KEY, String(next));
        } else {
          const next = Math.max(220, Math.min(560, startRight - delta));
          setExplorerWidth(next);
          localStorage.setItem(AGENT_EXPLORER_WIDTH_KEY, String(next));
        }
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [explorerWidth, sidebarWidth]
  );

  const openSkillsPanel = () => {
    setShowSkills(true);
    setShowMcp(false);
  };

  const openMcpPanel = () => {
    setShowMcp(true);
    setShowSkills(false);
  };

  const skillsWorkspace = state.workspaceRoot || activeSession?.workspacePath || null;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <AppHeader
        onOpenSettings={() => setShowSettings(true)}
        onOpenSkills={openSkillsPanel}
        onOpenMcp={openMcpPanel}
      />

      <div className="flex-1 flex min-h-0">
        <div style={{ width: leftCollapsed ? 40 : sidebarWidth }} className="shrink-0 h-full relative">
          <AgentSidebar
            collapsed={leftCollapsed}
            onToggleCollapse={() => setLeftCollapsed((v) => !v)}
            activeSessionId={activeSession?.id || state.conversationId}
            openingSessionId={openingSessionId}
            isGeneralConversationActive={isGeneralMode}
            onOpenGeneralConversation={() => setIsGeneralMode(true)}
            onNewAgent={() => void handleNewAgent()}
            onNewChat={() => void handleNewChat()}
            onSelectSession={(session) => void openSession(session)}
            onOpenSkills={openSkillsPanel}
            onOpenMcp={openMcpPanel}
          />
          {!leftCollapsed && (
            <div
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-rays-lilac/40"
              onMouseDown={(e) => beginHorizontalResize(e, "left")}
            />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          {isGeneralMode ? (
            <GeneralConversationView
              onSendPrompt={handleSendGcPrompt}
              answers={gcAnswers}
              isRouting={isRouting}
              connectedSessionsCount={connectedAgents.length}
              activeSessions={connectedAgents}
              workspaceRoot={state.workspaceRoot || activeSession?.workspacePath}
            />
          ) : !hasActiveChat ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 relative overflow-hidden bg-gradient-to-b from-[#0e0d18] via-[#090812] to-[#06050b]">
              {/* Vivid RAYS Glow Backdrop */}
              <div className="absolute w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.18)_0%,rgba(168,85,247,0.12)_40%,transparent_75%)] blur-3xl pointer-events-none" />
              <div className="absolute w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle_at_center,rgba(250,133,209,0.22)_0%,transparent_70%)] blur-2xl pointer-events-none" />

              {/* Giant Unique Artistic RAYS Centered Banner */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="text-9xl sm:text-[145px] font-black tracking-[0.2em] leading-none text-transparent bg-clip-text bg-gradient-to-r from-[#f52999] via-[#fa85d1] via-[#c084fc] to-[#941fe0] drop-shadow-[0_0_65px_rgba(245,41,153,0.7)] drop-shadow-[0_0_130px_rgba(148,31,224,0.5)] select-none transition-transform hover:scale-[1.02] duration-300">
                  RAYS
                </div>
              </div>

              {(startError || state.error) && (
                <div className="text-xs text-red-400 max-w-lg text-center bg-red-950/30 p-2.5 rounded-lg border border-red-800/40 font-mono">
                  {startError || state.error}
                </div>
              )}

              {/* Action Buttons (Hermes Refined Compact Style) */}
              <div className="relative z-10 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsGeneralMode(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-rays-violet to-rays-pink text-white text-[12px] font-medium shadow-md shadow-rays-violet/20 hover:shadow-rays-pink/30 hover:scale-[1.01] transition-all"
                >
                  <Radio size={13} className="text-white animate-pulse" />
                  <span>Open General Conversation</span>
                </button>

                <button
                  type="button"
                  disabled={startingSession}
                  onClick={() => void handleNewAgent()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white/90 hover:text-white text-[12px] font-medium transition-all disabled:opacity-50 shadow-sm"
                >
                  <FolderOpen size={13} className="text-rays-lavender" />
                  <span>{startingSession ? "Starting…" : "New Agent in Folder…"}</span>
                </button>
              </div>
            </div>
          ) : (
            <AgentChat
              turns={state.turns}
              connected={state.connected}
              running={running}
              loading={startingSession || state.status === "starting"}
              hudPhase={state.hudPhase}
              hudDetail={state.hudDetail}
              tokenCount={state.tokenCount}
              pendingApproval={state.pendingApproval}
              defaultMode="agent"
              onSend={(prompt, mode) => submitPrompt(prompt, mode || "agent")}
              onApprove={respondApproval}
              onStop={cancelCurrentTask}
            />
          )}
        </div>

        {hasActiveChat && (
          <div style={{ width: rightCollapsed ? 40 : explorerWidth }} className="shrink-0 h-full relative">
            {!rightCollapsed && (
              <div
                className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-rays-lilac/40 z-10"
                onMouseDown={(e) => beginHorizontalResize(e, "right")}
              />
            )}
            <AgentExplorer
              collapsed={rightCollapsed}
              onToggleCollapse={() => setRightCollapsed((v) => !v)}
              nodes={state.fileTree}
              workspaceRoot={state.workspaceRoot}
              onRefresh={refreshTree}
            />
          </div>
        )}
      </div>

      <div className="h-7 border-t px-3 flex items-center justify-between text-[10px] text-muted-foreground bg-card/80" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <span>{state.workspaceRoot || activeSession?.workspacePath || "No workspace"}</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={state.executionMode === "autonomous"}
              onChange={(e) => setExecutionMode(e.target.checked ? "autonomous" : "ask")}
              disabled={!state.sessionId}
            />
            Autonomous mode
          </label>
          <span>{state.sessionId ? state.status : "no session"}</span>
        </div>
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <McpManagerPanel
        open={showMcp}
        onClose={() => setShowMcp(false)}
        workspaceRoot={skillsWorkspace}
        sessionActive={Boolean(state.sessionId && state.connected)}
        onReloadMcp={reloadMcp}
      />
      <SkillsManagerPanel open={showSkills} onClose={() => setShowSkills(false)} workspaceRoot={skillsWorkspace} />
    </div>
  );
}
