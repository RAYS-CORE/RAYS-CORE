---
name: duckduckgo
description: "Search the web using DuckDuckGo to answer user queries."
---
# DuckDuckGo Search

Use the `run_command` tool to search DuckDuckGo via python.

Example:
```json
{
  "name": "run_command",
  "arguments": {
    "command": "python3 -c \"import urllib.request, urllib.parse, re, ssl; ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE; req = urllib.request.Request('https://html.duckduckgo.com/html/?q=' + urllib.parse.quote('YOUR QUERY HERE'), headers={'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'}); html = urllib.request.urlopen(req, context=ctx).read().decode('utf-8'); snippets = re.findall(r'class=\\\"result__snippet[^>]*>(.*?)</a>', html, re.IGNORECASE | re.DOTALL); print('\\n'.join(re.sub('<[^<]+>', '', s).strip() for s in snippets[:5]))\""
  }
}
```
After you get the results, set `status: "completed"` and put the answer in your `exit_message`.
