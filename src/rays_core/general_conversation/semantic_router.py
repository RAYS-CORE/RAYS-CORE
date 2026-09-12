"""Semantic LLM Router for cross-terminal prompt dispatch."""
import json
import logging
import os
import re
from dataclasses import dataclass
from typing import List, Tuple, Dict, Any, Optional
from .session_detector import TerminalSession

logger = logging.getLogger(__name__)


@dataclass
class RoutingDecision:
    """The outcome of semantic routing for a prompt."""
    target_session: TerminalSession
    reasoning: str
    confidence: float
    raw_decision: Dict[str, Any]


class SemanticRouter:
    """Uses LLM reasoning to route prompts to the correct terminal session."""

    def __init__(self, ai_client: Any):
        self.ai_client = ai_client

    def route_prompt(
        self,
        user_prompt: str,
        session_contexts: List[Tuple[TerminalSession, str]],
    ) -> RoutingDecision:
        """
        Determines the single best terminal session to receive user_prompt.
        
        Args:
            user_prompt: The prompt entered by the user (with resolved @citations).
            session_contexts: List of (session, last_90_100_lines_buffer).
        """
        if not session_contexts:
            raise ValueError("No active terminal sessions detected.")

        # Single session trivial bypass
        if len(session_contexts) == 1:
            session, _buf = session_contexts[0]
            return RoutingDecision(
                target_session=session,
                reasoning="Single active terminal session connected.",
                confidence=1.0,
                raw_decision={"target_session_id": session.session_id}
            )

        # Build structured context for the LLM
        session_blocks = []
        id_to_session: Dict[str, TerminalSession] = {}

        for idx, (sess, buffer_tail) in enumerate(session_contexts, start=1):
            id_to_session[sess.session_id] = sess
            # Truncate buffer tail to last 80 lines for prompt token efficiency
            clean_tail = "\n".join(buffer_tail.splitlines()[-80:]) if buffer_tail else "(empty session buffer)"
            session_blocks.append(
                f"### Session [{idx}]: ID `{sess.session_id}`\n"
                f"- **Agent/Process**: {sess.agent_name} ({sess.foreground_cmd})\n"
                f"- **Directory**: {sess.cwd}\n"
                f"- **Status**: {sess.status}\n"
                f"- **Recent Terminal Activity (last ~80 lines)**:\n"
                f"```terminal\n{clean_tail}\n```\n"
            )

        system_prompt = (
            "You are a Universal Terminal Agent Router.\n"
            "You are given a list of active terminal sessions (running AI agents, shells, or REPLs) and recent output logs from each.\n"
            "Your task is to analyze the user's prompt and determine which terminal session the prompt should be delivered to.\n\n"
            "STRICT ROUTING RULES:\n"
            "1. Base your routing decision SOLELY on the semantic intent of the user prompt and how it connects to the ongoing work, errors, files, or conversation in each session.\n"
            "2. Citations (e.g., @path/to/file) provide context and DO NOT dictate which terminal session the prompt goes to. A prompt referencing a file in dir B may be for an agent in dir A.\n"
            "3. Choose exactly one `target_session_id` from the provided active sessions.\n\n"
            "ACTIVE SESSIONS:\n"
            + "\n".join(session_blocks)
            + "\nUSER PROMPT TO ROUTE:\n"
            + f'"""\n{user_prompt}\n"""\n\n'
            + "Return a JSON object with this exact schema:\n"
            + '{\n'
            + '  "target_session_id": "<exact session_id from list>",\n'
            + '  "target_agent": "<agent name>",\n'
            + '  "confidence": <float 0.0 to 1.0>,\n'
            + '  "reasoning": "<1-2 sentence explanation of why this session was chosen>"\n'
            + '}\n'
        )

        try:
            if hasattr(self.ai_client, "generate_json"):
                response = self.ai_client.generate_json(system_prompt)
            else:
                raw_text = self.ai_client.generate_text(system_prompt)
                response = json.loads(raw_text)

            target_id = str(response.get("target_session_id", "")).strip()
            matched_session = id_to_session.get(target_id)

            # Fallback fuzzy match on session id or name if exact id was slightly formatted
            if not matched_session:
                for sid, sess in id_to_session.items():
                    if sid.lower() in target_id.lower() or target_id.lower() in sid.lower():
                        matched_session = sess
                        break

            if not matched_session:
                # Default to first session
                matched_session = session_contexts[0][0]

            return RoutingDecision(
                target_session=matched_session,
                reasoning=str(response.get("reasoning", "Routed based on session context.")),
                confidence=float(response.get("confidence", 0.9)),
                raw_decision=response if isinstance(response, dict) else {}
            )

        except Exception as e:
            logger.info(f"Semantic router LLM call unavailable ({e}); using lexical & buffer relevance scoring.")
            return self._heuristic_route(user_prompt, session_contexts)

    def _heuristic_route(self, prompt: str, session_contexts: List[Tuple[TerminalSession, str]]) -> RoutingDecision:
        """Score sessions based on keyword overlap, topic tokens, CWD match, and buffer relevance."""
        if not session_contexts:
            raise ValueError("No session contexts available for routing.")

        prompt_lower = prompt.lower()
        prompt_words = set(re.findall(r"\w+", prompt_lower))
        PROJECT_TOPICS = {
            "PMCN": ["stdp", "liquid", "pmcn", "helmholtz", "glial", "spiking", "idrid", "decolle", "eprop", "research_logs"],
            "Hrishav_Sir_FHDR": ["hrishav", "fhdr", "exposure_fusion", "hdr_denoise"],
            "TriGate-HDR": ["trigate", "tri-gate", "gated_fusion"],
            "RAYS-CORE": ["rays", "vivid", "rays-core", "orchestrator", "general_conversation"],
            "portfolio": ["portfolio", "vite", "website", "react_ui"],
            "NMT_low-resource": ["nmt", "translation", "low-resource", "indic"],
            "hfm_model_documentation": ["hfm", "documentation", "hfm_model"]
        }

        terms = [t for t in re.findall(r'[a-zA-Z0-9_\-]+', prompt_lower) if len(t) > 2]
        best_score = -1.0
        best_session = session_contexts[0][0]
        matched_keywords = []

        for session, buf in session_contexts:
            score = 0.0
            buf_lower = buf.lower()
            sname = session.session_name
            cwd_lower = session.cwd.lower()
            curr_matched = []

            # 1. Project Domain Topics Match (+150 points)
            if sname in PROJECT_TOPICS:
                for top in PROJECT_TOPICS[sname]:
                    if top in prompt_lower:
                        score += 150.0
                        curr_matched.append(top)

            # 2. Workspace File Existence (+100 points)
            if "research" in prompt_lower and ("log" in prompt_lower or "logs" in prompt_lower):
                if os.path.exists(os.path.join(session.cwd, "research_logs.md")) or os.path.exists(os.path.join(session.cwd, "replicating_the_brain/liquid_population_act/research_logs.md")):
                    score += 100.0
                    curr_matched.append("research_logs.md")

            # 3. Buffer Relevance (Term density, capped to avoid runaway pollution)
            for t in set(terms):
                c_buf = buf_lower.count(t)
                if c_buf > 0:
                    score += min(20.0, c_buf * 1.5)
                    if t not in curr_matched:
                        curr_matched.append(t)

            if score > best_score:
                best_score = score
                best_session = session
                matched_keywords = curr_matched

        if best_score > 0:
            uniq_matches = list(dict.fromkeys(matched_keywords))
            reason = f"Matched session `{best_session.session_id}` ({best_session.session_name}) based on context relevance ({', '.join(uniq_matches[:4])})."
            confidence = min(0.98, max(0.70, best_score / 150.0))
        else:
            reason = f"Defaulted to session `{best_session.session_id}` (no strong keyword overlap detected)."
            confidence = 0.50

        return RoutingDecision(
            target_session=best_session,
            reasoning=reason,
            confidence=confidence,
            raw_decision={"score": best_score, "heuristic": True}
        )
