"""Face Engine — multi-image pipeline with embedding extraction, clustering, and matching."""

import os
import json
import numpy as np
from pathlib import Path
from typing import Optional

try:
    from sklearn.cluster import DBSCAN
    HAS_DBSCAN = True
except ImportError:
    HAS_DBSCAN = False

try:
    from deepface import DeepFace
    HAS_DEEPFACE = True
except ImportError:
    HAS_DEEPFACE = False

FACE_REGISTRY_FILE = "face_registry.npy"


class FaceEngine:
    def __init__(self, workspace_root: str, eps: float = 0.5, min_samples: int = 1):
        self._root = Path(workspace_root)
        self._registry_path = self._root / FACE_REGISTRY_FILE
        self._eps = eps
        self._min_samples = min_samples
        self._embeddings: list[np.ndarray] = []
        self._metadata: list[dict] = []
        self._load_registry()

    def _load_registry(self):
        if self._registry_path.exists():
            try:
                data = np.load(self._registry_path, allow_pickle=True)
                if isinstance(data, np.ndarray) and data.ndim == 0:
                    data = data.item()
                if isinstance(data, dict):
                    self._embeddings = list(data.get("embeddings", []))
                    self._metadata = list(data.get("metadata", []))
            except Exception:
                pass

    def _save_registry(self):
        data = np.array({"embeddings": self._embeddings, "metadata": self._metadata},
                        dtype=object)
        np.save(self._registry_path, data)

    def extract_embedding(self, image_path: str) -> Optional[np.ndarray]:
        if not HAS_DEEPFACE or not os.path.isfile(image_path):
            return None
        try:
            result = DeepFace.represent(img_path=image_path,
                                        model_name="Facenet512",
                                        enforce_detection=False)
            emb = np.array(result[0]["embedding"], dtype=np.float32)
            return emb
        except Exception:
            return None

    def register_face(self, embedding: np.ndarray, candidate_id: str,
                      platform: str, image_url: str, quality: float = 1.0):
        idx = len(self._embeddings)
        self._embeddings.append(embedding)
        self._metadata.append({
            "index": idx,
            "candidate_id": candidate_id,
            "platform": platform,
            "image_url": image_url,
            "quality": quality,
            "cluster_id": None,
        })
        self._save_registry()

    def cluster_faces(self) -> list[dict]:
        if not HAS_DBSCAN or len(self._embeddings) < 2:
            return self._metadata

        embs = np.stack(self._embeddings, axis=0)
        labels = DBSCAN(eps=self._eps, min_samples=self._min_samples,
                        metric="cosine").fit_predict(embs)

        for i, meta in enumerate(self._metadata):
            cid = str(labels[i]) if labels[i] >= 0 else f"noise_{i}"
            meta["cluster_id"] = cid

        self._save_registry()
        return self._metadata

    def match_faces(self, query_embedding: np.ndarray,
                    threshold: float = 0.4) -> list[dict]:
        if len(self._embeddings) == 0:
            return []
        results = []
        for i, emb in enumerate(self._embeddings):
            sim = float(np.dot(query_embedding, emb) /
                        (np.linalg.norm(query_embedding) * np.linalg.norm(emb) + 1e-8))
            if sim >= threshold:
                results.append({**self._metadata[i], "similarity": sim})
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results

    def count(self) -> int:
        return len(self._embeddings)

    def clusters(self) -> dict[str, list[dict]]:
        groups = {}
        for meta in self._metadata:
            cid = meta.get("cluster_id", "unassigned")
            groups.setdefault(cid, []).append(meta)
        return groups
