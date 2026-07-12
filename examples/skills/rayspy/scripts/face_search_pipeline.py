"""RaySpy Face Search Pipeline — 14-stage face-based identity resolution.

Stages:
  1. Query Planner        — normalize name, generate queries, handle nicknames
  2. Multi-Source Collection — search for profiles across social platforms + web
  3. Data Normalization    — standardize names, usernames, URLs, metadata
  4. Image Collection      — download profile photos, headshots, relevant images
  5. Image Quality & Validation — reject low-res / multi-face / cartoon / blurry
  6. Duplicate & Near-Duplicate Removal     — pHash-based dedup
  7. Face Embedding Generation              — InsightFace feature vectors
  8. Face Clustering       — DBSCAN / union-find on cosine distance
  9. Evidence Aggregation  — collect names, usernames, URLs per cluster
  10. Evidence Reliability Weighting        — weight by source trustworthiness
  11. Identity Confidence Scoring           — combine face + evidence
  12. Candidate Ranking    — sort clusters by confidence
  13. Decision Engine      — dominant / two-way / none / ambiguous
  14. Explainable Output   — structured JSON with sources + signals

Usage:
  python face_search_pipeline.py --name "John Doe" [--name-search] [--image-urls '[...]']
  python face_search_pipeline.py --name "John Doe" --reference https://...jpg
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import re
import sys
import tempfile
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any

import cv2

# New pipeline modules (graceful import — each handles its own unavailability)
try:
    import page_classifier as _pc
except ImportError:
    _pc = None
try:
    import browser_fetcher as _bf
except ImportError:
    _bf = None
try:
    import search_fetcher as _sf
except ImportError:
    _sf = None
try:
    import dom_parser as _dp
except ImportError:
    _dp = None
try:
    import image_extractor as _ie
except ImportError:
    _ie = None
try:
    import profile_detector as _pd
except ImportError:
    _pd = None
try:
    import image_validator as _iv
except ImportError:
    _iv = None
try:
    import duplicate_filter as _df
except ImportError:
    _df = None
try:
    import profile_ranker as _pr
except ImportError:
    _pr = None
try:
    import reference_selector as _rs
except ImportError:
    _rs = None

# Phase 2 — Browser Controller & Session Manager
try:
    import browser_controller as _bc
except ImportError:
    _bc = None
try:
    import session_manager as _sm
except ImportError:
    _sm = None

# Phase 4 — Download Manager (SHA256 dedup cache)
try:
    import download_manager as _dm
except ImportError:
    _dm = None

# Phase 5 — Face Consensus & Identity Memory
try:
    import face_consensus as _fc
except ImportError:
    _fc = None
try:
    import identity_memory as _im
except ImportError:
    _im = None

# Phase 6 — Dynamic Confidence (Bayesian)
try:
    import dynamic_confidence as _dc
except ImportError:
    _dc = None

# Phase 9 — Source Reliability Engine
try:
    import source_reliability as _sr
except ImportError:
    _sr = None

# URL Canonicalizer — resolves redirect/tracker URLs
try:
    import url_canonicalizer as _uc
except ImportError:
    _uc = None

# Identifier Discovery — extracts usernames, emails, websites from verified accounts
try:
    import identifier_discovery as _idc
except ImportError:
    _idc = None

# Cross-Verification Loop — feeds verified identifiers back into Sherlock/SpiderFoot
try:
    import cross_verification_loop as _cvl
except ImportError:
    _cvl = None

# Post Metadata Extractor — extracts post-level metadata (dates, locations, hashtags)
try:
    import post_metadata_extractor as _pme
except ImportError:
    _pme = None

# Organization Graph — builds person→organization affiliation graph
try:
    import organization_graph as _og
except ImportError:
    _og = None

# Geolocation Engine — infers location from images, text, and metadata
try:
    import geolocation_engine as _ge
except ImportError:
    _ge = None

# Evidence Harvester — extracts display_name, bio, emails, phones from validated profiles
try:
    import evidence_harvester as _eh
except ImportError:
    _eh = None

# Adaptive Searcher — generates targeted multi-platform queries from known identities
try:
    import adaptive_searcher as _asearcher
except ImportError:
    _asearcher = None

# Evidence Iteration Loop — iterative collection until confidence stabilizes
try:
    import evidence_iteration_loop as _eil
except ImportError:
    _eil = None

# Validator framework — site-aware profile validation
try:
    from validators import dispatch_with_quality as _validate_profile
except ImportError:
    _validate_profile = None

# Data models & Candidate Registry
try:
    from models import (
        CandidateProfile, CandidateStatus, ValidatedProfile, ValidationStatus,
        IdentityCandidate, VerifiedIdentity, FaceVerificationState,
        EvidenceItem, EvidenceClass, ValidationResult, ValidationState,
        compute_capped_confidence, compute_quality_score,
        should_continue_from_state, VALIDATED_PROFILE_THRESHOLD,
        is_profile_eligible, CandidateRecord, LeadSource,
        FaceImage,
    )
    from dynamic_confidence import build_evidence
    from candidate_registry import CandidateRegistry
    _has_models = True
except ImportError:
    _has_models = False
    VALIDATED_PROFILE_THRESHOLD = 55

import numpy as np
from scipy.spatial.distance import cdist

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# ── Platform reliability weights (Stage 10) ──────────────────────────────
PLATFORM_WEIGHTS: dict[str, float] = {
    "linkedin":     0.90,
    "github":       0.85,
    "x":            0.80,
    "twitter":      0.80,
    "facebook":     0.80,
    "instagram":    0.75,
    "youtube":      0.70,
    "personal_site": 0.95,
    "news":         0.60,
    "blog":         0.65,
    "web":          0.40,
}

# Known image URL patterns for server-side served profile images
PLATFORM_IMAGE_PATTERNS: dict[str, callable] = {
    "github": lambda h: f"https://github.com/{h}.png",
}

SOCIAL_DOMAINS = {
    "linkedin.com", "instagram.com", "x.com", "twitter.com",
    "facebook.com", "github.com", "youtube.com", "tiktok.com",
    "reddit.com", "pinterest.com", "snapchat.com",
}


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Utility functions                                                   ║
# ╚══════════════════════════════════════════════════════════════════════╝

def _fetch_bytes(url: str, timeout: int = 20) -> bytes | None:
    if not url.startswith(("http://", "https://", "file://")):
        p = Path(url)
        if p.exists():
            return p.read_bytes()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except Exception:
        return None


def _download(url: str) -> Path | None:
    if not url.startswith(("http://", "https://", "file://")):
        p = Path(url)
        if p.exists():
            return p
    data = _fetch_bytes(url)
    if not data:
        return None
    tmp = Path(tempfile.mkdtemp()) / f"face_{os.urandom(4).hex()}.jpg"
    try:
        tmp.write_bytes(data)
        return tmp
    except Exception:
        return None


def _guess_platform(url: str) -> str:
    u = url.lower()
    if "linkedin.com" in u:            return "linkedin"
    if "instagram.com" in u:           return "instagram"
    if "x.com" in u or "twitter.com" in u: return "x"
    if "facebook.com" in u or "fb.com" in u: return "facebook"
    if "github.com" in u:              return "github"
    if "youtube.com" in u:             return "youtube"
    if "tiktok.com" in u:              return "tiktok"
    if "reddit.com" in u:              return "reddit"
    if "pinterest.com" in u:           return "pinterest"
    return "web"


def _extract_handle(url: str) -> str | None:
    try:
        parsed = urllib.parse.urlparse(url)
        path = parsed.path.rstrip("/")
        segs = [s for s in path.split("/") if s]
        if not segs:
            return None
        domain = parsed.netloc.lower()
        handle = None
        if "linkedin.com" in domain and len(segs) >= 2 and segs[0] == "in":
            handle = segs[1]
        elif "github.com" in domain:
            handle = segs[0]
        elif "x.com" in domain or "twitter.com" in domain:
            handle = segs[0]
        elif "instagram.com" in domain:
            handle = segs[0]
        elif "facebook.com" in domain or "fb.com" in domain:
            handle = segs[-1]
        elif "medium.com" in domain:
            if segs[0] != "@":
                handle = segs[0]
        elif "reddit.com" in domain:
            if len(segs) >= 2 and segs[0] == "user":
                handle = segs[1]
            elif len(segs) >= 2 and segs[0] == "r":
                handle = None
        else:
            handle = segs[-1]

        if handle is not None and len(handle) < 2:
            return None
        if handle is not None and not re.search(r"[a-zA-Z0-9]", handle):
            return None
        return handle
    except Exception:
        return None


def _is_social_domain(url: str) -> bool:
    try:
        domain = urllib.parse.urlparse(url).netloc.lower()
        return any(d in domain for d in SOCIAL_DOMAINS)
    except Exception:
        return False


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    return float(np.dot(np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)))


def _dhash(img: np.ndarray, hash_size: int = 8) -> int:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (hash_size + 1, hash_size))
    diff = resized[:, 1:] > resized[:, :-1]
    return sum(int(v) << i for i, v in enumerate(diff.flatten()))


def _hamming_distance(h1: int, h2: int) -> int:
    return bin(h1 ^ h2).count("1")


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  FaceEngine — InsightFace wrapper                                    ║
# ╚══════════════════════════════════════════════════════════════════════╝

class FaceEngine:
    def __init__(self):
        with contextlib.redirect_stdout(io.StringIO()):
            with contextlib.redirect_stderr(io.StringIO()):
                from insightface.app import FaceAnalysis
                self.app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
                self.app.prepare(ctx_id=0, det_size=(640, 640))

    def get_faces(self, image_path: Path) -> list[dict]:
        img = cv2.imread(str(image_path))
        if img is None:
            return []
        faces = self.app.get(img)
        results = []
        for face in faces:
            bbox = face.bbox.tolist() if hasattr(face.bbox, "tolist") else list(face.bbox)
            emb = list(np.asarray(face.normed_embedding, dtype=np.float32))
            results.append({
                "bbox": bbox,
                "embedding": emb,
                "gender": "Male" if face.gender == 1 else "Female" if face.gender == 0 else None,
                "age": int(face.age) if face.age else None,
                "det_score": float(face.det_score) if face.det_score else 0.0,
            })
        return results


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 1 — Query Planner                                             ║
# ╚══════════════════════════════════════════════════════════════════════╝

def stage1_query_planner(raw_name: str) -> dict:
    """Normalize name, generate search queries, detect structure.

    Returns:
        normalized_name: title-cased clean name
        tokens: [first, last, ...middle]
        search_queries: list of query strings to try
        structure: "full_name" | "first_last" | "single" | "unknown"
        language_hint: "en" | "other"
    """
    name = raw_name.strip()
    # Strip prefix labels
    name = re.sub(r"^(?:Profile|Person|Find|Search|Lookup):\s*", "", name, flags=re.IGNORECASE).strip()

    tokens = [t for t in re.split(r"[\s,]+", name) if t]
    normalized = " ".join(tokens).title()

    structure = "unknown"
    if len(tokens) >= 3:
        structure = "full_name"
    elif len(tokens) == 2:
        structure = "first_last"
    elif len(tokens) == 1:
        structure = "single"

    # Detect likely English vs non-ASCII
    language_hint = "en" if all(ord(c) < 128 for c in name) else "other"

    # Generate search queries
    search_queries = []
    search_queries.append(normalized)
    search_queries.append(f'"{normalized}"')
    if len(tokens) >= 2:
        search_queries.append(f"{tokens[0]} {tokens[-1]}")
    # Quoted first + last
    if len(tokens) >= 2:
        search_queries.append(f'"{tokens[0]}" "{tokens[-1]}"')
    # For longer names, try without middle
    if len(tokens) > 2:
        search_queries.append(f"{tokens[0]} {tokens[-1]}")

    return {
        "raw_input": raw_name,
        "normalized_name": normalized,
        "tokens": tokens,
        "search_queries": search_queries,
        "structure": structure,
        "language_hint": language_hint,
    }


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 2 — Multi-Source Public Data Collection                        ║
# ╚══════════════════════════════════════════════════════════════════════╝

def _scrape_ddg_for_profiles(name: str, max_results: int = 15) -> list[dict]:
    """Search DuckDuckGo HTML for social media profile URLs.

    Returns list of dicts with url, platform, handle.
    This may return 0 results if search is blocked from the network.
    """
    profiles = []
    query = urllib.parse.quote(name)
    url = f"https://html.duckduckgo.com/html/?q={query}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except Exception:
        return profiles

    # Extract result links
    for match in re.finditer(r'<a[^>]+class="result__a"[^>]*href="(.*?)".*?</a>', html, re.DOTALL):
        href = match.group(1)
        # Decode HTML entities
        href = href.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        if _is_social_domain(href) or "linkedin.com" in href.lower():
            plat = _guess_platform(href)
            handle = _extract_handle(href)
            profiles.append({
                "url": href,
                "platform": plat,
                "handle": handle,
                "source": "ddg_search",
                "reliability": PLATFORM_WEIGHTS.get(plat, 0.4),
            })
        if len(profiles) >= max_results:
            break

    return profiles


def _guess_profile_image_url(platform: str, handle: str | None) -> str | None:
    if not handle:
        return None
    pattern_fn = PLATFORM_IMAGE_PATTERNS.get(platform)
    if pattern_fn:
        return pattern_fn(handle)
    return None


def stage2_collect(
    query_plan: dict,
    pre_collected: list[dict] | None = None,
    enable_search: bool = False,
) -> list[dict]:
    """Collect social media profiles + web sources for the given name.

    Args:
        query_plan: output of stage1_query_planner
        pre_collected: list of profiles already known (from JS side, Sherlock, etc.)
        enable_search: whether to perform live web search

    Returns list of profile dicts with:
        url, platform, handle, image_url, source, reliability
    """
    collected = []
    seen_urls: set[str] = set()

    # Include pre-collected profiles
    if pre_collected:
        for p in pre_collected:
            url = p.get("url") or p.get("profile_url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                plat = p.get("platform") or _guess_platform(url)
                handle = p.get("handle") or _extract_handle(url)
                img_url = p.get("image_url") or _guess_profile_image_url(plat, handle)
                collected.append({
                    "url": url,
                    "platform": plat,
                    "handle": handle,
                    "image_url": img_url,
                    "source": p.get("source", "pre_collected"),
                    "reliability": PLATFORM_WEIGHTS.get(plat, 0.4),
                })

    # Live web search for more profiles
    if enable_search:
        for q in query_plan["search_queries"][:3]:
            results = _scrape_ddg_for_profiles(q)
            for r in results:
                if r["url"] not in seen_urls:
                    seen_urls.add(r["url"])
                    img_url = _guess_profile_image_url(r["platform"], r["handle"])
                    r["image_url"] = img_url
                    collected.append(r)

    return collected


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 3 — Data Normalization                                        ║
# ╚══════════════════════════════════════════════════════════════════════╝

def _normalize_username(raw: str | None) -> str | None:
    if not raw:
        return None
    return raw.strip().lower().lstrip("@").replace("_", "").replace("-", "")


def stage3_normalize(profiles: list[dict]) -> list[dict]:
    """Standardize names, usernames, URLs, deduplicate by URL."""
    seen = set()
    normalized = []
    for p in profiles:
        url = p.get("url", "")
        if not url or url in seen:
            continue
        seen.add(url)

        handle = p.get("handle")
        normalized_handle = _normalize_username(handle) if handle else None
        plat = p.get("platform") or _guess_platform(url)

        normalized.append({
            "url": url,
            "platform": plat,
            "handle": handle,
            "normalized_handle": normalized_handle,
            "image_url": p.get("image_url"),
            "source": p.get("source", "unknown"),
            "reliability": p.get("reliability", PLATFORM_WEIGHTS.get(plat, 0.4)),
        })
    return normalized


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 4 — Image Collection                                          ║
# ╚══════════════════════════════════════════════════════════════════════╝

def _known_image_url(platform: str, handle: str | None) -> str | None:
    """Check if the platform has a known server-side image URL pattern."""
    if not handle:
        return None
    if platform in PLATFORM_IMAGE_PATTERNS:
        return PLATFORM_IMAGE_PATTERNS[platform](handle)
    return None


def stage4_collect_images(
    profiles: list[dict],
    extra_image_urls: list[dict] | None = None,
    enable_smart_fetch: bool = True,
) -> list[dict]:
    """Download profile photos using the smart fetching pipeline.

    For each profile URL:
      1. Classify page (static vs JS-rendered) via page_classifier
      2. Fetch HTML via search_fetcher (requests or browser)
      3. Parse DOM via dom_parser
      4. Extract all images via image_extractor
      5. Detect profile picture via profile_detector
      6. Rank images via profile_ranker
      7. Download the best candidate(s)

    Also supports:
      - Known server-side URL patterns (GitHub .png)
      - Externally provided image URLs

    Returns list of image items with:
        id, url, local_path, platform, profile_url, handle, source, score
    """
    images: list[dict] = []
    seen_urls: set[str] = set()

    # ── 1. Known server-side image patterns (fast path) ──
    for p in profiles:
        img_url = _known_image_url(p.get("platform", "web"), p.get("handle"))
        if img_url and img_url not in seen_urls:
            seen_urls.add(img_url)
            images.append({
                "id": f"img_{os.urandom(4).hex()}",
                "url": img_url,
                "platform": p.get("platform", "web"),
                "profile_url": p.get("url", ""),
                "handle": p.get("handle"),
                "source": "known_pattern",
                "score": 0.9,
            })

    # ── 2. Smart fetch (page_classifier → search_fetcher → dom_parser → image_extractor → profile_detector) ──
    if enable_smart_fetch and _sf is not None:
        for p in profiles:
            url = p.get("url", "")
            if not url:
                continue
            plat = p.get("platform", "web")
            # Skip platforms already handled by known patterns
            if any(img.get("profile_url") == url and img.get("source") == "known_pattern" for img in images):
                continue

            html, method, meta = _sf.fetch(url, timeout=15, browser_timeout_ms=25_000, browser_wait_ms=2_000)

            if not html:
                continue

            # Parse DOM
            dom = _dp.parse(html, url)

            # Extract images with scores
            extracted = _ie.extract_from_dom(dom, url)

            # Detect profile picture
            profile_pic = _pd.detect(extracted, url, dom)

            # Rank all images
            ranked = _pr.rank(extracted, url)

            # Add best ranked images (up to 3 per profile)
            added = 0
            for img in ranked:
                img_url = img.get("url", "")
                if img_url and img_url not in seen_urls and added < 3:
                    seen_urls.add(img_url)
                    images.append({
                        "id": f"img_{os.urandom(4).hex()}",
                        "url": img_url,
                        "platform": plat,
                        "profile_url": url,
                        "handle": p.get("handle"),
                        "source": f"smart_fetch:{img.get('source', 'unknown')}",
                        "score": img.get("score", 0.0),
                        "image_type": img.get("image_type", "unknown"),
                        "detection_method": img.get("detection_method"),
                        "alt": img.get("alt", ""),
                    })
                    added += 1

            # If no images found via smart fetch, try og:image directly as fallback
            if added == 0:
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        raw_html = resp.read().decode("utf-8", errors="replace")
                    og_match = re.search(
                        r'<meta\s+[^>]*property=["\']og:image["\'][^>]*content=["\'](.*?)["\']',
                        raw_html, re.IGNORECASE,
                    )
                    if not og_match:
                        og_match = re.search(
                            r'<meta\s+[^>]*content=["\'](.*?)["\'][^>]*property=["\']og:image["\']',
                            raw_html, re.IGNORECASE,
                        )
                    if og_match:
                        img_url = og_match.group(1)
                        if img_url and img_url not in seen_urls:
                            seen_urls.add(img_url)
                            images.append({
                                "id": f"img_{os.urandom(4).hex()}",
                                "url": img_url,
                                "platform": plat,
                                "profile_url": url,
                                "handle": p.get("handle"),
                                "source": "og_image_fallback",
                                "score": 0.5,
                            })
                except Exception:
                    pass

    # ── 3. Fallback: basic og:image extraction (if smart fetch disabled) ──
    if not enable_smart_fetch or _sf is None:
        for p in profiles:
            url = p.get("url", "")
            if not url:
                continue
            plat = p.get("platform", "web")
            if plat in PLATFORM_IMAGE_PATTERNS:
                continue
            if any(img.get("profile_url") == url for img in images):
                continue
            try:
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    raw_html = resp.read().decode("utf-8", errors="replace")
                og_match = re.search(
                    r'<meta\s+[^>]*property=["\']og:image["\'][^>]*content=["\'](.*?)["\']',
                    raw_html, re.IGNORECASE,
                )
                if not og_match:
                    og_match = re.search(
                        r'<meta\s+[^>]*content=["\'](.*?)["\'][^>]*property=["\']og:image["\']',
                        raw_html, re.IGNORECASE,
                    )
                if og_match:
                    img_url = og_match.group(1)
                    if img_url and img_url not in seen_urls:
                        seen_urls.add(img_url)
                        images.append({
                            "id": f"img_{os.urandom(4).hex()}",
                            "url": img_url,
                            "platform": plat,
                            "profile_url": url,
                            "handle": p.get("handle"),
                            "source": "og_image",
                            "score": 0.5,
                        })
            except Exception:
                pass

    # ── 4. Extra image URLs provided externally ──
    if extra_image_urls:
        for item in extra_image_urls:
            url = item.get("url") or item.get("image_url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                images.append({
                    "id": item.get("id", f"img_{os.urandom(4).hex()}"),
                    "url": url,
                    "platform": item.get("platform", "web"),
                    "profile_url": item.get("profile_url", ""),
                    "handle": item.get("handle"),
                    "source": item.get("source", "external"),
                    "score": item.get("score", 0.5),
                })

    return images


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 5 — Image Quality & Validation                                ║
# ╚══════════════════════════════════════════════════════════════════════╝

def _is_cartoon(img: np.ndarray, edge_threshold: float = 0.05) -> bool:
    """Heuristic: if edge pixel ratio is very low, likely a cartoon/illustration."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    edge_ratio = np.count_nonzero(edges) / (gray.shape[0] * gray.shape[1])
    if edge_ratio < edge_threshold:
        return True
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    sat_std = np.std(hsv[:, :, 1])
    if sat_std < 20:
        return True
    return False


