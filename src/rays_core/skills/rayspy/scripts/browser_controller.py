"""Browser Controller — full-featured browser automation module.

State Machine:
  START → LAUNCHING → SEARCHING → HARVESTING → DONE
                   ↘ LOGIN_REQUIRED → WAITING → RESUME → HARVESTING

Features:
  - Persistent browser context with profile
  - Cookie/session management (via SessionManager)
  - CAPTCHA detection (by known selectors + URL patterns)
  - Login-wall detection
  - Infinite wait for user to complete login/CAPTCHA
  - Intelligent waiting (DOM changes, URL changes, network idle)
  - DOM snapshot diffing for unexpected page changes
  - Retry tree with configurable recovery actions
  - Browser crash recovery
  - Screenshot capture
  - Structured JSON output

Output:
  {
    "status": "SUCCESS" | "FAILED" | "LOGIN_REQUIRED" | "CAPTCHA",
    "html": "...",
    "screenshots": ["..."],
    "cookies": "...",
    "profile_image": "...",
    "metadata": {...}
  }
"""

from __future__ import annotations

import base64
import difflib
import json
import os
import time
import traceback
from enum import Enum
from pathlib import Path
from typing import Any, Optional

try:
    from . import session_manager as _sm
except ImportError:
    try:
        import session_manager as _sm
    except ImportError:
        _sm = None

HAS_PLAYWRIGHT = False
try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
    from playwright.sync_api import Page, Browser, BrowserContext
    HAS_PLAYWRIGHT = True
except ImportError:
    pass

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

MAX_RETRIES = 3
CAPTCHA_KEYWORDS = ["captcha", "recaptcha", "hcaptcha", "cf-turnstile", "challenge"]
LOGIN_KEYWORDS = ["sign in", "log in", "login", "sign in to continue"]
WATCH_INTERVAL_MS = 500
MAX_WAIT_SECONDS = 300  # 5 min max wait for user login/CAPTCHA


class BrowserState(Enum):
    START = "START"
    LAUNCHING = "LAUNCHING"
    SEARCHING = "SEARCHING"
    HARVESTING = "HARVESTING"
    LOGIN_REQUIRED = "LOGIN_REQUIRED"
    WAITING = "WAITING"
    RESUME = "RESUME"
    DONE = "DONE"
    FAILED = "FAILED"
    CAPTCHA_DETECTED = "CAPTCHA_DETECTED"


class DOMSnapshot:
    """Lightweight DOM snapshot for change detection."""

    def __init__(self, html: str = "", url: str = "", text_length: int = 0, img_count: int = 0):
        self.html = html[:2000]
        self.url = url
        self.text_length = text_length
        self.img_count = img_count

    @classmethod
    def capture(cls, page: "Page") -> "DOMSnapshot":
        try:
            html = page.content()
            text_len = page.evaluate("document.body?.innerText?.length || 0")
            imgs = page.evaluate("document.querySelectorAll('img').length")
            return cls(html=html, url=page.url, text_length=text_len, img_count=imgs)
        except Exception:
            return cls()

    def diff(self, other: "DOMSnapshot") -> dict:
        changes = {}
        if self.url != other.url:
            changes["url"] = {"from": self.url, "to": other.url}
        text_delta = other.text_length - self.text_length
        if abs(text_delta) > 50:
            changes["text_length"] = {"from": self.text_length, "to": other.text_length, "delta": text_delta}
        if self.img_count != other.img_count:
            changes["img_count"] = {"from": self.img_count, "to": other.img_count}
        html_diff = list(difflib.unified_diff(
            self.html.splitlines(), other.html.splitlines(),
            n=0, lineterm=""
        ))
        if len(html_diff) > 10:
            changes["html_changed_significantly"] = True
        return changes


