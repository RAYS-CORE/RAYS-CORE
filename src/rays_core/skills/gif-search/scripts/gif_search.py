#!/usr/bin/env python3
"""
gif_search.py — Windows-compatible GIF search using the Tenor API via urllib.
No curl or jq required.

Usage:
    python gif_search.py "happy dance" [--limit 5] [--rating g]
    python gif_search.py "cat" --trending --limit 10
    python gif_search.py "explosion" --download ./gifs/

Environment:
    TENOR_API_KEY  — Required. Get a free key at https://developers.google.com/tenor
"""
import sys
import os
import json
import argparse
import urllib.request
import urllib.parse
import pathlib

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

TENOR_BASE = "https://tenor.googleapis.com/v2"

def get_api_key() -> str:
    key = os.environ.get("TENOR_API_KEY", "")
    if not key:
        print("ERROR: TENOR_API_KEY env var not set. Get a free key at https://developers.google.com/tenor", file=sys.stderr)
        sys.exit(1)
    return key

def search_gifs(query: str, limit: int, rating: str, api_key: str) -> list:
    params = urllib.parse.urlencode({
        "q": query,
        "key": api_key,
        "limit": limit,
        "contentfilter": rating,
        "media_filter": "gif,tinygif",
    })
    url = f"{TENOR_BASE}/search?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "RAYS-Agent/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8")).get("results", [])

def trending_gifs(limit: int, api_key: str) -> list:
    params = urllib.parse.urlencode({
        "key": api_key,
        "limit": limit,
        "media_filter": "gif,tinygif",
    })
    url = f"{TENOR_BASE}/featured?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "RAYS-Agent/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8")).get("results", [])

def print_results(results: list) -> None:
    if not results:
        print("No GIFs found.")
        return
    for i, r in enumerate(results, 1):
        title = r.get("title") or r.get("id", "")
        url = r.get("url", "")
        # Prefer tinygif, fallback to gif
        media = r.get("media_formats", {})
        gif_url = media.get("gif", {}).get("url") or media.get("tinygif", {}).get("url") or ""
        print(f"\n{i}. {title}")
        print(f"   Tenor URL:  {url}")
        if gif_url:
            print(f"   Direct GIF: {gif_url}")

def download_gifs(results: list, out_dir: str) -> None:
    dest = pathlib.Path(out_dir)
    dest.mkdir(parents=True, exist_ok=True)
    for i, r in enumerate(results, 1):
        media = r.get("media_formats", {})
        gif_url = media.get("gif", {}).get("url") or media.get("tinygif", {}).get("url") or ""
        if not gif_url:
            continue
        filename = dest / f"{r.get('id', i)}.gif"
        print(f"Downloading {filename}...", end=" ", flush=True)
        try:
            urllib.request.urlretrieve(gif_url, filename)
            print("✓")
        except Exception as e:
            print(f"FAILED: {e}")

def main():
    parser = argparse.ArgumentParser(description="Tenor GIF search (Windows-compatible, no curl/jq)")
    parser.add_argument("query", nargs="?", help="Search query (omit for --trending)")
    parser.add_argument("--limit", type=int, default=5, help="Number of GIFs (default: 5)")
    parser.add_argument("--rating", choices=["g", "pg", "pg-13", "r"], default="g",
                        help="Content filter (default: g)")
    parser.add_argument("--trending", action="store_true", help="Fetch trending GIFs instead of searching")
    parser.add_argument("--download", metavar="DIR", help="Download GIFs to this directory")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    if not args.query and not args.trending:
        parser.error("Provide a search query or use --trending")

    api_key = get_api_key()

    if args.trending:
        results = trending_gifs(args.limit, api_key)
    else:
        results = search_gifs(args.query, args.limit, args.rating, api_key)

    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
        return

    print_results(results)

    if args.download:
        download_gifs(results, args.download)

if __name__ == "__main__":
    main()
