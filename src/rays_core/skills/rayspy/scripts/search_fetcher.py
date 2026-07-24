"""Module 1: Search Fetcher — smart URL fetcher with browser fallback.

Flow:
  1. Classify page as STATIC or JS_RENDERED (via page_classifier)
  2. If STATIC → fetch with urllib (requests)
  3. If JS_RENDERED → fetch with browser (Playwright), fallback to requests

Input:  URL
Output: (html_string, method_used, metadata)

The caller never needs to know which method was used.
"""

from __future__ import annotations

import urllib.error
import urllib.request
from typing import Literal

try:
    from .page_classifier import classify
except ImportError:
    from page_classifier import classify

try:
    from . import browser_fetcher
except ImportError:
    import browser_fetcher

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

DEFAULT_TIMEOUT = 20
DEFAULT_BROWSER_TIMEOUT_MS = 30_000
DEFAULT_WAIT_MS = 3_000


def _fetch_with_requests(url: str, timeout: int = DEFAULT_TIMEOUT) -> tuple[str, dict]:
    """Fetch HTML using standard urllib (no JS execution).

    Returns (html, metadata).
    """
    metadata: dict = {"method": "requests"}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            html = resp.read().decode("utf-8", errors="replace")
            metadata["status"] = resp.status
            metadata["html_length"] = len(html)
            metadata["content_type"] = resp.headers.get("Content-Type", "")
            return html, metadata
    except urllib.error.HTTPError as e:
        metadata["error"] = f"HTTP {e.code}: {e.reason}"
        metadata["status"] = e.code
        return "", metadata
    except urllib.error.URLError as e:
        metadata["error"] = f"URL error: {e.reason}"
        return "", metadata
    except OSError as e:
        metadata["error"] = f"OS error: {e}"
        return "", metadata
    except Exception as e:
        metadata["error"] = f"Unexpected error: {e}"
        return "", metadata


def _fetch_with_browser(url: str, timeout_ms: int, wait_ms: int) -> tuple[str, dict]:
    """Fetch rendered HTML using headless browser.

    Returns (html, metadata) — on failure, html is empty string.
    """
    if not browser_fetcher.is_available():
        return "", {"method": "browser", "available": False, "error": "Playwright not installed"}

    html, metadata = browser_fetcher.fetch(
        url,
        timeout_ms=timeout_ms,
        wait_for_dom=True,
        wait_ms=wait_ms,
    )
    return html, metadata


def fetch(
    url: str,
    timeout: int = DEFAULT_TIMEOUT,
    browser_timeout_ms: int = DEFAULT_BROWSER_TIMEOUT_MS,
    browser_wait_ms: int = DEFAULT_WAIT_MS,
    force_method: Literal["requests", "browser"] | None = None,
) -> tuple[str, Literal["requests", "browser", "failed"], dict]:
    """Smart fetch: classifies page then fetches with appropriate method.

    Args:
        url: The URL to fetch.
        timeout: Timeout for requests-based fetch (seconds).
        browser_timeout_ms: Timeout for browser-based fetch (ms).
        browser_wait_ms: Additional wait after page load for JS rendering (ms).
        force_method: If set, skip classification and use this method.

    Returns:
        (html, method_used, metadata)
        method_used is 'requests', 'browser', or 'failed'.
    """
    if force_method == "browser":
        html, meta = _fetch_with_browser(url, browser_timeout_ms, browser_wait_ms)
        method: Literal["requests", "browser", "failed"] = "browser" if html else "failed"
        return html, method, meta

    if force_method == "requests":
        html, meta = _fetch_with_requests(url, timeout)
        method = "requests" if html else "failed"
        return html, method, meta

    # Stage 1: Classify the page
    classification, classify_meta = classify(url)
    meta: dict = {"classification": classification, "classify": classify_meta}

    # Stage 2: Fetch with appropriate method
    if classification == "STATIC":
        html, req_meta = _fetch_with_requests(url, timeout)
        meta.update(req_meta)
        if html:
            return html, "requests", meta
        # If requests failed and it was misclassified, try browser as fallback
        meta["requests_failed"] = req_meta.get("error", "unknown")
        html, br_meta = _fetch_with_browser(url, browser_timeout_ms, browser_wait_ms)
        meta.update(br_meta)
        if html:
            return html, "browser", meta
        return "", "failed", meta

    # JS_RENDERED — try browser first
    if browser_fetcher.is_available():
        html, br_meta = _fetch_with_browser(url, browser_timeout_ms, browser_wait_ms)
        meta.update(br_meta)
        if html:
            return html, "browser", meta
        meta["browser_failed"] = br_meta.get("error", "unknown")

    # Fallback to requests
    html, req_meta = _fetch_with_requests(url, timeout)
    meta.update(req_meta)
    if html:
        return html, "requests", meta

    return "", "failed", meta