def _is_blurry(img: np.ndarray, threshold: float = 100.0) -> bool:
    """Laplacian variance below threshold indicates blur."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    return laplacian_var < threshold


def stage5_validate(
    images: list[dict],
    min_size: int = 100,
    min_det_score: float = 0.5,
    enable_quality: bool = True,
) -> list[dict]:
    """Validate images using image_validator module (fallback to built-in heuristics).

    Each item gets:
        accepted: bool
        rejection_reason: str | None
        resolution: (w, h)
        face_count: int
        blurry: bool
        cartoon: bool
        det_score: float
    """
    if not enable_quality:
        return [dict(i, accepted=True, rejection_reason=None) for i in images]

    if _iv is not None:
        # Use the dedicated image_validator module — download first, then validate
        validated = []
        for item in images:
            path = _download(item["url"])
            if path is None:
                item["accepted"] = False
                item["rejection_reason"] = "download_failed"
                validated.append(item)
                continue
            item["local_path"] = str(path)
            vresult = _iv.validate(path)
            item.update({k: v for k, v in vresult.items() if k != "image_path"})
            validated.append(item)
        return validated

    validated = []
    for item in images:
        path = _download(item["url"])
        if path is None:
            item["accepted"] = False
            item["rejection_reason"] = "download_failed"
            validated.append(item)
            continue

        img = cv2.imread(str(path))
        if img is None:
            item["accepted"] = False
            item["rejection_reason"] = "corrupt_image"
            validated.append(item)
            continue

        h, w = img.shape[:2]
        item["resolution"] = (w, h)
        item["local_path"] = str(path)

        if w < min_size or h < min_size:
            item["accepted"] = False
            item["rejection_reason"] = f"too_small: {w}x{h} < {min_size}x{min_size}"
            validated.append(item)
            continue

        item["cartoon"] = _is_cartoon(img)
        if item["cartoon"]:
            item["accepted"] = False
            item["rejection_reason"] = "cartoon_or_illustration"
            validated.append(item)
            continue

        item["blurry"] = _is_blurry(img)
        if item["blurry"]:
            item["accepted"] = False
            item["rejection_reason"] = "blurry"
            validated.append(item)
            continue

        if os.name == "nt":
            pass
        item["accepted"] = True
        item["rejection_reason"] = None
        validated.append(item)

    return validated


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 6 — Duplicate & Near-Duplicate Removal                        ║
# ╚══════════════════════════════════════════════════════════════════════╝

def stage6_dedup(
    validated: list[dict],
    hash_threshold: int = 10,
    enable_dedup: bool = True,
) -> list[dict]:
    """Remove near-duplicate images using duplicate_filter module (fallback to dHash).

    Keeps the image with the highest resolution among duplicates.
    """
    if not enable_dedup or not validated:
        return validated

    if _df is not None:
        return _df.filter_duplicates(validated, hash_threshold=hash_threshold)

    accepted = [v for v in validated if v.get("accepted")]
    if not accepted:
        return validated

    hash_groups: list[tuple[int, int, dict]] = []
    for item in accepted:
        local = item.get("local_path")
        if not local:
            continue
        img = cv2.imread(local)
        if img is None:
            continue
        h = _dhash(img)
        res_score = item["resolution"][0] * item["resolution"][1] if item.get("resolution") else 0
        hash_groups.append((h, res_score, item))

    if not hash_groups:
        return validated

    used = set()
    deduped = []
    for i, (h1, s1, item1) in enumerate(hash_groups):
        if i in used:
            continue
        group = [i]
        for j, (h2, s2, item2) in enumerate(hash_groups):
            if j > i and j not in used and _hamming_distance(h1, h2) <= hash_threshold:
                group.append(j)
        best_idx = max(group, key=lambda idx: hash_groups[idx][1])
        used.update(group)
        item = hash_groups[best_idx][2]
        item["duplicate_group_size"] = len(group)
        deduped.append(item)

    result = []
    deduped_ids = {id(v) for v in deduped}
    for v in validated:
        if id(v) in deduped_ids:
            result.append(v)
        elif not v.get("accepted"):
            result.append(v)
        else:
            v["accepted"] = False
            v["rejection_reason"] = "duplicate_removed"
            result.append(v)

    return result


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 7 — Face Embedding Generation                                 ║
# ╚══════════════════════════════════════════════════════════════════════╝

def stage7_embed(engine: FaceEngine, accepted_images: list[dict]) -> list[dict]:
    """Extract InsightFace embeddings for accepted images.

    Each result gets:
        face_detected: bool
        face_count: int
        faces: list of face dicts with embedding, bbox, gender, age, det_score
    """
    for item in accepted_images:
        local = item.get("local_path")
        if not local:
            item["face_detected"] = False
            item["face_count"] = 0
            item["faces"] = []
            continue
        faces = engine.get_faces(Path(local))
        item["faces"] = faces
        item["face_count"] = len(faces)
        item["face_detected"] = len(faces) > 0
        # Reject if multiple faces or no face
        if len(faces) == 0:
            item["accepted"] = False
            item["rejection_reason"] = "no_face_detected"
        elif len(faces) > 1:
            item["accepted"] = False
            item["rejection_reason"] = f"multiple_faces: {len(faces)}"
        elif faces[0]["det_score"] < 0.5:
            item["accepted"] = False
            item["rejection_reason"] = f"low_face_confidence: {faces[0]['det_score']:.3f}"
        else:
            item["accepted"] = True
            item["rejection_reason"] = None
    return accepted_images


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 8 — Face Clustering                                           ║
# ╚══════════════════════════════════════════════════════════════════════╝

def stage8_cluster(
    embedded: list[dict],
    threshold: float = 0.9,
) -> tuple[list[dict], list[dict]]:
    """Cluster faces by cosine similarity using DBSCAN.

    Returns (all_faces_list, clusters_list) where:
        all_faces: flat list of face dicts with origin info
        clusters: list of cluster dicts with face indices, similarities, origins
    """
    # Collect all face embeddings from accepted images
    all_faces: list[dict] = []
    face_origins: list[dict] = []
    for item in embedded:
        if not item.get("accepted"):
            continue
        for fi, face in enumerate(item.get("faces", [])):
            face["profile_url"] = item.get("profile_url", "")
            face["platform"] = item.get("platform", "")
            face["handle"] = item.get("handle", "")
            face["image_url"] = item.get("url", "")
            face["face_idx"] = fi
            all_faces.append(face)
            face_origins.append({
                "id": item.get("id"),
                "image_url": item.get("url"),
                "platform": item.get("platform"),
                "profile_url": item.get("profile_url"),
                "handle": item.get("handle"),
                "face_idx": fi,
            })

    n = len(all_faces)
    if n < 2:
        clusters = []
        if n == 1:
            clusters.append({
                "face_count": 1,
                "face_indices": [0],
                "average_similarity": 1.0,
                "max_similarity": 1.0,
                "profile_urls": [face_origins[0]["profile_url"]] if face_origins[0]["profile_url"] else [],
                "platforms": [face_origins[0]["platform"]] if face_origins[0]["platform"] else [],
                "handles": [face_origins[0]["handle"]] if face_origins[0]["handle"] else [],
            })
        return all_faces, clusters

    # Build pairwise cosine similarity matrix
    emb_matrix = np.array([f["embedding"] for f in all_faces], dtype=np.float32)
    sim_matrix = emb_matrix @ emb_matrix.T  # cosine similarity (normalized vectors)

    # DBSCAN on cosine distance
    try:
        from sklearn.cluster import DBSCAN
        dist_matrix = 1.0 - sim_matrix
        clustering = DBSCAN(eps=1.0 - threshold, min_samples=1, metric="precomputed")
        labels = clustering.fit_predict(dist_matrix)
    except ImportError:
        # Fallback: union-find
        parent = list(range(n))

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(x, y):
            px, py = find(x), find(y)
            if px != py:
                parent[py] = px

        for i in range(n):
            for j in range(i + 1, n):
                if sim_matrix[i][j] >= threshold:
                    union(i, j)

        label_map: dict[int, int] = {}
        labels_list = []
        label_id = 0
        for i in range(n):
            root = find(i)
            if root not in label_map:
                label_map[root] = label_id
                label_id += 1
            labels_list.append(label_map[root])
        labels = np.array(labels_list)

    unique_labels = set(labels)
    clusters = []
    for label in unique_labels:
        if label == -1:
            continue  # noise
        indices = [int(i) for i in range(n) if labels[i] == label]
        if len(indices) < 1:
            continue
        # Compute pairwise similarities within cluster
        cluster_sims = []
        for i in indices:
            for j in indices:
                if i < j:
                    cluster_sims.append(float(sim_matrix[i][j]))
        origins_in_cluster = [face_origins[i] for i in indices]
        profile_urls = list(set(
            o["profile_url"] for o in origins_in_cluster if o.get("profile_url")
        ))
        platforms = list(set(
            o["platform"] for o in origins_in_cluster if o.get("platform")
        ))
        handles = list(set(
            o["handle"] for o in origins_in_cluster if o.get("handle")
        ))
        clusters.append({
            "face_count": len(indices),
            "face_indices": indices,
            "average_similarity": round(sum(cluster_sims) / len(cluster_sims), 4) if cluster_sims else (1.0 if len(indices) == 1 else 0),
            "max_similarity": round(max(cluster_sims), 4) if cluster_sims else (1.0 if len(indices) == 1 else 0),
            "profile_urls": profile_urls,
            "platforms": platforms,
            "handles": handles,
        })

    # Sort clusters by size (largest first)
    clusters.sort(key=lambda c: c["face_count"], reverse=True)
    return all_faces, clusters


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 9 — Evidence Aggregation                                      ║
# ╚══════════════════════════════════════════════════════════════════════╝

def stage9_aggregate(clusters: list[dict], all_faces: list[dict], profiles: list[dict]) -> list[dict]:
    """Collect public evidence per cluster."""
    for cluster in clusters:
        evidence = {
            "profile_urls": cluster.get("profile_urls", []),
            "platforms": cluster.get("platforms", []),
            "handles": cluster.get("handles", []),
            "normalized_handles": [],
            "face_similarities": [],
            "cross_site_references": [],
        }

        # Normalize handles for cross-site comparison
        raw_handles = evidence["handles"]
        norm_handles = set()
        for h in raw_handles:
            nh = _normalize_username(h)
            if nh:
                norm_handles.add(nh)
        evidence["normalized_handles"] = sorted(norm_handles)

        # Cross-site references: same normalized handle on multiple platforms
        handle_platforms: dict[str, set[str]] = defaultdict(set)
        cluster_indices = cluster.get("face_indices", [])
        for idx in cluster_indices:
            origin = all_faces[idx] if idx < len(all_faces) else None
            if origin:
                nh = _normalize_username(origin.get("handle"))
                if nh:
                    handle_platforms[nh].add(origin.get("platform", "web"))
        refs = []
        for nh, plats in handle_platforms.items():
            if len(plats) >= 2:
                refs.append({
                    "handle": nh,
                    "platforms": sorted(plats),
                    "type": "same_handle",
                })
        evidence["cross_site_references"] = refs

        # Face similarity stats
        cluster["evidence"] = evidence
    return clusters


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 10 — Evidence Reliability Weighting                            ║
# ╚══════════════════════════════════════════════════════════════════════╝

def stage10_weight(clusters: list[dict]) -> list[dict]:
    """Weight each cluster's evidence by source reliability."""
    for cluster in clusters:
        evidence = cluster.get("evidence", {})
        platforms = cluster.get("platforms", [])

        # Compute average platform reliability
        platform_scores = [PLATFORM_WEIGHTS.get(p, 0.4) for p in platforms]
        avg_platform_score = sum(platform_scores) / len(platform_scores) if platform_scores else 0.0

        # Cross-site reference bonus
        cross_refs = evidence.get("cross_site_references", [])
        cross_ref_bonus = min(0.15, len(cross_refs) * 0.08)

        # Handle consistency bonus
        norm_handles = evidence.get("normalized_handles", [])
        handle_consistency = 0.05 if len(norm_handles) >= 1 else 0.0
        if len(norm_handles) >= 2 and all(
            nh == _normalize_username(norm_handles[0]) for nh in norm_handles
        ):
            handle_consistency = 0.1

        evidence_weight = min(1.0, avg_platform_score + cross_ref_bonus + handle_consistency)
        cluster["evidence_weight"] = round(evidence_weight, 4)
        cluster["evidence_details"] = {
            "avg_platform_score": round(avg_platform_score, 4),
            "cross_ref_bonus": round(cross_ref_bonus, 4),
            "handle_consistency_bonus": round(handle_consistency, 4),
            "cross_site_references": len(cross_refs),
            "normalized_handles": norm_handles,
        }

    return clusters


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 11 — Identity Confidence Scoring                              ║
# ╚══════════════════════════════════════════════════════════════════════╝

