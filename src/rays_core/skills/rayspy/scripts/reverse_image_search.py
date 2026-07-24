import urllib.request
import urllib.parse
import re
import json

def search_image(image_url: str) -> list[dict]:
    """Perform a reverse image search and return a list of discovered leads."""
    # Yandex uses cbir_id, but rpt=imageview is easiest
    yandex_url = f'https://yandex.com/images/search?rpt=imageview&url={urllib.parse.quote(image_url)}'
    
    leads = []
    try:
        req = urllib.request.Request(yandex_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='replace')
            
        # Extract URLs from CbirSites (JSON is HTML escaped inside data-state)
        matches = re.findall(r'&quot;url&quot;:&quot;(http[^&]+)&quot;', html)
        seen = set()
        
        for u in matches:
            if "yandex" in u or "w3.org" in u or "yastatic" in u or u in seen:
                continue
            seen.add(u)
            
            domain = u.split("/")[2] if "://" in u else u
            platform = domain.split(".")[-2] if "." in domain else domain
            
            leads.append({
                "url": u,
                "platform": platform,
                "handle": None,
            })
            
            if len(leads) >= 20:
                break
                
    except Exception as e:
        print(f"Reverse image search failed: {e}")
        
    return leads

if __name__ == "__main__":
    leads = search_image("https://upload.wikimedia.org/wikipedia/commons/a/a8/Bill_Gates_2017_%28cropped%29.jpg")
    for lead in leads:
        print(lead)
