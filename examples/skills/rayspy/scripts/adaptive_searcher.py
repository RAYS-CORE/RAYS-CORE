"""Adaptive Searcher — generates targeted multi-platform queries from known identities.

Instead of a fixed search list, this module:
  1. Maintains a knowledge base of discovered identities (names, handles, emails, orgs)
  2. Generates platform-specific search queries based on current knowledge
  3. Searches each query via DuckDuckGo HTML
  4. Extracts profile URLs from results
  5. Updates the knowledge base with new findings
  6. Repeats until no new evidence is found

This turns a single LinkedIn URL into a full multi-platform discovery.
"""

from __future__ import annotations

import json
import re
import threading
import time
import urllib.parse
import urllib.request
from typing import Optional

try:
    from . import url_canonicalizer as _uc
except ImportError:
    import url_canonicalizer as _uc

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

PLATFORM_WEIGHTS: dict[str, float] = {
    "linkedin":      0.90,
    "github":        0.85,
    "x":             0.80,
    "twitter":       0.80,
    "facebook":      0.80,
    "instagram":     0.75,
    "youtube":       0.70,
    "medium":        0.65,
    "kaggle":        0.60,
    "orcid":         0.60,
    "scholar":       0.70,
    "researchgate":  0.65,
    "pinterest":     0.50,
    "reddit":        0.50,
    "tiktok":        0.40,
    "personal_site": 0.95,
    "web":           0.40,
}

# Platform-specific query templates using {name}
PLATFORM_QUERIES: dict[str, list[str]] = {
    "github": [
        '"{name}" GitHub',
        '"{name}" site:github.com',
    ],
    "instagram": [
        '"{name}" Instagram',
        '"{name}" site:instagram.com',
    ],
    "x": [
        '"{name}" X',
        '"{name}" Twitter',
        '"{name}" site:x.com',
        '"{name}" site:twitter.com',
    ],
    "facebook": [
        '"{name}" Facebook',
        '"{name}" site:facebook.com',
    ],
    "medium": [
        '"{name}" Medium',
        '"{name}" site:medium.com',
    ],
    "linkedin": [
        '"{name}" LinkedIn',
        '"{name}" site:linkedin.com',
    ],
    "youtube": [
        '"{name}" YouTube',
        '"{name}" site:youtube.com',
    ],
    "kaggle": [
        '"{name}" Kaggle',
        '"{name}" site:kaggle.com',
    ],
    "orcid": [
        '"{name}" ORCID',
        '"{name}" site:orcid.org',
    ],
    "scholar": [
        '"{name}" Google Scholar',
        '"{name}" site:scholar.google.com',
    ],
    "researchgate": [
        '"{name}" ResearchGate',
        '"{name}" site:researchgate.net',
    ],
    "pinterest": [
        '"{name}" Pinterest',
        '"{name}" site:pinterest.com',
    ],
    "personal_site": [
        '"{name}" portfolio',
        '"{name}" personal website',
        '"{name}" resume',
        '"{name}" CV',
        '"{name}" bio',
    ],
    "web": [
        '"{name}" university',
        '"{name}" research',
        '"{name}" conference',
    ],
}

SOCIAL_DOMAINS = {
    "linkedin.com", "instagram.com", "x.com", "twitter.com",
    "facebook.com", "github.com", "youtube.com", "tiktok.com",
    "reddit.com", "pinterest.com", "snapchat.com", "medium.com",
    "kaggle.com", "orcid.org", "researchgate.net",
    "scholar.google.com",
}


def _guess_platform(url: str) -> str:
    u = url.lower()
    if "linkedin.com" in u:            return "linkedin"
    if "instagram.com" in u:           return "instagram"
    if "x.com" in u or "twitter.com" in u: return "x"
    if "facebook.com" in u or "fb.com" in u: return "facebook"
    if "github.com" in u:              return "github"
    if "youtube.com" in u:             return "youtube"
    if "tiktok.com" in u:              return "tiktok"
    if "reddit.com" in u:              return "reddit"
    if "pinterest.com" in u:           return "pinterest"
    if "medium.com" in u:              return "medium"
    if "kaggle.com" in u:              return "kaggle"
    if "orcid.org" in u:               return "orcid"
    if "researchgate.net" in u:        return "researchgate"
    if "scholar.google.com" in u:      return "scholar"
    return "web"


