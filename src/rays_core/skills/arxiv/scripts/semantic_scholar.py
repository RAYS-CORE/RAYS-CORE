#!/usr/bin/env python3
"""Search Semantic Scholar for paper citations and recommendations.

Usage:
    python semantic_scholar.py search "GRPO reinforcement learning" --limit 5
    python semantic_scholar.py paper arXiv:2402.03300
    python semantic_scholar.py citations arXiv:2402.03300 --limit 10
    python semantic_scholar.py references arXiv:2402.03300 --limit 10
    python semantic_scholar.py recommend arXiv:2402.03300
    python semantic_scholar.py author "Yann LeCun"
"""
import sys
import json
import urllib.request
import urllib.parse
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "https://api.semanticscholar.org/graph/v1"

def fetch_json(url, data=None):
    req = urllib.request.Request(url, headers={'User-Agent': 'RaysAgent/1.0'})
    if data:
        req.add_header('Content-Type', 'application/json')
        data = json.dumps(data).encode('utf-8')
    try:
        with urllib.request.urlopen(req, data=data, timeout=15) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching data: {e}")
        sys.exit(1)

def print_paper(p, prefix=""):
    title = p.get('title', 'Unknown Title')
    authors = ", ".join(a.get('name', '') for a in p.get('authors', []))
    year = p.get('year', 'N/A')
    citations = p.get('citationCount', 0)
    print(f"{prefix}Title: {title}")
    print(f"{prefix}Authors: {authors} ({year}) | Citations: {citations}")
    if p.get('externalIds') and 'ArXiv' in p['externalIds']:
        print(f"{prefix}arXiv ID: {p['externalIds']['ArXiv']}")
    print()

def cmd_search(query, limit):
    url = f"{BASE_URL}/paper/search?query={urllib.parse.quote(query)}&limit={limit}&fields=title,authors,year,citationCount,externalIds"
    data = fetch_json(url)
    for i, p in enumerate(data.get('data', [])):
        print(f"{i+1}. ", end="")
        print_paper(p, "   ")

def cmd_paper(pid):
    url = f"{BASE_URL}/paper/{urllib.parse.quote(pid)}?fields=title,authors,citationCount,referenceCount,influentialCitationCount,year,abstract,externalIds"
    data = fetch_json(url)
    print_paper(data)
    print(f"Abstract: {data.get('abstract', 'No abstract')}")

def cmd_citations(pid, limit):
    url = f"{BASE_URL}/paper/{urllib.parse.quote(pid)}/citations?fields=title,authors,year,citationCount,externalIds&limit={limit}"
    data = fetch_json(url)
    for i, c in enumerate(data.get('data', [])):
        print(f"{i+1}. Citing Paper:")
        print_paper(c.get('citingPaper', {}), "   ")

def cmd_references(pid, limit):
    url = f"{BASE_URL}/paper/{urllib.parse.quote(pid)}/references?fields=title,authors,year,citationCount,externalIds&limit={limit}"
    data = fetch_json(url)
    for i, c in enumerate(data.get('data', [])):
        print(f"{i+1}. Cited Paper:")
        print_paper(c.get('citedPaper', {}), "   ")

def cmd_recommend(pid):
    url = f"https://api.semanticscholar.org/recommendations/v1/papers/"
    data = fetch_json(url, data={"positivePaperIds": [pid], "negativePaperIds": []})
    for i, p in enumerate(data.get('recommendedPapers', [])[:10]):
        print(f"{i+1}. ", end="")
        print_paper(p, "   ")

def cmd_author(query):
    url = f"{BASE_URL}/author/search?query={urllib.parse.quote(query)}&fields=name,hIndex,citationCount,paperCount"
    data = fetch_json(url)
    for i, a in enumerate(data.get('data', [])[:5]):
        print(f"{i+1}. {a.get('name')} | h-index: {a.get('hIndex')} | Citations: {a.get('citationCount')} | Papers: {a.get('paperCount')}")

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)
    
    cmd = args[0]
    limit = 5
    if "--limit" in args:
        idx = args.index("--limit")
        limit = int(args[idx+1])
        del args[idx:idx+2]
    
    if len(args) < 2:
        print("Missing argument for command.")
        sys.exit(1)
        
    val = args[1]
    
    if cmd == "search": cmd_search(val, limit)
    elif cmd == "paper": cmd_paper(val)
    elif cmd == "citations": cmd_citations(val, limit)
    elif cmd == "references": cmd_references(val, limit)
    elif cmd == "recommend": cmd_recommend(val)
    elif cmd == "author": cmd_author(val)
    else:
        print(f"Unknown command: {cmd}")
