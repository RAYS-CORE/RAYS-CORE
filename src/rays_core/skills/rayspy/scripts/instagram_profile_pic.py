"""Use Playwright/Chromium to extract Instagram profile picture."""
import sys, os, json, time

os.chdir(os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright

USERNAME = "samreedh"
PROFILE_URL = f"https://www.instagram.com/{USERNAME}/"

profile_pic_url = None

with sync_playwright() as p:
    # Launch Chromium
    browser = p.chromium.launch(
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
        ]
    )
    
    context = browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1280, "height": 800},
        locale="en-US",
        timezone_id="America/New_York",
    )
    
    page = context.new_page()
    page.set_default_timeout(30000)
    
    print(f"Navigating to {PROFILE_URL}...", flush=True)
    
    try:
        page.goto(PROFILE_URL, wait_until="domcontentloaded", timeout=30000)
        time.sleep(3)  # Let JS render
        
        # Try to extract profile picture from rendered HTML
        html = page.content()
        print(f"Page loaded, HTML length: {len(html)}", flush=True)
        
        # Method 1: Look for og:image meta tag
        og_image = page.query_selector('meta[property="og:image"]')
        if og_image:
            content = og_image.get_attribute("content")
            if content and "cdninstagram" in content.lower():
                profile_pic_url = content
                print(f"Method 1 (og:image): {profile_pic_url}", flush=True)
        
        # Method 2: Look for img with specific Instagram profile pic selectors
        if not profile_pic_url:
            for sel in [
                'img[alt*="profile picture"]',
                'img[alt*="profile photo"]',
                'img[data-testid="user-avatar"]',
                'header img',
                'section img',
                'img[src*="cdninstagram"]',
                'img[src*="fbcdn"]',
            ]:
                try:
                    el = page.query_selector(sel)
                    if el:
                        src = el.get_attribute("src")
                        if src and "cdninstagram" in src.lower():
                            profile_pic_url = src
                            print(f"Method 2 ({sel}): {profile_pic_url}", flush=True)
                            break
                except Exception:
                    pass
        
        # Method 3: Search page source for profile_pic_url
        if not profile_pic_url:
            import re
            for m in re.finditer(r'"profile_pic_url_hd"\s*:\s*"([^"]+)"', html):
                url = m.group(1).replace('\\u0026', '&').replace('\\\\/', '/')
                if url.startswith("http"):
                    profile_pic_url = url
                    print(f"Method 3a (profile_pic_url_hd): {profile_pic_url[:150]}", flush=True)
                    break
            if not profile_pic_url:
                for m in re.finditer(r'"profile_pic_url"\s*:\s*"([^"]+)"', html):
                    url = m.group(1).replace('\\u0026', '&').replace('\\\\/', '/')
                    if url.startswith("http"):
                        profile_pic_url = url
                        print(f"Method 3b (profile_pic_url): {profile_pic_url[:150]}", flush=True)
                        break
        
        # Method 4: Screenshot and find image regions
        if not profile_pic_url:
            screenshot_path = "ig_screenshot.png"
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"Screenshot saved: {screenshot_path}", flush=True)
            
            # Try to download the profile pic from Instagram's CDN
            # Look for any img tag with a cdninstagram URL
            all_imgs = page.query_selector_all('img[src*="cdninstagram"]')
            for img in all_imgs:
                src = img.get_attribute("src")
                if src and src not in ("https://static.cdninstagram.com/rsrc.php/y4/r/QaBlI0OZiks.ico",):
                    profile_pic_url = src
                    print(f"Method 4 (img src): {profile_pic_url[:150]}", flush=True)
                    break
        
        # Method 5: Try API through browser with cookies
        if not profile_pic_url:
            try:
                page.goto(f"{PROFILE_URL}?__a=1", wait_until="domcontentloaded", timeout=15000)
                pre = page.query_selector("pre")
                if pre:
                    text = pre.inner_text()
                    if "profile_pic" in text:
                        data = json.loads(text)
                        ppu = data.get("graphql", {}).get("user", {}).get("profile_pic_url_hd")
                        if ppu:
                            profile_pic_url = ppu
                            print(f"Method 5 (API): {profile_pic_url}", flush=True)
            except Exception:
                pass
        
        # Method 6: Try mobile viewport
        if not profile_pic_url:
            try:
                mobile_context = browser.new_context(
                    user_agent="Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
                    viewport={"width": 390, "height": 844},
                    locale="en-US",
                )
                mobile_page = mobile_context.new_page()
                mobile_page.set_default_timeout(20000)
                mobile_page.goto(f"https://i.instagram.com/api/v1/users/web_profile_info/?username={USERNAME}", wait_until="domcontentloaded", timeout=15000)
                pre = mobile_page.query_selector("pre")
                if pre:
                    text = pre.inner_text()
                    data = json.loads(text)
                    user = data.get("data", {}).get("user", {})
                    ppu = user.get("hd_profile_pic_url_info", {}).get("url") or user.get("profile_pic_url")
                    if ppu:
                        profile_pic_url = ppu
                        print(f"Method 6 (mobile API): {profile_pic_url}", flush=True)
                mobile_context.close()
            except Exception:
                pass
    
    except Exception as e:
        print(f"Error during navigation: {e}", flush=True)
    
    # If we found a URL, download it
    if profile_pic_url:
        import urllib.request
        local_path = os.path.join(os.path.dirname(__file__), "instagram_samreedh_profile.jpg")
        req = urllib.request.Request(
            profile_pic_url,
            headers={"User-Agent": "Mozilla/5.0"}
        )
        try:
            resp = urllib.request.urlopen(req, timeout=15)
            with open(local_path, "wb") as f:
                f.write(resp.read())
            print(f"Downloaded profile pic to {local_path}", flush=True)
        except Exception as e:
            print(f"Download error: {e}", flush=True)
    else:
        print("No Instagram profile picture URL found.", flush=True)
        # List all img tags on the page for debugging
        all_imgs = page.query_selector_all("img")
        print(f"Total img tags found: {len(all_imgs)}", flush=True)
        for img in all_imgs[:20]:
            alt = img.get_attribute("alt") or ""
            src = img.get_attribute("src") or ""
            if src:
                print(f"  img alt='{alt[:50]}' src='{src[:120]}'", flush=True)
    
    context.close()
    browser.close()

print(f"\nProfile pic URL: {profile_pic_url}", flush=True)
