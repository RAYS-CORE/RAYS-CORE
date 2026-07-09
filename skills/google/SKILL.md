---
name: google
description: "Search the web using DuckDuckGo to answer user queries."
---
# DuckDuckGo Search

Use the `run_command` tool to search DuckDuckGo via python.

Example:
```json
{
  "name": "run_command",
  "arguments": {
    "command": "python3 -c \"import urllib.request, urllib.parse, json; req = urllib.request.Request('https://html.duckduckgo.com/html/?q=' + urllib.parse.quote('YOUR QUERY HERE'), headers={'User-Agent': 'Mozilla/5.0'}); html = urllib.request.urlopen(req).read().decode('utf-8'); import re; text = re.sub('<[^<]+>', ' ', html); print(text[:4000])\""
  }
}
```
After you get the results, set `status: "completed"` and put the answer in your `exit_message`.
