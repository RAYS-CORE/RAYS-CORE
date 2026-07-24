"""Identity Memory — persistent embedding cache per person.

Once a person is verified, their face embeddings are cached.
On subsequent investigations, the cached embedding serves as
an immediate reference — no need to recompute from scratch.

Storage: JSON file keyed by normalized name → list of embeddings.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Optional

import numpy as np

MEMORY_DIR = os.path.join(tempfile.gettempdir(), "raySpy_identity_memory")


class IdentityMemory:
    """Persistent cache of known identity embeddings."""

    def __init__(self, memory_dir: str = MEMORY_DIR):
        self.memory_dir = Path(memory_dir)
        self.memory_dir.mkdir(parents=True, exist_ok=True)
        self._path = self.memory_dir / "identities.json"
        self._data: dict[str, dict] = {}  # name -> {embeddings, metadata, timestamp}
        self._load()

    def _load(self):
        if self._path.exists():
            try:
                self._data = json.loads(self._path.read_text())
            except (json.JSONDecodeError, IOError):
                self._data = {}

    def _save(self):
        self._path.write_text(json.dumps(self._data, indent=2, default=str))

    def remember(self, name: str, embeddings: list[list[float]], metadata: Optional[dict] = None):
        """Store embeddings for a verified identity."""
        key = name.strip().lower()
        self._data[key] = {
            "name": name,
            "embeddings": embeddings,
            "metadata": metadata or {},
            "timestamp": str(Path(__file__).stat().st_mtime),
            "embedding_count": len(embeddings),
            "centroid": self._compute_centroid(embeddings),
        }
        self._save()

    def recall(self, name: str) -> Optional[dict]:
        """Retrieve stored identity data for a name."""
        key = name.strip().lower()
        entry = self._data.get(key)
        if entry:
            return entry
        for stored_key, stored_val in self._data.items():
            if key in stored_key or stored_key in key:
                return stored_val
        return None

    def get_centroid(self, name: str) -> Optional[list[float]]:
        entry = self.recall(name)
        if entry and "centroid" in entry:
            return entry["centroid"]
        if entry and "embeddings" in entry:
            return self._compute_centroid(entry["embeddings"])
        return None

    def match_against_memory(self, embedding: list[float], threshold: float = 0.9) -> list[tuple[str, float]]:
        """Compare an embedding against all known identities.

        Returns list of (name, similarity) sorted by similarity descending.
        """
        results = []
        emb = np.asarray(embedding, dtype=np.float32)
        for key, entry in self._data.items():
            centroid = entry.get("centroid")
            if centroid:
                sim = float(np.dot(emb, np.asarray(centroid, dtype=np.float32)))
                if sim >= threshold:
                    results.append((entry.get("name", key), sim))
            else:
                for stored_emb in entry.get("embeddings", []):
                    sim = float(np.dot(emb, np.asarray(stored_emb, dtype=np.float32)))
                    if sim >= threshold:
                        results.append((entry.get("name", key), sim))
                        break
        results.sort(key=lambda x: x[1], reverse=True)
        return results

    def forget(self, name: str):
        key = name.strip().lower()
        self._data.pop(key, None)
        self._save()

    def list_known(self) -> list[str]:
        return [v.get("name", k) for k, v in self._data.items()]

    def clear(self):
        self._data.clear()
        self._save()

    @staticmethod
    def _compute_centroid(embeddings: list[list[float]]) -> list[float]:
        if not embeddings:
            return []
        arr = np.asarray(embeddings, dtype=np.float32)
        centroid = arr.mean(axis=0)
        norm = np.linalg.norm(centroid)
        if norm > 0:
            centroid = centroid / norm
        return centroid.tolist()


_global_memory: Optional[IdentityMemory] = None


def get_global() -> IdentityMemory:
    global _global_memory
    if _global_memory is None:
        _global_memory = IdentityMemory()
    return _global_memory
