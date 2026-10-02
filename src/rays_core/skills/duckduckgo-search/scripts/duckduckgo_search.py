#!/usr/bin/env python3
"""
duckduckgo_search.py — Windows-compatible wrapper for the duckduckgo-search CLI.
Uses the `ddgs` Python package (pip install duckduckgo-search).

Usage:
    python duckduckgo_search.py "your query" [--max 5] [--type text|news|images]
    python duckduckgo_search.py "sadie sink spider-man" --max 3
    python duckduckgo_search.py "python async" --type news
"""
import sys
import argparse
import json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def main():
    parser = argparse.ArgumentParser(description="DuckDuckGo search (Windows-compatible)")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--max", type=int, default=5, help="Max results (default: 5)")
    parser.add_argument("--type", choices=["text", "news", "images"], default="text",
                        help="Search type (default: text)")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    try:
        from ddgs import DDGS
    except ImportError:
        try:
            from duckduckgo_search import DDGS  # legacy package name
        except ImportError:
            print("ERROR: ddgs not installed. Run: pip install ddgs", file=sys.stderr)
            sys.exit(1)

    with DDGS() as ddgs:
        if args.type == "text":
            results = list(ddgs.text(args.query, max_results=args.max))
        elif args.type == "news":
            results = list(ddgs.news(args.query, max_results=args.max))
        elif args.type == "images":
            results = list(ddgs.images(args.query, max_results=args.max))
        else:
            results = []

    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
        return

    if not results:
        print("No results found.")
        return

    for i, r in enumerate(results, 1):
        print(f"\n{i}.")
        if "title" in r:
            print(f"title       {r['title']}")
        if "href" in r or "url" in r:
            print(f"href        {r.get('href', r.get('url', ''))}")
        if "body" in r:
            body = r["body"]
            if len(body) > 300:
                body = body[:297] + "..."
            print(f"body        {body}")
        if "source" in r:
            print(f"source      {r['source']}")
        if "image" in r:
            print(f"image       {r['image']}")

if __name__ == "__main__":
    main()
