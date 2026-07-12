"""Investigation Registry — single source of truth backed by investigation.json.

Every module reads/writes through this registry. Nothing bypasses it.
"""

import json
import os
from pathlib import Path
from typing import Optional
from uuid import uuid4


CANDIDATE_STATES = [
    "LEAD", "DISCOVERED", "CANONICALIZED", "PAGE_LOADED", "PAGE_CLASSIFIED",
    "PROFILE_VALIDATED", "HARVESTED", "QUALITY_CHECKED", "FACE_CLUSTERED",
    "IDENTITY_RESOLVED", "VERIFIED", "REJECTED",
]

VALIDATION_STATES = [
    "FOUND_PUBLIC", "FOUND_LOGIN_REQUIRED", "FOUND_PRIVATE", "FOUND_LIMITED",
    "NOT_FOUND", "SUSPENDED", "DELETED", "ERROR",
]

REJECT_STATES = {"NOT_FOUND", "SUSPENDED", "DELETED"}


def _default():
    return {
        "investigation_id": "",
        "target_name": "",
        "status": "initialized",
        "created_at": "",
        "updated_at": "",
        "candidates": [],
        "evidence": [],
        "face_registry": [],
        "graphs": {"evidence": {}, "identity": {}, "organization": {}, "relationship": {}},
        "identities": [],
        "report": None,
    }


