"""Module 2: Browser Fetcher — fetch rendered HTML via headless browser.

Only used when search_fetcher determines the page is JS_RENDERED.
Uses Playwright for browser automation, with graceful fallback
if Playwright is not installed.

Output: rendered HTML string (or error message).
"""

from __future__ import annotations

import time

# Try to import Playwright — it's optional
HAS_PLAYWRIGHT = False
try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
    HAS_PLAYWRIGHT = True
except ImportError:
    pass

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

DEFAULT_TIMEOUT_MS = 30_000
DEFAULT_WAIT_MS = 5_000


def fetch(
    url: str,
    timeout_ms: int = DEFAULT_TIMEOUT_MS,
    wait_for_dom: bool = True,
    wait_ms: int = DEFAULT_WAIT_MS,
) -> tuple[str, dict]:
    """Fetch rendered HTML from a URL using headless browser.

    Args:
        url: The URL to fetch.
        timeout_ms: Maximum time to wait for page load.
        wait_for_dom: Whether to wait for DOM content to load.
        wait_ms: Additional wait time after page load (for JS rendering).

    Returns:
        (html_string, metadata_dict)
    """
    metadata: dict = {
        "url": url,
        "method": "browser",
        "playwright_available": HAS_PLAYWRIGHT,
    }

    if not HAS_PLAYWRIGHT:
        metadata["error"] = (
            "Playwright is not installed. Install with: "
            "pip install playwright && playwright install chromium"
        )
        metadata["html"] = ""
        return "", metadata

    try:
        with sync_playwright() as p:
            browser_type = p.chromium
            metadata["browser"] = "chromium"

            browser = browser_type.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ],
            )

            context = browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1280, "height": 720},
                locale="en-US",
            )

            page = context.new_page()

            start = time.time()
            try:
                if wait_for_dom:
                    page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                else:
                    page.goto(url, wait_until="load", timeout=timeout_ms)
                metadata["load_time_ms"] = (time.time() - start) * 1000
            except PlaywrightTimeout:
                metadata["load_time_ms"] = (time.time() - start) * 1000
                metadata["warning"] = f"Page load timed out after {timeout_ms}ms"

            # Additional wait for JS rendering
            if wait_ms > 0:
                time.sleep(wait_ms / 1000)
                metadata["wait_ms"] = wait_ms

            # Get fully rendered HTML
            html = page.content()
            metadata["html_length"] = len(html)
            metadata["title"] = page.title()

            # Check if we got meaningful content
            body_text = page.evaluate("document.body?.innerText?.length || 0")
            metadata["body_text_length"] = body_text

            browser.close()

            return html, metadata

    except Exception as e:
        metadata["error"] = str(e)
        metadata["html"] = ""
        return "", metadata


def is_available() -> bool:
    """Check if Playwright is available for use."""
    return HAS_PLAYWRIGHT
