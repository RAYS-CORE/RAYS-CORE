"""Source Reliability Engine — score and weight information sources.

Each source type gets a base reliability score. The engine combines:
  - Source type weight
  - Cross-source consistency
  - Direct vs indirect evidence
  - Recency/staleness factor
  - Domain authority

Usage:
    engine = SourceReliability()
    score = engine.score("linkedin", url="https://linkedin.com/in/name")
    # Returns weighted reliability score 0.0–1.0
"""

from __future__ import annotations

import re
import time
import urllib.parse
from typing import Optional

# Base reliability weights for source types
SOURCE_WEIGHTS: dict[str, float] = {
    "official_profile": 1.0,
    "personal_website": 0.95,
    "linkedin": 0.92,
    "github": 0.90,
    "x": 0.85,
    "twitter": 0.85,
    "facebook": 0.80,
    "instagram": 0.75,
    "youtube": 0.70,
    "medium": 0.70,
    "reddit": 0.60,
    "news": 0.70,
    "blog": 0.65,
    "google_cache": 0.75,
    "government": 0.95,
    "education": 0.90,
    "corporate": 0.85,
    "public_record": 0.80,
    "reverse_image": 0.60,
    "whois": 0.70,
    "sherlock": 0.65,
    "spiderfoot": 0.60,
    "holehe": 0.55,
    "random_image": 0.25,
    "web": 0.40,
}

# Domain-level overrides
DOMAIN_AUTHORITY: dict[str, float] = {
    "linkedin.com": 0.92,
    "github.com": 0.90,
    "x.com": 0.85,
    "twitter.com": 0.85,
    "facebook.com": 0.80,
    "instagram.com": 0.75,
    "youtube.com": 0.70,
    "reddit.com": 0.60,
    "medium.com": 0.70,
    "nytimes.com": 0.85,
    "reuters.com": 0.85,
    "bbc.com": 0.85,
    "wikipedia.org": 0.80,
    ".gov": 0.95,
    ".edu": 0.90,
    ".ac.": 0.90,
    "whois.": 0.70,
}

# Recency decay: sources older than this many days get penalized
STALENESS_DAYS = 365
MAX_AGE_BONUS_DAYS = 30  # sources newer than this get a bonus


class SourceReliability:
    """Score and weight information sources."""

    def score(
        self,
        source_type: str,
        url: str = "",
        platform: str = "",
        days_old: Optional[float] = None,
        cross_references: int = 0,
        is_direct: bool = True,
    ) -> float:
        """Compute a reliability score for a source.

        Args:
            source_type: Type string (e.g. 'linkedin', 'news', 'personal_website').
            url: Full URL for domain-level authority lookup.
            platform: Platform name override (maps to source_type).
            days_old: Age of the source in days. None = unknown.
            cross_references: Number of other sources referencing the same info.
            is_direct: Whether this is direct evidence (True) or indirect (False).

        Returns:
            Score 0.0–1.0.
        """
        base = self._base_weight(source_type, platform, url)
        domain_bonus = self._domain_authority(url)
        recency = self._recency_factor(days_old)
        directness = 1.0 if is_direct else 0.7
        cross_bonus = min(0.1, cross_references * 0.02)

        score = base * recency * directness + domain_bonus + cross_bonus
        return min(1.0, max(0.0, score))

    def _base_weight(self, source_type: str, platform: str, url: str) -> float:
        t = source_type.lower().replace(" ", "_")
        if t in SOURCE_WEIGHTS:
            return SOURCE_WEIGHTS[t]
        if platform:
            p = platform.lower().replace(" ", "_")
            if p in SOURCE_WEIGHTS:
                return SOURCE_WEIGHTS[p]
        return SOURCE_WEIGHTS.get("web", 0.4)

    def _domain_authority(self, url: str) -> float:
        if not url:
            return 0.0
        domain = urllib.parse.urlparse(url).netloc.lower()
        for pattern, weight in DOMAIN_AUTHORITY.items():
            if pattern.startswith("."):
                if domain.endswith(pattern):
                    return weight * 0.05  # domain bonus is additive, capped at 0.05
            elif pattern in domain:
                return weight * 0.05
        return 0.0

    def _recency_factor(self, days_old: Optional[float]) -> float:
        if days_old is None:
            return 0.9  # unknown age, slight penalty
        if days_old <= MAX_AGE_BONUS_DAYS:
            return 1.0  # fresh
        if days_old >= STALENESS_DAYS:
            return 0.7  # stale
        return 1.0 - (days_old / STALENESS_DAYS) * 0.3

    def classify_source_type(self, url: str, platform: str = "") -> str:
        """Infer source type from a URL."""
        if platform:
            if platform in SOURCE_WEIGHTS:
                return platform
        u = url.lower()
        if "linkedin.com" in u:
            return "linkedin"
        if "github.com" in u:
            return "github"
        if "instagram.com" in u:
            return "instagram"
        if "x.com" in u or "twitter.com" in u:
            return "x"
        if "facebook.com" in u or "fb.com" in u:
            return "facebook"
        if "youtube.com" in u:
            return "youtube"
        if "medium.com" in u:
            return "medium"
        if "reddit.com" in u:
            return "reddit"
        if any(d in u for d in [".gov", ".govt"]):
            return "government"
        if any(d in u for d in [".edu", ".ac."]):
            return "education"
        if "wikipedia.org" in u:
            return "news"
        if "news" in u or any(s in u for s in ["nytimes", "reuters", "bbc", "cnn"]):
            return "news"
        return "web"
