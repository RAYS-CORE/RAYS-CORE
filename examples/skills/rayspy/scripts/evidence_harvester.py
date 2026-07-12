"""Evidence Harvester — extracts identifiers from validated profiles and writes them back.

IMPORTANT: extraction is scoped to profile-specific areas of the page only
(meta tags, JSON-LD structured data, and the profile header/bio/contact
sections). We never regex the entire raw HTML document — that picks up
page assets (CDN/script URLs), tracking pixels, and cache-busting IDs and
misreports them as "websites" or "phone numbers".
"""

from __future__ import annotations

import json
import re
import urllib.parse
from typing import Optional

from bs4 import BeautifulSoup

# ── Patterns applied only to scoped, profile-relevant text (never full HTML) ──
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

# Phone numbers must contain at least one real separator (space/dash/dot/
# parens) or a leading '+'. A bare run of 10-13 digits (timestamps, cache
# busters, tracking/session IDs) will NOT match this, which is what was
# causing values like "1781791509496" and "1440502568" to be misreported
# as phone numbers previously.
PHONE_RE = re.compile(
    r"(?<!\d)(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]?\d{4}(?!\d)"
)

USERNAME_RE = re.compile(r"(?<![\w.])@([a-zA-Z0-9_.-]{2,30})\b")

# Known social media title patterns that carry display names
TITLE_NAME_RE = re.compile(
    r"^(.*?)\s*[|–-]\s*(?:@[\w_.-]+\s*[|–-]\s*)?(?:Instagram|Twitter|X|Facebook|LinkedIn|GitHub|Threads)",
    re.IGNORECASE,
)

# Page-asset / infrastructure domains that are never profile attributes.
# Any "website" match under these domains is a script/CDN/tracking asset,
# not something the profile owner put there, and must be discarded.
ASSET_DOMAIN_BLOCKLIST = (
    "googletagmanager.com", "google-analytics.com", "googlesyndication.com",
    "googleapis.com", "gstatic.com", "recaptcha.net", "recaptcha.google.com",
    "cloudfront.net", "akamaihd.net", "akamai.net", "cloudflare.com",
    "cloudflareinsights.com", "jsdelivr.net", "unpkg.com", "polyfill.io",
    "bootstrapcdn.com", "fontawesome.com", "use.fontawesome.com",
    "spotifycdn.com", "spoti.fi", "doubleclick.net", "facebook.net",
    "hotjar.com", "segment.com", "segment.io", "amplitude.com",
    "sentry.io", "newrelic.com", "nr-data.net", "optimizely.com",
    "cdn.jsdelivr.net", "ajax.googleapis.com", "connect.facebook.net",
    "static.cloudflareinsights.com", "challenges.cloudflare.com",
    "captcha-delivery.com", "hcaptcha.com",
)

# File extensions that indicate a page asset rather than a profile-provided link
ASSET_PATH_RE = re.compile(
    r"\.(?:js|css|map|woff2?|ttf|eot|ico|svg|png|jpe?g|gif|webp|json)(?:[?#]|$)",
    re.IGNORECASE,
)


