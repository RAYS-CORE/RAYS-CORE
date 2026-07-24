"""Module 6: Profile Detector — find the actual profile picture.

Given a list of extracted images (from image_extractor), identify
which one is the actual profile/avatar picture using:

  - Relevance score (from image_extractor)
  - Size heuristics
  - Platform-specific selectors
  - Known URL patterns
  - DOM position (near name/header)
  - Image aspect ratio (profile photos are typically square)
  - File naming patterns

Returns the best candidate or None if no profile picture found.
"""

from __future__ import annotations

import re
import urllib.parse
from typing import Optional

# Size ranges for profile pictures (in pixels)
MIN_PROFILE_SIZE = 100
MAX_PROFILE_SIZE = 2000
IDEAL_PROFILE_SIZE_RANGE = (200, 800)


def detect(
    images: list[dict],
    page_url: str,
    dom_data: Optional[dict] = None,
) -> Optional[dict]:
    """Detect the most likely profile picture from a list of images.

    Args:
        images: List of image dicts from image_extractor.extract_from_dom()
                (should already have 'score' field).
        page_url: The original page URL.
        dom_data: Optional full DOM data for additional context.

    Returns:
        The best profile picture candidate dict, or None.
    """
    if not images:
        return None

    # Already have scores from image_extractor, just pick the best
    scored = list(images)

    # Additional refinements
    for img in scored:
        src = img.get("url", "")
        w = img.get("width", "")
        h = img.get("height", "")

        # Bonus: explicit profile image URL patterns
        path = urllib.parse.urlparse(src).path.lower()
        if re.search(r"(avatar|profile|photo|pfp|headshot)", path):
            img["_profile_bonus"] = img.get("score", 0) + 0.2

        # Penalty: known non-profile patterns
        if re.search(r"(logo|icon|favicon|banner|cover|sprite|tracking|pixel)", path):
            img["_profile_bonus"] = img.get("score", 0) - 0.3

        # Size-based refinement
        if w and h:
            try:
                width, height = int(w), int(h)
                if MIN_PROFILE_SIZE <= width <= MAX_PROFILE_SIZE and MIN_PROFILE_SIZE <= height <= MAX_PROFILE_SIZE:
                    ratio = max(width, height) / min(width, height) if min(width, height) > 0 else 99
                    if ratio <= 1.3:  # roughly square → profile photo
                        if IDEAL_PROFILE_SIZE_RANGE[0] <= width <= IDEAL_PROFILE_SIZE_RANGE[1]:
                            img["_profile_bonus"] = img.get("_profile_bonus", img.get("score", 0)) + 0.15
                        img["_profile_bonus"] = img.get("_profile_bonus", img.get("score", 0)) + 0.1
                    elif ratio > 2.0:  # very rectangular → probably not profile
                        img["_profile_bonus"] = img.get("_profile_bonus", img.get("score", 0)) - 0.2
            except (ValueError, TypeError):
                pass

        # Small images are rarely profile photos
        if w and h:
            try:
                if int(w) < MIN_PROFILE_SIZE or int(h) < MIN_PROFILE_SIZE:
                    img["_profile_bonus"] = img.get("_profile_bonus", img.get("score", 0)) - 0.3
            except (ValueError, TypeError):
                pass

    # Rank by final score
    def final_score(img: dict) -> float:
        return img.get("_profile_bonus", img.get("score", 0))

    scored.sort(key=final_score, reverse=True)

    # Return best if it passes minimum threshold
    best = scored[0]
    if final_score(best) >= 0.3:
        best["detection_method"] = "score_based"
        return best

    # Fallback: if images exist but none scored well, return the first og:image
    for img in scored:
        if img.get("source") in ("og:image", "twitter:image"):
            img["detection_method"] = "meta_fallback"
            return img

    # Last resort: return the largest image
    def img_area(img: dict) -> int:
        try:
            return int(img.get("width", 0)) * int(img.get("height", 0))
        except (ValueError, TypeError):
            return 0

    largest = max(scored, key=img_area)
    if img_area(largest) >= MIN_PROFILE_SIZE * MIN_PROFILE_SIZE:
        largest["detection_method"] = "largest_fallback"
        return largest

    return None
