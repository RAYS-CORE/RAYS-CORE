"""URL Canonicalization — resolves redirect/shortened URLs to final destinations.

Handles:
  - Protocol-relative URLs (//example.com/path → https://example.com/path)
  - DDG redirect URLs (//duckduckgo.com/l/?uddg=... → actual URL)
  - Google redirect URLs
  - URL shorteners (bit.ly, t.co, etc.)
  - HTTP→HTTPS upgrades
  - Trailing slash normalization
  - Query param stripping (for dedup)

Usage:
    canonicalizer = URLCanonicalizer()
    final_url = canonicalizer.resolve("//duckduckgo.com/l/?uddg=https://linkedin.com/in/name")
    # Returns "https://linkedin.com/in/name"
"""

from __future__ import annotations

import re
import urllib.parse
import urllib.request
from typing import Optional

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Known URL shortener domains
SHORTENER_DOMAINS = {
    "bit.ly", "bitly.com", "tinyurl.com", "goo.gl", "ow.ly", "is.gd",
    "buff.ly", "t.co", "lnkd.in", "rb.gy", "shorturl.at", "tiny.cc",
    "tr.im", "v.gd", "cli.gs", "url.ie",
}

# Redirect tracker patterns: extract actual URL from query param
TRACKER_PATTERNS = [
    re.compile(r"[?&](?:uddg|url|q|u|redirect|next|continue|destination)=([^&]+)"),
    re.compile(r"/redirect/?\?.*?(?:url|q)=([^&]+)"),
    re.compile(r"/l/?\?.*?uddg=([^&]+)"),
]


class URLCanonicalizer:
    """Resolve URLs to their canonical form."""

    def resolve(self, url: str, follow_redirects: bool = True, max_redirects: int = 5) -> str:
        """Resolve a URL to its canonical form.

        Steps:
          1. Fix protocol-relative URLs
          2. Extract from tracker/redirect wrappers (DDG, Google, etc.)
          3. Follow HTTP redirects (301/302/307/308)
          4. Normalize (scheme, trailing slash, query params)
        """
        url = url.strip()

        # Step 1: Protocol-relative
        if url.startswith("//"):
            url = "https:" + url

        # Step 2: No scheme at all — prepend https
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        # Step 3: Extract from tracker wrappers
        extracted = self._extract_from_tracker(url)
        if extracted and extracted != url:
            return self.resolve(extracted, follow_redirects, max_redirects)

        # Step 4: Follow HTTP redirects
        if follow_redirects:
            url = self._follow_redirects(url, max_redirects)

        # Step 5: Normalize
        url = self._normalize(url)

        return url

    def _extract_from_tracker(self, url: str) -> Optional[str]:
        """Extract actual URL from DDG/Google/tracker redirect URLs."""
        parsed = urllib.parse.urlparse(url)
        for pattern in TRACKER_PATTERNS:
            m = pattern.search(url)
            if m:
                extracted = urllib.parse.unquote(m.group(1))
                if extracted.startswith("//"):
                    extracted = "https:" + extracted
                if extracted.startswith(("http://", "https://")):
                    return extracted
        return None

    def _follow_redirects(self, url: str, max_redirects: int) -> str:
        """Follow HTTP redirect chain."""
        for _ in range(max_redirects):
            try:
                req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=1) as resp:
                    if resp.status in (301, 302, 303, 307, 308):
                        redirected = resp.headers.get("Location", "")
                        if redirected:
                            if redirected.startswith("//"):
                                redirected = "https:" + redirected
                            elif redirected.startswith("/"):
                                parsed = urllib.parse.urlparse(url)
                                redirected = f"{parsed.scheme}://{parsed.netloc}{redirected}"
                            url = redirected
                            continue
                    return url
            except Exception:
                return url
        return url

    def _normalize(self, url: str) -> str:
        """Normalize URL: consistent scheme, trailing slash, clean query."""
        parsed = urllib.parse.urlparse(url)
        scheme = "https" if parsed.scheme == "http" else parsed.scheme
        netloc = parsed.netloc.lower()
        path = parsed.path.rstrip("/") or "/"
        return urllib.parse.urlunparse((scheme, netloc, path, "", "", ""))

    def is_shortener(self, url: str) -> bool:
        """Check if URL is from a known shortener domain."""
        domain = urllib.parse.urlparse(url).netloc.lower()
        return any(s in domain for s in SHORTENER_DOMAINS)

    def extract_domain(self, url: str) -> str:
        """Extract clean domain from URL."""
        return urllib.parse.urlparse(url).netloc.lower()

    def batch_resolve(self, urls: list[str]) -> dict[str, str]:
        """Resolve multiple URLs, returning mapping of original → canonical."""
        mapping = {}
        for url in urls:
            try:
                mapping[url] = self.resolve(url)
            except Exception:
                mapping[url] = url
        return mapping
