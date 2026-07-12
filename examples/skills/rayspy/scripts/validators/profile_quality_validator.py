from __future__ import annotations
from .base_validator import ValidationResult


PROFILE_COMPLETENESS_WEIGHTS = {
    "name": 20,
    "avatar": 20,
    "bio": 10,
    "location": 10,
    "website": 10,
    "followers": 5,
    "posts": 10,
    "email": 15,
    "organization": 10,
}

INVESTIGATIVE_VALUE_THRESHOLD = 30


def score_profile_completeness(profile: dict, validation: ValidationResult) -> float:
    score = 0.0
    total = sum(PROFILE_COMPLETENESS_WEIGHTS.values())

    if profile.get("name"):
        score += PROFILE_COMPLETENESS_WEIGHTS["name"]
    if profile.get("avatar") or profile.get("image_url") or profile.get("photo_url"):
        score += PROFILE_COMPLETENESS_WEIGHTS["avatar"]
    if profile.get("bio") or profile.get("description"):
        score += PROFILE_COMPLETENESS_WEIGHTS["bio"]
    if profile.get("location"):
        score += PROFILE_COMPLETENESS_WEIGHTS["location"]
    if profile.get("website"):
        score += PROFILE_COMPLETENESS_WEIGHTS["website"]
    if profile.get("followers"):
        score += PROFILE_COMPLETENESS_WEIGHTS["followers"]
    if profile.get("posts") is not None:
        score += PROFILE_COMPLETENESS_WEIGHTS["posts"]
    if profile.get("email"):
        score += PROFILE_COMPLETENESS_WEIGHTS["email"]
    if profile.get("organization"):
        score += PROFILE_COMPLETENESS_WEIGHTS["organization"]

    return round(score / total, 4)


def assess_investigative_value(profile: dict, validation: ValidationResult) -> dict:
    completeness = score_profile_completeness(profile, validation)
    low_value_reasons = []

    if not profile.get("name"):
        low_value_reasons.append("no_name")
    if not (profile.get("avatar") or profile.get("image_url") or profile.get("photo_url")):
        low_value_reasons.append("no_avatar")
    if not (profile.get("bio") or profile.get("description")):
        low_value_reasons.append("no_bio")

    if validation.status == "FOUND":
        if completeness < INVESTIGATIVE_VALUE_THRESHOLD / 100.0:
            status = "FOUND_LOW_VALUE"
        else:
            status = "FOUND"
    else:
        status = validation.status

    return {
        "status": status,
        "completeness_score": completeness,
        "investigative_value": completeness,
        "low_value_indicators": low_value_reasons,
    }
