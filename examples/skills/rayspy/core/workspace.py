"""Workspace — central state and directory structure for an investigation."""

import os
import json
import shutil
from pathlib import Path


WORKSPACE_DIRS = ["accounts", "related", "network", "locations", "tools", "evidence"]


class Workspace:
    def __init__(self, base_dir: str, target_name: str):
        safe = target_name.lower().replace(" ", "_").replace("/", "_")
        self.root = Path(base_dir) / f"workspace_{safe}"
        self._dirs = {name: self.root / name for name in WORKSPACE_DIRS}
        self._state = {
            "target": target_name,
            "status": "initialized",
            "stage": "workspace_created",
            "candidates": [],
            "evidence": [],
            "faces": [],
            "identities": [],
        }

    def create(self):
        self.root.mkdir(parents=True, exist_ok=True)
        for d in self._dirs.values():
            d.mkdir(exist_ok=True)

    def destroy(self):
        if self.root.exists():
            shutil.rmtree(self.root)

    def path(self, subdir: str) -> Path:
        return self._dirs.get(subdir, self.root)

    def resolve(self, subdir: str, *parts: str) -> Path:
        return self._dirs.get(subdir, self.root).joinpath(*parts)

    @property
    def accounts_dir(self) -> Path:
        return self._dirs["accounts"]

    @property
    def evidence_dir(self) -> Path:
        return self._dirs["evidence"]

    @property
    def locations_dir(self) -> Path:
        return self._dirs["locations"]

    def save_state(self):
        path = self.root / "workspace_state.json"
        with open(path, "w") as f:
            json.dump(self._state, f, indent=2, default=str)

    def load_state(self):
        path = self.root / "workspace_state.json"
        if path.exists():
            with open(path) as f:
                self._state.update(json.load(f))

    def update_state(self, **kw):
        self._state.update(kw)