class InvestigationRegistry:
    def __init__(self, workspace_root: str):
        self._path = Path(workspace_root) / "investigation.json"
        self._data = _default()
        self._dirty = False
        self._load()

    # ── Persistence ──────────────────────────────────────────────────────

    def _load(self):
        if self._path.exists():
            try:
                with open(self._path) as f:
                    self._data.update(json.load(f))
            except (json.JSONDecodeError, OSError):
                pass

    def save(self):
        self._data["updated_at"] = __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ")
        with open(self._path, "w") as f:
            json.dump(self._data, f, indent=2, default=str)
        self._dirty = False

    def flush(self):
        if self._dirty:
            self.save()

    @property
    def path(self) -> Path:
        return self._path

    # ── Meta ─────────────────────────────────────────────────────────────

    def init(self, target_name: str):
        import time
        self._data["investigation_id"] = f"inv_{uuid4().hex[:12]}"
        self._data["target_name"] = target_name
        self._data["status"] = "running"
        self._data["created_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
        self._dirty = True

    @property
    def investigation_id(self) -> str:
        return self._data.get("investigation_id", "")

    @property
    def target_name(self) -> str:
        return self._data.get("target_name", "")

    @property
    def status(self) -> str:
        return self._data.get("status", "")

    def set_status(self, status: str):
        self._data["status"] = status
        self._dirty = True

    # ── Candidates ───────────────────────────────────────────────────────

    def add_candidate(self, platform: str, url: str, username: str = "",
                      source: str = "sherlock", source_confidence: float = 0.0) -> str:
        cid = f"cand_{uuid4().hex[:12]}"
        self._data["candidates"].append({
            "candidate_id": cid,
            "platform": platform,
            "url": url,
            "username": username,
            "display_name": "",
            "source": source,
            "source_confidence": source_confidence,
            "state": "LEAD",
            "state_history": [("CREATED", f"Added from {source}")],
            "canonical_url": None,
            "final_url": None,
            "http_status": None,
            "dom": None,
            "validation_status": None,
            "validation_reason": "",
            "quality_score": 0,
            "quality_signals": {},
            "images": [],
            "faces": [],
            "evidence": [],
            "graph_nodes": [],
            "bio": None,
            "image_url": None,
        })
        self._dirty = True
        return cid

    def get_candidate(self, candidate_id: str) -> Optional[dict]:
        for c in self._data["candidates"]:
            if c["candidate_id"] == candidate_id:
                return c
        return None

    def get_candidate_by_url(self, url: str) -> Optional[dict]:
        for c in self._data["candidates"]:
            if c["url"] == url or c.get("canonical_url") == url or c.get("final_url") == url:
                return c
        return None

    def update_candidate(self, candidate_id: str, **kw):
        c = self.get_candidate(candidate_id)
        if c:
            c.update(kw)
            self._dirty = True

    def transition_candidate(self, candidate_id: str, new_state: str, reason: str = ""):
        c = self.get_candidate(candidate_id)
        if c:
            c["state_history"].append((c["state"], reason))
            c["state"] = new_state
            self._dirty = True

    def candidates_by_state(self, state: str) -> list[dict]:
        return [c for c in self._data["candidates"] if c["state"] == state]

    def candidates_by_platform(self, platform: str) -> list[dict]:
        return [c for c in self._data["candidates"] if c["platform"] == platform]

    def all_candidates(self) -> list[dict]:
        return list(self._data["candidates"])

    def candidate_count(self) -> int:
        return len(self._data["candidates"])

    def validated_candidates(self, min_quality: float = 30) -> list[dict]:
        result = []
        for c in self._data["candidates"]:
            if c["state"] not in ("PROFILE_VALIDATED", "HARVESTED", "QUALITY_CHECKED",
                                  "FACE_CLUSTERED", "IDENTITY_RESOLVED", "VERIFIED"):
                continue
            vs = c.get("validation_status")
            if vs in REJECT_STATES:
                continue
            if c.get("quality_score", 0) < min_quality:
                continue
            result.append(c)
        return result

    # ── Evidence ─────────────────────────────────────────────────────────

    def add_evidence(self, candidate_id: str, evidence_type: str,
                     source: str, weight: float, description: str):
        self._data["evidence"].append({
            "evidence_id": f"ev_{uuid4().hex[:12]}",
            "candidate_id": candidate_id,
            "type": evidence_type,
            "source": source,
            "weight": weight,
            "description": description,
        })
        self._dirty = True

    def evidence_for_candidate(self, candidate_id: str) -> list[dict]:
        return [e for e in self._data["evidence"] if e["candidate_id"] == candidate_id]

    def all_evidence(self) -> list[dict]:
        return list(self._data["evidence"])

    # ── Face Registry ────────────────────────────────────────────────────

    def add_face(self, candidate_id: str, platform: str, image_url: str,
                 quality: float = 0.0, confidence: float = 0.0,
                 pose: str = "", resolution: str = "", embedding_path: str = ""):
        self._data["face_registry"].append({
            "face_id": f"face_{uuid4().hex[:12]}",
            "candidate_id": candidate_id,
            "platform": platform,
            "image_url": image_url,
            "quality": quality,
            "confidence": confidence,
            "pose": pose,
            "resolution": resolution,
            "embedding_path": embedding_path,
            "cluster_id": None,
        })
        self._dirty = True

    def faces_for_candidate(self, candidate_id: str) -> list[dict]:
        return [f for f in self._data["face_registry"] if f["candidate_id"] == candidate_id]

    def all_faces(self) -> list[dict]:
        return list(self._data["face_registry"])

    def set_face_cluster(self, face_id: str, cluster_id: str):
        for f in self._data["face_registry"]:
            if f["face_id"] == face_id:
                f["cluster_id"] = cluster_id
                self._dirty = True
                break

    # ── Graphs ───────────────────────────────────────────────────────────

    def graph(self, name: str) -> dict:
        return self._data["graphs"].get(name, {})

    def add_graph_edge(self, graph_name: str, source: str, target: str,
                       relation: str, weight: float = 1.0):
        g = self._data["graphs"].setdefault(graph_name, {"nodes": [], "edges": []})
        g.setdefault("edges", []).append({
            "source": source, "target": target,
            "relation": relation, "weight": weight,
        })
        seen_nodes = set(n["id"] for n in g.get("nodes", []))
        for nid in (source, target):
            if nid not in seen_nodes:
                g.setdefault("nodes", []).append({"id": nid})
                seen_nodes.add(nid)
        self._dirty = True

    # ── Identities ───────────────────────────────────────────────────────

    def add_identity(self, name: str, confidence: float,
                     candidates: list[str], evidence_ids: list[str]):
        self._data["identities"].append({
            "identity_id": f"id_{uuid4().hex[:12]}",
            "name": name,
            "confidence": confidence,
            "candidate_ids": candidates,
            "evidence_ids": evidence_ids,
            "face_verified": False,
        })
        self._dirty = True

    # ── Reporting ────────────────────────────────────────────────────────

    def evidence_chain(self) -> dict:
        c = self._data["candidates"]
        return {
            "leads": sum(1 for x in c if x["source"] in ("sherlock", "SHERLOCK")),
            "candidates": len(c),
            "canonicalized": sum(1 for x in c if x["state"] in ("CANONICALIZED",) or x.get("canonical_url")),
            "page_loaded": sum(1 for x in c if x.get("http_status") is not None),
            "page_classified": sum(1 for x in c if x["state"] == "PAGE_CLASSIFIED" or "classify" in str(x.get("state_history", [])).lower()),
            "profile_validated": sum(1 for x in c if x["state"] in ("PROFILE_VALIDATED", "HARVESTED", "QUALITY_CHECKED", "FACE_CLUSTERED", "IDENTITY_RESOLVED", "VERIFIED")),
            "rejected": sum(1 for x in c if x["state"] == "REJECTED"),
            "harvested": sum(1 for x in c if x["state"] in ("HARVESTED", "QUALITY_CHECKED", "FACE_CLUSTERED", "IDENTITY_RESOLVED", "VERIFIED")),
            "quality_checked": sum(1 for x in c if x["state"] in ("QUALITY_CHECKED", "FACE_CLUSTERED", "IDENTITY_RESOLVED", "VERIFIED") and x.get("quality_score", 0) >= 30),
            "face_clustered": sum(1 for x in c if x["state"] in ("FACE_CLUSTERED", "IDENTITY_RESOLVED", "VERIFIED")),
            "identity_resolved": sum(1 for x in c if x["state"] in ("IDENTITY_RESOLVED", "VERIFIED")),
            "verified": sum(1 for x in c if x["state"] == "VERIFIED"),
        }
