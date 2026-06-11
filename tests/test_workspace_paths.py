import pytest
from pathlib import Path

from rays_core.workspace_paths import resolve_workspace_path


@pytest.fixture
def root(tmp_path: Path) -> Path:
    ws = tmp_path / "project"
    ws.mkdir()
    (ws / "skills" / "docx").mkdir(parents=True)
    (ws / "skills" / "docx" / "out.md").write_text("hello", encoding="utf-8")
    return ws.resolve()


def test_forward_slashes_on_all_platforms(root: Path) -> None:
    p = resolve_workspace_path(root, "skills/docx/out.md")
    assert p == (root / "skills" / "docx" / "out.md").resolve()


def test_backslashes(root: Path) -> None:
    p = resolve_workspace_path(root, "skills\\docx\\out.md")
    assert p == (root / "skills" / "docx" / "out.md").resolve()


def test_dot_is_workspace_root(root: Path) -> None:
    assert resolve_workspace_path(root, ".") == root


def test_rejects_parent_escape(root: Path) -> None:
    with pytest.raises(ValueError, match="escapes workspace"):
        resolve_workspace_path(root, "../outside")


def test_rejects_absolute_outside_workspace(root: Path) -> None:
    outside = (root.parent.parent / "elsewhere").resolve()
    outside.mkdir(exist_ok=True)
    with pytest.raises(ValueError, match="escapes workspace"):
        resolve_workspace_path(root, str(outside))


def test_allows_absolute_inside_workspace(root: Path) -> None:
    target = root / "skills" / "docx" / "out.md"
    p = resolve_workspace_path(root, str(target))
    assert p == target.resolve()
