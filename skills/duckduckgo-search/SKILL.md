---
name: duckduckgo-search
description: Free web search via DuckDuckGo — text, news, images, videos. No API key needed.
version: 1.5.0
author: gamedevCloudy
license: MIT
platforms: [linux, macos, windows]
metadata:
  rays-core:
    tags: [search, duckduckgo, web-search, free, fallback]
    related_skills: [arxiv]
    fallback_for_toolsets: [web]
---

# DuckDuckGo Search

Free web search using DuckDuckGo. **No API key required.**

## MANDATORY COMPLETION RULE

**THE MOMENT you run a search and get ANY results (even partial), you MUST set status `completed` in the SAME turn and put the answer in `exit_message`. DO NOT run more searches. DO NOT re-check the CLI. Just complete immediately.**

## EXACT STEPS — FOLLOW IN ORDER, NO DEVIATIONS

**Turn 1:** Check CLI:
```
python -c "import shutil; print('DDGS_CLI=installed' if shutil.which('ddgs') else 'DDGS_CLI=missing')"
```

**Turn 2:** If installed, run search. Use this EXACT format (double quotes, no -o flag):
```
ddgs text -q "your search query here" -m 5
```

**Turn 3:** You have results now. Immediately set status `completed` and put the answer in `exit_message`. STOP. DO NOT run another search.

## WINDOWS COMMAND RULES (CRITICAL)

- Use `"double quotes"` for the `-q` argument. NEVER `'single quotes'` — single quotes don't work on Windows.
- NEVER add `-o json` or `-o csv`. These flags write to a file and produce no stdout.
- The search output appears directly in stdout — just read it.

## Example (copy this exactly):

Turn 1 tool call:
```json
{
  "status": "running",
  "thought": "Checking if ddgs CLI is installed",
  "tool_call": {"name": "run_shell_command", "arguments": {"command": "python -c \"import shutil; print('DDGS_CLI=installed' if shutil.which('ddgs') else 'DDGS_CLI=missing')\""}}
}
```

Turn 2 tool call (after confirming DDGS_CLI=installed):
```json
{
  "status": "running",
  "thought": "Searching DuckDuckGo",
  "tool_call": {"name": "run_shell_command", "arguments": {"command": "ddgs text -q \"most recent Super Bowl winner\" -m 5"}}
}
```

Turn 3 — after seeing results — COMPLETE IMMEDIATELY:
```json
{
  "status": "completed",
  "thought": "Got search results, answering now",
  "tool_call": null,
  "exit_message": "The most recent Super Bowl winner is [ANSWER FROM RESULTS]"
}
```

## If DDGS_CLI=missing

Install it first, then search:
```
pip install ddgs
```
Then continue from Turn 2 above.

## Other Search Commands

```
ddgs news -q "your query" -m 5
ddgs images -q "your query" -m 5
```

## Pitfalls

- NEVER use `-o json` — it writes to a file, no stdout
- NEVER use single quotes on Windows
- COMPLETE AFTER FIRST SUCCESSFUL SEARCH — do not loop
