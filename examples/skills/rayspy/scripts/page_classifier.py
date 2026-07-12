"""Module 3: Page Classifier — determine if a URL is static or JS-rendered.

Heuristics:
  - Known JS-heavy platform domains (LinkedIn, Instagram, Facebook, X)
  - HEAD request: Content-Length, Content-Type, if very little HTML
  - URL patterns (SPA frameworks, single-page apps)
  - Early body content from a partial fetch

Returns STATIC or JS_RENDERED before a full fetch is attempted.
"""

from __future__ import annotations

import re
import urllib.error
import urllib.request
from typing import Literal

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Platforms known to require JavaScript rendering
JS_HEAVY_DOMAINS: list[str] = [
    "linkedin.com",
    "instagram.com",
    "facebook.com",
    "fb.com",
    "x.com",
    "twitter.com",
    "tiktok.com",
    "snapchat.com",
    "pinterest.com",
    "reddit.com",
]

# SPA framework indicators in URL
SPA_INDICATORS: list[str] = [
    "/#/",
    "/#!/",
    "#!",
    "?_r=",
    "react",
    "vue",
    "angular",
]

# Minimum HTML size in bytes to be considered "has meaningful content"
MIN_MEANINGFUL_HTML = 2048

# Maximum redirects to follow during HEAD
MAX_REDIRECTS = 5


def _get_domain(url: str) -> str:
    """Extract the domain from a URL."""
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc.lower()
    except Exception:
        return ""


def _check_known_js_domain(url: str) -> bool:
    """Check if the URL belongs to a known JS-heavy platform."""
    domain = _get_domain(url)
    return any(heavy in domain for heavy in JS_HEAVY_DOMAINS)


def _check_spa_indicators(url: str) -> bool:
    """Check if the URL contains SPA framework indicators."""
    return any(indicator in url for indicator in SPA_INDICATORS)


def _check_content_length(url: str, timeout: int = 10) -> tuple[bool, dict]:
    """Perform a HEAD request to gather metadata about the page.

    Returns (is_static, metadata).
    """
    if url.startswith("//"):
        url = "https:" + url
    metadata: dict = {}
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content_length = resp.headers.get("Content-Length")
            content_type = resp.headers.get("Content-Type", "")
            metadata["content_length"] = int(content_length) if content_length else None
            metadata["content_type"] = content_type
            metadata["status"] = resp.status

            # If content length is small, likely JS-rendered (just a loader)
            if content_length and int(content_length) < MIN_MEANINGFUL_HTML:
                return False, metadata

            # If not HTML at all, it's something else
            if "text/html" not in content_type:
                return True, metadata  # treat as static, might fail later

            return True, metadata
    except (urllib.error.HTTPError, urllib.error.URLError, OSError) as e:
        metadata["error"] = str(e)
        # On error, default to static (requests will be tried first)
        return True, metadata


def _partial_body_check(url: str, timeout: int = 8) -> tuple[bool, dict]:
    """Fetch first few KB of the body to check if it has meaningful content.

    JS-rendered pages often have:
      - Empty or near-empty <body>
      - <div id="root"></div> or similar mount points
      - Large inline JS bundles but no visible content

    Returns (likely_static, metadata).
    """
    if url.startswith("//"):
        url = "https:" + url
    metadata: dict = {}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            chunk = resp.read(MIN_MEANINGFUL_HTML).decode("utf-8", errors="replace")

            metadata["partial_size"] = len(chunk)
            metadata["body_empty"] = len(chunk.strip()) < 200

            # Check for JS-rendered indicators in partial HTML
            has_empty_body = bool(re.search(r"<body[^>]*>\s*</body>", chunk, re.IGNORECASE))
            has_mount_div = bool(re.search(r'<div\s+id=["\'](root|app|react-root|__next)["\']', chunk, re.IGNORECASE))
            has_large_js = len(re.findall(r'<script[^>]*src=["\']', chunk, re.IGNORECASE)) >= 3
            has_meaningful_content = bool(re.search(
                r"<(p|h[1-6]|article|section|main|img|meta)", chunk, re.IGNORECASE
            ))

            metadata["has_empty_body"] = has_empty_body
            metadata["has_mount_div"] = has_mount_div
            metadata["has_large_js"] = has_large_js
            metadata["has_meaningful_content"] = has_meaningful_content

            js_indicators = sum([has_empty_body, has_mount_div, has_large_js])
            if js_indicators >= 2 and not has_meaningful_content:
                return False, metadata  # JS_RENDERED

            return True, metadata  # STATIC
    except Exception as e:
        metadata["error"] = str(e)
        return True, metadata  # Default to static on fetch error


def classify(url: str) -> tuple[Literal["STATIC", "JS_RENDERED"], dict]:
    """Classify a URL as STATIC or JS_RENDERED.

    Uses a cascade of checks from cheapest to most expensive:

    1. Known JS-heavy domain check (instant)
    2. SPA indicator check (instant)
    3. HEAD request + Content-Length check (quick)
    4. Partial body fetch + analysis (medium)

    Args:
        url: The URL to classify.

    Returns:
        (classification, metadata) where classification is 'STATIC' or 'JS_RENDERED'.
    """
    metadata: dict = {"url": url}

    # Normalize protocol-relative URLs
    if url.startswith("//"):
        url = "https:" + url
        metadata["url"] = url

    # Check 1: Known JS-heavy domains
    if _check_known_js_domain(url):
        metadata["reason"] = "known_js_domain"
        metadata["domain"] = _get_domain(url)
        return "JS_RENDERED", metadata

    # Check 2: SPA indicators in URL
    if _check_spa_indicators(url):
        metadata["reason"] = "spa_indicator"
        return "JS_RENDERED", metadata

    # Check 3: HEAD request
    is_static, head_meta = _check_content_length(url)
    metadata["head"] = head_meta
    if not is_static:
        metadata["reason"] = "small_content_length"
        return "JS_RENDERED", metadata

    # Check 4: Partial body fetch
    is_static, body_meta = _partial_body_check(url)
    metadata["partial_body"] = body_meta
    if not is_static:
        metadata["reason"] = "empty_body_or_mount_div"
        return "JS_RENDERED", metadata

    metadata["reason"] = "looks_static"
    return "STATIC", metadata
