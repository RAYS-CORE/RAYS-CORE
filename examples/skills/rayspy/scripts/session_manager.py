"""Session Manager — persistent cookie/session management per platform.

At startup:
  1. Load stored cookies for each platform
  2. Check if they're still valid (by domain)
  3. If invalid → open browser → wait for user login → save cookies

Supported platforms: linkedin, instagram, facebook, x/twitter, github, medium

Cookies are stored as JSON in the session directory.
"""

from __future__ import annotations

import json
import os
import tempfile
import time
from pathlib import Path
from typing import Optional

SESSION_DIR = os.path.join(tempfile.gettempdir(), "raySpy_sessions")

PLATFORM_DOMAINS: dict[str, str] = {
    "linkedin": "https://www.linkedin.com",
    "instagram": "https://www.instagram.com",
    "facebook": "https://www.facebook.com",
    "x": "https://x.com",
    "twitter": "https://x.com",
    "github": "https://github.com",
    "medium": "https://medium.com",
}


class SessionManager:
    """Manages persistent browser sessions per platform."""

    def __init__(self, session_dir: str = SESSION_DIR):
        self.session_dir = Path(session_dir)
        self.session_dir.mkdir(parents=True, exist_ok=True)
        self._cookie_cache: dict[str, list[dict]] = {}

    def _cookie_path(self, platform: str) -> Path:
        return self.session_dir / f"{platform.lower()}_cookies.json"

    def save_cookies(self, platform: str, cookies: list[dict]):
        """Save cookies for a platform."""
        key = platform.lower()
        self._cookie_cache[key] = cookies
        path = self._cookie_path(key)
        path.write_text(json.dumps({
            "platform": key,
            "saved_at": time.time(),
            "cookie_count": len(cookies),
            "cookies": cookies,
        }, indent=2))

    def load_cookies(self, platform: str) -> list[dict]:
        """Load stored cookies for a platform. Returns empty list if none."""
        key = platform.lower()
        if key in self._cookie_cache:
            return self._cookie_cache[key]
        path = self._cookie_path(key)
        if not path.exists():
            return []
        try:
            data = json.loads(path.read_text())
            cookies = data.get("cookies", [])
            self._cookie_cache[key] = cookies
            return cookies
        except (json.JSONDecodeError, IOError):
            return []

    def are_cookies_valid(self, platform: str) -> bool:
        """Quick check: do we have cookies that aren't obviously expired?"""
        key = platform.lower()
        cookies = self.load_cookies(key)
        if not cookies:
            return False
        now = time.time()
        valid = 0
        for c in cookies:
            exp = c.get("expires")
            if exp is None or exp == -1:
                valid += 1
            elif isinstance(exp, (int, float)) and exp > now:
                valid += 1
        return valid >= 2

    def needs_login(self, platform: str) -> bool:
        """Check if user needs to log in to this platform."""
        return not self.are_cookies_valid(platform)

    def get_session_url(self, platform: str) -> str:
        """Get the login URL for a platform."""
        domain = PLATFORM_DOMAINS.get(platform.lower())
        if not domain:
            return f"https://www.{platform}.com"
        return domain

    def clear_session(self, platform: str):
        """Remove stored cookies for a platform."""
        key = platform.lower()
        self._cookie_cache.pop(key, None)
        path = self._cookie_path(key)
        if path.exists():
            path.unlink()

    def clear_all(self):
        for f in self.session_dir.glob("*_cookies.json"):
            f.unlink()
        self._cookie_cache.clear()

    def list_sessions(self) -> dict[str, dict]:
        """List all stored sessions with metadata."""
        sessions = {}
        for f in self.session_dir.glob("*_cookies.json"):
            try:
                data = json.loads(f.read_text())
                platform = data.get("platform", f.stem.replace("_cookies", ""))
                sessions[platform] = {
                    "platform": platform,
                    "saved_at": data.get("saved_at"),
                    "cookie_count": data.get("cookie_count", 0),
                    "valid": self.are_cookies_valid(platform),
                }
            except (json.JSONDecodeError, IOError):
                pass
        return sessions

    def get_storage_info(self) -> dict:
        return {
            "session_dir": str(self.session_dir),
            "active_sessions": self.list_sessions(),
        }


_global_sm: Optional[SessionManager] = None


def get_global() -> SessionManager:
    global _global_sm
    if _global_sm is None:
        _global_sm = SessionManager()
    return _global_sm
