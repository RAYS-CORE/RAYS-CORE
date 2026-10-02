---
name: arxiv
description: "Search arXiv papers by keyword, author, category, or ID."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Research, Arxiv, Papers, Academic, Science, API]
    related_skills: [ocr-and-documents]
---
> [!WARNING]
> **WINDOWS COMPATIBILITY:** You are running on Windows. Linux tools like `jq`, `grep`, `sed`, `head`, `tr`, and `bash` are **NOT available**. If the instructions below suggest using `curl | jq` or pipeline parsing, you MUST NOT do it. Instead, write a short Python script (using `urllib` or `json`) to perform the request and data extraction, and then execute it via `python script.py`.


# arXiv Research

Search and retrieve academic papers from arXiv via their free REST API, and fetch citations and related papers via Semantic Scholar.

## Quick Reference

| Action | Command |
|--------|---------|
| Search papers | `python scripts/search_arxiv.py "large language models"` |
| Get specific paper | `python scripts/search_arxiv.py --id 2402.03300` |
| Read abstract (web) | `web_extract(urls=["https://arxiv.org/abs/2402.03300"])` |
| Read full paper (PDF) | `web_extract(urls=["https://arxiv.org/pdf/2402.03300"])` |
| Search Semantic Scholar | `python scripts/semantic_scholar.py search "large language models"` |
| Get Citations | `python scripts/semantic_scholar.py citations arXiv:2402.03300` |

## Searching arXiv Papers

Use the provided helper script `scripts/search_arxiv.py` to search arXiv. This script correctly fetches and parses the XML responses cross-platform.
NEVER use `curl` to query the API directly as the output is raw XML.

```bash
# Basic query
python scripts/search_arxiv.py "GRPO reinforcement learning"

# Complex query with max limits
python scripts/search_arxiv.py "transformer attention" --max 10 --sort date

# By author
python scripts/search_arxiv.py --author "Yann LeCun" --max 5

# By category
python scripts/search_arxiv.py --category cs.AI --sort date

# Fetch specific papers by ID
python scripts/search_arxiv.py --id 2402.03300
python scripts/search_arxiv.py --id 2402.03300,2401.12345
```

## Search Query Syntax Tips for arXiv

If you need more advanced boolean logic in the query string:
- `all:transformer+attention` (AND default)
- `ti:"chain+of+thought"` (Title phrase)
- `au:vaswani` (Author)
- `cat:cs.AI` (Category)

## Semantic Scholar (Citations, Related Papers, Author Profiles)

arXiv doesn't provide citation data or recommendations. Use the `scripts/semantic_scholar.py` script to interact with Semantic Scholar for these features.

### Get paper details
```bash
# By arXiv ID
python scripts/semantic_scholar.py paper arXiv:2402.03300
```

### Get citations OF a paper (who cited it)
```bash
python scripts/semantic_scholar.py citations arXiv:2402.03300 --limit 10
```

### Get references FROM a paper (what it cites)
```bash
python scripts/semantic_scholar.py references arXiv:2402.03300 --limit 10
```

### Search papers directly in Semantic Scholar
```bash
python scripts/semantic_scholar.py search "GRPO reinforcement learning" --limit 5
```

### Get paper recommendations
```bash
python scripts/semantic_scholar.py recommend arXiv:2402.03300
```

### Author profile
```bash
python scripts/semantic_scholar.py author "Yann LeCun"
```

## Complete Research Workflow

1. **Discover**: `python scripts/search_arxiv.py "your topic" --sort date --max 10`
2. **Assess impact**: `python scripts/semantic_scholar.py paper arXiv:ID`
3. **Read abstract**: `web_extract(urls=["https://arxiv.org/abs/ID"])`
4. **Read full paper**: `web_extract(urls=["https://arxiv.org/pdf/ID"])`
5. **Find related work**: `python scripts/semantic_scholar.py references arXiv:ID --limit 20`
6. **Track authors**: `python scripts/semantic_scholar.py author NAME`

## Rate Limits

| API | Rate | Auth |
|-----|------|------|
| arXiv | ~1 req / 3 seconds | None needed |
| Semantic Scholar | 1 req / second | None |

## Notes

- arXiv returns Atom XML — always use the helper script to avoid XML parsing issues.
- Semantic Scholar returns JSON — always use the helper script for readability.
- arXiv IDs: old format (`hep-th/0601001`) vs new (`2402.03300`)
- PDF: `https://arxiv.org/pdf/{id}` — Abstract: `https://arxiv.org/abs/{id}`
- For local PDF processing, see the `ocr-and-documents` skill
