from __future__ import annotations

from models import (
    EvidenceItem, EvidenceClass, compute_capped_confidence,
    IdentityCandidate, ValidatedProfile, FaceVerificationStatus,
)
from typing import Optional


class BayesianConfidence:
    def compute(
        self,
        face_similarity: float = 0.5,
        source_reliability: float = 0.5,
        cross_platform_matches: int = 0,
        username_match: bool = False,
        name_match: bool = False,
        employer_overlap: bool = False,
        education_overlap: bool = False,
        website_match: bool = False,
        contradictions: int = 0,
    ) -> dict:
        return compute_confidence(
            face_similarity=face_similarity,
            source_reliability=source_reliability,
            cross_platform_matches=cross_platform_matches,
            username_match=username_match,
            name_match=name_match,
            employer_overlap=employer_overlap,
            education_overlap=education_overlap,
            website_match=website_match,
            contradictions=contradictions,
        )


def build_evidence(
    profiles: list[ValidatedProfile],
    username_match: bool = False,
    name_match: bool = False,
    employer_overlap: bool = False,
    education_overlap: bool = False,
    website_match: bool = False,
    email_match: bool = False,
    face_verified: bool = False,
    location_match: bool = False,
    same_avatar: bool = False,
) -> list[EvidenceItem]:
    evidence = []

    if username_match:
        evidence.append(EvidenceItem(
            evidence_class=EvidenceClass.WEAK,
            description="Same username across platforms",
            weight=0.05,
            source="profile_analysis",
        ))
    if name_match and not username_match:
        evidence.append(EvidenceItem(
            evidence_class=EvidenceClass.WEAK,
            description="Similar display name",
            weight=0.05,
            source="profile_analysis",
        ))
    if employer_overlap:
        evidence.append(EvidenceItem(
            evidence_class=EvidenceClass.MEDIUM,
            description="Same organization in profiles",
            weight=0.15,
            source="profile_analysis",
        ))
    if education_overlap:
        evidence.append(EvidenceItem(
            evidence_class=EvidenceClass.MEDIUM,
            description="Same education in profiles",
            weight=0.15,
            source="profile_analysis",
        ))
    if website_match:
        evidence.append(EvidenceItem(
            evidence_class=EvidenceClass.MEDIUM,
            description="Same website across profiles",
            weight=0.20,
            source="profile_analysis",
        ))
    if email_match:
        evidence.append(EvidenceItem(
            evidence_class=EvidenceClass.STRONG,
            description="Same verified email domain",
            weight=0.25,
            source="profile_analysis",
        ))
    if face_verified:
        evidence.append(EvidenceItem(
            evidence_class=EvidenceClass.STRONG,
            description="Independent face verification",
            weight=0.30,
            source="face_verification",
        ))
    if location_match:
        evidence.append(EvidenceItem(
            evidence_class=EvidenceClass.WEAK,
            description="Same location in profiles",
            weight=0.05,
            source="profile_analysis",
        ))
    if same_avatar:
        evidence.append(EvidenceItem(
            evidence_class=EvidenceClass.MEDIUM,
            description="Same avatar across platforms",
            weight=0.15,
            source="image_analysis",
        ))

    return evidence


def compute_confidence(
    face_similarity: float = 0.5,
    source_reliability: float = 0.5,
    cross_platform_matches: int = 0,
    username_match: bool = False,
    name_match: bool = False,
    employer_overlap: bool = False,
    education_overlap: bool = False,
    website_match: bool = False,
    contradictions: int = 0,
) -> dict:
    has_username = username_match
    has_name = name_match and not username_match
    has_employer = employer_overlap
    has_education = education_overlap
    has_website = website_match
    has_face = face_similarity >= 0.90

    evidence = build_evidence(
        profiles=[],
        username_match=has_username,
        name_match=has_name,
        employer_overlap=has_employer,
        education_overlap=has_education,
        website_match=has_website,
        face_verified=has_face,
    )

    confidence, label = compute_capped_confidence(evidence)

    reasons = []
    for e in evidence:
        reasons.append(f"{e.description} ({e.weight})")

    if contradictions > 0:
        confidence = round(confidence * (1.0 - 0.3 * min(contradictions, 3)), 4)
        label = "LOW" if confidence < 0.4 else label

    return {
        "confidence": confidence,
        "confidence_label": label,
        "evidence": [e.to_dict() for e in evidence],
        "contributions": reasons,
        "prior": 0.3,
        "posterior_odds": 0.0,
        "decision": {
            "verdict": "dominant_match" if confidence >= 0.85 else (
                "probable_match" if confidence >= 0.50 else "no_confident_match"
            ),
            "reason": "; ".join(reasons) if reasons else "No supporting evidence.",
        },
    }
