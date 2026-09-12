"""General Conversation — Universal Cross-Terminal Agent Orchestrator & Router."""
from .gc_manager import GeneralConversationManager, get_gc_manager
from .session_detector import TerminalSession, SessionDetector
from .buffer_capture import BufferCapture
from .citation_resolver import CitationResolver
from .semantic_router import SemanticRouter
from .terminal_injector import TerminalInjector
from .agent_observer import AgentObserver

__all__ = [
    "GeneralConversationManager",
    "get_gc_manager",
    "TerminalSession",
    "SessionDetector",
    "BufferCapture",
    "CitationResolver",
    "SemanticRouter",
    "TerminalInjector",
    "AgentObserver",
]