def _extract_handle(url: str) -> Optional[str]:
    try:
        parsed = urllib.parse.urlparse(url)
        path = parsed.path.rstrip("/")
        segs = [s for s in path.split("/") if s]
        if not segs:
            return None
        domain = parsed.netloc.lower()
        if "linkedin.com" in domain and len(segs) >= 2 and segs[0] == "in":
            return segs[1]
        if "github.com" in domain:
            return segs[0]
        if "x.com" in domain or "twitter.com" in domain:
            return segs[0]
        if "instagram.com" in domain:
            return segs[0]
        if "facebook.com" in domain or "fb.com" in domain:
            return segs[-1]
        if "medium.com" in domain:
            return segs[0].lstrip("@")
        return segs[-1]
    except Exception:
        return None


def _is_social_domain(url: str) -> bool:
    try:
        domain = urllib.parse.urlparse(url).netloc.lower()
        return any(d in domain for d in SOCIAL_DOMAINS)
    except Exception:
        return False


class AdaptiveSearcher:
    """Adaptive multi-platform search using discovered identities as seeds.

    Usage:
        searcher = AdaptiveSearcher()
        searcher.register_name("Samreedh Bhuyan")
        results = searcher.iterate(max_iterations=3)
    """

    def __init__(self, canonicalizer: Optional[_uc.URLCanonicalizer] = None):
        self.canonicalizer = canonicalizer or _uc.URLCanonicalizer()

        # Knowledge base
        self._names: set[str] = set()
        self._handles: dict[str, str] = {}    # platform → handle
        self._emails: set[str] = set()
        self._domains: set[str] = set()
        self._orgs: set[str] = set()
        self._urls: set[str] = set()
        self._platforms_found: set[str] = set()

        # Tracking
        self._queries_tried: set[str] = set()
        self._iteration_history: list[dict] = []

    # ── Registration ──────────────────────────────────────────────

    def register_name(self, name: str):
        if name:
            self._names.add(name.strip())

    def register_handle(self, platform: str, handle: str):
        if platform and handle:
            self._handles[platform] = handle

    def register_email(self, email: str):
        if email and "@" in email:
            self._emails.add(email)
            domain = email.split("@", 1)[1].lower()
            self._domains.add(domain)

    def register_org(self, org: str):
        if org:
            self._orgs.add(org)

    def register_url(self, url: str, platform: str = "", handle: str = ""):
        if url:
            self._urls.add(url)
            if platform:
                self._platforms_found.add(platform)
            if handle and platform:
                self._handles[platform] = handle

    def register_from_profile(self, profile: dict):
        url = profile.get("url", "")
        plat = profile.get("platform", "")
        handle = profile.get("handle", "")
        bio = profile.get("bio") or profile.get("description", "")
        display_name = profile.get("display_name") or profile.get("name", "")

        if url and not url.startswith(("http://", "https://")):
            url = "https:" + url
        if url:
            self.register_url(url, plat, handle)
        if display_name:
            self.register_name(display_name)
        if bio:
            self._extract_from_text(bio)

    def _extract_from_text(self, text: str):
        email_pat = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
        for m in email_pat.finditer(text):
            self.register_email(m.group(0))
        org_pat = re.compile(r"(?:at|@)\s*([A-Z][a-zA-Z0-9 .&]{2,40})")
        for m in org_pat.finditer(text):
            self.register_org(m.group(1).strip())

    # ── Query Generation ──────────────────────────────────────────

    def generate_queries(self) -> list[str]:
        """Generate targeted search queries based on current knowledge."""
        queries = []

        for name in self._names:
            # Try both quoted and unquoted name variations
            name_variants = [name]
            if name.startswith('"') and name.endswith('"'):
                name_variants.append(name.strip('"'))
            elif " " in name:
                name_variants.append(name)

            for nv in name_variants:
                for plat, templates in PLATFORM_QUERIES.items():
                    if plat in self._platforms_found:
                        continue
                    for tmpl in templates:
                        q = tmpl.replace("{name}", nv)
                        if q not in self._queries_tried:
                            queries.append(q)

        # If we have only single-word names and no results yet, try broader queries
        if not self._urls:
            for name in self._names:
                if " " not in name:
                    broad_queries = [
                        f'"{name}" profile',
                        f'"{name}" linkedin',
                        f'"{name}" github',
                        f'"{name}" instagram',
                    ]
                    for q in broad_queries:
                        if q not in self._queries_tried:
                            queries.append(q)

        # Handle-based queries
        for plat, handle in self._handles.items():
            if plat not in self._platforms_found:
                q = f'"{handle}" {plat}'
                if q not in self._queries_tried:
                    queries.append(q)

        # Email-based queries
        for email in self._emails:
            q = f'"{email}" profile'
            if q not in self._queries_tried:
                queries.append(q)

        # Organization-based queries
        for org in self._orgs:
            for name in self._names:
                q = f'"{name}" "{org}"'
                if q not in self._queries_tried:
                    queries.append(q)

        return queries

    # ── Direct URL Probing (fallback when DDG is blocked) ────────

    PLATFORM_URL_TEMPLATES: dict[str, list[str]] = {
        "github":       ["https://github.com/{handle}"],
        "instagram":    ["https://instagram.com/{handle}"],
        "x":            ["https://x.com/{handle}"],
        "twitter":      ["https://twitter.com/{handle}"],
        "facebook":     ["https://facebook.com/{handle}"],
        "linkedin":     ["https://linkedin.com/in/{handle}"],
        "medium":       ["https://medium.com/@{handle}"],
        "youtube":      ["https://youtube.com/@{handle}", "https://youtube.com/{handle}"],
        "kaggle":       ["https://kaggle.com/{handle}"],
        "reddit":       ["https://reddit.com/user/{handle}"],
        "pinterest":    ["https://pinterest.com/{handle}"],
        "tiktok":       ["https://tiktok.com/@{handle}"],
    }

    def _probe_url(self, url: str, timeout: int = 5) -> bool:
        """Check if a URL exists via HEAD request."""
        try:
            req = urllib.request.Request(url, method="HEAD",
                headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status == 200
        except Exception:
            return False

    def _derive_handles(self) -> dict[str, list[str]]:
        """Derive candidate handles from registered names for all platforms.

        Returns dict mapping platform → list of candidate handles.
        """
        candidates: dict[str, list[str]] = {}
        all_handles: list[str] = list(self._handles.values())

        # Add registered handles for their specific platforms
        for plat, handle in self._handles.items():
            candidates.setdefault(plat, []).append(handle)

        # Derive handles from names and try across platforms
        for name in self._names:
            clean = name.lower().replace(" ", "").replace("-", "").replace("_", "")
            parts = name.lower().split()
            name_derived = [clean]
            if len(parts) >= 2:
                name_derived.append(parts[0])                     # first name
                name_derived.append(parts[0] + parts[1][0])       # first + last initial
                name_derived.append(".".join(parts[:2]))          # first.last
            if len(parts) >= 3:
                name_derived.append(parts[0] + parts[1] + parts[2][0])
            for nd in name_derived:
                if nd not in all_handles:
                    all_handles.append(nd)

        # Try each derived handle across all platforms
        for handle in all_handles:
            for plat in self.PLATFORM_URL_TEMPLATES:
                if handle not in candidates.setdefault(plat, []):
                    candidates[plat].append(handle)

        return candidates

    def _probe_handles(self) -> list[dict]:
        """Probe platform URLs concurrently for each registered/candidate handle.

        Derives candidate handles from registered names (e.g., 'Samreedh Bhuyan'
        → 'samreedhbhuyan', 'samreedh', 'samreedhb') and probes concurrently
        across all platforms. Uses threading pool to avoid sequential HEAD delays.
        """
        candidates = self._derive_handles()
        urls_to_probe: list[dict] = []
        seen: set[str] = set(self._urls)

        for plat, handles in candidates.items():
            templates = self.PLATFORM_URL_TEMPLATES.get(plat, [])
            for handle in handles:
                for tmpl in templates:
                    url = tmpl.replace("{handle}", handle)
                    if url not in seen:
                        seen.add(url)
                        urls_to_probe.append({
                            "url": url, "platform": plat, "handle": handle,
                        })

        if not urls_to_probe:
            return []

        results: list[dict] = []
        lock = threading.Lock()

        def probe(item: dict):
            if self._probe_url(item["url"]):
                with lock:
                    results.append({
                        "url": item["url"],
                        "platform": item["platform"],
                        "handle": item["handle"],
                        "source": "direct_probe",
                        "reliability": PLATFORM_WEIGHTS.get(item["platform"], 0.4),
                        "query": f"direct:{item['platform']}/{item['handle']}",
                    })

        MAX_WORKERS = 15
        for i in range(0, len(urls_to_probe), MAX_WORKERS):
            batch = urls_to_probe[i:i + MAX_WORKERS]
            threads = []
            for item in batch:
                t = threading.Thread(target=probe, args=(item,))
                t.start()
                threads.append(t)
            for t in threads:
                t.join(timeout=6)

        return results

    # ── Search ────────────────────────────────────────────────────

    def _search_ddg(self, query: str) -> list[dict]:
        """Search DuckDuckGo HTML for a query and return profile results."""
        self._queries_tried.add(query)
        results = []
        encoded = urllib.parse.quote(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded}"

        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=4) as resp:
                html = resp.read().decode("utf-8", errors="replace")
        except Exception:
            return results

        for match in re.finditer(
            r'<a[^>]+class="result__a"[^>]*href="(.*?)".*?</a>', html, re.DOTALL
        ):
            href = match.group(1)
            href = href.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")

            resolved = self.canonicalizer.resolve(href) if self.canonicalizer else href
            if not resolved:
                resolved = href

            if resolved in self._urls:
                continue
            if not (_is_social_domain(resolved) or "linkedin.com" in resolved.lower()):
                continue

            plat = _guess_platform(resolved)
            handle = _extract_handle(resolved)
            results.append({
                "url": resolved,
                "platform": plat,
                "handle": handle or "",
                "source": "adaptive_search",
                "reliability": PLATFORM_WEIGHTS.get(plat, 0.4),
                "query": query,
            })

        return results

    # ── Main Iteration ────────────────────────────────────────────

    def iterate(self, max_iterations: int = 5, max_queries_per_iter: int = 20,
                enable_direct_probe: bool = True) -> dict:
        """Run adaptive search iterations.

        Each iteration:
          1. Generate queries from current knowledge
          2. Search up to max_queries_per_iter via DDG
          3. If DDG yields nothing and handles exist, fall back to direct URL probing
          4. Register new profiles found
          5. Repeat until no new evidence

        Args:
            max_iterations: Maximum search iterations.
            max_queries_per_iter: Max DDG queries per iteration.
            enable_direct_probe: If True, probe platform URLs directly when DDG fails.

        Returns:
            Dict with all discovered profiles, identifiers, iteration history.
        """
        all_profiles: list[dict] = []
        iteration = 0

        while iteration < max_iterations:
            queries = self.generate_queries()
            if not queries and not self._handles:
                break

            queries = queries[:max_queries_per_iter]
            iteration_profiles = []
            iteration_new = 0

            # Phase A: DDG search (with circuit breaker — if first 3 queries all fail, skip)
            ddg_failures = 0
            for q in queries:
                if ddg_failures >= 3:
                    break
                results = self._search_ddg(q)
                if not results:
                    ddg_failures += 1
                else:
                    ddg_failures = 0
                for r in results:
                    if r["url"] not in self._urls:
                        self._urls.add(r["url"])
                        if r["platform"]:
                            self._platforms_found.add(r["platform"])
                        if r["handle"] and r["platform"]:
                            self._handles[r["platform"]] = r["handle"]
                        all_profiles.append(r)
                        iteration_profiles.append(r)
                        iteration_new += 1

            # Phase B: Direct URL probing fallback (if DDG found nothing and we have names/handles)
            if iteration_new == 0 and enable_direct_probe and (self._handles or self._names):
                probe_results = self._probe_handles()
                for r in probe_results:
                    if r["url"] not in self._urls:
                        self._urls.add(r["url"])
                        self._platforms_found.add(r["platform"])
                        self._handles[r["platform"]] = r["handle"]
                        all_profiles.append(r)
                        iteration_profiles.append(r)
                        iteration_new += 1

            self._iteration_history.append({
                "iteration": iteration,
                "queries_run": len(queries),
                "new_profiles": iteration_new,
                "total_profiles": len(all_profiles),
                "platforms": sorted(self._platforms_found),
                "queries": queries[:5],
                "direct_probe_used": any(
                    r.get("source") == "direct_probe" for r in iteration_profiles
                ),
            })

            if iteration_new == 0:
                break

            iteration += 1

        return {
            "total_profiles": len(all_profiles),
            "profiles": all_profiles,
            "platforms_found": sorted(self._platforms_found),
            "identifiers": {
                "names": sorted(self._names),
                "handles": dict(self._handles),
                "emails": sorted(self._emails),
                "domains": sorted(self._domains),
                "organizations": sorted(self._orgs),
            },
            "iteration_history": self._iteration_history,
            "iterations_completed": len(self._iteration_history),
        }