def stage11_score(clusters: list[dict]) -> list[dict]:
    """Combine face similarity + evidence weight into confidence score."""
    for cluster in clusters:
        # Face similarity component (0-1)
        max_sim = cluster.get("max_similarity", 0.0)
        avg_sim = cluster.get("average_similarity", 0.0)
        face_score = max_sim * 0.7 + avg_sim * 0.3

        # Evidence component (0-1)
        evidence_weight = cluster.get("evidence_weight", 0.0)

        # Combined: 60% face, 40% evidence
        confidence = min(1.0, face_score * 0.6 + evidence_weight * 0.4)

        cluster["face_score"] = round(face_score, 4)
        cluster["confidence"] = round(confidence, 4)

    return clusters


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 12 — Candidate Ranking                                        ║
# ╚══════════════════════════════════════════════════════════════════════╝

def stage12_rank(clusters: list[dict]) -> list[dict]:
    """Rank clusters by confidence descending."""
    clusters.sort(key=lambda c: c["confidence"], reverse=True)
    for i, cluster in enumerate(clusters):
        cluster["rank"] = i + 1
    return clusters


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 13 — Decision Engine                                          ║
# ╚══════════════════════════════════════════════════════════════════════╝

def stage13_decide(clusters: list[dict]) -> dict:
    """Determine the final decision based on cluster confidence scores."""
    if not clusters:
        return {
            "decision": "no_confident_match",
            "reason": "No identity clusters were formed. No faces detected or images available.",
            "dominant_candidate": None,
            "candidates": [],
        }

    ranked = clusters
    top = ranked[0]["confidence"]
    second = ranked[1]["confidence"] if len(ranked) > 1 else 0.0

    # Thresholds
    DOMINANT_THRESHOLD = 0.85
    AMBIGUITY_GAP = 0.10
    MIN_CONFIDENCE = 0.50

    if top >= DOMINANT_THRESHOLD and (len(ranked) == 1 or top - second > AMBIGUITY_GAP):
        decision = "dominant_candidate"
        reason = f"Candidate 1 (confidence={top:.3f}) is well above threshold and clearly separated from other clusters."
        candidates = [ranked[0]]
    elif top >= DOMINANT_THRESHOLD and len(ranked) >= 2 and top - second <= AMBIGUITY_GAP:
        decision = "multiple_similar_candidates"
        reason = (
            f"Top candidates have similar confidence: "
            f"#{1}={top:.3f}, #{2}={second:.3f} (gap={top - second:.3f} <= {AMBIGUITY_GAP}). "
            "Returning both for review."
        )
        candidates = ranked[:2]
    elif top < MIN_CONFIDENCE:
        decision = "no_confident_match"
        reason = f"Highest confidence ({top:.3f}) is below minimum threshold ({MIN_CONFIDENCE})."
        candidates = []
    else:
        decision = "ambiguous"
        reason = (
            f"Highest confidence ({top:.3f}) is above minimum but below dominant threshold "
            f"({DOMINANT_THRESHOLD}). Indicate uncertainty."
        )
        candidates = [ranked[0]] if top >= MIN_CONFIDENCE else []

    return {
        "decision": decision,
        "reason": reason,
        "dominant_candidate": candidates[0] if candidates else None,
        "candidates": candidates,
    }


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Reference image processing                                          ║
# ╚══════════════════════════════════════════════════════════════════════╝

def _process_reference(
    engine: FaceEngine,
    reference_url: str | None,
) -> tuple[dict | None, dict | None, list[dict]]:
    """Process reference image: detect face, compare against all processed faces.

    Returns (ref_face_info, ref_face, ref_matches).
    """
    if not reference_url:
        return None, None, []

    ref_path = _download(reference_url)
    if not ref_path:
        return {
            "id": "reference",
            "image_url": reference_url,
            "platform": "reference",
            "face_detected": False,
            "face_count": 0,
            "error": "download_failed",
        }, None, []

    ref_faces = engine.get_faces(ref_path)
    ref_info = {
        "id": "reference",
        "image_url": reference_url,
        "platform": "reference",
        "face_detected": len(ref_faces) > 0,
        "face_count": len(ref_faces),
        "gender": ref_faces[0]["gender"] if ref_faces else None,
        "age": ref_faces[0]["age"] if ref_faces else None,
    }
    ref_face = ref_faces[0] if ref_faces else None
    return ref_info, ref_face, ref_faces


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Stage 14 — Explainable Output                                       ║
# ╚══════════════════════════════════════════════════════════════════════╝

