#!/usr/bin/env python3
"""
searxng_search.py — Windows-compatible SearXNG search using urllib (no curl/bash needed).

Usage:
    python searxng_search.py "your query" [--max 5] [--categories general,news]
    python searxng_search.py "python llm" --instance https://searx.be
    python searxng_search.py "climate change" --categories news --max 3

Environment:
    SEARXNG_URL  (optional) — base URL of your SearXNG instance.
                 Falls back to public instances if not set.
"""
import sys
import os
import json
import argparse
import urllib.request
import urllib.parse

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Public SearXNG instances (used as fallback when SEARXNG_URL is not set)
PUBLIC_INSTANCES = [
    "https://searx.be",
    "https://search.inetol.net",
    "https://searxng.world",
]

def search(query: str, instance: str, categories: str, max_results: int) -> list:
    params = urllib.parse.urlencode({
        "q": query,
        "format": "json",
        "categories": categories,
    })
    url = f"{instance.rstrip('/')}/search?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "RAYS-Agent/1.0 (searxng-search-skill)"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("results", [])[:max_results]

def main():
    parser = argparse.ArgumentParser(description="SearXNG search (Windows-compatible)")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--max", type=int, default=5, help="Max results (default: 5)")
    parser.add_argument("--categories", default="general", help="Comma-separated categories (default: general)")
    parser.add_argument("--instance", default=None, help="SearXNG instance URL (overrides SEARXNG_URL env var)")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    instance = args.instance or os.environ.get("SEARXNG_URL") or None

    instances_to_try = [instance] if instance else PUBLIC_INSTANCES
    results = []
    last_error = None

    for inst in instances_to_try:
        try:
            results = search(args.query, inst, args.categories, args.max)
            if results:
                break
        except Exception as e:
            last_error = e
            continue

    if not results:
        print(f"No results found. Last error: {last_error}", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
        return

    for i, r in enumerate(results, 1):
        print(f"\n{i}. {r.get('title', '(no title)')}")
        print(f"   URL: {r.get('url', '')}")
        content = r.get("content", "")
        if content:
            if len(content) > 300:
                content = content[:297] + "..."
            print(f"   {content}")
        if r.get("publishedDate"):
            print(f"   Published: {r['publishedDate']}")

if __name__ == "__main__":
    main()
