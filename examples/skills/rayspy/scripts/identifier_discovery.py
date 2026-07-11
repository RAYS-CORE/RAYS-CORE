"""Identifier Discovery Engine — extracts identifiers from verified accounts.

After a profile is verified (face match + evidence), this module extracts:
  - GitHub username
  - Instagram username
  - LinkedIn handle
  - Email addresses (from profile, posts, descriptions)
  - Website URLs (personal site, company site)
  - Phone numbers (if public)
  - Display names / real names
  - Locations

Output:
  {
    "name": "John Doe",
    "usernames": {"github": "johndoe", "instagram": "johndoe", ...},
    "emails": ["john@example.com"],
    "websites": ["https://johndoe.com"],
    "phones": [],
    "locations": ["San Francisco, CA"],
    "employers": ["Acme Corp"],
    "education": ["MIT"],
  }
"""

from __future__ import annotations

import re
import urllib.parse
from typing import Optional

# Regex patterns for identifier extraction
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_PATTERN = re.compile(
    r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}"
)
URL_PATTERN = re.compile(
    r"https?://(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:/[^\s\"'<>]*)?"
)
USERNAME_PATTERN = re.compile(r"@([a-zA-Z0-9_.-]{2,})")

PLATFORM_USERNAME_PATTERNS = {
    "github": [
        re.compile(r"github\.com/([a-zA-Z0-9_-]+)"),
        re.compile(r"github\.com/([a-zA-Z0-9_-]+)\.png"),
    ],
    "instagram": [
        re.compile(r"instagram\.com/([a-zA-Z0-9_.]+)"),
    ],
    "linkedin": [
        re.compile(r"linkedin\.com/in/([a-zA-Z0-9_-]+)"),
    ],
    "x": [
        re.compile(r"(?:x\.com|twitter\.com)/([a-zA-Z0-9_]+)"),
    ],
    "facebook": [
        re.compile(r"facebook\.com/([a-zA-Z0-9.]+)"),
    ],
    "medium": [
        re.compile(r"medium\.com/@([a-zA-Z0-9_-]+)"),
    ],
}