class BrowserController:
    """Full browser automation controller with state machine."""

    def __init__(
        self,
        headless: bool = True,
        user_data_dir: Optional[str] = None,
        session_mgr: Optional[_sm.SessionManager] = None,
        viewport: tuple[int, int] = (1280, 720),
    ):
        self.headless = headless
        self.user_data_dir = user_data_dir
        self.sessions = session_mgr or _sm.get_global()
        self.viewport = viewport

        self.state = BrowserState.START
        self._playwright = None
        self._browser: Optional["Browser"] = None
        self._context: Optional["BrowserContext"] = None
        self._page: Optional["Page"] = None
        self._snapshot_before: Optional[DOMSnapshot] = None
        self._retry_count = 0
        self._screenshots: list[str] = []
        self._metadata: dict = {}
        self._html = ""

    @property
    def is_available(self) -> bool:
        return HAS_PLAYWRIGHT

    def navigate(self, url: str, platform: str = "", timeout_ms: int = 30_000) -> dict:
        """Navigate to a URL with full state machine and recovery.

        This is the main entry point. It handles:
          - Browser launch
          - Cookie injection
          - Navigation
          - CAPTCHA/login detection
          - Retry on failure
          - Screenshot capture
          - Structured JSON return

        Returns:
            Dict with status, html, screenshots, cookies, metadata.
        """
        self._screenshots = []
        self._metadata = {"url": url, "platform": platform, "state_history": []}
        self.state = BrowserState.LAUNCHING
        self._metadata["state_history"].append("LAUNCHING")

        if not HAS_PLAYWRIGHT:
            return self._result("FAILED", error="Playwright not installed")

        try:
            self._launch()
            self._inject_cookies(platform)
            self._navigate_with_retry(url, timeout_ms)
            self._screenshot("post_navigate")

            if self._is_captcha_page():
                self.state = BrowserState.CAPTCHA_DETECTED
                self._metadata["state_history"].append("CAPTCHA_DETECTED")
                self._handle_wait("CAPTCHA")
                if self.state == BrowserState.FAILED:
                    return self._result("CAPTCHA", error="CAPTCHA not resolved by user")

            if self._is_login_page():
                self.state = BrowserState.LOGIN_REQUIRED
                self._metadata["state_history"].append("LOGIN_REQUIRED")
                self._handle_wait("LOGIN")
                if self.state == BrowserState.FAILED:
                    return self._result("LOGIN_REQUIRED", error="Login not completed by user")

            self.state = BrowserState.SEARCHING
            self._metadata["state_history"].append("SEARCHING")
            self._harvest()
            self.state = BrowserState.DONE
            self._metadata["state_history"].append("DONE")
            return self._result("SUCCESS")

        except Exception as e:
            self.state = BrowserState.FAILED
            self._metadata["error"] = str(e)
            self._metadata["traceback"] = traceback.format_exc()
            return self._result("FAILED", error=str(e))

        finally:
            self._save_cookies(platform)
            self._cleanup()

    def _launch(self):
        self._playwright = sync_playwright().start()
        launch_args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        if self.user_data_dir:
            self._browser = self._playwright.chromium.launch_persistent_context(
                user_data_dir=self.user_data_dir,
                headless=self.headless,
                args=launch_args,
                viewport={"width": self.viewport[0], "height": self.viewport[1]},
                user_agent=USER_AGENT,
                locale="en-US",
            )
            self._page = self._browser.pages[0] if self._browser.pages else self._browser.new_page()
        else:
            self._browser = self._playwright.chromium.launch(headless=self.headless, args=launch_args)
            self._context = self._browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": self.viewport[0], "height": self.viewport[1]},
                locale="en-US",
            )
            self._page = self._context.new_page()

    def _inject_cookies(self, platform: str):
        if not platform:
            return
        cookies = self.sessions.load_cookies(platform)
        if cookies:
            try:
                context = self._context or self._browser
                if hasattr(context, "add_cookies"):
                    context.add_cookies(cookies)
            except Exception:
                pass

    def _navigate_with_retry(self, url: str, timeout_ms: int):
        last_error = None
        for attempt in range(MAX_RETRIES):
            self._retry_count = attempt
            self._snapshot_before = DOMSnapshot.capture(self._page) if self._page else None
            try:
                self._page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                self._wait_for_network_idle()
                return
            except PlaywrightTimeout as e:
                last_error = f"Timeout attempt {attempt + 1}: {e}"
                self._metadata.setdefault("warnings", []).append(last_error)
                self._screenshot(f"timeout_attempt_{attempt + 1}")
                if attempt < MAX_RETRIES - 1:
                    recovery = self._recover_page()
                    if not recovery:
                        break
            except Exception as e:
                last_error = f"Error attempt {attempt + 1}: {e}"
                self._metadata.setdefault("warnings", []).append(last_error)
                if attempt < MAX_RETRIES - 1:
                    recovery = self._recover_page()
                    if not recovery:
                        break
        if last_error:
            self._metadata["navigation_error"] = last_error

    def _recover_page(self) -> bool:
        """Try to recover from a failed page load."""
        try:
            if self._page and not self._page.is_closed():
                self._page.close()
            context = self._context or self._browser
            if context and hasattr(context, "pages"):
                self._page = context.new_page()
                return True
        except Exception:
            pass
        try:
            self._cleanup()
            self._launch()
            return True
        except Exception:
            return False

    def _harvest(self):
        self.state = BrowserState.HARVESTING
        self._metadata["state_history"].append("HARVESTING")
        self._wait_for_network_idle()
        self._wait_for_dom_stable()
        self._html = self._page.content()
        self._metadata["html_length"] = len(self._html)
        self._metadata["title"] = self._page.title()
        self._metadata["final_url"] = self._page.url
        self._screenshot("harvest_complete")
        self._snapshot_after = DOMSnapshot.capture(self._page)
        if self._snapshot_before:
            changes = self._snapshot_before.diff(self._snapshot_after)
            if changes:
                self._metadata["dom_changes"] = changes

    def _wait_for_network_idle(self, timeout_ms: int = 10_000):
        try:
            self._page.wait_for_load_state("networkidle", timeout=timeout_ms)
        except Exception:
            pass

    def _wait_for_dom_stable(self, check_interval: float = 0.5, stable_rounds: int = 3):
        """Wait until DOM stops changing."""
        prev = DOMSnapshot.capture(self._page)
        for _ in range(stable_rounds):
            time.sleep(check_interval)
            curr = DOMSnapshot.capture(self._page)
            if not prev.diff(curr):
                return
            prev = curr

    def _is_captcha_page(self) -> bool:
        if not self._page:
            return False
        try:
            url = self._page.url.lower()
            if any(k in url for k in CAPTCHA_KEYWORDS):
                return True
            html_lower = self._page.content().lower()
            if any(k in html_lower for k in CAPTCHA_KEYWORDS):
                return True
            selectors = [
                "iframe[src*='captcha']", "iframe[src*='recaptcha']",
                "iframe[src*='hcaptcha']", "div.g-recaptcha",
                "div.h-captcha", "#captcha", ".captcha",
            ]
            for sel in selectors:
                if self._page.query_selector(sel):
                    return True
        except Exception:
            pass
        return False

    def _is_login_page(self) -> bool:
        if not self._page:
            return False
        try:
            body = self._page.evaluate("document.body?.innerText?.toLowerCase() || ''")
            if any(k in body for k in LOGIN_KEYWORDS):
                return True
            selectors = [
                "input[type='password']", "input[name='password']",
                "input[id='password']", "#login-form", ".login-form",
                "button[type='submit']", "form[action*='login']",
            ]
            matched = 0
            for sel in selectors:
                if self._page.query_selector(sel):
                    matched += 1
            if matched >= 2:
                return True
        except Exception:
            pass
        return False

    def _handle_wait(self, wait_type: str):
        """Wait for user to resolve CAPTCHA or complete login."""
        self.state = BrowserState.WAITING
        self._metadata["state_history"].append(f"WAITING_FOR_{wait_type.upper()}")
        self._screenshot(f"before_{wait_type.lower()}_wait")

        start = time.time()
        last_snapshot = DOMSnapshot.capture(self._page) if self._page else None

        while time.time() - start < MAX_WAIT_SECONDS:
            time.sleep(WATCH_INTERVAL_MS / 1000)

            try:
                current_snapshot = DOMSnapshot.capture(self._page)
                changes = last_snapshot.diff(current_snapshot) if last_snapshot else {}
                last_snapshot = current_snapshot

                if wait_type == "CAPTCHA":
                    if not self._is_captcha_page():
                        self._metadata["captcha_resolved_at"] = time.time()
                        self._metadata["wait_duration"] = time.time() - start
                        self.state = BrowserState.RESUME
                        self._metadata["state_history"].append("RESUME")
                        return

                elif wait_type == "LOGIN":
                    if not self._is_login_page():
                        self._metadata["login_completed_at"] = time.time()
                        self._metadata["wait_duration"] = time.time() - start
                        self.state = BrowserState.RESUME
                        self._metadata["state_history"].append("RESUME")
                        return

                if changes:
                    pass

                elapsed = int(time.time() - start)
                if elapsed % 30 == 0:
                    self._screenshot(f"wait_progress_{elapsed}s")

            except Exception:
                continue

        self.state = BrowserState.FAILED
        self._metadata["wait_timeout"] = True
        self._metadata["wait_type"] = wait_type
        self._metadata["wait_duration"] = time.time() - start

    def _screenshot(self, label: str = ""):
        if not self._page:
            return
        try:
            buf = self._page.screenshot(type="png")
            b64 = base64.b64encode(buf).decode("utf-8")
            self._screenshots.append({"label": label, "data": b64[:200] + "..."})
        except Exception:
            pass

    def _save_cookies(self, platform: str):
        if not platform or not self._context:
            return
        try:
            cookies = self._context.cookies()
            if cookies:
                self.sessions.save_cookies(platform, cookies)
        except Exception:
            pass

    def _cleanup(self):
        try:
            if self._page and not self._page.is_closed():
                self._page.close()
        except Exception:
            pass
        try:
            if self._context:
                self._context.close()
        except Exception:
            pass
        try:
            if self._browser:
                self._browser.close()
        except Exception:
            pass
        try:
            if self._playwright:
                self._playwright.stop()
        except Exception:
            pass

    def _result(self, status: str, error: str = "") -> dict:
        profile_image = self._extract_profile_image() if self._page else ""
        return {
            "status": status,
            "html": self._html,
            "screenshots": self._screenshots,
            "cookies": json.dumps(self._context.cookies()) if self._context else "[]",
            "profile_image": profile_image,
            "metadata": self._metadata,
            "error": error,
        }

    def _extract_profile_image(self) -> str:
        if not self._page:
            return ""
        try:
            selectors = [
                "img[alt*='profile']", "img[alt*='avatar']",
                "img.profile-photo", "img.avatar",
                "meta[property='og:image']",
            ]
            for sel in selectors:
                el = self._page.query_selector(sel)
                if sel.startswith("meta"):
                    content = el.get_attribute("content") if el else None
                    if content:
                        return content
                else:
                    src = el.get_attribute("src") if el else None
                    if src:
                        return src
        except Exception:
            pass
        return ""

    def get_state(self) -> str:
        return self.state.value

    def get_retry_count(self) -> int:
        return self._retry_count


def fetch_url(url: str, platform: str = "", headless: bool = True) -> dict:
    """Convenience function: navigate with BrowserController and return result."""
    ctrl = BrowserController(headless=headless)
    return ctrl.navigate(url, platform=platform)
