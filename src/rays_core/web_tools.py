"""
Web Search & Web Fetch Tools for RAYS-CORE.

Provides robust internet search and URL content extraction inspired by
OpenCode (websearch, webfetch), Hermes Agent (web_search_tool, web_extract_tool),
and Pi Agent (web extensions).

Features:
- web_search(query, limit=5): Real-time live web search using DuckDuckGo/direct engines.
- web_fetch(url, max_chars=12000): Fetches URL content and converts HTML to clean, readable Markdown.
"""

from __future__ import annotations

import json
import logging
import re
import urllib.parse
from typing import Any, Dict, List, Optional
import requests

logger = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)

DEFAULT_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def web_search(query: str, limit: int = 5) -> str:
    """
    Search the live web for documentation, latest libraries, design trends, API references, or answers.
    Returns structured markdown search results with title, link, and summary snippet.
    """
    if not query or not query.strip():
        return "Error: Search query cannot be empty."

    clean_query = query.strip()
    limit = max(1, min(int(limit), 20))

    # Strategy 1: Try duckduckgo_search library
    try:
        from duckduckgo_search import DDGS
        with DDGS(timeout=10) as ddgs:
            raw_results = list(ddgs.text(clean_query, max_results=limit))
            if raw_results:
                formatted = [f"### Web Search Results for: \"{clean_query}\"\n"]
                for i, r in enumerate(raw_results, start=1):
                    title = r.get("title", "No Title").strip()
                    href = r.get("href") or r.get("link") or ""
                    snippet = r.get("body") or r.get("snippet") or ""
                    formatted.append(f"{i}. **[{title}]({href})**\n   {snippet}\n")
                return "\n".join(formatted)
    except Exception as exc:
        logger.debug(f"DDGS library search failed ({exc}), falling back to direct HTTP...")

    # Strategy 2: Direct DuckDuckGo HTML / Lite endpoint fallback
    try:
        url = "https://html.duckduckgo.com/html/"
        resp = requests.post(url, data={"q": clean_query}, headers=DEFAULT_HEADERS, timeout=10)
        if resp.status_code != 200:
            url = "https://lite.duckduckgo.com/lite/"
            resp = requests.post(url, data={"q": clean_query}, headers=DEFAULT_HEADERS, timeout=10)

        if resp.status_code == 200:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.text, "html.parser")
            results = []
            
            # Match standard HTML layout
            for result_div in soup.find_all("div", class_="result")[:limit]:
                title_elem = result_div.find("a", class_="result__a")
                snippet_elem = result_div.find("a", class_="result__snippet")
                if title_elem:
                    title = title_elem.get_text().strip()
                    href = title_elem.get("href", "")
                    if "uddg=" in href:
                        match = re.search(r"uddg=([^&]+)", href)
                        if match:
                            href = urllib.parse.unquote(match.group(1))
                    snippet = snippet_elem.get_text().strip() if snippet_elem else ""
                    results.append((title, href, snippet))

            # Match Lite layout if standard was empty
            if not results:
                links = soup.find_all("a", class_="result-link")[:limit]
                snippets = soup.find_all("td", class_="result-snippet")[:limit]
                for i, link in enumerate(links):
                    title = link.get_text().strip()
                    href = link.get("href", "")
                    snippet = snippets[i].get_text().strip() if i < len(snippets) else ""
                    results.append((title, href, snippet))

            if results:
                formatted = [f"### Web Search Results for: \"{clean_query}\"\n"]
                for i, (title, href, snippet) in enumerate(results, start=1):
                    formatted.append(f"{i}. **[{title}]({href})**\n   {snippet}\n")
                return "\n".join(formatted)
    except Exception as exc:
        logger.debug(f"Direct DDG search failed: {exc}")

    # Strategy 3: Direct Wikipedia / DuckDuckGo Instant Answer API fallback
    try:
        api_url = f"https://api.duckduckgo.com/?q={urllib.parse.quote_plus(clean_query)}&format=json"
        resp = requests.get(api_url, headers=DEFAULT_HEADERS, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("AbstractText")
            abstract_url = data.get("AbstractURL")
            if abstract:
                return (
                    f"### Web Search Result for: \"{clean_query}\"\n\n"
                    f"**Source: [{data.get('Heading', 'Summary')}]({abstract_url})**\n\n"
                    f"{abstract}"
                )
    except Exception:
        pass

    return f"No search results found for: \"{clean_query}\". Please try a more specific or alternate query."


def web_fetch(url: str, max_chars: int = 12000, format: str = "markdown") -> str:
    """
    Fetch content from an HTTP or HTTPS URL and convert HTML to clean, readable Markdown/Text.
    """
    if not url or not url.strip():
        return "Error: URL is required for web_fetch."

    clean_url = url.strip()
    if not clean_url.startswith(("http://", "https://")):
        clean_url = "https://" + clean_url

    try:
        resp = requests.get(clean_url, headers=DEFAULT_HEADERS, timeout=15)
        resp.raise_for_status()

        content_type = resp.headers.get("Content-Type", "").lower()

        # Handle JSON responses directly
        if "application/json" in content_type:
            try:
                formatted_json = json.dumps(resp.json(), indent=2)
                if len(formatted_json) > max_chars:
                    return formatted_json[:max_chars] + f"\n\n[JSON truncated to {max_chars} characters]"
                return formatted_json
            except Exception:
                return resp.text[:max_chars]

        # Handle plain text / markdown / code directly
        if "text/plain" in content_type or "text/markdown" in content_type:
            raw_text = resp.text
            if len(raw_text) > max_chars:
                return raw_text[:max_chars] + f"\n\n[Content truncated to {max_chars} characters]"
            return raw_text

        # Handle HTML conversion using BeautifulSoup
        html_content = resp.text
        try:
            from bs4 import BeautifulSoup, Comment

            soup = BeautifulSoup(html_content, "html.parser")

            # Remove unwanted tags (scripts, styles, ads, navigation bars, footers)
            for tag in soup(["script", "style", "nav", "footer", "aside", "svg", "noscript", "iframe"]):
                tag.decompose()

            for comment in soup.find_all(text=lambda text: isinstance(text, Comment)):
                comment.extract()

            # Find main article container if present to reduce boilerplate
            main_content = (
                soup.find("article")
                or soup.find("main")
                or soup.find(id=re.compile(r"content|main|article|body", re.I))
                or soup.find(class_=re.compile(r"content|main|article|post|document", re.I))
                or soup.body
                or soup
            )

            # Convert headings, links, paragraphs to clean text
            for h in main_content.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
                level = int(h.name[1])
                h.insert_before(f"\n\n{'#' * level} ")
                h.insert_after("\n\n")

            for p in main_content.find_all("p"):
                p.insert_after("\n\n")

            for li in main_content.find_all("li"):
                li.insert_before("\n- ")

            for pre in main_content.find_all("pre"):
                code_text = pre.get_text()
                pre.string = f"\n```\n{code_text}\n```\n"

            text = main_content.get_text()

            # Normalize excessive whitespace and empty lines
            text = re.sub(r"\n{3,}", "\n\n", text)
            text = re.sub(r"[ \t]+", " ", text)
            text = text.strip()

            if not text:
                text = "Fetched page returned empty text content."

            truncated_note = ""
            if len(text) > max_chars:
                text = text[:max_chars]
                truncated_note = f"\n\n[Page content truncated to {max_chars} characters. Use start_line/end_line or targeted queries if needed.]"

            return f"### Content from: {clean_url}\n\n{text}{truncated_note}"

        except Exception as parse_err:
            # Fallback regex stripper if BS4 has an issue
            logger.debug(f"BS4 parsing failed ({parse_err}), falling back to regex clean...")
            clean_text = re.sub(r"<[^>]+>", " ", html_content)
            clean_text = re.sub(r"\s+", " ", clean_text).strip()
            return f"### Content from: {clean_url}\n\n{clean_text[:max_chars]}"

    except requests.exceptions.RequestException as req_err:
        return f"Error fetching URL '{clean_url}': {req_err}"
    except Exception as e:
        return f"Unexpected error fetching URL '{clean_url}': {e}"
