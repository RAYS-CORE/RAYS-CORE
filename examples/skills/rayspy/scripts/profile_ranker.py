"""Module 9: Profile Ranker — rank images by type preference.

Given multiple images from a profile page, rank them:

  1. Profile Photo (highest priority — used for face comparison)
  2. Cover Photo (lower priority — may contain face, not ideal)
  3. Random Post Image (low priority)
  4. News Thumbnail (lowest priority)

Only the highest-ranked image(s) proceed to face comparison.

Ranking considers:
  - Image source (og:image, img_tag, etc.)
  - DOM position (near header/profile section)
  - Size and aspect ratio
  - Alt text and CSS class names
  - URL patterns
  - Score from image_extractor / profile_detector
"""

from __future__ import annotations

import re
import urllib.parse
from typing import Optional

# Image type classifications
IMAGE_TYPE_PROFILE = "profile_photo"
IMAGE_TYPE_COVER = "cover_photo"
IMAGE_TYPE_POST = "post_image"
IMAGE_TYPE_THUMBNAIL = "thumbnail"
IMAGE_TYPE_UNKNOWN = "unknown"


def classify_image(img: dict, page_url: str = "") -> str:
    """Classify an image into one of the defined types."""
    src = img.get("url", "")
    alt = img.get("alt", "")
    source_type = img.get("source", "")
    cls = " ".join(str(c) for c in img.get("class", []))
    img_id = img.get("id", "")
    w = img.get("width", "")
    h = img.get("height", "")
    path = urllib.parse.urlparse(src).path.lower()

    # Explicit profile indicators
    profile_indicators = [
        (alt, r"(profile|avatar|photo|pfp|headshot|me|user)"),
        (cls, r"(profile|avatar|photo)"),
        (img_id, r"(profile|avatar)"),
        (path, r"(avatar|profile|photo|pfp|headshot)"),
        (source_type, r"(og:image)"),
    ]
    for text, pattern in profile_indicators:
        if re.search(pattern, str(text), re.IGNORECASE):
            return IMAGE_TYPE_PROFILE

    # Explicit cover/banner indicators
    cover_indicators = [
        (alt, r"(cover|banner|hero|background)"),
        (cls, r"(cover|banner|hero)"),
        (img_id, r"(cover|banner)"),
        (path, r"(cover|banner|hero)"),
    ]
    for text, pattern in cover_indicators:
        if re.search(pattern, str(text), re.IGNORECASE):
            return IMAGE_TYPE_COVER

    # Explicit thumbnail indicators
    thumbnail_indicators = [
        (cls, r"(thumb|thumbnail|small)"),
        (img_id, r"(thumb|thumbnail)"),
        (path, r"(thumb|thumbnail)"),
        (source_type, r"(thumbnail)"),
    ]
    for text, pattern in thumbnail_indicators:
        if re.search(pattern, str(text), re.IGNORECASE):
            return IMAGE_TYPE_THUMBNAIL

    # Logo / icon indicators
    logo_indicators = [
        (cls, r"(logo|icon)"),
        (img_id, r"(logo|icon)"),
        (path, r"(logo|icon|favicon)"),
    ]
    for text, pattern in logo_indicators:
        if re.search(pattern, str(text), re.IGNORECASE):
            return IMAGE_TYPE_UNKNOWN  # Skip these entirely

    # Size-based classification
    if w and h:
        try:
            width, height = int(w), int(h)
            ratio = max(width, height) / min(width, height) if min(width, height) > 0 else 99

            if ratio <= 1.3 and width >= 100:  # roughly square → profile
                return IMAGE_TYPE_PROFILE
            if ratio >= 2.0 and width >= 300:  # wide → cover/banner
                return IMAGE_TYPE_COVER
        except (ValueError, TypeError):
            pass

    # Source-based classification
    if source_type in ("og:image", "twitter:image"):
        return IMAGE_TYPE_PROFILE
    if "srcset" in str(source_type):
        return IMAGE_TYPE_POST

    return IMAGE_TYPE_UNKNOWN


def rank(images: list[dict], page_url: str = "") -> list[dict]:
    """Rank images by preference for profile photo matching.

    Returns images sorted by priority:
      profile_photo > cover_photo > post_image > thumbnail > unknown

    Args:
        images: List of image dicts (from image_extractor).
        page_url: The original page URL.

    Returns:
        Sorted list with 'rank' and 'image_type' added.
    """
    type_priority = {
        IMAGE_TYPE_PROFILE: 0,
        IMAGE_TYPE_COVER: 1,
        IMAGE_TYPE_POST: 2,
        IMAGE_TYPE_THUMBNAIL: 3,
        IMAGE_TYPE_UNKNOWN: 4,
    }

    ranked = []
    for img in images:
        img_type = classify_image(img, page_url)
        priority = type_priority.get(img_type, 99)
        score = img.get("score", 0.0)

        ranked.append({
            **img,
            "image_type": img_type,
            "rank": 0,  # will be set below
            "_sort_key": (priority, -score),
        })

    ranked.sort(key=lambda x: x["_sort_key"])
    for i, item in enumerate(ranked):
        item["rank"] = i + 1
    if ranked:
        for item in ranked:
            item.pop("_sort_key", None)

    return ranked


def best_profile_image(images: list[dict], page_url: str = "") -> Optional[dict]:
    """Get the single best profile image candidate.

    Returns None if no profile-suitable image found.
    """
    ranked = rank(images, page_url)
    for img in ranked:
        if img.get("image_type") == IMAGE_TYPE_PROFILE:
            return img
    # Fallback: first ranked
    return ranked[0] if ranked else None
