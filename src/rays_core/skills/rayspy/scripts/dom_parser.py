"""Module 4: DOM Parser — parse rendered HTML into structured data.

Completely independent of whether HTML came from requests or a browser.
Returns a standardised dict with:

  - title: page title
  - description: meta description
  - images: list of image dicts {src, alt, width, height, class, id}
  - links: list of link dicts {href, text, rel}
  - text: extracted visible text
  - metadata: og:*, twitter:*, article:* meta tags
  - scripts: inline scripts (for JS bundle detection)
  - platform_hints: domain-level platform identification
"""

from __future__ import annotations

import re
import urllib.parse
from typing import Any, Optional

from bs4 import BeautifulSoup, Tag


def parse(html: str, source_url: str = "") -> dict:
    """Parse rendered HTML into a structured dict.

    Args:
        html: The HTML to parse (from requests or browser).
        source_url: The original URL (used to resolve relative paths).

    Returns:
        Structured dict with all extracted data.
    """
    soup = BeautifulSoup(html, "html.parser")

    # ── Platform hints from URL ──
    platform = _detect_platform(source_url)

    # ── Page title ──
    title = ""
    title_tag = soup.find("title")
    if title_tag:
        title = title_tag.get_text(strip=True)
    if not title:
        og_title = _get_meta_attr(soup, "og:title")
        if og_title:
            title = og_title

    # ── Description ──
    description = _get_meta_attr(soup, "description") or _get_meta_attr(soup, "og:description") or ""

    # ── Open Graph / Twitter / Article metadata ──
    metadata: dict[str, str] = {}
    for prop_pattern in ["og:", "twitter:", "article:", "profile:"]:
        for meta_tag in soup.find_all("meta"):
            prop = meta_tag.get("property", "") or meta_tag.get("name", "")
            content = meta_tag.get("content", "")
            if prop.lower().startswith(prop_pattern) and content:
                metadata[prop] = content

    # ── Images ──
    images: list[dict] = []
    seen_srcs: set[str] = set()

    # Standard <img> tags
    for img_tag in soup.find_all("img"):
        img = _parse_img_tag(img_tag, source_url)
        if img and img.get("src") and img["src"] not in seen_srcs:
            seen_srcs.add(img["src"])
            images.append(img)

    # <meta property="og:image">
    og_image = _get_meta_attr(soup, "og:image")
    if og_image and og_image not in seen_srcs:
        seen_srcs.add(og_image)
        images.append({
            "src": og_image,
            "alt": _get_meta_attr(soup, "og:image:alt") or "",
            "width": _get_meta_attr(soup, "og:image:width") or "",
            "height": _get_meta_attr(soup, "og:image:height") or "",
            "source": "og:image",
            "type": "meta",
        })

    # <meta name="twitter:image">
    tw_image = _get_meta_attr(soup, "twitter:image") or _get_meta_attr(soup, "twitter:image:src")
    if tw_image and tw_image not in seen_srcs:
        seen_srcs.add(tw_image)
        images.append({
            "src": tw_image,
            "alt": _get_meta_attr(soup, "twitter:image:alt") or "",
            "width": "",
            "height": "",
            "source": "twitter:image",
            "type": "meta",
        })

    # Lazy-loaded images (data-src, data-lazy-src, data-original)
    for lazy_pattern in ["data-src", "data-lazy-src", "data-original", "data-srcset"]:
        for tag in soup.find_all(attrs={lazy_pattern: True}):
            src = tag.get(lazy_pattern, "")
            if src and src not in seen_srcs:
                seen_srcs.add(src)
                images.append({
                    "src": src,
                    "alt": tag.get("alt", ""),
                    "width": tag.get("width", ""),
                    "height": tag.get("height", ""),
                    "source": lazy_pattern,
                    "type": tag.name or "unknown",
                })

    # CSS background images (inline style)
    for tag in soup.find_all(style=re.compile(r"background(?:-image)?\s*:")):
        style = tag.get("style", "")
        urls = re.findall(r"url\(['\"]?(.*?)['\"]?\)", style)
        for bg_url in urls:
            if bg_url and bg_url not in seen_srcs:
                seen_srcs.add(bg_url)
                images.append({
                    "src": bg_url,
                    "alt": tag.get("alt", "") or "",
                    "width": "",
                    "height": "",
                    "source": "background-image",
                    "type": "css",
                })

    # <picture> / <source> srcset
    for source_tag in soup.find_all("source"):
        srcset = source_tag.get("srcset", "")
        if srcset:
            urls = _parse_srcset(srcset, source_url)
            for url in urls:
                if url not in seen_srcs:
                    seen_srcs.add(url)
                    images.append({
                        "src": url,
                        "alt": "",
                        "width": "",
                        "height": "",
                        "source": "srcset",
                        "type": "source",
                    })

    # ── Links ──
    links: list[dict] = []
    seen_hrefs: set[str] = set()
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        resolved = urllib.parse.urljoin(source_url, href)
        if resolved and resolved not in seen_hrefs:
            seen_hrefs.add(resolved)
            links.append({
                "href": resolved,
                "text": a_tag.get_text(strip=True)[:200],
                "rel": a_tag.get("rel", []),
                "class": a_tag.get("class", []),
            })

    # ── Visible text ──
    body = soup.find("body")
    visible_text = body.get_text(separator="\n", strip=True)[:50_000] if body else ""

    # ── Scripts (JS bundle detection) ──
    scripts: list[dict] = []
    for script_tag in soup.find_all("script"):
        src = script_tag.get("src", "")
        content = script_tag.string or ""
        scripts.append({
            "src": src,
            "length": len(content),
            "has_src": bool(src),
        })

    return {
        "title": title,
        "description": description,
        "platform": platform,
        "images": images,
        "links": links,
        "text": visible_text[:20_000],
        "metadata": metadata,
        "scripts": scripts,
        "image_count": len(images),
        "link_count": len(links),
    }


