import urllib.request
import json
import os
import platform
import zipfile
import tarfile

def download_latest_release(repo: str, target_dir: str, binary_names: list[str], asset_keywords: list[str], exclude_keywords: list[str] = None):
    if exclude_keywords is None:
        exclude_keywords = []
        
    api_url = f"https://api.github.com/repos/{repo}/releases/latest"
    print(f"[{repo}] Querying latest release from {api_url}")
    req = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
    except Exception as e:
        print(f"[{repo}] Failed to fetch release info: {e}")
        return False
        
    assets = data.get('assets', [])
    target_asset = None
    for asset in assets:
        name = asset['name'].lower()
        if all(kw in name for kw in asset_keywords) and not any(ex in name for ex in exclude_keywords):
            target_asset = asset
            break
            
    if not target_asset:
        print(f"[{repo}] No matching asset found for {asset_keywords}")
        return False
        
    download_url = target_asset['browser_download_url']
    asset_name = target_asset['name']
    download_path = os.path.join(target_dir, asset_name)
    
    print(f"[{repo}] Downloading {asset_name}...")
    try:
        urllib.request.urlretrieve(download_url, download_path)
    except Exception as e:
        print(f"[{repo}] Download failed: {e}")
        return False
        
    print(f"[{repo}] Extracting {asset_name}...")
    try:
        if asset_name.endswith(".zip"):
            with zipfile.ZipFile(download_path, 'r') as zip_ref:
                zip_ref.extractall(target_dir)
        elif asset_name.endswith(".tar.gz") or asset_name.endswith(".tgz"):
            with tarfile.open(download_path, 'r:gz') as tar_ref:
                tar_ref.extractall(target_dir)
    except Exception as e:
        print(f"[{repo}] Extraction failed: {e}")
        return False
    finally:
        if os.path.exists(download_path):
            os.remove(download_path)
            
    # Find the extracted binary and move it to the expected path
    extracted_bin = None
    target_binary_name = binary_names[0] # the preferred name
    for root, dirs, files in os.walk(target_dir):
        for name in binary_names:
            if name in files:
                extracted_bin = os.path.join(root, name)
                target_binary_name = name
                break
        if extracted_bin:
            break
            
    if extracted_bin:
        # We rename it to the primary preferred name so the rest of the code is predictable
        final_path = os.path.join(target_dir, binary_names[0])
        if extracted_bin != final_path:
            os.rename(extracted_bin, final_path)
        if platform.system() != "Windows":
            os.chmod(final_path, 0o755)
        print(f"[{repo}] Successfully installed {binary_names[0]}")
        return True
    else:
        print(f"[{repo}] Could not find any of {binary_names} in the extracted files.")
        return False
