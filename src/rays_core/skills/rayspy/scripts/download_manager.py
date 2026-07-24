"""Download Manager — SHA256-deduped download cache.

Every downloaded image is hashed (SHA256) before saving.
If the hash already exists in the cache, the existing path is returned.
This prevents duplicate downloads and duplicate file storage.

Usage:
    dm = DownloadManager(cache_dir="~/face_cache")
    path = dm.download("https://example.com/photo.jpg")
    # returns Path to cached file
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

CACHE_DIR = os.path.join(tempfile.gettempdir(), "raySpy_face_cache")


class DownloadManager:
    """Persistent download cache keyed by SHA256 of file content."""

    def __init__(self, cache_dir: str = CACHE_DIR):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._manifest_path = self.cache_dir / "manifest.json"
        self._manifest: dict[str, str] = {}  # sha256 -> local_path
        self._url_index: dict[str, str] = {}  # url -> sha256
        self._load_manifest()

    def _load_manifest(self):
        if self._manifest_path.exists():
            try:
                data = json.loads(self._manifest_path.read_text())
                self._manifest = data.get("sha_index", {})
                self._url_index = data.get("url_index", {})
            except (json.JSONDecodeError, KeyError):
                pass

    def _save_manifest(self):
        self._manifest_path.write_text(json.dumps({
            "sha_index": self._manifest,
            "url_index": self._url_index,
        }, indent=2))

    def _sha256(self, data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    def _fetch_bytes(self, url: str, timeout: int = 20) -> Optional[bytes]:
        if url.startswith(("file://",)):
            p = Path(url[7:])
            if p.exists():
                return p.read_bytes()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except Exception:
            return None

    def download(self, url: str, timeout: int = 20) -> Optional[Path]:
        """Download URL and return cached Path, or None on failure.

        If the same URL was downloaded before, returns the cached path.
        If a different URL produces the same SHA256, returns the cached path.
        """
        # Check URL cache first
        if url in self._url_index:
            sha = self._url_index[url]
            if sha in self._manifest:
                p = Path(self._manifest[sha])
                if p.exists():
                    return p

        data = self._fetch_bytes(url, timeout)
        if not data:
            return None

        sha = self._sha256(data)

        # Check SHA256 cache
        if sha in self._manifest:
            p = Path(self._manifest[sha])
            if p.exists():
                self._url_index[url] = sha
                self._save_manifest()
                return p

        # Save to new file
        ext = ".jpg"
        if url.lower().endswith((".png",)):
            ext = ".png"
        elif url.lower().endswith((".gif",)):
            ext = ".gif"
        elif url.lower().endswith((".webp",)):
            ext = ".webp"

        fname = f"{sha[:16]}{ext}"
        dest = self.cache_dir / fname
        try:
            dest.write_bytes(data)
        except Exception:
            return None

        self._manifest[sha] = str(dest)
        self._url_index[url] = sha
        self._save_manifest()
        return dest

    def get_cached_path(self, url: str) -> Optional[Path]:
        """Return cached path if URL was already downloaded."""
        if url in self._url_index:
            sha = self._url_index[url]
            if sha in self._manifest:
                p = Path(self._manifest[sha])
                if p.exists():
                    return p
        return None

    def contains_sha(self, sha: str) -> bool:
        return sha in self._manifest

    def get_path_by_sha(self, sha: str) -> Optional[Path]:
        if sha in self._manifest:
            p = Path(self._manifest[sha])
            return p if p.exists() else None
        return None

    def clear(self):
        shutil.rmtree(self.cache_dir, ignore_errors=True)
        self._manifest.clear()
        self._url_index.clear()
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._save_manifest()

    def stats(self) -> dict:
        return {
            "cache_dir": str(self.cache_dir),
            "cached_files": len(self._manifest),
            "cached_urls": len(self._url_index),
            "disk_usage_bytes": sum(
                f.stat().st_size for f in self.cache_dir.iterdir() if f.is_file()
            ) if self.cache_dir.exists() else 0,
        }


# Global singleton for convenience
_global_dm: Optional[DownloadManager] = None


def get_global() -> DownloadManager:
    global _global_dm
    if _global_dm is None:
        _global_dm = DownloadManager()
    return _global_dm
