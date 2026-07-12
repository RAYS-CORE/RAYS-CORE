"""Person matcher sidecar — image-based face matching with InsightFace.

Accepts image URLs (profile photos, reference photos, web-found images)
and cross-compares face embeddings to find matches above threshold.

Two input modes:
  1. --image-urls JSON:  [{"id": "profile_x", "url": "https://..."}, ...]
  2. --name TEXT + optional --name-search-results JSON: profile URLs found by JS side

Process:
  1. Download each image
  2. Extract face embeddings via InsightFace (buffalo_l)
  3. Compare all pairs via cosine similarity
  4. Cluster identities (union-find, >= threshold)
  5. Return matched groups

Usage:
  python person_matcher_sidecar.py --image-urls '[{"id":"p1","url":"https://..."}]' --threshold 0.9
  python person_matcher_sidecar.py --name "John Doe" --reference https://...jpg
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _fetch_bytes(url: str, timeout: int = 20) -> bytes | None:
    # Handle local file paths
    if not url.startswith(("http://", "https://", "file://")):
        try:
            p = Path(url)
            if p.exists():
                return p.read_bytes()
        except Exception:
            pass
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except Exception:
        return None


def _resolve_path(url: str) -> Path | None:
    """If url is a local path, return resolved Path."""
    if not url.startswith(("http://", "https://", "file://")):
        p = Path(url)
        if p.exists():
            return p
    return None


def _download(url: str) -> Path | None:
    # Local file — just return path
    local = _resolve_path(url)
    if local:
        return local
    # Remote URL — download to temp
    data = _fetch_bytes(url)
    if not data:
        return None
    tmp = Path(tempfile.mkdtemp()) / f"face_{os.urandom(4).hex()}.jpg"
    try:
        tmp.write_bytes(data)
        return tmp
    except Exception:
        return None


class FaceEngine:
    """Wraps InsightFace for face detection + embedding extraction."""

    def __init__(self):
        with contextlib.redirect_stdout(io.StringIO()):
            with contextlib.redirect_stderr(io.StringIO()):
                from insightface.app import FaceAnalysis
                self.app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
                self.app.prepare(ctx_id=0, det_size=(640, 640))

    def get_faces(self, image_path: Path) -> list[dict]:
        import cv2
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


def cosine_similarity(a: list[float], b: list[float]) -> float:
    return float(np.dot(np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)))


def run_pipeline(
    image_items: list[dict],
    reference_url: str | None = None,
    match_threshold: float = 0.9,
) -> dict:
    """
    image_items: [{"id": str, "url": str, "platform": str, "profile_url": str, ...}, ...]
    """
    engine = FaceEngine()
    results: list[dict] = []   # {id, image_url, faces: [...]}

    # Download and extract faces from each image
    for item in image_items:
        img_url = item.get("url") or item.get("image_url")
        if not img_url:
            results.append({**item, "faces": [], "face_count": 0, "error": "no_url"})
            continue
        path = _download(img_url)
        if path is None:
            results.append({**item, "faces": [], "face_count": 0, "error": "download_failed"})
            continue
        faces = engine.get_faces(path)
        results.append({**item, "faces": faces, "face_count": len(faces)})

    # Build flat face list with back-references
    all_faces: list[dict] = []
    face_origins: list[dict] = []
    for r in results:
        for i, f in enumerate(r.get("faces", [])):
            all_faces.append(f)
            face_origins.append({
                "id": r.get("id", "?"),
                "image_url": r.get("url") or r.get("image_url"),
                "platform": r.get("platform"),
                "profile_url": r.get("profile_url"),
                "face_idx": i,
            })

    n = len(all_faces)

    # Reference image — process separately and include in output
    ref_matches: list[dict] = []
    ref_embedding: list[float] | None = None
    ref_face_info: dict | None = None
    if reference_url:
        ref_path = _download(reference_url)
        if ref_path:
            ref_faces = engine.get_faces(ref_path)
            if ref_faces:
                ref_embedding = ref_faces[0].get("embedding")
                ref_face_info = {
                    "id": "reference",
                    "image_url": reference_url,
                    "platform": "reference",
                    "face_detected": True,
                    "face_count": len(ref_faces),
                    "gender": ref_faces[0].get("gender"),
                    "age": ref_faces[0].get("age"),
                }
                for idx, (f, origin) in enumerate(zip(all_faces, face_origins)):
                    sim = cosine_similarity(ref_embedding, f["embedding"])
                    if sim >= match_threshold:
                        ref_matches.append({
                            "face_index": idx,
                            "similarity": round(sim, 4),
                            "origin": origin,
                        })

    # Pairwise cross-matches
    pairs: list[dict] = []
    for i in range(n):
        for j in range(i + 1, n):
            sim = cosine_similarity(all_faces[i]["embedding"], all_faces[j]["embedding"])
            if sim >= match_threshold:
                pairs.append({
                    "i": i, "j": j,
                    "similarity": round(sim, 4),
                    "origin_i": face_origins[i],
                    "origin_j": face_origins[j],
                })

    # Union-find clustering
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

    for p in pairs:
        union(p["i"], p["j"])

    clusters: dict[int, list[int]] = {}
    for i in range(n):
        clusters.setdefault(find(i), []).append(i)

    cluster_list = []
    for root, indices in clusters.items():
        if len(indices) < 2:
            continue
        cluster_origins = [face_origins[i] for i in indices]
        similarities = [p["similarity"] for p in pairs if p["i"] in indices and p["j"] in indices]
        profile_urls = list(set(o.get("profile_url", "") for o in cluster_origins if o.get("profile_url")))
        platforms = list(set(o.get("platform", "") for o in cluster_origins if o.get("platform")))
        cluster_list.append({
            "face_count": len(indices),
            "face_indices": indices,
            "average_similarity": round(sum(similarities) / len(similarities), 4) if similarities else 0,
            "max_similarity": round(max(similarities), 4) if similarities else 0,
            "profile_urls": profile_urls,
            "platforms": platforms,
        })

    # Build matched_persons summary
    matched_persons = []
    for cl in cluster_list:
        matched_persons.append({
            "face_count": cl["face_count"],
            "max_similarity": cl["max_similarity"],
            "profile_urls": cl["profile_urls"],
            "platforms": cl["platforms"],
        })

    face_results_list = [
        {
            "id": r.get("id"),
            "image_url": r.get("url") or r.get("image_url"),
            "platform": r.get("platform"),
            "profile_url": r.get("profile_url"),
            "face_detected": r.get("face_count", 0) > 0,
            "face_count": r.get("face_count", 0),
            "gender": r["faces"][0]["gender"] if r.get("faces") else None,
            "age": r["faces"][0]["age"] if r.get("faces") else None,
        }
        for r in results
    ]
    if ref_face_info:
        face_results_list.append(ref_face_info)

    return {
        "images_processed": len(results) + (1 if ref_face_info else 0),
        "total_faces_detected": n + (ref_face_info["face_count"] if ref_face_info else 0),
        "cross_matches": len(pairs),
        "identity_clusters": len(cluster_list),
        "matched_person_count": len(matched_persons),
        "face_results": face_results_list,
        "reference_matches": ref_matches,
        "reference_face": ref_face_info,
        "clusters": cluster_list,
        "matched_persons": matched_persons,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Person matcher — face cross-matching")
    parser.add_argument("--image-urls", default=None, help="JSON array of image objects with url, id fields")
    parser.add_argument("--name", default=None, help="Person name (used as display label)")
    parser.add_argument("--reference", default=None, help="Reference image URL for direct comparison")
    parser.add_argument("--threshold", type=float, default=0.9, help="Face match threshold (default: 0.9)")
    parser.add_argument("--output-format", default="json")
    args = parser.parse_args()

    image_items = []
    if args.image_urls:
        try:
            parsed_urls = json.loads(args.image_urls)
            if isinstance(parsed_urls, list):
                image_items = parsed_urls
        except (json.JSONDecodeError, TypeError) as e:
            print(json.dumps({"error": f"Invalid --image-urls JSON: {e}"}))
            return 1

    # Skip running pipeline only if no images AND no reference AND no name
    has_reference = bool(args.reference)
    if not image_items and not has_reference:
        if args.name:
            print(json.dumps({
                "query_name": args.name,
                "message": "No images provided and no reference image. "
                           "Pass --image-urls and/or --reference to enable face matching.",
                "images_processed": 0,
                "total_faces_detected": 0,
            }))
            return 0
        else:
            print(json.dumps({"error": "Provide --image-urls, --reference, or --name"}))
            return 1

    # Even with empty image_items, run_pipeline handles the reference case
    result = run_pipeline(
        image_items=image_items,
        reference_url=args.reference,
        match_threshold=args.threshold,
    )
    result["query_name"] = args.name
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
