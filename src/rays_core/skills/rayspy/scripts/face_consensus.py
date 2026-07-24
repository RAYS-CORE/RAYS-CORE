"""Face Consensus — multi-image verification.

Instead of comparing a single candidate image against a reference,
collect multiple images of the same person, generate embeddings,
remove duplicates, compute a centroid embedding, then compare.

Flow:
  Candidate Images
    → Remove Duplicates
    → Quality Filter
    → Generate Embeddings
    → Compute Centroid Embedding
    → Compare Against Reference
    → Consensus Score

Usage:
    consensus = FaceConsensus(engine)
    result = consensus.verify(reference_embedding, candidate_images, threshold=0.9)
    # Returns {verified, consensus_score, match_count, total_count, ...}
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np


class FaceConsensus:
    """Multi-image consensus verification.

    Uses a list of candidate image paths, extracts face embeddings,
    removes near-duplicates (detection score), computes centroid,
    and compares against a reference embedding.
    """

    def __init__(self, face_engine: Any, min_quality_size: int = 100):
        """
        Args:
            face_engine: An object with .get_faces(path) returning list of face dicts.
            min_quality_size: Minimum pixel dimension for a candidate image.
        """
        self.engine = face_engine
        self.min_quality_size = min_quality_size

    def verify(
        self,
        reference_embedding: list[float],
        candidate_paths: list[str | Path],
        threshold: float = 0.9,
        min_consensus_ratio: float = 0.6,
    ) -> dict:
        """Multi-stage face verification pipeline.

        Args:
            reference_embedding: The reference face embedding.
            candidate_paths: Paths to candidate images.
            threshold: Cosine similarity threshold for match.
            min_consensus_ratio: Minimum fraction of images that must match.

        Returns:
            Dict with verification result.
        """
        ref_emb = np.asarray(reference_embedding, dtype=np.float32)
        ref_norm = np.linalg.norm(ref_emb)
        if ref_norm > 0:
            ref_emb = ref_emb / ref_norm

        candidates = self._collect_candidates(candidate_paths)
        if not candidates:
            return {
                "verified": False,
                "consensus_score": 0.0,
                "match_count": 0,
                "total_count": 0,
                "rejection_reason": "no_faces_detected_in_candidates",
            }

        embeddings = [c["embedding"] for c in candidates]
        kept = self._dedup_by_embedding(embeddings, threshold=0.95)

        matches = 0
        similarities = []
        for idx in kept:
            emb = np.asarray(embeddings[idx], dtype=np.float32)
            sim = float(np.dot(ref_emb, emb))
            similarities.append(sim)
            if sim >= threshold:
                matches += 1

        total = len(kept)
        consensus_ratio = matches / max(total, 1)
        avg_similarity = sum(similarities) / max(len(similarities), 1)

        verified = consensus_ratio >= min_consensus_ratio and matches >= 2

        return {
            "verified": verified,
            "consensus_score": round(avg_similarity, 4),
            "consensus_ratio": round(consensus_ratio, 4),
            "match_count": matches,
            "total_count": total,
            "average_similarity": round(avg_similarity, 4),
            "similarities": [round(s, 4) for s in similarities],
            "kept_indices": kept,
            "all_match": matches == total if total > 0 else False,
        }

    def _collect_candidates(self, paths: list[str | Path]) -> list[dict]:
        """Extract best face from each candidate image."""
        candidates = []
        for p in paths:
            p = Path(p)
            if not p.exists():
                continue
            img = cv2.imread(str(p))
            if img is None:
                continue
            h, w = img.shape[:2]
            if h < self.min_quality_size or w < self.min_quality_size:
                continue

            faces = self.engine.get_faces(p)
            if not faces:
                continue

            # Pick largest face (by bbox area)
            best = max(faces, key=lambda f: (
                (f["bbox"][2] - f["bbox"][0]) * (f["bbox"][3] - f["bbox"][1])
                if f.get("bbox") and len(f["bbox"]) >= 4 else 0
            ))
            candidates.append({
                "path": str(p),
                "embedding": best["embedding"],
                "det_score": best.get("det_score", 0.0),
                "resolution": (w, h),
            })
        return candidates

    def _dedup_by_embedding(self, embeddings: list[list[float]], threshold: float = 0.95) -> list[int]:
        """Return indices of deduplicated embeddings (keep first)."""
        if not embeddings:
            return []
        kept = [0]
        refs = [np.asarray(embeddings[0], dtype=np.float32)]
        for i in range(1, len(embeddings)):
            emb = np.asarray(embeddings[i], dtype=np.float32)
            is_dup = False
            for ref in refs:
                sim = float(np.dot(emb, ref))
                if sim >= threshold:
                    is_dup = True
                    break
            if not is_dup:
                kept.append(i)
                refs.append(emb)
        return kept