def harvest_from_candidate(
    url: str,
    html: str,
    platform: str = "web",
    handle: str = "",
    existing: Optional[dict] = None,
) -> dict:
    """Extract all evidence we can from a validated candidate.

    Extraction is limited to profile-specific areas of the page:
      - <meta property="og:*"> / twitter:* / profile:* tags
      - JSON-LD structured data (<script type="application/ld+json">)
      - the visible profile header / bio / "about" or "contact" section

    Returns a dict with keys:
      display_name, bio, image_url, emails, phones, websites,
      organizations, locations, usernames
    """
    evidence: dict = {
        "display_name": None,
        "bio": None,
        "image_url": None,
        "emails": [],
        "phones": [],
        "websites": [],
        "organizations": [],
        "locations": [],
        "usernames": {},
    }

    if existing:
        evidence.update(existing)

    html = html or ""
    soup = BeautifulSoup(html, "html.parser")

    # ── Display name from <title> ──
    title_tag = soup.find("title")
    if title_tag and title_tag.string:
        raw_title = title_tag.get_text(strip=True)
        m = TITLE_NAME_RE.match(raw_title)
        if m:
            evidence["display_name"] = evidence["display_name"] or m.group(1).strip()

    # ── Meta tags (og:*, twitter:*, profile:*) — the primary profile-scoped source ──
    meta_content: dict[str, str] = {}
    for meta in soup.find_all("meta"):
        key = (meta.get("property") or meta.get("name") or "").lower().strip()
        content = (meta.get("content") or "").strip()
        if key and content:
            meta_content[key] = content

    if not evidence["display_name"]:
        evidence["display_name"] = (
            meta_content.get("og:title")
            or meta_content.get("twitter:title")
            or meta_content.get("profile:username")
        )

    if not evidence["bio"]:
        evidence["bio"] = (
            meta_content.get("description")
            or meta_content.get("og:description")
            or meta_content.get("twitter:description")
        )

    if not evidence["image_url"]:
        evidence["image_url"] = meta_content.get("og:image") or meta_content.get("twitter:image")

    # ── Display name / avatar from a profile-header heading ──
    if not evidence["display_name"]:
        header = soup.find(["h1", "h2"], class_=re.compile(r"(fullname|profile-name|username)", re.I))
        if header:
            evidence["display_name"] = header.get_text(strip=True)

    if not evidence["image_url"]:
        avatar = soup.find("img", class_=re.compile(r"(avatar|profile-img|profile-photo|ProfileAvatar)", re.I))
        if avatar and avatar.get("src"):
            evidence["image_url"] = urllib.parse.urljoin(url, avatar["src"])

    # ── JSON-LD structured data — the richest, most reliable profile-scoped source ──
    jsonld_objs = _extract_jsonld(soup)
    for obj in jsonld_objs:
        _merge_jsonld_person(obj, evidence)

    # ── Build the scoped text region for regex identifier extraction ──
    # Only the bio/about/contact section and meta content — never the full document.
    scoped_text_parts = [meta_content.get(k, "") for k in ("description", "og:description", "twitter:description")]
    for container in soup.find_all(
        ["div", "section", "span", "p"],
        class_=re.compile(r"(bio|about|contact|profile-header|profile-info|profile-details)", re.I),
    ):
        scoped_text_parts.append(container.get_text(separator=" ", strip=True))
    scoped_text = "\n".join(p for p in scoped_text_parts if p)

    # --- Emails (scoped text + JSON-LD only) ---
    found_emails = set(evidence["emails"]) | set(EMAIL_RE.findall(scoped_text))
    evidence["emails"] = sorted(found_emails)

    # --- Phones (scoped text only, requires real separators — see PHONE_RE) ---
    found_phones = set(evidence["phones"]) | set(PHONE_RE.findall(scoped_text))
    evidence["phones"] = sorted(found_phones)

    # --- Websites: only from bio/about text and JSON-LD sameAs / meta content,
    #     filtered against the asset/CDN blocklist and asset file extensions ---
    urls_found = set(evidence["websites"])
    for m in re.finditer(r"https?://(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:/[^\s\"'<>]*)?", scoped_text):
        candidate_url = m.group(0)
        if _is_profile_website(candidate_url, platform):
            urls_found.add(candidate_url)
    evidence["websites"] = sorted(urls_found)

    # --- Organizations: employer/affiliation mentions within scoped bio text only ---
    org_matches = re.findall(
        r'(?:works at|works for|employed by|engineer at|designer at|founder at|ceo of|cto of)\s+'
        r'([A-Z][A-Za-z0-9\s&.]+?)(?:[.,!<]|\s+(?:Inc|LLC|Ltd|GmbH|Corp)\b|$)',
        scoped_text,
    )
    existing_orgs = set(evidence.get("organizations", []))
    evidence["organizations"] = sorted(existing_orgs | {o.strip() for o in org_matches if o.strip()})

    # --- Locations: "based in X" / "located in X" mentions within scoped bio text ---
    loc_matches = re.findall(
        r'(?:based in|located in|lives in|from)\s+([A-Z][A-Za-z\s]{2,40}?)(?:[.,!<\n]|$)',
        scoped_text,
    )
    existing_locs = set(evidence.get("locations", []))
    evidence["locations"] = sorted(existing_locs | {l.strip() for l in loc_matches if l.strip()})

    # --- Usernames ---
    if handle:
        evidence["usernames"][platform] = handle
    for m in USERNAME_RE.finditer(scoped_text):
        uname = m.group(1)
        if len(uname) >= 3:
            evidence["usernames"].setdefault("web", uname)

    return evidence


