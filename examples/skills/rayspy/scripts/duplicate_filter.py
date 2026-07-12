"""Module 8: Duplicate Filter — remove near-duplicate images before face matching.

Three-level dedup strategy:
  1. dHash (Difference Hash): fast, catches exact and near-exact duplicates
  2. Perceptual Hash (pHash via OpenCV): catches resized / recompressed copies
  3. Face embedding cosine similarity: catches same face different photos

Configuration:
  HASH_THRESHOLD: Hamming distance threshold for dHash (default: 10)
  EMBEDDING_THRESHOLD: Cosine similarity for face embedding (default: 0.95)
"""

from __future__ import annotations

import contextlib
import io
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

HASH_THRESHOLD = 10
EMBEDDING_THRESHOLD = 0.95

_face_engine = None


def _get_face_engine():
    global _face_engine
    if _face_engine is None:
        with contextlib.redirect_stdout(io.StringIO()):
            with contextlib.redirect_stderr(io.StringIO()):
                from insightface.app import FaceAnalysis
                _face_engine = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
                _face_engine.prepare(ctx_id=0, det_size=(640, 640))
    return _face_engine


def _dhash(img: np.ndarray, hash_size: int = 8) -> int:
    """Compute difference hash (dHash) of an image."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (hash_size + 1, hash_size))
    diff = resized[:, 1:] > resized[:, :-1]
    return sum(int(v) << i for i, v in enumerate(diff.flatten()))


def _phash(img: np.ndarray, hash_size: int = 8) -> int:
    """Compute perceptual hash (pHash) using DCT.

    Simplified version: resize to 32x32, DCT, take top-left 8x8, compare medians.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Resize to 32x32
    resized = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_LINEAR)
    # Convert to float for DCT
    float_img = np.float32(resized)
    # DCT
    dct = cv2.dct(float_img)
    # Take top-left 8x8
    dct_low = dct[:hash_size, :hash_size]
    # Compute median
    med = np.median(dct_low)
    # Generate hash: 1 if > median, 0 otherwise
    diff = dct_low > med
    return sum(int(v) << i for i, v in enumerate(diff.flatten()))


def _hamming_distance(h1: int, h2: int) -> int:
    return bin(h1 ^ h2).count("1")


def _get_embedding(img: np.ndarray) -> Optional[np.ndarray]:
    """Extract face embedding from an image."""
    engine = _get_face_engine()
    faces = engine.get(img)
    if len(faces) != 1:
        return None
    return np.asarray(faces[0].normed_embedding, dtype=np.float32)


def compute_hashes(image_path: str | Path) -> dict:
    """Compute dHash and pHash for an image.

    Returns dict with dhash, phash, resolution, and file_size.
    """
    path = Path(image_path)
    img = cv2.imread(str(path))
    if img is None:
        return {"error": "corrupt_image"}

    h, w = img.shape[:2]
    return {
        "dhash": _dhash(img),
        "phash": _phash(img),
        "resolution": (w, h),
        "file_size": path.stat().st_size,
    }


def filter_duplicates(
    images: list[dict],
    hash_threshold: int = HASH_THRESHOLD,
    embedding_threshold: float = EMBEDDING_THRESHOLD,
    use_embedding: bool = True,
) -> list[dict]:
    """Remove near-duplicate images from a list.

    Args:
        images: List of image dicts, each with at least 'local_path' key.
        hash_threshold: Hamming distance threshold for dHash/pHash.
        embedding_threshold: Cosine similarity threshold for face embeddings.
        use_embedding: Whether to use face embedding dedup.

    Returns:
        Filtered list with duplicates removed. Keeps the highest-resolution
        image from each duplicate group.
    """
    if not images:
        return []

    # Compute hashes for all images
    hash_data: list[dict] = []
    for item in images:
        local = item.get("local_path")
        if not local:
            continue
        hashes = compute_hashes(local)
        if "error" in hashes:
            continue
        hashes["item"] = item
        hash_data.append(hashes)

    if not hash_data:
        return images

    # Level 1: Dedup by dHash
    groups: list[list[int]] = []
    used = set()
    for i, h1 in enumerate(hash_data):
        if i in used:
            continue
        group = [i]
        for j, h2 in enumerate(hash_data):
            if j > i and j not in used:
                d_dist = _hamming_distance(h1["dhash"], h2["dhash"])
                p_dist = _hamming_distance(h1["phash"], h2["phash"])
                if d_dist <= hash_threshold or p_dist <= hash_threshold:
                    group.append(j)
        used.update(group)
        groups.append(group)

    # Within each group, keep the highest resolution image
    deduped = []
    for group in groups:
        best_idx = max(
            group,
            key=lambda idx: (
                hash_data[idx]["resolution"][0] * hash_data[idx]["resolution"][1],
                hash_data[idx]["file_size"],
            ),
        )
        deduped.append(hash_data[best_idx]["item"])

    # Level 2: Dedup by face embedding (if multiple images remain)
    if use_embedding and len(deduped) >= 2:
        embedding_groups: list[list[int]] = []
        embedded_items: list[tuple[int, np.ndarray, dict]] = []
        for idx, item in enumerate(deduped):
            local = item.get("local_path")
            if not local:
                continue
            img = cv2.imread(str(local))
            if img is None:
                continue
            emb = _get_embedding(img)
            if emb is not None:
                embedded_items.append((idx, emb, item))

        if embedded_items:
            emb_used = set()
            for i, (idx1, emb1, _) in enumerate(embedded_items):
                if i in emb_used:
                    continue
                group = [i]
                for j, (idx2, emb2, _) in enumerate(embedded_items):
                    if j > i and j not in emb_used:
                        sim = float(np.dot(emb1, emb2))
                        if sim >= embedding_threshold:
                            group.append(j)
                emb_used.update(group)
                embedding_groups.append([embedded_items[gi][0] for gi in group])

            # Keep best from each embedding group
            embedding_deduped = set()
            for eg in embedding_groups:
                best = max(eg, key=lambda idx: (
                    deduped[idx].get("resolution", (0, 0))[0] * deduped[idx].get("resolution", (0, 0))[1]
                ))
                embedding_deduped.add(best)
            deduped = [deduped[i] for i in embedding_deduped]

    return deduped
