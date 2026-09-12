"""Central coordinator for General Conversation Mode across terminal multiplexers."""
import logging
import os
import sys
import time
from typing import Optional, List, Dict, Any, Tuple

from .session_detector import SessionDetector, TerminalSession
from .buffer_capture import BufferCapture
from .citation_resolver import CitationResolver
from .semantic_router import SemanticRouter, RoutingDecision
from .terminal_injector import TerminalInjector
from .agent_observer import AgentObserver, ObservationResult

logger = logging.getLogger(__name__)


class GeneralConversationManager:
    """Coordinates Universal Semantic Cross-Terminal Agent Routing & Observation."""

    def __init__(self, codebase_root: Optional[str] = None):
        self.codebase_root = codebase_root or os.getcwd()
        self.active: bool = True
        self.session_detector = SessionDetector()
        self.buffer_capture = BufferCapture()
        self.citation_resolver = CitationResolver([self.codebase_root])
        self.terminal_injector = TerminalInjector()
        self.agent_observer = AgentObserver(self.buffer_capture)
        self.cached_sessions: List[TerminalSession] = []
        self.manual_sessions: Dict[str, TerminalSession] = {}

    def get_all_sessions(self) -> List[TerminalSession]:
        """Return merged list of auto-discovered and manually connected sessions."""
        auto_sessions = self.session_detector.detect_all_sessions()
        session_map: Dict[str, TerminalSession] = {s.session_id: s for s in auto_sessions}
        # Overlay manually connected sessions
        for sid, s in self.manual_sessions.items():
            session_map[sid] = s
        self.cached_sessions = list(session_map.values())
        return self.cached_sessions

    def start_mode(self) -> List[TerminalSession]:
        """Activate General Conversation Mode and scan connected sessions."""
        self.active = True
        return self.get_all_sessions()

    def exit_mode(self) -> None:
        """Exit General Conversation Mode and return to standard agent mode."""
        self.active = False

    def refresh_sessions(self) -> List[TerminalSession]:
        """Rescan active sessions."""
        return self.get_all_sessions()

    def connect_session(self, identifier: str) -> Tuple[bool, str, Optional[TerminalSession]]:
        """
        Explicitly connect to a session by PID, tmux pane/session name, TTY name, or Kitty window ID.
        """
        sess, detail = self.session_detector.connect_session_by_identifier(identifier)
        if not sess:
            return False, detail, None
        self.manual_sessions[sess.session_id] = sess
        self.active = True
        return True, detail, sess

    def disconnect_session(self, identifier: str) -> Tuple[bool, str]:
        """Remove a manually connected session."""
        raw_id = identifier.strip().lower()
        matched_key = None
        for sid in self.manual_sessions:
            if sid.lower() == raw_id or sid.lower().endswith(raw_id) or raw_id in sid.lower():
                matched_key = sid
                break
        if matched_key:
            del self.manual_sessions[matched_key]
            return True, f"Disconnected session `{matched_key}`."
        return False, f"No connected session found matching `{identifier}`."

    def process_prompt(
        self,
        raw_prompt: str,
        ai_client: Any,
        on_interim_summary: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Full orchestration pipeline for a General Conversation prompt:
        1. Resolve @file citations from any directory to absolute paths.
        2. Pull recent 90-100 lines of buffer from every active terminal session.
        3. Semantically route the prompt to the matching agent session.
        4. Verify target agent readiness (prevent typing into bare shell).
        5. Deliver prompt without mutation.
        6. Observe output across exponential wait stages: if completed -> show full response; if in-progress -> show progress summaries.
        """
        # Step 1: Resolve @file citations
        resolved_prompt, cited_files = self.citation_resolver.resolve_prompt_citations(
            raw_prompt, cwd_hint=self.codebase_root
        )

        # Step 2: Refresh and capture recent buffers (last 90-100 lines)
        sessions = self.get_all_sessions()

        if not sessions:
            return {
                "ok": False,
                "error": (
                    "No active terminal sessions detected. "
                    "Make sure an agent is running in a tmux pane, Kitty window, or Terminal tab."
                ),
            }

        session_contexts: List[Tuple[TerminalSession, str]] = []
        for sess in sessions:
            buf = self.buffer_capture.capture_recent_lines(sess, num_lines=100)
            session_contexts.append((sess, buf))

        # Step 3: Semantic LLM Routing (or direct dispatch if manually connected)
        from .semantic_router import RoutingDecision
        if len(self.manual_sessions) == 1:
            target_session = list(self.manual_sessions.values())[0]
            decision = RoutingDecision(
                target_session=target_session,
                confidence=1.0,
                reasoning=f"Dispatched directly to connected session {target_session.session_id} in {target_session.cwd}",
                raw_decision={"target_session_id": target_session.session_id}
            )
        else:
            router = SemanticRouter(ai_client)
            decision = router.route_prompt(resolved_prompt, session_contexts)
            target_session = decision.target_session

        # Find target's initial buffer for output diffing
        target_initial_buf = ""
        for sess, buf in session_contexts:
            if sess.session_id == target_session.session_id:
                target_initial_buf = buf
                break

        # Step 4: Verify target agent is alive and ready
        ready, reason = self.session_detector.verify_agent_ready(target_session, target_initial_buf)
        if not ready:
            return {
                "ok": False,
                "target_session": target_session,
                "decision": decision,
                "error": reason,
            }

        # Step 5: Inject exact prompt into target terminal agent
        injected, err_or_res = self.terminal_injector.inject_prompt(target_session, resolved_prompt)
        if not injected:
            return {
                "ok": False,
                "target_session": target_session,
                "decision": decision,
                "error": f"Failed to inject prompt into `{target_session.session_id}`: {err_or_res}",
            }

        # If direct IPC returned the full AI agent response, return immediately
        if target_session.extra.get("conv_id") and len(err_or_res.strip()) > 30 and not err_or_res.startswith("Dispatched") and not err_or_res.startswith("Delivered") and not err_or_res.startswith("Switched"):
            from .agent_observer import ObservationResult
            obs_result = ObservationResult(
                status="completed",
                full_output=err_or_res.strip(),
                summary=None,
                stage=1
            )
            return {
                "ok": True,
                "target_session": target_session,
                "decision": decision,
                "resolved_prompt": resolved_prompt,
                "cited_files": cited_files,
                "observation": obs_result,
            }

        # Step 6: Progressive observation across exponential stages
        obs_result = self.agent_observer.observe_session(
            session=target_session,
            initial_buffer=target_initial_buf,
            ai_client=ai_client,
            on_interim_summary=on_interim_summary,
        )

        return {
            "ok": True,
            "target_session": target_session,
            "decision": decision,
            "resolved_prompt": resolved_prompt,
            "cited_files": cited_files,
            "observation": obs_result,
        }


# Global singleton instance
_GLOBAL_GC_MANAGER: Optional[GeneralConversationManager] = None


def get_gc_manager(codebase_root: Optional[str] = None) -> GeneralConversationManager:
    global _GLOBAL_GC_MANAGER
    if _GLOBAL_GC_MANAGER is None:
        _GLOBAL_GC_MANAGER = GeneralConversationManager(codebase_root)
    return _GLOBAL_GC_MANAGER