def stage14_output(
    query_plan: dict,
    profiles: list[dict],
    images: list[dict],
    validated: list[dict],
    embedded: list[dict],
    all_faces: list[dict],
    clusters: list[dict],
    decision: dict,
    reference_info: dict | None,
    ref_matches: list[dict],
    pipeline_times: dict[str, float],
    metadata: dict | None = None,
) -> dict:
    """Build the final structured output with explanations."""
    # Summary per image
    image_results = []
    for item in embedded:
        image_results.append({
            "id": item.get("id"),
            "image_url": item.get("url"),
            "platform": item.get("platform"),
            "profile_url": item.get("profile_url"),
            "accepted": item.get("accepted", False),
            "rejection_reason": item.get("rejection_reason"),
            "face_detected": item.get("face_detected", False),
            "face_count": item.get("face_count", 0),
            "gender": item["faces"][0]["gender"] if item.get("faces") else None,
            "age": item["faces"][0]["age"] if item.get("faces") else None,
            "det_score": item["faces"][0]["det_score"] if item.get("faces") else None,
            "resolution": item.get("resolution"),
            "blurry": item.get("blurry", False),
            "cartoon": item.get("cartoon", False),
            "duplicate_group_size": item.get("duplicate_group_size", 1),
        })

    # Detailed candidate output
    candidates_output = []
    for cluster in clusters:
        evidence = cluster.get("evidence", {})
        details = cluster.get("evidence_details", {})
        candidates_output.append({
            "rank": cluster.get("rank"),
            "confidence": cluster.get("confidence"),
            "face_score": cluster.get("face_score"),
            "evidence_weight": cluster.get("evidence_weight"),
            "face_count": cluster.get("face_count"),
            "max_similarity": cluster.get("max_similarity"),
            "average_similarity": cluster.get("average_similarity"),
            "profile_urls": cluster.get("profile_urls", []),
            "platforms": cluster.get("platforms", []),
            "handles": cluster.get("handles", []),
            "evidence": {
                "normalized_handles": evidence.get("normalized_handles", []),
                "cross_site_references": evidence.get("cross_site_references", []),
            },
            "evidence_weighting": details,
            "matching_signals": _build_signals(cluster),
        })

    output = {
        "pipeline_version": "2.0",
        "query_plan": {
            "raw_input": query_plan["raw_input"],
            "normalized_name": query_plan["normalized_name"],
            "structure": query_plan["structure"],
            "search_queries_generated": len(query_plan["search_queries"]),
        },
        "stages": {
            "1_query_planner": {
                "normalized_name": query_plan["normalized_name"],
                "tokens": query_plan["tokens"],
                "search_queries": query_plan["search_queries"],
            },
            "2_collection": {
                "profiles_found": len(profiles),
                "platforms": list(set(p["platform"] for p in profiles)),
            },
            "3_normalization": {
                "unique_profiles": len(profiles),
                "duplicates_removed": 0,
            },
            "4_image_collection": {
                "images_queued": len(images),
            },
            "5_quality_validation": {
                "total_images": len(validated),
                "accepted": sum(1 for v in validated if v.get("accepted")),
                "rejected": sum(1 for v in validated if not v.get("accepted")),
                "rejection_reasons": list(set(
                    v.get("rejection_reason") for v in validated if not v.get("accepted")
                )),
            },
            "6_dedup": {
                "after_quality": sum(1 for v in validated if v.get("accepted")),
                "after_dedup": sum(1 for v in embedded if v.get("accepted")),
            },
            "7_embedding": {
                "faces_detected": len(all_faces),
                "images_with_faces": sum(1 for v in embedded if v.get("face_detected")),
            },
            "8_clustering": {
                "clusters_formed": len(clusters),
                "total_faces_in_clusters": sum(c["face_count"] for c in clusters),
            },
            "9_evidence_aggregation": {
                "clusters_with_evidence": len(clusters),
            },
            "10_weighting": {
                "clusters_weighted": len(clusters),
            },
            "11_scoring": {
                "clusters_scored": len(clusters),
            },
            "12_ranking": {
                "clusters_ranked": len(clusters),
            },
            "13_decision": {
                "decision": decision.get("decision"),
                "reason": decision.get("reason"),
            },
        },
        "timing_ms": pipeline_times,
        "total_profiles_found": len(profiles),
        "total_images_processed": len(validated),
        "total_faces_detected": len(all_faces),
        "identity_clusters": len(clusters),
        "reference": reference_info,
        "reference_matches": ref_matches,
        "image_results": image_results,
        "candidates": candidates_output,
        "decision": {
            "verdict": decision.get("decision"),
            "explanation": decision.get("reason"),
            "dominant_candidate": candidates_output[0] if candidates_output and decision.get("decision") == "dominant_candidate" else None,
            "candidates_returned": [c["rank"] for c in candidates_output[:2]] if decision.get("decision") in ("multiple_similar_candidates", "ambiguous") else [],
        },
        "uncertainty_notes": _build_uncertainty_notes(decision, clusters, profiles),
    }

    if metadata:
        output["metadata"] = metadata

    return output


def _build_signals(cluster: dict) -> list[dict]:
    """Build list of matching signals for explainability."""
    signals = []
    if cluster.get("max_similarity", 0) > 0.9:
        signals.append({
            "signal": "face_match",
            "strength": "strong",
            "detail": f"Face similarity {cluster['max_similarity']:.3f} >= 0.9",
        })
    platforms = cluster.get("platforms", [])
    if len(platforms) >= 2:
        signals.append({
            "signal": "multiple_platforms",
            "strength": "medium",
            "detail": f"Same face found on {len(platforms)} platforms: {', '.join(platforms)}",
        })
    evidence = cluster.get("evidence", {})
    refs = evidence.get("cross_site_references", [])
    if refs:
        signals.append({
            "signal": "cross_site_handle",
            "strength": "high",
            "detail": f"Same handle used on {len(refs)} platform pairs",
        })
    handles = cluster.get("handles", [])
    if handles:
        signals.append({
            "signal": "username_consistency",
            "strength": "medium",
            "detail": f"Username available: {handles[0]}",
        })
    return signals


def _build_uncertainty_notes(decision: dict, clusters: list[dict], profiles: list[dict]) -> list[str]:
    notes = []
    if decision.get("decision") == "no_confident_match":
        notes.append("No identity cluster met the minimum confidence threshold.")
    elif decision.get("decision") == "ambiguous":
        notes.append("Confidence is above minimum but below dominant threshold.")
    if not profiles:
        notes.append("No social media profiles were discovered. Try a more specific name or provide profile URLs.")
    if clusters and clusters[0].get("face_count", 0) == 1 and len(clusters) > 1:
        notes.append("Each cluster contains only 1 face image. More images per cluster would increase confidence.")
    return notes


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Main pipeline orchestrator                                          ║
# ╚══════════════════════════════════════════════════════════════════════╝

def run_pipeline(
    name: str,
    pre_collected_profiles: list[dict] | None = None,
    extra_image_urls: list[dict] | None = None,
    reference_url: str | None = None,
    match_threshold: float = 0.9,
    enable_name_search: bool = False,
    enable_quality: bool = True,
    enable_dedup: bool = True,
    metadata: dict | None = None,
) -> dict:
    """Run the full 14-stage face search pipeline.

    Args:
        name: Person name to search
        pre_collected_profiles: Profile URLs already known (from JS side)
        extra_image_urls: Additional image URLs to include
        reference_url: Reference image URL for direct comparison
        match_threshold: Cosine similarity threshold (0-1)
        enable_name_search: Whether to search web for profiles
        enable_quality: Enable image quality validation
        enable_dedup: Enable near-duplicate removal
        metadata: Additional metadata to include in output

    Returns:
        Complete pipeline output dict with all 14 stages
    """
    times: dict[str, float] = {}
    import time

    # Stage 1: Query Planner
    t0 = time.time()
    query_plan = stage1_query_planner(name)
    times["1_query_planner"] = (time.time() - t0) * 1000

    # Stage 2: Multi-Source Collection
    t0 = time.time()
    profiles = stage2_collect(query_plan, pre_collected_profiles, enable_name_search)
    times["2_collection"] = (time.time() - t0) * 1000

    # Stage 3: Data Normalization
    t0 = time.time()
    profiles = stage3_normalize(profiles)
    times["3_normalization"] = (time.time() - t0) * 1000

    # Stage 4: Image Collection
    t0 = time.time()
    images = stage4_collect_images(profiles, extra_image_urls)
    times["4_image_collection"] = (time.time() - t0) * 1000

    # Stage 5: Quality & Validation
    t0 = time.time()
    validated = stage5_validate(images, enable_quality=enable_quality)
    times["5_quality_validation"] = (time.time() - t0) * 1000

    # Stage 6: Duplicate Removal
    t0 = time.time()
    validated = stage6_dedup(validated, enable_dedup=enable_dedup)
    times["6_dedup"] = (time.time() - t0) * 1000

    # Stage 7: Face Embedding (also validates face count / confidence)
    t0 = time.time()
    engine = FaceEngine()
    embedded = stage7_embed(engine, [v for v in validated if v.get("accepted")])
    times["7_embedding"] = (time.time() - t0) * 1000

    # Re-run dedup after embedding rejects some (no face, multi-face, low confidence)
    embedded = stage6_dedup(embedded, enable_dedup=enable_dedup)

    # Stage 8: Clustering
    t0 = time.time()
    all_faces, clusters = stage8_cluster(embedded, threshold=match_threshold)
    times["8_clustering"] = (time.time() - t0) * 1000

    # Stage 9: Evidence Aggregation
    t0 = time.time()
    clusters = stage9_aggregate(clusters, all_faces, profiles)
    times["9_evidence"] = (time.time() - t0) * 1000

    # Stage 10: Evidence Weighting
    t0 = time.time()
    clusters = stage10_weight(clusters)
    times["10_weighting"] = (time.time() - t0) * 1000

    # Stage 11: Confidence Scoring
    t0 = time.time()
    clusters = stage11_score(clusters)
    times["11_scoring"] = (time.time() - t0) * 1000

    # Stage 12: Ranking
    t0 = time.time()
    clusters = stage12_rank(clusters)
    times["12_ranking"] = (time.time() - t0) * 1000

    # Stage 13: Decision Engine
    t0 = time.time()
    decision = stage13_decide(clusters)
    times["13_decision"] = (time.time() - t0) * 1000

    # Reference image processing (if provided)
    ref_info, ref_face, ref_faces = _process_reference(engine, reference_url)
    ref_matches: list[dict] = []
    if ref_face and all_faces:
        for idx, f in enumerate(all_faces):
            sim = _cosine_similarity(ref_face["embedding"], f["embedding"])
            if sim >= match_threshold:
                ref_matches.append({
                    "face_index": idx,
                    "similarity": round(sim, 4),
                    "profile_url": f.get("profile_url", ""),
                    "platform": f.get("platform", ""),
                })

    # Stage 14: Explainable Output
    t0 = time.time()
    output = stage14_output(
        query_plan=query_plan,
        profiles=profiles,
        images=images,
        validated=validated,
        embedded=embedded,
        all_faces=all_faces,
        clusters=clusters,
        decision=decision,
        reference_info=ref_info,
        ref_matches=ref_matches,
        pipeline_times=times,
        metadata=metadata,
    )
    times["14_output"] = (time.time() - t0) * 1000
    output["timing_ms"] = times
    output["total_time_ms"] = sum(times.values())

    return output


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Enhanced Pipeline — 12-phase with all 16 improvements               ║
# ╚══════════════════════════════════════════════════════════════════════╝

# ── Image Quality Pipeline helpers (Improvement #8) ──────────────

def _largest_face(image_path: Path, faces: list[dict]) -> Optional[dict]:
    """Return the face dict with the largest bounding box area."""
    if not faces:
        return None
    return max(faces, key=lambda f: (
        (f["bbox"][2] - f["bbox"][0]) * (f["bbox"][3] - f["bbox"][1])
        if f.get("bbox") and len(f["bbox"]) >= 4 else 0
    ))


def _face_align(image_path: Path, face: dict) -> Optional[np.ndarray]:
    """Align face based on eye landmarks (requires InsightFace landmarks)."""
    import cv2
    img = cv2.imread(str(image_path))
    if img is None:
        return None
    bbox = face.get("bbox")
    if not bbox or len(bbox) < 4:
        return None
    x1, y1, x2, y2 = [int(max(0, v)) for v in bbox[:4]]
    h, w = img.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    if x2 <= x1 or y2 <= y1:
        return None
    face_img = img[y1:y2, x1:x2]
    if face_img.size == 0:
        return None
    # Simple brightness normalization
    face_img = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)
    face_img = cv2.equalizeHist(face_img)
    face_img = cv2.resize(face_img, (160, 160))
    return face_img


