"""Module: Reference Image Selector — auto-selects a primary reference photo
from discovered candidate profile images when no independently-sourced
reference photo was supplied by the investigator.

Intended workflow (per-investigation):

    Input Name
        -> Collect profile images        (stage4_collect_images, existing)
        -> Rank images                   (profile_ranker, existing)
        -> Choose best profile image     (select_reference, this module)
        -> Compare all others            (find_corroborating_matches, this module)

IMPORTANT — non-circularity boundary:
This module never marks an identity as FaceVerificationState.VERIFIED. It
selects one candidate-sourced photo as a working "auto reference" and looks
for OTHER, independently-sourced candidate photos (from a *different*
profile URL) that corroborate it. Two independently-run profiles (e.g. a
LinkedIn photo and a Twitter photo) matching each other is real, non-circular
signal. But it is still weaker than verification against a reference the
investigator supplied from outside the discovered platforms entirely, so it
must stay a distinctly separate, lower-trust signal from true independent
face verification (see FaceVerificationState.VERIFIED / has_trusted_reference
in face_search_pipeline.py, which this module does not touch or weaken).
"""

from __future__ import annotations

from typing import Callable, Optional


def select_reference(embedded: list[dict]) -> Optional[dict]:
    """Pick the single best auto-reference image among discovered/embedded
    candidate images.

    Only considers images that were accepted by stage7_embed (exactly one
    confident face detected) and carry a face embedding.

    Preference order:
      1. image_type == "profile_photo" (set by profile_ranker during
         collection) over cover photos / posts / thumbnails
      2. highest ranking score (already computed by profile_ranker)

    Returns None if no eligible image exists.
    """
    candidates = [item for item in embedded if item.get("accepted") and item.get("faces")]
    if not candidates:
        return None

    def sort_key(item: dict) -> tuple:
        is_profile_photo = item.get("image_type") == "profile_photo"
        return (0 if is_profile_photo else 1, -float(item.get("score", 0.0) or 0.0))

    candidates.sort(key=sort_key)
    return candidates[0]


def find_corroborating_matches(
    reference_item: dict,
    embedded: list[dict],
    cosine_similarity_fn: Callable[[list, list], float],
    threshold: float = 0.9,
) -> list[dict]:
    """Compare the auto-selected reference face against every OTHER
    discovered candidate face.

    Non-circularity guard: any face whose profile_url matches the
    reference's own profile_url is skipped — a photo (or another photo from
    the same profile) can never corroborate itself. Only genuinely
    independent, differently-sourced profiles count as corroboration.

    Returns a list of match dicts sorted by similarity (highest first):
        {profile_url, platform, image_url, similarity}
    """
    ref_faces = reference_item.get("faces") or []
    if not ref_faces:
        return []
    ref_embedding = ref_faces[0].get("embedding")
    if ref_embedding is None:
        return []
    ref_profile_url = reference_item.get("profile_url", "")

    matches: list[dict] = []
    for item in embedded:
        if not item.get("accepted") or not item.get("faces"):
            continue
        if ref_profile_url and item.get("profile_url", "") == ref_profile_url:
            continue  # same source profile as the reference — non-circularity guard
        for face in item["faces"]:
            emb = face.get("embedding")
            if emb is None:
                continue
            sim = cosine_similarity_fn(ref_embedding, emb)
            if sim >= threshold:
                matches.append({
                    "profile_url": item.get("profile_url", ""),
                    "platform": item.get("platform", ""),
                    "image_url": item.get("url", ""),
                    "similarity": round(float(sim), 4),
                })
                break  # one match per image is enough

    matches.sort(key=lambda m: m["similarity"], reverse=True)
    return matches
