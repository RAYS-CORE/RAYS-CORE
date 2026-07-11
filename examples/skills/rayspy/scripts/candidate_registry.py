from __future__ import annotations
from typing import Optional
from models import CandidateProfile, ValidationState, VALIDATED_PROFILE_THRESHOLD


class CandidateRegistry:
    """Central registry keyed by candidate UUID.

    Every downstream stage consults this registry and filters by state.
    """

    def __init__(self):
        self._by_id: dict[str, CandidateProfile] = {}

    def add(self, candidate: CandidateProfile):
        self._by_id[candidate.id] = candidate

    def get(self, candidate_id: str) -> Optional[CandidateProfile]:
        return self._by_id.get(candidate_id)

    def get_by_url(self, url: str) -> Optional[CandidateProfile]:
        for c in self._by_id.values():
            if c.url == url:
                return c
        return None

    def all(self) -> list[CandidateProfile]:
        return list(self._by_id.values())

    def filter(self, state: Optional[str] = None, min_quality: float = 0.0) -> list[CandidateProfile]:
        results = self._by_id.values()
        if state:
            results = (c for c in results if c.state == state)
        if min_quality > 0:
            results = (c for c in results if c.quality_score >= min_quality)
        return list(results)

    def count_by_state(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for c in self._by_id.values():
            counts[c.state] = counts.get(c.state, 0) + 1
        return counts

    def evidence_chain(self) -> dict[str, int]:
        """Return stage-by-stage counts for reporting."""
        all_c = self.all()
        return {
            "leads": len([c for c in all_c if c.source in ("sherlock", "SHERLOCK")]),
            "candidates": len(all_c),
            "browser_loaded": len([c for c in all_c if c.state == "PAGE_LOADED" or c.http_status is not None]),
            "validated": len([c for c in all_c if c.state == "VALIDATED"]),
            "rejected": len([c for c in all_c if c.state == "REJECTED"]),
            "high_quality": len([c for c in all_c if c.state == "VALIDATED" and c.quality_score >= VALIDATED_PROFILE_THRESHOLD]),
            "identity_candidates": 0,
            "verified": 0,
        }

    def transition(self, candidate_id: str, new_state: str, reason: str = ""):
        c = self._by_id.get(candidate_id)
        if c:
            c.transition(new_state, reason)

    def validated_candidates(self) -> list[CandidateProfile]:
        """Candidates that passed validation and quality threshold."""
        result = []
        for c in self._by_id.values():
            if c.state != "VALIDATED":
                continue
            if c.validation is None:
                continue
            if not should_continue(c.validation.status):
                continue
            if c.quality_score < VALIDATED_PROFILE_THRESHOLD:
                continue
            result.append(c)
        return result


def should_continue(status: str) -> bool:
    try:
        return ValidationState(status).should_continue()
    except (ValueError, AttributeError):
        return status not in ("NOT_FOUND", "SUSPENDED", "DELETED")