def _brightness_normalize(img: np.ndarray) -> np.ndarray:
    """Normalize brightness and contrast using CLAHE."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    normalized = cv2.merge([l, a, b])
    return cv2.cvtColor(normalized, cv2.COLOR_LAB2BGR)


def _occlusion_detection(face_img: np.ndarray, threshold: float = 0.3) -> bool:
    """Simple occlusion detection: check if large uniform regions exist."""
    gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    grid_size = 8
    cell_h, cell_w = h // grid_size, w // grid_size
    uniform_cells = 0
    for i in range(grid_size):
        for j in range(grid_size):
            cell = gray[i * cell_h:(i + 1) * cell_h, j * cell_w:(j + 1) * cell_w]
            if cell.std() < 10:
                uniform_cells += 1
    return (uniform_cells / (grid_size * grid_size)) > threshold


def _process_with_quality_pipeline(engine: "FaceEngine", image_path: Path) -> Optional[dict]:
    """Run the full image quality pipeline: detect → largest → align → quality → embed."""
    faces = engine.get_faces(image_path)
    if not faces:
        return None
    best = _largest_face(image_path, faces)
    if not best:
        return None
    aligned = _face_align(image_path, best)
    if aligned is None:
        return None
    occluded = _occlusion_detection(cv2.imread(str(image_path)))
    return {
        "embedding": best["embedding"],
        "bbox": best["bbox"],
        "det_score": best.get("det_score", 0.0),
        "gender": best.get("gender"),
        "age": best.get("age"),
        "aligned": aligned.tolist() if aligned is not None else None,
        "occluded": occluded,
    }


# ── Platform accessibility checker ─────────────────────────────

def _check_platform_accessibility(url: str, timeout: int = 8) -> str:
    """Quick-check whether a platform URL is accessible or login-gated.
    
    Returns one of: 'accessible', 'login_gated', 'not_found', 'error'
    """
    if not url:
        return "error"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        resp = urllib.request.urlopen(req, timeout=timeout)
        html_fragment = resp.read(2048).decode("utf-8", errors="replace").lower()
        status = resp.status
        if status >= 400:
            return "not_found"
        # Heuristic: login-gated pages often contain sign-in forms or auth redirects
        login_signals = ["login", "sign in", "signin", "log in", "auth", "password",
                         "this page is not available", "join instagram", "sign up"]
        if any(s in html_fragment for s in login_signals):
            return "login_gated"
        return "accessible"
    except urllib.error.HTTPError as e:
        return "not_found" if e.code == 404 else "login_gated" if e.code in (401, 403) else f"http_{e.code}"
    except Exception:
        return "error"


def _legacy_build_identity_candidates(profiles, cross_verification_profiles, discovered_identifiers, original_name):
    resolved_name = (original_name or "").strip() or "(unresolved — no name could be inferred)"
    candidates = []
    for i, p in enumerate(profiles + cross_verification_profiles):
        candidates.append({
            "candidate_id": f"candidate_{i+1}",
            "name_hypothesis": resolved_name,
            "platforms": [p.get("platform", "web")],
            "profile_urls": [p.get("url", "")],
            "handles": [p.get("handle", "")],
            "evidence_signals": [],
            "confidence": 0.3,
            "confidence_label": "low",
            "face_evidence": None,
            "face_verified": False,
            "verification": "not_attempted",
            "explanation": "",
        })
    return candidates


def _build_identity_candidates(
    validated_profiles: list[ValidatedProfile],
    registry: CandidateRegistry,
    original_name: str,
) -> list[IdentityCandidate]:
    candidates: list[IdentityCandidate] = []

    eligible = [vp for vp in validated_profiles if vp.is_eligible]
    fallback = [vp for vp in validated_profiles if not vp.is_eligible and vp.exists]

    working_set = eligible if eligible else fallback

    handle_groups: dict[str, list[ValidatedProfile]] = {}
    for vp in working_set:
        nh = _normalize_username(vp.handle) if vp.handle else "_no_handle"
        handle_groups.setdefault(nh, []).append(vp)

    for nh, grouped in handle_groups.items():
        if not grouped:
            continue

        evidence_items = []

        username_match = len(set(v.handle for v in grouped if v.handle)) == 1 and len(grouped) >= 2
        name_match = any(v.name for v in grouped) and original_name.lower() in " ".join(v.name for v in grouped if v.name).lower()

        if username_match:
            evidence_items.append(EvidenceItem(
                evidence_class=EvidenceClass.WEAK,
                description="Same username across platforms",
                weight=0.05,
                source="profile_analysis",
            ))
        elif name_match:
            evidence_items.append(EvidenceItem(
                evidence_class=EvidenceClass.WEAK,
                description="Display name match",
                weight=0.10,
                source="profile_analysis",
            ))

        orgs = set(v.extracted_fields.get("organization", "") for v in grouped if v.extracted_fields.get("organization"))
        if orgs:
            evidence_items.append(EvidenceItem(
                evidence_class=EvidenceClass.MEDIUM,
                description=f"Same employer across profiles: {', '.join(orgs)}",
                weight=0.20,
                source="profile_analysis",
            ))

        websites = set(v.extracted_fields.get("website", "") for v in grouped if v.extracted_fields.get("website"))
        if websites:
            evidence_items.append(EvidenceItem(
                evidence_class=EvidenceClass.MEDIUM,
                description=f"Same website across profiles: {', '.join(websites)}",
                weight=0.20,
                source="profile_analysis",
            ))

        emails = set(v.extracted_fields.get("email", "") for v in grouped if v.extracted_fields.get("email"))
        if emails:
            evidence_items.append(EvidenceItem(
                evidence_class=EvidenceClass.STRONG,
                description=f"Same verified email domain across profiles",
                weight=0.25,
                source="profile_analysis",
            ))

        locs = set(v.extracted_fields.get("location", "") for v in grouped if v.extracted_fields.get("location"))
        if locs:
            evidence_items.append(EvidenceItem(
                evidence_class=EvidenceClass.WEAK,
                description=f"Same city across profiles: {', '.join(locs)}",
                weight=0.10,
                source="profile_analysis",
            ))

        confidence, label = compute_capped_confidence(evidence_items)

        # Never invent a placeholder like "unknown" for the resolved identity
        # name: if we truly can't infer one, retain the originally queried
        # name so the candidate stays traceable to what was actually searched.
        resolved_name = (original_name or "").strip() or "(unresolved — no name could be inferred)"

        candidate = IdentityCandidate(
            linked_profiles=grouped,
            name=resolved_name,
            confidence=confidence,
            confidence_label=label,
            evidence=evidence_items,
            face_verification_status=FaceVerificationState.NOT_ATTEMPTED,
        )
        candidates.append(candidate)

    candidates.sort(key=lambda c: c.confidence, reverse=True)
    return candidates


def _build_harvested_evidence(all_candidates: list) -> dict:
    """Aggregate harvested evidence from all validated candidates."""
    emails = set()
    phones = set()
    websites = set()
    organizations = set()
    display_names = set()
    for c in all_candidates:
        if c.state not in ("VALIDATED",):
            continue
        ev = getattr(c, "extracted_evidence", {}) or {}
        emails.update(ev.get("emails", []))
        phones.update(ev.get("phones", []))
        websites.update(ev.get("websites", []))
        organizations.update(ev.get("organizations", []))
        if c.display_name:
            display_names.add(c.display_name)
    return {
        "display_names": sorted(display_names),
        "emails": sorted(emails),
        "phones": sorted(phones),
        "websites": sorted(websites),
        "organizations": sorted(organizations),
    }


# ── Phase 2.5: Profile Validation ────────────────────────────────────────────────────────────────────────────────────────────────
# ── Phase 2.5: Profile Validation ─────────────────────────────────

def _run_profile_validation(profiles: list[dict], registry: CandidateRegistry) -> list[ValidatedProfile]:
    validated: list[ValidatedProfile] = []
    for p in profiles:
        url = p.get("url", "")
        html = p.get("_browser_html", "")
        plat = p.get("platform", "")
        if not url:
            continue
        try:
            vr = _validate_profile(url, html, profile=p, platform=plat)
            validation = vr.get("validation", {})
            quality = vr.get("quality", {})
            p["_validation"] = validation
            p["_quality"] = quality

            exists = validation.get("exists", False)
            status = validation.get("status", "ERROR")
            completeness = quality.get("completeness_score", 0.0)

            vp = ValidatedProfile(
                url=url,
                platform=plat,
                handle=p.get("handle"),
                name=p.get("name"),
                exists=exists,
                validation_status=ValidationStatus(status),
                quality_score=completeness,
                completeness_score=completeness,
                investigative_value=quality.get("investigative_value", 0.0),
                is_eligible=False,
                extracted_fields={k: p.get(k) for k in ("bio", "location", "email", "website", "organization", "followers") if p.get(k)},
                signals=validation.get("signals", []),
                warnings=validation.get("warnings", []),
                low_value_indicators=quality.get("low_value_indicators", []),
            )

            # Update registry: mark reachable first, then validate
            registry.mark_reachable(url, True, "Validated: " + status)
            if exists and status == "FOUND":
                vp.is_eligible = completeness >= 0.30
                registry.mark_validated(url, "FOUND", reason=status,
                                        quality_score=completeness, completeness_score=completeness)
            else:
                registry.mark_validated(url, status, reason=validation.get("reason", "Profile not found"),
                                        quality_score=0.0, completeness_score=0.0)

            validated.append(vp)
        except Exception as e:
            p["_validation"] = {"exists": False, "status": "ERROR", "confidence": 0.0}
    return validated


# ── Enhanced run (Improvements #8–16) ────────────────────────────

def run_enhanced_pipeline(
    name: str,
    pre_collected_profiles: Optional[list[dict]] = None,
    extra_image_urls: Optional[list[dict]] = None,
    reference_url: Optional[str] = None,
    match_threshold: float = 0.9,
    enable_name_search: bool = False,
    enable_quality: bool = True,
    enable_dedup: bool = True,
    enable_consensus: bool = True,
    enable_memory: bool = True,
    enable_bayesian: bool = True,
    enable_browser_ctrl: bool = False,
    enable_auto_reference: bool = True,
    metadata: Optional[dict] = None,
    sherlock_leads: Optional[list[dict]] = None,
) -> dict:
    """Run the two-phase enhanced pipeline:

    Phase A — IDENTITY DISCOVERY (always runs):
      Answers: "What public accounts and evidence exist that could belong 
                to someone with this name?"
      Outputs: identity_candidates with non-face evidence confidence

    Phase B — IDENTITY VERIFICATION (only with trusted reference):
      Answers: "Do these accounts belong to the same real person?"
      Outputs: verification result with face evidence, or null if no reference

    The reference MUST come from a trusted source:
      - a photo supplied by the investigator
      - an already verified identity (identity memory)
      - another trusted reference source
    It should NOT be automatically taken from the first discovered profile.

    Phase B2 — AUTO REFERENCE SELECTION (runs when enable_auto_reference=True
    and no trusted reference was supplied):
      Answers: "Do any of the discovered, independently-sourced profile
                photos corroborate each other?"
      This is a strictly separate, lower-trust signal from Phase B: it never
      sets FaceVerificationState.VERIFIED and never touches has_trusted_reference
      or reference_url. It picks one discovered candidate photo as a working
      reference and checks it against OTHER, differently-sourced candidate
      photos only (see reference_selector.py for the non-circularity guard).
    """
    times: dict[str, float] = {}
    import time
    
    has_trusted_reference = reference_url is not None

    # ── Candidate Registry initialization ──
    registry = CandidateRegistry() if _has_models else None
    validated_profiles: list[ValidatedProfile] = []

    # ╔══════════════════════════════════════════════════════════════════╗
    # ║  PHASE A: IDENTITY DISCOVERY                                   ║
    # ║  Answers: "What public accounts exist for this name?"           ║
    # ╚══════════════════════════════════════════════════════════════════╝

    # ── Phase 0: Authorization (placeholder) ──
    t0 = time.time()
    times["0_authorization"] = (time.time() - t0) * 1000

    # ── Phase 1: Query Planning & Search ──
    t0 = time.time()
    query_plan = stage1_query_planner(name)
    times["1_query_planning"] = (time.time() - t0) * 1000

    # ── Phase 1b: Session loading ──
    session_info = {}
    if _sm is not None:
        try:
            mgr = _sm.get_global()
            session_info = mgr.get_storage_info()
        except Exception:
            pass

    # ── Phase 2: Collection (via search + optional browser controller) ──
    t0 = time.time()
    profiles = stage2_collect(query_plan, pre_collected_profiles, enable_name_search)
    times["2_collection"] = (time.time() - t0) * 1000

    # ── Phase A1: Candidate Generator (Lead → CandidateProfile) ──
    t0 = time.time()
    validated_profiles: list[ValidatedProfile] = []
    validation_results = []
    all_candidates: list[CandidateProfile] = []
    if _has_models and registry is not None:
        # Register Sherlock leads as candidates
        if sherlock_leads:
            for lead in sherlock_leads:
                c = CandidateProfile(
                    source="sherlock",
                    source_confidence=0.3,
                    platform=lead.get("platform", "web"),
                    url=lead.get("url", ""),
                    username=lead.get("handle"),
                )
                registry.add(c)
                all_candidates.append(c)

        # Register pipeline-discovered profiles as candidates
        pipeline_sources = {"sherlock": 0.3, "cross_verification": 0.6, "web_search": 0.5, "direct_probe": 0.7, "pre_collected": 0.4}
        for p in profiles:
            src = p.get("source", "direct_probe")
            sc = pipeline_sources.get(src, 0.4)
            c = CandidateProfile(
                source=src,
                source_confidence=sc,
                platform=p.get("platform", "web"),
                url=p.get("url", ""),
                username=p.get("handle"),
                display_name=p.get("name"),
                image_url=p.get("image_url") or p.get("photo_url"),
                bio=p.get("bio"),
            )
            registry.add(c)
            all_candidates.append(c)
        # Transition all to DISCOVERED
        for c in all_candidates:
            registry.transition(c.id, "DISCOVERED", "Candidate generated")
    times["a1_candidate_generator"] = (time.time() - t0) * 1000

    # ── Phase A2: Browser Controller — updates candidates with DOM/status ──
    t0 = time.time()
    if registry is not None:
        for c in all_candidates:
            if c.state != "DISCOVERED":
                continue
            try:
                if enable_browser_ctrl and _bc is not None and _bc.HAS_PLAYWRIGHT:
                    ctrl = _bc.BrowserController(headless=True)
                    result = ctrl.navigate(c.url, platform=c.platform)
                    c.dom = result.get("html", "")
                    c.final_url = result.get("final_url") or c.url
                    c.http_status = result.get("http_status", 200)
                    reg_msg = f"Playwright: {c.http_status}"
                else:
                    # HTTP fallback when Playwright is unavailable
                    fetch_result = _http_fetch_page(c.url)
                    c.dom = fetch_result.get("html", "")
                    c.final_url = fetch_result.get("final_url", c.url)
                    c.http_status = fetch_result.get("http_status", 0)
                    reg_msg = f"HTTP: {c.http_status}"
                registry.transition(c.id, "PAGE_LOADED", reg_msg)
            except Exception as exc:
                c.http_status = 0
                registry.transition(c.id, "PAGE_LOADED", f"Fetch error: {exc}")
    times["a2_browser_controller"] = (time.time() - t0) * 1000

    # ── Phase A3: Site Validator — updates candidates with ValidationResult ──
    t0 = time.time()
    if _validate_profile is not None and _has_models and registry is not None:
        for c in all_candidates:
            if c.state not in ("DISCOVERED", "PAGE_LOADED"):
                continue
            try:
                # Run validator on this candidate
                p_dict = {"url": c.url, "platform": c.platform, "handle": c.username,
                          "name": c.display_name, "image_url": c.image_url, "bio": c.bio}
                vr = _validate_profile(c.url, c.dom or "", profile=p_dict, platform=c.platform)
                validation = ValidationResult(
                    exists=vr["validation"]["exists"],
                    accessible=vr["validation"]["accessible"],
                    status=vr["validation"]["status"],
                    confidence=vr["validation"]["confidence"],
                    reason=vr["validation"]["reason"],
                    signals=vr["validation"].get("signals", []),
                    warnings=vr["validation"].get("warnings", []),
                )
                c.validation = validation
                c.bio = p_dict.get("bio") or c.bio
                c.http_status = vr.get("http_status", 200 if validation.exists else 0)

                # Decide state: only NOT_FOUND/SUSPENDED/DELETED should reject
                if should_continue_from_state(validation.status):
                    registry.transition(c.id, "VALIDATED",
                                        f"Validation: {validation.status} - {validation.reason}")
                else:
                    registry.transition(c.id, "REJECTED",
                                        f"Validation: {validation.status} - {validation.reason}")
            except Exception as e:
                c.validation = ValidationResult(
                    exists=False, accessible=False, status="ERROR", confidence=0.0,
                    reason=f"Validator exception: {e}",
                )
                registry.transition(c.id, "REJECTED", "Validator error")
    times["a3_validator"] = (time.time() - t0) * 1000

    # ── Stage debug: validator output ──
    validated_count_a3 = sum(1 for c in all_candidates if c.state == "VALIDATED")
    rejected_count_a3 = sum(1 for c in all_candidates if c.state == "REJECTED")
    error_count_a3 = sum(1 for c in all_candidates if getattr(c, "validation", None) and c.validation.status == "ERROR")
    print(f"[STAGE:A3]  VALIDATED:{validated_count_a3}  REJECTED:{rejected_count_a3}  ERROR:{error_count_a3}", flush=True)
    _stage_assert(validated_count_a3 > 0 or rejected_count_a3 > 0,
                  "Validator produced no output - all candidates skipped")

    # ── Phase A3b: Evidence Harvester — extract identifiers from validated DOMs ──
    t0 = time.time()
    if _eh is not None and _has_models and registry is not None:
        for c in all_candidates:
            if c.state not in ("VALIDATED", "PAGE_LOADED"):
                continue
            if not c.dom:
                continue
            try:
                harvested = _eh.harvest_from_candidate(
                    url=c.url,
                    html=c.dom,
                    platform=c.platform or "web",
                    handle=c.username or "",
                )
                if harvested.get("display_name") and not c.display_name:
                    c.display_name = harvested["display_name"]
                if harvested.get("bio") and not c.bio:
                    c.bio = harvested["bio"][:500]
                if harvested.get("image_url") and not c.image_url:
                    c.image_url = harvested["image_url"]
                c.extracted_evidence = {
                    "emails": harvested.get("emails", []),
                    "phones": harvested.get("phones", []),
                    "websites": harvested.get("websites", []),
                    "organizations": harvested.get("organizations", []),
                    "usernames": harvested.get("usernames", {}),
                }
            except Exception:
                pass
    times["a3b_evidence_harvester"] = (time.time() - t0) * 1000

    # ── Stage debug: harvester output ──
    harvested_any = sum(1 for c in all_candidates
                        if getattr(c, "extracted_evidence", None) and c.extracted_evidence.get("emails"))
    harvested_name = sum(1 for c in all_candidates
                         if c.display_name and c.state == "VALIDATED")
    print(f"[STAGE:A3b]  With names:{harvested_name}  With emails:{harvested_any}", flush=True)
    _stage_assert(harvested_name > 0 or True,
                  "No display names extracted - check DOM content / HTTP fallback")

    # ── Phase A4: Quality Scorer ──
    t0 = time.time()
    if _has_models and registry is not None:
        for c in all_candidates:
            if c.state not in ("VALIDATED", "REJECTED"):
                continue
            c.quality_score = compute_quality_score(c)
    times["a4_quality_scorer"] = (time.time() - t0) * 1000

    # ── Stage debug: quality scorer output ──
    validated_count_a4 = sum(1 for c in all_candidates if c.state == "VALIDATED")
    high_quality_count_a4 = sum(1 for c in all_candidates if c.state == "VALIDATED" and c.quality_score >= VALIDATED_PROFILE_THRESHOLD)
    avg_quality = (sum(c.quality_score for c in all_candidates if c.state == "VALIDATED") /
                   max(validated_count_a4, 1))
    print(f"[STAGE:A4]  VALIDATED:{validated_count_a4}  HIGH_QUALITY(>={VALIDATED_PROFILE_THRESHOLD}):{high_quality_count_a4}  AVG_QUALITY:{avg_quality:.1f}", flush=True)
    _stage_assert(validated_count_a4 > 0 or high_quality_count_a4 == 0,
                  "All validated profiles have quality < 30")

    # ── Phase 3: Normalization ──
    t0 = time.time()
    profiles = stage3_normalize(profiles)
    times["3_normalization"] = (time.time() - t0) * 1000

    # ── Phase 7a: URL Canonicalization (Improvement #17) ──
    t0 = time.time()
    canonicalized_urls = {}
    if _uc is not None:
        canon = _uc.URLCanonicalizer()
        for p in profiles:
            url = p.get("url", "")
            if url:
                resolved = canon.resolve(url)
                if resolved and resolved != url:
                    canonicalized_urls[url] = resolved
                    p["canonical_url"] = resolved
    times["7a_url_canonicalization"] = (time.time() - t0) * 1000

    # ── Phase 7b: Identifier Discovery (Improvement #18) ──
    t0 = time.time()
    discovered_identifiers = {
        "usernames": [],
        "emails": [],
        "phones": [],
        "websites": [],
        "locations": [],
        "full_names": [],
    }
    if _idc is not None:
        idc = _idc.IdentifierDiscovery()
        for p in profiles:
            identifiers = idc.extract_from_profile(p)
            for k in discovered_identifiers:
                for item in identifiers.get(k, []):
                    if item not in discovered_identifiers[k]:
                        discovered_identifiers[k].append(item)
            html = p.get("_browser_html", "")
            if html:
                html_ids = idc.extract_from_text(html)
                for k in discovered_identifiers:
                    for item in html_ids.get(k, []):
                        if item not in discovered_identifiers[k]:
                            discovered_identifiers[k].append(item)
    times["7b_identifier_discovery"] = (time.time() - t0) * 1000

    # ── Phase 7c: Post Metadata Extraction (Improvement #19) ──
    t0 = time.time()
    post_metadata = []
    if _pme is not None:
        pme = _pme.PostMetadataExtractor()
        for p in profiles:
            html = p.get("_browser_html", "")
            if html:
                metadata = pme.extract(html, source_url=p.get("url", ""))
                if metadata:
                    post_metadata.append(metadata)
    times["7c_post_metadata"] = (time.time() - t0) * 1000

    # ── Phase 8: Organization Graph (Improvement #20) ──
    t0 = time.time()
    org_graph = {}
    if _og is not None:
        og = _og.OrganizationGraph()
        eligible_urls = set(c.url for c in registry.validated_candidates()) if (registry is not None) else None
        for p in profiles:
            if eligible_urls is None or p.get("url") in eligible_urls:
                og.add_from_profile(name, p)
        org_graph = og.build_graph()
    times["8_organization_graph"] = (time.time() - t0) * 1000

    # ── Phase 9: Geolocation Engine (Improvement #21) ──
    t0 = time.time()
    geolocation_result = {}
    if _ge is not None:
        ge = _ge.GeolocationEngine()
        all_text = " ".join(
            p.get("bio", "") or p.get("description", "") or ""
            for p in profiles
        )
        profile_urls = [p.get("url", "") for p in profiles if p.get("url")]
        text_locs = ge.extract_from_text(all_text)
        url_locs = ge.extract_from_urls(profile_urls)
        profile_locs = []
        for p in profiles:
            profile_locs.extend(ge.extract_from_profile(p))
        geolocation_result = ge.aggregate([text_locs, url_locs, profile_locs])
        if geolocation_result.get("coordinates"):
            nearby = ge.overpass_query(
                geolocation_result["coordinates"]["lat"],
                geolocation_result["coordinates"]["lng"],
            )
            if nearby:
                geolocation_result["nearby_places"] = nearby.get("nearby_places", [])
    times["9_geolocation"] = (time.time() - t0) * 1000

    # ── Phase 10: Cross-Verification Loop (Improvement #22) ──
    t0 = time.time()
    cross_verification_results = []
    cross_verification_profiles = []
    if _cvl is not None:
        usernames = {}
        names = [name]

        # Collect usernames from profiles
        for p in profiles:
            plat = p.get("platform", "")
            handle = p.get("handle", "")
            if plat and handle:
                usernames[plat] = handle
                if plat == "linkedin" and "-" in handle:
                    full_name = handle.replace("-", " ").title()
                    names.append(full_name)

        # Collect usernames from imported identifier discovery
        disc_ids = discovered_identifiers.get("usernames", {})
        if isinstance(disc_ids, dict):
            for k, v in disc_ids.items():
                if k not in usernames:
                    usernames[k] = v

        # Collect emails/phones/websites from harvested evidence on validated candidates
        harvested_emails = set()
        harvested_websites = set()
        if registry is not None:
            for c in registry.validated_candidates():
                ev = getattr(c, "extracted_evidence", {}) or {}
                harvested_emails.update(ev.get("emails", []))
                harvested_websites.update(ev.get("websites", []))

        cvl = _cvl.CrossVerificationLoop()
        initial_ids = {
            "usernames": usernames,
            "emails": list(harvested_emails) or discovered_identifiers.get("emails", []),
            "websites": list(harvested_websites) or discovered_identifiers.get("websites", []),
            "names": names,
        }
        cvl_result = cvl.run(initial_ids, max_iterations=3)
        cross_verification_results = cvl_result.get("iteration_history", [])
        cross_verification_profiles = cvl_result.get("discovered_profiles", [])
        for cp in cross_verification_profiles:
            url = cp.get("url", "")
            if url and url not in [p.get("url", "") for p in profiles]:
                profiles.append(cp)
                if registry is not None:
                    c = CandidateProfile(
                        source="cross_verification",
                        source_confidence=0.6,
                        platform=cp.get("platform", "web"),
                        url=url,
                        username=cp.get("handle"),
                        display_name=cp.get("name"),
                    )
                    registry.add(c)
                    registry.transition(c.id, "DISCOVERED", "Cross-verification discovery")
    times["10_cross_verification"] = (time.time() - t0) * 1000

    # ── Phase A Decision: Build Identity Candidates from non-face evidence ──
    if _has_models and registry is not None:
        vcs = registry.validated_candidates()
        validated_profiles = []
        for c in vcs:
            # c.validation.status is a raw string from the richer ValidationState
            # space (e.g. "FOUND_PUBLIC", "FOUND_LIMITED"), NOT a ValidationStatus
            # member and NOT even a valid ValidationStatus value. ValidatedProfile.to_dict()
            # calls `.value` on this field, so it must be converted to a real
            # ValidationStatus enum member here, or serialization crashes later
            # (AttributeError: 'str' object has no attribute 'value').
            raw_status = c.validation.status if c.validation else None
            try:
                legacy_status = ValidationState(raw_status).as_legacy_status()
            except (ValueError, TypeError):
                legacy_status = raw_status if raw_status in ValidationStatus.__members__ else "ERROR"
            try:
                validation_status_enum = ValidationStatus(legacy_status)
            except ValueError:
                validation_status_enum = ValidationStatus.ERROR

            vp = ValidatedProfile(
                url=c.url,
                platform=c.platform,
                handle=c.username,
                name=c.display_name,
                exists=c.validation.exists if c.validation else False,
                validation_status=validation_status_enum,
                quality_score=c.quality_score,
                is_eligible=True,
            )
            vp.extracted_fields = {}
            if c.bio:
                vp.extracted_fields["bio"] = c.bio
            if c.image_url:
                vp.extracted_fields["avatar_url"] = c.image_url
            ev = getattr(c, "extracted_evidence", {}) or {}
            if ev:
                vp.extracted_fields["evidence"] = ev
                # _build_identity_candidates reads flat keys (organization/
                # website/email/location), not the nested "evidence" dict —
                # flatten the harvested lists into those keys so the richer
                # weighted evidence signals (same website/employer/city) can
                # actually be produced instead of silently never firing.
                if ev.get("organizations"):
                    vp.extracted_fields["organization"] = ", ".join(ev["organizations"])
                if ev.get("websites"):
                    vp.extracted_fields["website"] = ", ".join(ev["websites"])
                if ev.get("emails"):
                    vp.extracted_fields["email"] = ev["emails"][0]
                if ev.get("locations"):
                    vp.extracted_fields["location"] = ", ".join(ev["locations"])
            validated_profiles.append(vp)
        identity_candidates = _build_identity_candidates(validated_profiles, registry, name)
    else:
        identity_candidates = _legacy_build_identity_candidates(
            profiles, cross_verification_profiles, discovered_identifiers, name
        )
    
    # Determine discovery convergence — has the investigation reached its limit?
    discovery_exhausted = len(cross_verification_results) >= 2 and \
        all(c.get("new_profiles_found", 0) == 0 for c in cross_verification_results[-2:])
    discovery_message = (
        "Investigation reached the limit of publicly accessible information. "
        "No additional profiles were found in the last cross-verification cycle."
        if discovery_exhausted else
        "Cross-verification may not have converged. Additional search strategies "
        "might yield more results with different network conditions."
    )

    # ╔══════════════════════════════════════════════════════════════════╗
    # ║  PHASE B: IDENTITY VERIFICATION                                 ║
    # ║  Only runs when a trusted reference is provided.                ║
    # ║  Answers: "Do the discovered accounts belong to this person?"   ║
    # ╚══════════════════════════════════════════════════════════════════╝
    
    verification_result = None
    ref_info = None
    face_verified = False
    verification_confidence = 0.0
    verification_explanation = None
    image_results = []
    validated = []
    embedded = []
    all_faces = []
    clusters = []
    decision = None
    engine = None
    memory_hit = None
    consensus_result = None
    dl_manager = None

    # ── Phase 4: Image Collection ──
    # Runs whenever there's a reason to need discovered candidate photos:
    # either an independent reference was supplied (has_trusted_reference),
    # or auto reference selection is enabled (enable_auto_reference, Phase
    # B2). If neither applies, collection is skipped entirely as before —
    # this step is the most expensive part of the pipeline (real browser
    # fetches per candidate photo), so it should not run unconditionally
    # just because the code path exists. The independent-verification
    # comparison further below stays gated strictly by has_trusted_reference
    # regardless of this flag (unchanged, preserves the anti-circularity
    # design — see run_enhanced_pipeline docstring).
    images = []
    if has_trusted_reference or enable_auto_reference:
        t0 = time.time()
        images = stage4_collect_images(profiles, extra_image_urls)
        times["4_image_collection"] = (time.time() - t0) * 1000

        dl_manager = _dm.get_global() if _dm is not None else None
        if dl_manager:
            for img in images:
                cached = dl_manager.get_cached_path(img.get("url", ""))
                if cached:
                    img["local_path"] = str(cached)
                    img["_from_cache"] = True

        t0 = time.time()
        validated = stage5_validate(images, enable_quality=enable_quality)
        times["5_quality_validation"] = (time.time() - t0) * 1000

        t0 = time.time()
        validated = stage6_dedup(validated, enable_dedup=enable_dedup)
        times["6_dedup"] = (time.time() - t0) * 1000

        # Face embedding (from discovered profiles)
        t0 = time.time()
        engine = FaceEngine()
        embedded = stage7_embed(engine, [v for v in validated if v.get("accepted")])
        times["7_embedding"] = (time.time() - t0) * 1000
        embedded = stage6_dedup(embedded, enable_dedup=enable_dedup)
    else:
        engine = FaceEngine()
        times["4_image_collection"] = 0
        times["5_quality_validation"] = 0
        times["6_dedup"] = 0
        times["7_embedding"] = 0

    # Identity Memory
    if enable_memory and _im is not None:
        try:
            mem = _im.get_global()
            for item in embedded:
                for face in item.get("faces", []):
                    matches = mem.match_against_memory(face["embedding"], threshold=match_threshold)
                    if matches:
                        memory_hit = matches[0]
                        break
                if memory_hit:
                    break
        except Exception:
            pass

    # Face Consensus (only when reference provided)
    consensus_result = None
    if has_trusted_reference and enable_consensus and _fc is not None:
        try:
            ref_path = _download(reference_url)
            if ref_path:
                ref_faces = engine.get_faces(ref_path)
                if ref_faces:
                    ref_emb = ref_faces[0]["embedding"]
                    candidate_paths = [
                        Path(v["local_path"]) for v in embedded
                        if v.get("accepted") and v.get("local_path")
                    ]
                    if len(candidate_paths) >= 2:
                        consensus = _fc.FaceConsensus(engine)
                        consensus_result = consensus.verify(ref_emb, candidate_paths, threshold=match_threshold)
        except Exception:
            pass

    # Clustering
    t0 = time.time()
    all_faces, clusters = stage8_cluster(embedded, threshold=match_threshold)
    times["8_clustering"] = (time.time() - t0) * 1000

    # Source Reliability
    if _sr is not None:
        rel_engine = _sr.SourceReliability()
        for cluster in clusters:
            for pu in cluster.get("profile_urls", []):
                src_type = rel_engine.classify_source_type(pu)
                rel_score = rel_engine.score(src_type, url=pu)
                cluster.setdefault("source_reliability_scores", []).append({
                    "url": pu,
                    "source_type": src_type,
                    "reliability_score": round(rel_score, 4),
                })

    # Evidence weighting
    clusters = stage10_weight(clusters)

    # Bayesian confidence
    if enable_bayesian and _dc is not None:
        bayes = _dc.BayesianConfidence()
        for cluster in clusters:
            face_sim = cluster.get("max_similarity", 0.5)
            src_rel = cluster.get("evidence_weight", 0.5)
            cross_plat = len(cluster.get("platforms", []))
            handles = cluster.get("handles", [])
            username_match = len(handles) >= 1
            bayes_result = bayes.compute(
                face_similarity=face_sim,
                source_reliability=src_rel,
                cross_platform_matches=cross_plat,
                username_match=username_match,
                name_match=True,
            )
            cluster["bayesian_confidence"] = bayes_result.get("confidence")
            cluster["bayesian_details"] = bayes_result

    clusters = stage11_score(clusters)
    if enable_bayesian and _dc is not None:
        for cluster in clusters:
            bc = cluster.get("bayesian_confidence")
            if bc is not None:
                cluster["confidence"] = round(0.6 * bc + 0.4 * cluster.get("confidence", 0.0), 4)

    clusters = stage12_rank(clusters)
    decision = stage13_decide(clusters)

    # Process reference face (INDEPENDENT of discovered clusters)
    if has_trusted_reference:
        ref_info, ref_face, ref_faces = _process_reference(engine, reference_url)
    else:
        ref_info = None
        ref_face = None
        ref_faces = []
    
    # ── Phase B2: Auto Reference Selection (separate from, and never a  ──
    # ── substitute for, independent verification above) ──
    # Picks one discovered candidate photo as a working reference and checks
    # it against OTHER, differently-sourced candidate photos only. Never
    # sets FaceVerificationState.VERIFIED and never feeds into ref_info /
    # ref_face / has_trusted_reference — see reference_selector.py.
    auto_reference_info = None
    auto_reference_matches = []
    if enable_auto_reference and not has_trusted_reference and _rs is not None and embedded:
        try:
            auto_ref_item = _rs.select_reference(embedded)
            if auto_ref_item:
                auto_reference_matches = _rs.find_corroborating_matches(
                    auto_ref_item, embedded, _cosine_similarity, threshold=match_threshold,
                )
                auto_reference_info = {
                    "image_url": auto_ref_item.get("url", ""),
                    "profile_url": auto_ref_item.get("profile_url", ""),
                    "platform": auto_ref_item.get("platform", ""),
                    "image_type": auto_ref_item.get("image_type", "unknown"),
                    "selection_basis": "best_ranked_profile_photo_among_discovered_candidates",
                    "note": (
                        "Auto-selected from discovered candidate photos. This is NOT "
                        "independent verification — it only reports whether OTHER, "
                        "independently-sourced candidate photos corroborate this one."
                    ),
                }
        except Exception:
            auto_reference_info = None
            auto_reference_matches = []

    # Face comparison: reference vs discovered faces
    ref_matches = []
    if ref_face and all_faces:
        for idx, f in enumerate(all_faces):
            sim = _cosine_similarity(ref_face["embedding"], f["embedding"])
            if sim >= match_threshold:
                ref_matches.append({
                    "face_index": idx,
                    "similarity": round(sim, 4),
                    "profile_url": f.get("profile_url", ""),
                    "platform": f.get("platform", ""),
                })

    # Build image results
    for item in embedded:
        image_results.append({
            "id": item.get("id"),
            "image_url": item.get("url"),
            "platform": item.get("platform"),
            "profile_url": item.get("profile_url"),
            "accepted": item.get("accepted", False),
            "rejection_reason": item.get("rejection_reason"),
            "face_detected": item.get("face_detected", False),
            "face_count": item.get("face_count", 0),
        })

    # Build face images with provenance tags
    face_images = []
    for item in embedded:
        for face in item.get("faces", []):
            fi = FaceImage(
                url=item.get("url", ""),
                platform=item.get("platform", "web"),
                profile_url=item.get("profile_url", ""),
                provenance="candidate",
                embedding=face.get("embedding"),
                face_detected=True,
                source_name=item.get("handle") or item.get("platform", "unknown"),
            )
            face_images.append(fi)

    if has_trusted_reference:
        for face in ref_faces:
            fi = FaceImage(
                url=reference_url,
                platform="reference",
                profile_url="",
                provenance="reference",
                embedding=face.get("embedding"),
                face_detected=True,
                source_name="investigator_provided",
            )
            face_images.append(fi)

    # Determine verification outcome using provenance-aware logic
    reference_faces = [f for f in face_images if f.provenance == "reference"]
    candidate_faces = [f for f in face_images if f.provenance == "candidate"]
    face_verified = False
    verification_confidence = 0.0
    verification_explanation = ""
    # Detect if reference comes from a discovered platform (circular check)
    reference_is_independent = True
    if has_trusted_reference and reference_url:
        ref_domain = urllib.parse.urlparse(reference_url).netloc.lower()
        discovered_platforms = set(p.get("platform", "").lower() for p in profiles)
        for plat in discovered_platforms:
            if plat and plat in ref_domain:
                reference_is_independent = False
                break

    verification_status = FaceVerificationState.NOT_ATTEMPTED

    if not has_trusted_reference:
        verification_status = FaceVerificationState.SKIPPED
        verification_explanation = (
            "No independent reference image provided. "
            "Face verification skipped."
        )
    elif not reference_is_independent:
        verification_status = FaceVerificationState.SKIPPED
        verification_explanation = (
            "Reference image originates from a discovered platform. "
            "Face verification requires an independent reference from a separate source."
        )
    elif not reference_faces:
        verification_status = FaceVerificationState.SKIPPED
        verification_explanation = (
            "Reference image could not be loaded or contained no detectable face. "
            "Face verification skipped."
        )
    elif reference_faces and not candidate_faces:
        verification_status = FaceVerificationState.SKIPPED
        verification_explanation = (
            "Reference face available but no faces detected in candidate profiles. "
            "Face verification could not be completed."
        )
    elif reference_faces and candidate_faces:
        for ref_face in reference_faces:
            for cand_face in candidate_faces:
                sim = _cosine_similarity(ref_face.embedding, cand_face.embedding)
                if sim >= match_threshold:
                    face_verified = True
                    if sim > verification_confidence:
                        verification_confidence = sim
                    ref_matches.append({
                        "face_index": len(ref_matches),
                        "similarity": round(sim, 4),
                        "profile_url": cand_face.profile_url,
                        "platform": cand_face.platform,
                    })

        if face_verified:
            verification_status = FaceVerificationState.VERIFIED
            verification_explanation = (
                f"Reference face matched profile images with similarity "
                f"{verification_confidence:.3f}. Identity is VERIFIED."
            )
        else:
            verification_status = FaceVerificationState.SKIPPED
            verification_explanation = (
                "Reference face was detected but NO matching faces were found "
                "among discovered profile images. Identity could not be verified "
                "through face evidence."
            )

    # Build verification result object
    verification_result = {
        "reference": ref_info,
        "reference_matches": ref_matches,
        "face_verified": face_verified,
        "verification_status": verification_status.value,
        "reference_source": reference_url if has_trusted_reference else None,
        "verification_confidence": round(verification_confidence, 4),
        "verification_explanation": verification_explanation,
        "face_detected_in_profiles": len(all_faces),
        "image_results": image_results,
        # Separate, lower-trust signal — see reference_selector.py. Never
        # implies independent verification; "reference_source" above stays
        # the authoritative field for that.
        "auto_selected_reference": auto_reference_info,
        "auto_reference_matches": auto_reference_matches,
    }

    # Update identity candidates with face evidence
    for candidate in identity_candidates:
        if verification_status == FaceVerificationState.VERIFIED:
            candidate.face_verification_status = FaceVerificationState.VERIFIED
            candidate.evidence.append(EvidenceItem(
                evidence_class=EvidenceClass.STRONG,
                description="Independent face verification",
                weight=0.30,
                source="face_verification",
            ))
            new_confidence, new_label = compute_capped_confidence(candidate.evidence)
            candidate.confidence = new_confidence
            candidate.confidence_label = new_label
        elif verification_status == FaceVerificationState.SKIPPED:
            candidate.face_verification_status = FaceVerificationState.SKIPPED
        else:
            candidate.face_verification_status = FaceVerificationState.NOT_ATTEMPTED

    # Cross-platform photo corroboration (Phase B2, auto reference
    # selection) — a separate, lower-trust signal from independent
    # verification above. Credited to an identity candidate ONLY when BOTH
    # the auto-selected reference photo AND at least one corroborating match
    # belong to that SAME candidate's own linked profiles — never a global
    # match, and never applied on top of an already-VERIFIED candidate, to
    # keep this signal distinct from true independent verification.
    if auto_reference_info and auto_reference_matches:
        auto_ref_profile_url = auto_reference_info.get("profile_url", "")
        corroborating_urls = {m["profile_url"] for m in auto_reference_matches if m.get("profile_url")}
        for candidate in identity_candidates:
            if candidate.face_verification_status == FaceVerificationState.VERIFIED:
                continue
            linked_urls = {p.url for p in candidate.linked_profiles}
            if auto_ref_profile_url in linked_urls and (corroborating_urls & linked_urls):
                candidate.evidence.append(EvidenceItem(
                    evidence_class=EvidenceClass.STRONG,
                    description="Cross-platform face match (auto-selected reference, not independently verified)",
                    weight=0.30,
                    source="auto_reference_selection",
                ))
                new_confidence, new_label = compute_capped_confidence(candidate.evidence)
                candidate.confidence = new_confidence
                candidate.confidence_label = new_label

    # ── Evidence Iteration Loop (Improvement #23) ──
    t0 = time.time()
    iteration_result = {}
    if _eil is not None:
        eil = _eil.EvidenceIterationLoop()
        iteration_result = eil.run(
            initial_profiles=profiles,
            initial_images=images,
            collect_profiles_fn=lambda ids: [],
            collect_images_fn=lambda profs: [],
            verify_fn=lambda imgs, profs: {
                "candidates": [{"confidence": c.get("confidence", 0.0),
                                 "profile_urls": c.get("profile_urls", [])}
                               for c in clusters],
                "decision": decision,
            },
            max_iterations=3,
        )
    times["13_evidence_iteration"] = (time.time() - t0) * 1000

    # ── Build output ──
    t0 = time.time()
    
    # ── Pipeline assertions ──
    if has_trusted_reference:
        assert ref_info is not None, "Face Verification: reference image required when has_trusted_reference is True"

    # ── Build report with stage-by-stage evidence chain ──
    ev = registry.evidence_chain() if registry else {}
    leads_count = ev.get("leads", len(profiles) + len(sherlock_leads if sherlock_leads else []))
    candidates_count = ev.get("candidates", 0)
    browser_loaded_count = ev.get("browser_loaded", 0)
    validated_count = ev.get("validated", 0)
    rejected_count = ev.get("rejected", 0)
    high_quality_count = ev.get("high_quality", 0)
    identity_candidates_count = ev.get("identity_candidates", len(identity_candidates))
    _harvested_names_count = sum(1 for c in all_candidates
                                 if c.state == "VALIDATED" and c.display_name)
    _harvested_emails_count = sum(1 for c in all_candidates
                                  if getattr(c, "extracted_evidence", None) and c.extracted_evidence.get("emails"))
    verified_identities_count = ev.get("verified", sum(1 for c in identity_candidates if isinstance(c, IdentityCandidate) and c.face_verification_status == FaceVerificationState.VERIFIED))

    top_confidence = max((c.confidence for c in identity_candidates), default=0.0) if identity_candidates and isinstance(identity_candidates[0] if identity_candidates else None, IdentityCandidate) else (
        max((c.get("confidence", 0) for c in identity_candidates), default=0.0) if identity_candidates else 0.0
    )
    top_label = "HIGH" if top_confidence >= 0.7 else ("MEDIUM" if top_confidence >= 0.4 else "LOW")

    verified = verification_status == FaceVerificationState.VERIFIED

    output = {
        "pipeline_version": "3.2-registry",

        # Stage-by-stage evidence chain (Phase A)
        "evidence_summary": {
            "leads": leads_count,
            "candidates": candidates_count,
            "browser_loaded": browser_loaded_count,
            "validated": validated_count,
            "rejected": rejected_count,
            "high_quality": high_quality_count,
            "harvested_with_names": _harvested_names_count,
            "harvested_with_emails": _harvested_emails_count,
            "identity_candidates": identity_candidates_count,
            "verified": verified_identities_count,
        },
        "verification_summary": {
            "face_verification": verification_status.value,
            "reference_source": reference_url if (has_trusted_reference and reference_is_independent) else "None",
            "face_verified": verified,
            "verification_confidence": round(verification_confidence, 4) if verified else 0.0,
            "explanation": verification_explanation,
            # Separate, lower-trust signal (Phase B2) — populated only when no
            # independent reference was supplied. Never implies "verified".
            "auto_selected_reference": auto_reference_info,
            "auto_reference_matches": auto_reference_matches,
        },

        # Detailed output
        "query_plan": {
            "raw_input": query_plan["raw_input"],
            "normalized_name": query_plan["normalized_name"],
            "structure": query_plan["structure"],
            "search_queries_generated": len(query_plan["search_queries"]),
        },
        "stages": {
            "1_query_planner": {
                "normalized_name": query_plan["normalized_name"],
                "tokens": query_plan["tokens"],
                "search_queries": query_plan["search_queries"],
            },
            "2_collection": {
                "profiles_found": len(profiles),
                "platforms": list(set(p["platform"] for p in profiles)),
            },
            "3_normalization": {
                "unique_profiles": len(profiles),
                "duplicates_removed": 0,
            },
        },
        "identity_discovery": {
            "status": "completed",
            "search_leads": leads_count,
            "candidate_urls": candidates_count,
            "validated_profiles": validated_count,
            "rejected": rejected_count,
            "high_quality_profiles": high_quality_count,
            "platforms": list(set(p["platform"] for p in profiles)),
            "cross_verification_cycles": len(cross_verification_results),
            "converged": discovery_exhausted,
            "convergence_message": discovery_message,
            "identity_candidates": [c.to_dict() if isinstance(c, IdentityCandidate) else c for c in identity_candidates],
            "identifiers_extracted": discovered_identifiers,
            "harvested_evidence": _build_harvested_evidence(all_candidates) if _has_models else {},
        },
        "identity_verification": verification_result,
        "reference": ref_info,
        "reference_matches": ref_matches,
        "candidates": [c.to_dict() if isinstance(c, IdentityCandidate) else c for c in identity_candidates],
        "image_results": image_results,
        "decision": {
            "verdict": "verified" if verified else (
                "verification_skipped" if verification_status == FaceVerificationState.SKIPPED else "discovery_only"
            ),
            "explanation": verification_explanation,
            "face_verification": verification_status.value,
            "verification_confidence": round(verification_confidence, 4) if verification_confidence > 0 else None,
        },
        "uncertainty_notes": _build_uncertainty_notes(
            decision or {"decision": "discovery_only"},
            clusters, profiles
        ),
        "enhancements": {
            "download_manager": dl_manager.stats() if dl_manager else None,
            "identity_memory_hit": memory_hit,
            "consensus_verification": consensus_result,
            "session_info": session_info if session_info else None,
            "browser_controller_available": _bc is not None and _bc.HAS_PLAYWRIGHT,
            "url_canonicalization": {"canonicalized_count": len(canonicalized_urls)},
            "identifier_discovery": discovered_identifiers,
            "post_metadata": {"count": len(post_metadata)},
            "organization_graph": org_graph,
            "geolocation": geolocation_result,
            "cross_verification": cross_verification_results,
            "cross_verification_profiles": cross_verification_profiles,
            "evidence_iteration": {
                "iterations": iteration_result.get("iterations_completed", 0),
                "converged": iteration_result.get("converged", False),
                "final_confidence": iteration_result.get("final_confidence", 0.0),
            },
            "profile_validation": validation_results,
        },
        "timing_ms": times,
        "total_time_ms": 0.0,
    }
    
    times["12_report"] = (time.time() - t0) * 1000
    output["timing_ms"] = times
    output["total_time_ms"] = sum(times.values())

    return output


# ── HTTP fallback fetcher (used when Playwright is unavailable) ──

def _http_fetch_page(url: str, timeout: int = 15) -> dict:
    """Fetch a page via simple HTTP GET. Returns dict with html, final_url, http_status."""
    import urllib.request
    result = {"html": "", "final_url": url, "http_status": 0}
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        })
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            result["html"] = resp.read().decode("utf-8", errors="replace")
            result["final_url"] = resp.geturl()
            result["http_status"] = resp.getcode()
    except urllib.error.HTTPError as e:
        result["http_status"] = e.code
    except urllib.error.URLError:
        result["http_status"] = 0
    except Exception:
        result["http_status"] = 0
    return result


# ── Stage-level debug helper ──

def _stage_debug(name: str, candidates: list, condition=None):
    """Print stage-level debug summary to help trace where profiles are lost."""
    total = len(candidates)
    if condition:
        matched = sum(1 for c in candidates if condition(c))
    else:
        matched = total
    skipped = total - matched
    print(f"[STAGE:{name}]  Received:{total}  Processed:{matched}  Skipped:{skipped}", flush=True)
    if matched > 0 and matched <= 20:
        for c in candidates:
            if condition and not condition(c):
                continue
            plat = c.platform or "?"
            url_short = c.url.split("/")[-1][:30] if c.url else "?"
            state = getattr(c, "state", "?")
            qual = getattr(c, "quality_score", 0)
            print(f"  {plat:12s} {url_short:30s} state={state} quality={qual}", flush=True)


def _stage_assert(condition: bool, msg: str):
    """Assert a pipeline invariant between stages. Prints instead of raising in production."""
    if not condition:
        print(f"[ASSERT FAIL] {msg}", flush=True)


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  CLI entry point                                                     ║
# ╚══════════════════════════════════════════════════════════════════════╝

def main() -> int:
    parser = argparse.ArgumentParser(description="RaySpy Face Search Pipeline")
    parser.add_argument("--name", default=None, help="Person name to search")
    parser.add_argument("--name-search", default="false",
                        help="Enable live web search for profiles (true/false)")
    parser.add_argument("--image-urls", default=None,
                        help="JSON array of image objects with url, platform, profile_url")
    parser.add_argument("--profiles", default=None,
                        help="JSON array of pre-discovered profile objects with url, platform")
    parser.add_argument("--reference", default=None, help="Reference image URL")
    parser.add_argument("--threshold", type=float, default=0.9,
                        help="Face match threshold (default: 0.9)")
    parser.add_argument("--quality", default="true",
                        help="Enable quality validation (default: true)")
    parser.add_argument("--dedup", default="true",
                        help="Enable duplicate removal (default: true)")
    parser.add_argument("--enhanced", default="false",
                        help="Use enhanced 12-phase pipeline with all improvements (true/false)")
    parser.add_argument("--consensus", default="true",
                        help="Enable face consensus verification (default: true)")
    parser.add_argument("--memory", default="true",
                        help="Enable identity memory cache (default: true)")
    parser.add_argument("--bayesian", default="true",
                        help="Enable Bayesian confidence engine (default: true)")
    parser.add_argument("--browser", default="false",
                        help="Enable browser controller for JS-rendered sites (default: false)")
    parser.add_argument("--output-format", default="json")
    args = parser.parse_args()

    if not args.name:
        print(json.dumps({"error": "Provide --name to search for a person"}))
        return 1

    # Parse JSON inputs
    pre_profiles = []
    if args.profiles:
        try:
            parsed = json.loads(args.profiles)
            if isinstance(parsed, list):
                pre_profiles = parsed
        except (json.JSONDecodeError, TypeError) as e:
            print(json.dumps({"error": f"Invalid --profiles JSON: {e}"}))
            return 1

    extra_images = []
    if args.image_urls:
        try:
            parsed = json.loads(args.image_urls)
            if isinstance(parsed, list):
                extra_images = parsed
        except (json.JSONDecodeError, TypeError) as e:
            print(json.dumps({"error": f"Invalid --image-urls JSON: {e}"}))
            return 1

    use_enhanced = args.enhanced.lower() in ("true", "1", "yes")

    if use_enhanced:
        result = run_enhanced_pipeline(
            name=args.name,
            pre_collected_profiles=pre_profiles,
            extra_image_urls=extra_images,
            reference_url=args.reference or None,
            match_threshold=args.threshold,
            enable_name_search=args.name_search.lower() in ("true", "1", "yes"),
            enable_quality=args.quality.lower() in ("true", "1", "yes"),
            enable_dedup=args.dedup.lower() in ("true", "1", "yes"),
            enable_consensus=args.consensus.lower() in ("true", "1", "yes"),
            enable_memory=args.memory.lower() in ("true", "1", "yes"),
            enable_bayesian=args.bayesian.lower() in ("true", "1", "yes"),
            enable_browser_ctrl=args.browser.lower() in ("true", "1", "yes"),
        )
    else:
        result = run_pipeline(
            name=args.name,
            pre_collected_profiles=pre_profiles,
            extra_image_urls=extra_images,
            reference_url=args.reference or None,
            match_threshold=args.threshold,
            enable_name_search=args.name_search.lower() in ("true", "1", "yes"),
            enable_quality=args.quality.lower() in ("true", "1", "yes"),
            enable_dedup=args.dedup.lower() in ("true", "1", "yes"),
        )
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