def _extract_jsonld(soup: BeautifulSoup) -> list[dict]:
    """Parse all <script type="application/ld+json"> blocks into a flat list of dicts."""
    objs: list[dict] = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = tag.string or tag.get_text() or ""
        if not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            continue
        if isinstance(data, list):
            objs.extend(d for d in data if isinstance(d, dict))
        elif isinstance(data, dict):
            if "@graph" in data and isinstance(data["@graph"], list):
                objs.extend(d for d in data["@graph"] if isinstance(d, dict))
            else:
                objs.append(data)
    return objs


def _merge_jsonld_person(obj: dict, evidence: dict) -> None:
    """Pull Person/ProfilePage schema.org fields into the evidence dict."""
    obj_type = str(obj.get("@type", "")).lower()
    if obj_type not in ("person", "profilepage", "organization") and "name" not in obj:
        return

    name = obj.get("name")
    if name and not evidence["display_name"]:
        evidence["display_name"] = str(name).strip()

    email = obj.get("email")
    if email:
        clean = str(email).replace("mailto:", "").strip()
        if EMAIL_RE.fullmatch(clean):
            evidence["emails"] = sorted(set(evidence["emails"]) | {clean})

    phone = obj.get("telephone")
    if phone and PHONE_RE.search(str(phone)):
        evidence["phones"] = sorted(set(evidence["phones"]) | {str(phone).strip()})

    image = obj.get("image")
    if image and not evidence["image_url"]:
        if isinstance(image, dict):
            image = image.get("url")
        if isinstance(image, str):
            evidence["image_url"] = image

    same_as = obj.get("sameAs")
    if same_as:
        links = same_as if isinstance(same_as, list) else [same_as]
        websites = set(evidence["websites"])
        for link in links:
            if isinstance(link, str) and _is_profile_website(link, ""):
                websites.add(link)
        evidence["websites"] = sorted(websites)

    works_for = obj.get("worksFor") or obj.get("affiliation") or obj.get("memberOf")
    if works_for:
        entries = works_for if isinstance(works_for, list) else [works_for]
        orgs = set(evidence["organizations"])
        for entry in entries:
            org_name = entry.get("name") if isinstance(entry, dict) else entry
            if isinstance(org_name, str) and org_name.strip():
                orgs.add(org_name.strip())
        evidence["organizations"] = sorted(orgs)

    address = obj.get("address") or obj.get("homeLocation")
    if address:
        loc_str = None
        if isinstance(address, dict):
            loc_str = address.get("addressLocality") or address.get("name")
        elif isinstance(address, str):
            loc_str = address
        if loc_str:
            evidence["locations"] = sorted(set(evidence["locations"]) | {loc_str.strip()})


def _is_profile_website(candidate_url: str, platform: str) -> bool:
    """Return True only if candidate_url looks like a profile-provided link,
    not a page asset, tracker, or the platform's own domain."""
    try:
        parsed = urllib.parse.urlparse(candidate_url)
    except ValueError:
        return False
    domain = parsed.netloc.lower()
    if not domain:
        return False
    if platform and platform.lower() in domain:
        return False
    if any(domain == d or domain.endswith("." + d) for d in ASSET_DOMAIN_BLOCKLIST):
        return False
    if ASSET_PATH_RE.search(parsed.path):
        return False
    return True


def _clean_html(raw: str) -> str:
    """Strip inline/block HTML tags and decode common entities."""
    cleaned = re.sub(r"<[^>]+>", " ", raw)
    cleaned = cleaned.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned
