"""Universal multi-root file citation resolver (@filename) across any directory."""
import os
import re
from pathlib import Path
from typing import List, Dict, Tuple, Optional


class CitationResolver:
    """Finds @file references in prompts and resolves them to absolute paths and excerpts."""

    # Matches @path/to/file.ext or @"path with spaces" or @file.ext
    CITATION_PATTERN = re.compile(r'@(?:"([^"]+)"|\'([^\']+)\'|([A-Za-z0-9_\-./\\]+\.[A-Za-z0-9_\-]+))')

    def __init__(self, root_search_dirs: Optional[List[str]] = None):
        self.root_search_dirs = [Path(d).resolve() for d in (root_search_dirs or [os.getcwd()])]

    def resolve_prompt_citations(self, raw_prompt: str, cwd_hint: Optional[str] = None) -> Tuple[str, List[Dict[str, str]]]:
        """
        Parses @citations in raw_prompt and replaces them with clean absolute paths.
        
        Returns:
            Tuple[resolved_prompt, list_of_cited_file_metadata]
        """
        search_roots = list(self.root_search_dirs)
        if cwd_hint:
            search_roots.insert(0, Path(cwd_hint).resolve())

        cited_files: List[Dict[str, str]] = []

        def _replace_citation(match: re.Match) -> str:
            path_str = match.group(1) or match.group(2) or match.group(3)
            if not path_str:
                return match.group(0)

            resolved_path = self._find_file(path_str, search_roots)
            if resolved_path:
                cited_files.append({
                    "raw_citation": match.group(0),
                    "resolved_path": str(resolved_path),
                    "file_name": resolved_path.name,
                    "exists": str(resolved_path.exists())
                })
                return f"@{resolved_path}"
            return match.group(0)

        resolved_prompt = self.CITATION_PATTERN.sub(_replace_citation, raw_prompt)
        return resolved_prompt, cited_files

    def _find_file(self, path_str: str, search_roots: List[Path]) -> Optional[Path]:
        """Resolve a relative or fuzzy path string to an actual Path object."""
        # 1. Absolute path check
        p = Path(path_str).expanduser()
        if p.is_absolute() and p.exists():
            return p.resolve()

        # 2. Check directly relative to each search root
        for root in search_roots:
            candidate = (root / p).resolve()
            if candidate.exists():
                return candidate

        # 3. Fuzzy search for filename across search roots (up to 3 levels deep)
        file_name = p.name
        for root in search_roots:
            if not root.exists() or not root.is_dir():
                continue
            try:
                for candidate in root.glob(f"**/{file_name}"):
                    if candidate.is_file():
                        return candidate.resolve()
            except Exception:
                continue

        # If not found on disk, return normalized path relative to first root
        return (search_roots[0] / p).resolve() if search_roots else p.resolve()