def _detect_platform(url: str) -> str:
    """Detect the platform from URL."""
    if not url:
        return "unknown"
    domain = urllib.parse.urlparse(url).netloc.lower()
    if "linkedin.com" in domain:
        return "linkedin"
    if "instagram.com" in domain:
        return "instagram"
    if "facebook.com" in domain or "fb.com" in domain:
        return "facebook"
    if "x.com" in domain or "twitter.com" in domain:
        return "x"
    if "github.com" in domain:
        return "github"
    if "youtube.com" in domain:
        return "youtube"
    if "tiktok.com" in domain:
        return "tiktok"
    if "reddit.com" in domain:
        return "reddit"
    return "web"


def _get_meta_attr(soup: BeautifulSoup, attr: str) -> Optional[str]:
    """Get a meta tag's content by property or name."""
    for meta in soup.find_all("meta"):
        prop = (meta.get("property") or "").lower().strip()
        name = (meta.get("name") or "").lower().strip()
        if prop == attr.lower() or name == attr.lower():
            return meta.get("content", "")
    return None


def _parse_img_tag(tag: Tag, source_url: str) -> Optional[dict]:
    """Parse a single <img> tag."""
    src = tag.get("src", "")
    if not src:
        return None
    resolved = urllib.parse.urljoin(source_url, src)
    return {
        "src": resolved,
        "alt": tag.get("alt", ""),
        "width": tag.get("width", ""),
        "height": tag.get("height", ""),
        "class": tag.get("class", []),
        "id": tag.get("id", ""),
        "data_src": tag.get("data-src", ""),
        "loading": tag.get("loading", ""),
        "source": "img_tag",
        "type": "img",
    }


def _parse_srcset(srcset: str, source_url: str) -> list[str]:
    """Parse srcset attribute into list of resolved URLs."""
    urls: list[str] = []
    for part in srcset.split(","):
        part = part.strip()
        if not part:
            continue
        url_candidate = part.split()[0]
        if url_candidate:
            resolved = urllib.parse.urljoin(source_url, url_candidate)
            urls.append(resolved)
    return urls
