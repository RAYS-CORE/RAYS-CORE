"""Cross-platform workspace path resolution for agent/skills orchestration."""

from __future__ import annotations

from pathlib import Path


def resolve_workspace_path(codebase_root: Path, raw_path: str) -> Path:
    """
    Resolve a user- or model-supplied path under the workspace root.

    Accepts forward or back slashes on all platforms. Rejects paths that escape
    the workspace (``..`` or absolute paths outside the root).
    """
    root = Path(codebase_root).resolve()
    if raw_path is None:
        raise ValueError("path is required")

    text = str(raw_path).strip()
    if not text or text == ".":
        return root

    candidate = Path(text)
    if candidate.is_absolute():
        resolved = candidate.resolve()
    else:
        normalized = text.replace("\\", "/")
        while "//" in normalized:
            normalized = normalized.replace("//", "/")
        parts = [p for p in normalized.split("/") if p and p != "."]
        if any(p == ".." for p in parts):
            raise ValueError(f"path escapes workspace: {raw_path}")
        resolved = root.joinpath(*parts).resolve()

    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"path escapes workspace: {raw_path}") from exc
    return resolved
