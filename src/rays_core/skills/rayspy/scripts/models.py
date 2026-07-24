from __future__ import annotations
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional
from uuid import uuid4


class CandidateStatus(Enum):
    LEAD = "LEAD"
    DISCOVERED = "DISCOVERED"
    CANONICALIZED = "CANONICALIZED"
    PAGE_LOADED = "PAGE_LOADED"
    VALIDATED = "VALIDATED"
    PROFILE_QUALITY_CHECKED = "PROFILE_QUALITY_CHECKED"
    ELIGIBLE = "ELIGIBLE"
    REJECTED = "REJECTED"
    SKIPPED = "SKIPPED"


class ValidationStatus(Enum):
    FOUND = "FOUND"
    NOT_FOUND = "NOT_FOUND"
    LOGIN_REQUIRED = "LOGIN_REQUIRED"
    SUSPENDED = "SUSPENDED"
    PRIVATE = "PRIVATE"
    PROTECTED = "PROTECTED"
    ERROR = "ERROR"


class ValidationState(Enum):
    """Richer validation outcome used in the Candidate Generator -> Validator flow."""
    NOT_ATTEMPTED = "NOT_ATTEMPTED"
    FOUND_PUBLIC = "FOUND_PUBLIC"
    FOUND_LOGIN_REQUIRED = "FOUND_LOGIN_REQUIRED"
    FOUND_PRIVATE = "FOUND_PRIVATE"
    FOUND_LIMITED = "FOUND_LIMITED"
    NOT_FOUND = "NOT_FOUND"
    SUSPENDED = "SUSPENDED"
    DELETED = "DELETED"
    ERROR = "ERROR"

    def should_continue(self) -> bool:
        """Only NOT_FOUND, SUSPENDED, DELETED, ERROR should be rejected."""
        return self in (
            ValidationState.FOUND_PUBLIC,
            ValidationState.FOUND_LOGIN_REQUIRED,
            ValidationState.FOUND_PRIVATE,
            ValidationState.FOUND_LIMITED,
        )

    def as_legacy_status(self) -> str:
        mapping = {
            ValidationState.FOUND_PUBLIC: "FOUND",
            ValidationState.FOUND_LOGIN_REQUIRED: "LOGIN_REQUIRED",
            ValidationState.FOUND_PRIVATE: "PRIVATE",
            ValidationState.FOUND_LIMITED: "FOUND",
            ValidationState.NOT_FOUND: "NOT_FOUND",
            ValidationState.SUSPENDED: "SUSPENDED",
            ValidationState.DELETED: "NOT_FOUND",
            ValidationState.ERROR: "ERROR",
            ValidationState.NOT_ATTEMPTED: "ERROR",
        }
        return mapping.get(self, "ERROR")


class FaceVerificationState(Enum):
    NOT_ATTEMPTED = "NOT_ATTEMPTED"
    SKIPPED = "SKIPPED"
    VERIFIED = "VERIFIED"


# Backward compatibility alias
FaceVerificationStatus = FaceVerificationState


class EvidenceClass(Enum):
    WEAK = "WEAK"
    MEDIUM = "MEDIUM"
    STRONG = "STRONG"


class LeadSource(Enum):
    SHERLOCK = "SHERLOCK"
    CROSS_VERIFICATION = "CROSS_VERIFICATION"
    WEB_SEARCH = "WEB_SEARCH"
    DIRECT_PROBE = "DIRECT_PROBE"


@dataclass
class ValidationResult:
    exists: bool
    accessible: bool
    status: str  # ValidationState value
    confidence: float
    reason: str
    profile_type: str = "profile"
    signals: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)

    def as_validation_state(self) -> str:
        return self.status


@dataclass
class CandidateProfile:
    id: str = field(default_factory=lambda: str(uuid4()))
    source: str = "sherlock"
    source_confidence: float = 0.3
    platform: str = "web"
    url: str = ""
    username: Optional[str] = None
    display_name: Optional[str] = None
    state: str = "LEAD"  # LEAD, DISCOVERED, PAGE_LOADED, VALIDATED, REJECTED
    dom: Optional[str] = None
    final_url: Optional[str] = None
    http_status: Optional[int] = None
    validation: Optional[ValidationResult] = None
    quality_score: float = 0.0
    image_url: Optional[str] = None
    bio: Optional[str] = None
    state_history: list[tuple[str, str]] = field(default_factory=list)

    def transition(self, new_state: str, reason: str = ""):
        self.state_history.append((self.state, reason))
        self.state = new_state

    @property
    def is_rejected(self) -> bool:
        return self.state == "REJECTED"

    @property
    def is_validated(self) -> bool:
        return self.state == "VALIDATED" and self.validation is not None and self.validation.exists

    @property
    def should_continue(self) -> bool:
        if self.validation is None:
            return True
        try:
            return ValidationState(self.validation.status).should_continue()
        except (ValueError, AttributeError):
            return self.validation.exists

    def to_dict(self) -> dict:
        d = {
            "id": self.id,
            "source": self.source,
            "source_confidence": self.source_confidence,
            "platform": self.platform,
            "url": self.url,
            "username": self.username,
            "display_name": self.display_name,
            "bio": self.bio,
            "image_url": self.image_url,
            "state": self.state,
            "final_url": self.final_url,
            "http_status": self.http_status,
            "dom_length": len(self.dom) if self.dom else 0,
            "validation": self.validation.to_dict() if self.validation else None,
            "quality_score": self.quality_score,
        }
        ev = getattr(self, "extracted_evidence", None)
        if ev:
            d["extracted_evidence"] = ev
        return d


# ── Legacy models (kept for backward compatibility) ──

@dataclass
class ValidatedProfile:
    url: str
    platform: str
    handle: Optional[str] = None
    name: Optional[str] = None
    exists: bool = False
    validation_status: ValidationStatus = ValidationStatus.ERROR
    quality_score: float = 0.0
    completeness_score: float = 0.0
    investigative_value: float = 0.0
    is_eligible: bool = False
    extracted_fields: dict = field(default_factory=dict)
    signals: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    low_value_indicators: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "url": self.url,
            "platform": self.platform,
            "handle": self.handle,
            "name": self.name,
            "exists": self.exists,
            "validation_status": self.validation_status.value,
            "quality_score": self.quality_score,
            "completeness_score": self.completeness_score,
            "investigative_value": self.investigative_value,
            "is_eligible": self.is_eligible,
            "signals": self.signals,
            "warnings": self.warnings,
            "low_value_indicators": self.low_value_indicators,
        }


@dataclass
class EvidenceItem:
    evidence_class: EvidenceClass
    description: str
    weight: float
    source: str

    def to_dict(self) -> dict:
        return {
            "evidence_class": self.evidence_class.value,
            "description": self.description,
            "weight": self.weight,
            "source": self.source,
        }


@dataclass
class IdentityCandidate:
    linked_profiles: list[ValidatedProfile] = field(default_factory=list)
    name: Optional[str] = None
    confidence: float = 0.0
    confidence_label: str = "LOW"
    evidence: list[EvidenceItem] = field(default_factory=list)
    face_verification_status: FaceVerificationStatus = FaceVerificationStatus.NOT_ATTEMPTED

    def to_dict(self) -> dict:
        return {
            "linked_profiles": [p.to_dict() for p in self.linked_profiles],
            "name": self.name,
            "confidence": self.confidence,
            "confidence_label": self.confidence_label,
            "evidence": [e.to_dict() for e in self.evidence],
            "face_verification_status": self.face_verification_status.value,
        }


@dataclass
class VerifiedIdentity:
    candidate: IdentityCandidate
    confidence: float = 0.0
    verification_method: str = "none"
    supporting_evidence: list[EvidenceItem] = field(default_factory=list)
    face_verified: bool = False
    reference_source: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "candidate": self.candidate.to_dict(),
            "confidence": self.confidence,
            "verification_method": self.verification_method,
            "supporting_evidence": [e.to_dict() for e in self.supporting_evidence],
            "face_verified": self.face_verified,
            "reference_source": self.reference_source,
        }


@dataclass
class FaceImage:
    url: str
    platform: str
    profile_url: str
    provenance: str  # "reference" or "candidate"
    embedding: Optional[list[float]] = None
    face_detected: bool = False
    local_path: Optional[str] = None
    source_name: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "url": self.url,
            "platform": self.platform,
            "profile_url": self.profile_url,
            "provenance": self.provenance,
            "face_detected": self.face_detected,
            "source_name": self.source_name,
        }


@dataclass
class CandidateRecord:
    candidate_id: str
    platform: str
    original_url: str
    canonical_url: Optional[str] = None
    source: str = "SHERLOCK"
    lead_confidence: float = 0.0
    reachable: bool = False
    validation_status: Optional[str] = None
    validation_reason: Optional[str] = None
    quality_score: float = 0.0
    completeness_score: float = 0.0
    graph_eligible: bool = False
    identity_eligible: bool = False
    face_eligible: bool = False
    report_eligible: bool = False
    status_history: list[tuple[str, str]] = field(default_factory=list)

    def transition(self, new_status: str, reason: str = ""):
        self.status_history.append((new_status, reason))

    def to_dict(self) -> dict:
        return {
            "candidate_id": self.candidate_id,
            "platform": self.platform,
            "original_url": self.original_url,
            "canonical_url": self.canonical_url,
            "source": self.source,
            "lead_confidence": self.lead_confidence,
            "reachable": self.reachable,
            "validation_status": self.validation_status,
            "validation_reason": self.validation_reason,
            "quality_score": self.quality_score,
            "completeness_score": self.completeness_score,
            "graph_eligible": self.graph_eligible,
            "identity_eligible": self.identity_eligible,
            "face_eligible": self.face_eligible,
            "report_eligible": self.report_eligible,
        }


