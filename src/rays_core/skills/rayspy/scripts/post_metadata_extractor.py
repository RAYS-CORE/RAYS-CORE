"""Post Metadata Extractor — extracts post-level metadata from profile pages.

Extracts from rendered HTML:
  - Post dates
  - Locations
  - @Mentions
  - #Hashtags
  - Media URLs (images, videos)
  - Engagement (likes, comments, shares)
  - External links
  - Post text content

Output:
  [
    {
      "date": "2024-01-15",
      "location": "San Francisco, CA",
      "mentions": ["@johndoe"],
      "hashtags": ["#tech"],
      "media_urls": ["https://...jpg"],
      "engagement": {"likes": 100, "comments": 5},
      "text": "Post content...",
      "external_links": ["https://..."]
    }
  ]
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin


class PostMetadataExtractor:
    """Extract rich metadata from post/page content."""

    def extract_from_html(self, html: str, base_url: str = "") -> list[dict]:
        """Extract post metadata from rendered HTML.

        Works with social media feeds, blogs, news articles.
        """
        posts = []

        # Look for post/article containers — common patterns
        post_blocks = self._split_into_posts(html)
        for block in post_blocks:
            post = self._extract_single_post(block, base_url)
            if post and post.get("text"):
                posts.append(post)

        return posts

    def _split_into_posts(self, html: str) -> list[str]:
        """Split HTML into individual post blocks."""
        blocks = []

        patterns = [
            r'<article[^>]*>(.*?)</article>',
            r'<div[^>]*class="[^"]*(?:post|feed-item|timeline-item|status)[^"]*"[^>]*>(.*?)</div>',
            r'<li[^>]*class="[^"]*(?:post|tweet|status)[^"]*"[^>]*>(.*?)</li>',
            r'<div[^>]*data-testid="[^"]*(?:post|tweet|feed)[^"]*"[^>]*>(.*?)</div>',
        ]

        for pat in patterns:
            matches = re.findall(pat, html, re.DOTALL | re.IGNORECASE)
            if matches:
                blocks.extend(matches)
                if len(matches) >= 3:
                    break

        return blocks

    def _extract_single_post(self, html_block: str, base_url: str) -> Optional[dict]:
        """Extract metadata from a single post block."""
        post = {
            "date": self._extract_date(html_block),
            "location": self._extract_location(html_block),
            "mentions": self._extract_mentions(html_block),
            "hashtags": self._extract_hashtags(html_block),
            "media_urls": self._extract_media_urls(html_block, base_url),
            "engagement": self._extract_engagement(html_block),
            "text": self._extract_text(html_block),
            "external_links": self._extract_external_links(html_block, base_url),
        }

        if not any([
            post["text"], post["media_urls"], post["hashtags"],
            post["mentions"], post["date"],
        ]):
            return None

        return post

    def _extract_date(self, html: str) -> Optional[str]:
        patterns = [
            r'datetime="([^"]+)"',
            r'<time[^>]*>([^<]+)</time>',
            r'(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2})',
            r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},?\s*\d{4}',
        ]
        for pat in patterns:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                return m.group(1)
        return None

    def _extract_location(self, html: str) -> Optional[str]:
        patterns = [
            r'<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)</span>',
            r'data-location="([^"]+)"',
            r'(?:📍|📍)\s*([^<]{2,50}?)(?:<|$)',
        ]
        for pat in patterns:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                loc = m.group(1).strip()
                if len(loc) >= 3:
                    return loc
        return None

    def _extract_mentions(self, html: str) -> list[str]:
        mentions = re.findall(r'@([a-zA-Z0-9_.]{2,})', html)
        return list(set(m.lower() for m in mentions))

    def _extract_hashtags(self, html: str) -> list[str]:
        hashtags = re.findall(r'#([a-zA-Z0-9_]{2,})', html)
        return list(set(h.lower() for h in hashtags))

    def _extract_media_urls(self, html: str, base_url: str) -> list[str]:
        urls = []
        img_patterns = [
            r'<img[^>]+src="([^"]+)"[^>]*>',
            r'<video[^>]+src="([^"]+)"[^>]*>',
            r'<source[^>]+src="([^"]+)"[^>]*>',
        ]
        for pat in img_patterns:
            for m in re.finditer(pat, html, re.IGNORECASE):
                src = m.group(1)
                if base_url and src.startswith("/"):
                    src = urljoin(base_url, src)
                if src.startswith(("http://", "https://")):
                    urls.append(src)
        return urls

    def _extract_engagement(self, html: str) -> dict:
        engagement = {}
        patterns = [
            (r"(\d[\d,]*)\s*(?:like|heart|favorite)[s]?", "likes"),
            (r"(\d[\d,]*)\s*(?:comment|reply)[s]?", "comments"),
            (r"(\d[\d,]*)\s*(?:share|retweet)[s]?", "shares"),
            (r"(\d[\d,]*)\s*(?:view)[s]?", "views"),
        ]
        for pat, key in patterns:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                try:
                    engagement[key] = int(m.group(1).replace(",", ""))
                except ValueError:
                    pass
        return engagement

    def _extract_text(self, html: str) -> str:
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text).strip()
        lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 20]
        return " ".join(lines[:5]) if lines else ""

    def _extract_external_links(self, html: str, base_url: str) -> list[str]:
        links = []
        for m in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>', html, re.IGNORECASE):
            href = m.group(1)
            if base_url and href.startswith("/"):
                href = urljoin(base_url, href)
            parsed = None
            try:
                parsed = urllib.parse.urlparse(href)
            except Exception:
                pass
            if parsed and parsed.netloc and parsed.scheme in ("http", "https"):
                links.append(href)
        return links

    def extract_relevant_metadata(self, posts: list[dict]) -> dict:
        """Aggregate metadata across all posts."""
        all_dates = []
        all_locations = set()
        all_mentions = set()
        all_hashtags = set()
        all_media = []
        total_engagement = {"likes": 0, "comments": 0, "shares": 0, "views": 0}

        for post in posts:
            if post.get("date"):
                all_dates.append(post["date"])
            if post.get("location"):
                all_locations.add(post["location"])
            all_mentions.update(post.get("mentions", []))
            all_hashtags.update(post.get("hashtags", []))
            all_media.extend(post.get("media_urls", []))
            for k in total_engagement:
                total_engagement[k] += post.get("engagement", {}).get(k, 0)

        return {
            "post_count": len(posts),
            "date_range": [min(all_dates), max(all_dates)] if len(all_dates) >= 2 else all_dates[:1],
            "locations": sorted(all_locations),
            "mentions": sorted(all_mentions),
            "hashtags": sorted(all_hashtags),
            "media_count": len(all_media),
            "total_engagement": total_engagement,
        }
