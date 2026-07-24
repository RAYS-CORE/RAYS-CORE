"""Module 5: Image Extractor — extract images from parsed DOM.

Finds images from ALL sources:
  - <img> tags
  - <meta property="og:image">
  - <meta name="twitter:image">
  - srcset / <source> tags
  - Lazy-loaded images (data-src, data-lazy-src, data-original)
  - CSS background-image (inline style)
  - <picture> elements
  - JSON-LD structured data images
  - favicon and apple-touch-icon

Each extracted image includes:
  - url: absolute URL of the image
  - source: how it was found (img_tag, og:image, etc.)
  - alt: alt text if available
  - width/height: dimensions if available
  - score: a relevance score (higher = more likely to be the profile image)
"""

from __future__ import annotations

import re
import urllib.parse
from typing import Optional

from bs4 import BeautifulSoup

_KNOWN_PROFILE_PATTERNS: list[re.Pattern] = [
    re.compile(r"(profile|avatar|user|photo|pfp|headshot)", re.IGNORECASE),
    re.compile(r"(cover|banner|hero|background)", re.IGNORECASE),
    re.compile(r"(logo|icon|favicon)", re.IGNORECASE),
]

_KNOWN_AVATAR_PATHS: list[str] = [
    "/avatar",
    "/profile",
    "/user/img",
    "/photo",
    "/headshot",
]


def _score_image(img: dict, page_url: str, platform: str = "") -> float:
    """Score an image on how likely it is to be a profile photo.

    Higher score = more likely to be the profile image.
    Range: 0.0 (irrelevant) to 1.0 (definitely profile).
    """
    src = img.get("src", "")
    alt = img.get("alt", "")
    cls = " ".join(str(c) for c in img.get("class", []))
    img_id = img.get("id", "")
    source_type = img.get("source", "")
    width = img.get("width", "")
    height = img.get("height", "")

    score = 0.1  # baseline

    # 1. Source-based scoring
    if source_type == "og:image":
        score += 0.3
    elif source_type == "twitter:image":
        score += 0.25
    elif source_type == "img_tag":
        score += 0.1

    # 2. Alt text signals
    if re.search(r"(profile|avatar|photo)", alt, re.IGNORECASE):
        score += 0.3
    if re.search(r"(cover|banner)", alt, re.IGNORECASE):
        score -= 0.2  # more likely cover photo

    # 3. Class/ID signals
    combined_ids = f"{cls} {img_id}"
    if "profile" in combined_ids.lower() or "avatar" in combined_ids.lower():
        score += 0.35
    if "cover" in combined_ids.lower() or "banner" in combined_ids.lower():
        score -= 0.15
    if "logo" in combined_ids.lower():
        score -= 0.3
    if "icon" in combined_ids.lower():
        score -= 0.2

    # 4. URL path signals
    path = urllib.parse.urlparse(src).path.lower()
    for avatar_path in _KNOWN_AVATAR_PATHS:
        if avatar_path in path:
            score += 0.3
            break
    if re.search(r"(cover|banner|background)", path):
        score -= 0.1

    # 5. Size hints — profile photos tend to be square-ish
    if width and height:
        try:
            w, h = int(width), int(height)
            if w >= 100 and h >= 100:
                score += 0.1
                ratio = max(w, h) / min(w, h) if min(w, h) > 0 else 1
                if ratio < 1.5:  # roughly square → likely profile
                    score += 0.15
                elif ratio > 2.0:  # very rectangular → likely banner/cover
                    score -= 0.1
        except (ValueError, TypeError):
            pass

    # 6. Platform-specific signals
    if platform == "linkedin":
        if "profile" in combined_ids.lower() or "ghost" in combined_ids.lower():
            score += 0.2
    elif platform == "github":
        if path.endswith(".png") and len(path.split("/")) <= 3:
            score += 0.3  # GitHub avatar URL pattern
    elif platform == "x" or platform == "twitter":
        if "profile" in path or "avatar" in path:
            score += 0.3
    elif platform == "facebook":
        if "profile" in combined_ids.lower():
            score += 0.2

    return min(1.0, max(0.0, score))


def extract_from_dom(dom_data: dict, page_url: str) -> list[dict]:
    """Extract all images from parsed DOM data, with relevance scores.

    Args:
        dom_data: Output from dom_parser.parse()
        page_url: The original page URL (for platform detection).

    Returns:
        List of image dicts with score, sorted by score descending.
    """
    platform = dom_data.get("platform", "web")
    raw_images = dom_data.get("images", [])
    metadata = dom_data.get("metadata", {})

    # Deduplicate by URL
    seen: set[str] = set()
    unique_images: list[dict] = []

    for img in raw_images:
        src = img.get("src", "")
        if not src:
            continue
        if src in seen:
            continue
        seen.add(src)

        entry = {
            "url": src,
            "alt": img.get("alt", ""),
            "width": img.get("width", ""),
            "height": img.get("height", ""),
            "source": img.get("source", img.get("type", "unknown")),
            "class": img.get("class", []),
            "id": img.get("id", ""),
        }
        entry["score"] = _score_image(entry, page_url, platform)
        unique_images.append(entry)

    # Sort by score descending
    unique_images.sort(key=lambda x: x["score"], reverse=True)

    return unique_images


def extract_from_html(html: str, page_url: str) -> list[dict]:
    """Convenience: parse HTML then extract images.

    Args:
        html: Raw HTML string.
        page_url: The original page URL.

    Returns:
        List of image dicts with score, sorted by score descending.
    """
    try:
        from . import dom_parser
    except ImportError:
        import dom_parser
    dom = dom_parser.parse(html, page_url)
    return extract_from_dom(dom, page_url)
