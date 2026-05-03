"""
Ensure every tracked .py file byte-compiles.
Catches syntax errors early without invoking the interactive CLI or LLMs.
"""

from pathlib import Path

# Directories / path parts to skip (dependencies, artifacts, SCM).
SKIP_PARTS = frozenset({
    ".git",
    ".github",
    ".venv",
    "venv",
    "env",
    "dist",
    "build",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".eggs",
    "node_modules",
})


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def test_all_project_python_files_compile():
    root = _project_root()
    for path in sorted(root.rglob("*.py")):
        if any(part in SKIP_PARTS for part in path.parts):
            continue
        source = path.read_text(encoding="utf-8")
        compile(source, str(path), "exec", dont_inherit=True)