# ── Quality threshold ──
# Raised from 30 -> 55 (0-100 scale). At 30, mere existence + a URL was
# already enough to cross the bar, so nearly every validated profile was
# marked "high quality" regardless of how little was actually known about
# it. 55 requires genuine richness: a photo/bio/org/website on top of basic
# existence, not just existence + a username.
VALIDATED_PROFILE_THRESHOLD = 55  # 0-100 scale for quality_score


# ── Helper: compute quality score from candidate signals ──
def compute_quality_score(candidate: CandidateProfile) -> int:
    """Score 0-100 based on the richness of evidence actually gathered about
    a profile, not just whether it exists. Existence alone (url + exists)
    caps out well below the high-quality threshold; a profile needs a
    genuine mix of photo/name/bio/organization/website to qualify."""
    score = 0
    if candidate.url:
        score += 10
    if candidate.validation:
        if candidate.validation.exists:
            score += 5
        if candidate.validation.signals:
            score += 10
        if candidate.validation.confidence and candidate.validation.confidence >= 0.5:
            score += 10
        if any("organization" in s.lower() for s in candidate.validation.signals):
            score += 15
        if any("website" in s.lower() or "email" in s.lower() for s in candidate.validation.signals):
            score += 15
    if candidate.image_url:
        score += 15
    if candidate.bio:
        score += 15
    if candidate.display_name:
        score += 10
    if candidate.username:
        score += 5
    ev = getattr(candidate, "extracted_evidence", None) or {}
    if ev.get("organizations"):
        score += 5
    if ev.get("locations"):
        score += 5
    return min(score, 100)


# ── Helper: filter ValidationState by continue rules ──
def should_continue_from_state(status: str) -> bool:
    try:
        return ValidationState(status).should_continue()
    except (ValueError, AttributeError):
        return status not in ("NOT_FOUND", "SUSPENDED", "DELETED")


# ── Evidence weights and confidence caps ──
EVIDENCE_WEIGHTS: dict[str, tuple[EvidenceClass, float]] = {
    "same_username": (EvidenceClass.WEAK, 0.05),
    "similar_display_name": (EvidenceClass.WEAK, 0.10),
    "same_organization": (EvidenceClass.MEDIUM, 0.20),
    "same_education": (EvidenceClass.MEDIUM, 0.15),
    "same_website": (EvidenceClass.MEDIUM, 0.20),
    "same_verified_email_domain": (EvidenceClass.STRONG, 0.25),
    "independent_face_verification": (EvidenceClass.STRONG, 0.30),
    "same_location": (EvidenceClass.WEAK, 0.10),
    "same_avatar": (EvidenceClass.MEDIUM, 0.15),
}

CONFIDENCE_CAPS: dict[str, float] = {
    "username_only": 0.35,
    "no_independent_face_no_org_no_website": 0.60,
    "default": 1.0,
}


def compute_capped_confidence(evidence: list[EvidenceItem]) -> tuple[float, str]:
    if not evidence:
        return 0.0, "NO_EVIDENCE"
    base = sum(e.weight for e in evidence)
    base = min(base, 1.0)
    has_face = any(e.evidence_class == EvidenceClass.STRONG and "face" in e.description.lower() for e in evidence)
    has_org = any("organization" in e.description.lower() for e in evidence)
    has_website = any("website" in e.description.lower() or "email" in e.description.lower() for e in evidence)
    has_username_only = all(
        e.evidence_class == EvidenceClass.WEAK and ("username" in e.description.lower() or "display name" in e.description.lower())
        for e in evidence
    )
    if has_username_only:
        cap = CONFIDENCE_CAPS["username_only"]
        label = "LOW"
    elif not has_face and not has_org and not has_website:
        cap = CONFIDENCE_CAPS["no_independent_face_no_org_no_website"]
        label = "MEDIUM" if base >= 0.4 else "LOW"
    else:
        cap = CONFIDENCE_CAPS["default"]
        label = "HIGH" if base >= 0.7 else ("MEDIUM" if base >= 0.4 else "LOW")
    capped = round(min(base, cap), 4)
    return capped, label


def is_profile_eligible(vp: ValidatedProfile) -> bool:
    return vp.exists and vp.validation_status == ValidationStatus.FOUND and vp.completeness_score >= 0.30