class IdentifierDiscovery:
    """Extract identifiers from verified account metadata and profile content."""

    def extract_from_profile(self, profile: dict) -> dict:
        return self.extract_from_profiles([profile])

    def extract_from_text(self, text: str) -> dict:
        """Extract identifiers from raw text (HTML, bio, description)."""
        identifiers = {
            "name": None,
            "usernames": {},
            "emails": set(),
            "websites": set(),
            "phones": set(),
            "locations": set(),
            "employers": set(),
            "education": set(),
            "platforms": set(),
        }
        for m in EMAIL_PATTERN.finditer(text):
            identifiers["emails"].add(m.group(0))
        for m in URL_PATTERN.finditer(text):
            identifiers["websites"].add(m.group(0))
        for m in PHONE_PATTERN.finditer(text):
            identifiers["phones"].add(m.group(0))
        for m in USERNAME_PATTERN.finditer(text):
            uname = m.group(1)
            if len(uname) >= 3 and not identifiers["usernames"].get("web"):
                identifiers["usernames"]["web"] = uname
        for plat, patterns in PLATFORM_USERNAME_PATTERNS.items():
            for pat in patterns:
                for m in pat.finditer(text):
                    identifiers["usernames"][plat] = m.group(1)
        identifiers["emails"] = sorted(identifiers["emails"])
        identifiers["websites"] = sorted(identifiers["websites"])
        identifiers["phones"] = sorted(identifiers["phones"])
        identifiers["locations"] = sorted(identifiers["locations"])
        identifiers["employers"] = sorted(identifiers["employers"])
        identifiers["education"] = sorted(identifiers["education"])
        identifiers["platforms"] = sorted(identifiers["platforms"])
        return identifiers

    def extract_from_profiles(self, profiles: list[dict]) -> dict:
        """Extract identifiers from a list of profile dicts.

        Each profile should have at minimum: url, platform, handle.
        """
        identifiers = {
            "name": None,
            "usernames": {},
            "emails": set(),
            "websites": set(),
            "phones": set(),
            "locations": set(),
            "employers": set(),
            "education": set(),
            "platforms": set(),
            "profile_urls": [],
        }

        for p in profiles:
            url = p.get("url", "")
            platform = p.get("platform", "web")
            handle = p.get("handle", "")
            bio = p.get("bio") or p.get("description", "")
            display_name = p.get("display_name") or p.get("name", "")

            identifiers["platforms"].add(platform)
            identifiers["profile_urls"].append(url)

            # Extract platform-specific usernames
            if handle and platform not in identifiers["usernames"]:
                identifiers["usernames"][platform] = handle

            # Extract emails
            if bio:
                for m in EMAIL_PATTERN.finditer(bio):
                    identifiers["emails"].add(m.group(0))

            # Extract URLs from bio
            if bio:
                for m in URL_PATTERN.finditer(bio):
                    identifiers["websites"].add(m.group(0))

            # Extract phone numbers
            if bio:
                for m in PHONE_PATTERN.finditer(bio):
                    identifiers["phones"].add(m.group(0))

            # Extract usernames from URLs
            for plat, patterns in PLATFORM_USERNAME_PATTERNS.items():
                for pat in patterns:
                    m = pat.search(url)
                    if m:
                        identifiers["usernames"][plat] = m.group(1)

            # Track name
            if display_name and not identifiers["name"]:
                identifiers["name"] = display_name

        # Convert sets to sorted lists
        identifiers["emails"] = sorted(identifiers["emails"])
        identifiers["websites"] = sorted(identifiers["websites"])
        identifiers["phones"] = sorted(identifiers["phones"])
        identifiers["locations"] = sorted(identifiers["locations"])
        identifiers["employers"] = sorted(identifiers["employers"])
        identifiers["education"] = sorted(identifiers["education"])
        identifiers["platforms"] = sorted(identifiers["platforms"])

        return identifiers

    def extract_from_html(self, html: str, base_url: str = "") -> dict:
        """Extract identifiers from raw HTML content."""
        identifiers = {
            "emails": set(),
            "websites": set(),
            "phones": set(),
            "usernames": {},
        }

        for m in EMAIL_PATTERN.finditer(html):
            identifiers["emails"].add(m.group(0))

        for m in URL_PATTERN.finditer(html):
            url = m.group(0)
            if base_url and url.startswith("/"):
                parsed = urllib.parse.urlparse(base_url)
                url = f"{parsed.scheme}://{parsed.netloc}{url}"
            identifiers["websites"].add(url)

        for m in PHONE_PATTERN.finditer(html):
            identifiers["phones"].add(m.group(0))

        for plat, patterns in PLATFORM_USERNAME_PATTERNS.items():
            for pat in patterns:
                for m in pat.finditer(html):
                    identifiers["usernames"][plat] = m.group(1)

        # Check for @username patterns
        for m in USERNAME_PATTERN.finditer(html):
            uname = m.group(1)
            if len(uname) >= 3 and not identifiers["usernames"].get("web"):
                identifiers["usernames"]["web"] = uname

        identifiers["emails"] = sorted(identifiers["emails"])
        identifiers["websites"] = sorted(identifiers["websites"])
        identifiers["phones"] = sorted(identifiers["phones"])

        return identifiers

    def extract_domains(self, urls: list[str]) -> set[str]:
        """Extract unique domains from a list of URLs."""
        domains = set()
        for url in urls:
            try:
                domain = urllib.parse.urlparse(url).netloc.lower()
                if domain:
                    domains.add(domain)
            except Exception:
                pass
        return domains

    def merge(self, *identifier_dicts: dict) -> dict:
        """Merge multiple identifier dicts into one."""
        merged = {
            "name": None,
            "usernames": {},
            "emails": set(),
            "websites": set(),
            "phones": set(),
            "locations": set(),
            "employers": set(),
            "education": set(),
            "platforms": set(),
            "profile_urls": [],
        }
        for d in identifier_dicts:
            if not d:
                continue
            if d.get("name") and not merged["name"]:
                merged["name"] = d["name"]
            merged["usernames"].update(d.get("usernames", {}))
            merged["emails"].update(d.get("emails", []))
            merged["websites"].update(d.get("websites", []))
            merged["phones"].update(d.get("phones", []))
            merged["locations"].update(d.get("locations", []))
            merged["employers"].update(d.get("employers", []))
            merged["education"].update(d.get("education", []))
            merged["platforms"].update(d.get("platforms", []))
            merged["profile_urls"].extend(d.get("profile_urls", []))

        merged["emails"] = sorted(merged["emails"])
        merged["websites"] = sorted(merged["websites"])
        merged["phones"] = sorted(merged["phones"])
        merged["locations"] = sorted(merged["locations"])
        merged["employers"] = sorted(merged["employers"])
        merged["education"] = sorted(merged["education"])
        merged["platforms"] = sorted(merged["platforms"])
        return merged
