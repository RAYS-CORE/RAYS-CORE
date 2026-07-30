#!/usr/bin/env python3
import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
FASTAPI_DIR = REPO_ROOT / "servers" / "fastapi"
NEXT_DIR = REPO_ROOT / "servers" / "nextjs"
NOTICE_PATH = REPO_ROOT / "NOTICE"

PY_LICENSE_CANDIDATES = [
    "LICENSE",
    "LICENSE.txt",
    "LICENSE.md",
    "LICENCE",
    "COPYING",
    "COPYING.txt",
    "NOTICE",
    "NOTICE.txt",
]

NODE_LICENSE_CANDIDATES = [
    "LICENSE",
    "LICENSE.txt",
    "LICENSE.md",
    "LICENCE",
    "LICENCE.txt",
    "COPYING",
    "COPYING.txt",
    "NOTICE",
    "NOTICE.txt",
]


def read_text_safe(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace").strip()
    except Exception:
        return ""


def parse_rfc822_metadata(text: str) -> Dict[str, str]:
    data: Dict[str, str] = {}
    key: Optional[str] = None
    for raw_line in text.splitlines():
        if not raw_line:
            key = None
            continue
        if raw_line[0] in " \t" and key:
            data[key] += "\n" + raw_line.strip()
            continue
        if ":" in raw_line:
            k, v = raw_line.split(":", 1)
            key = k.strip()
            data[key] = v.strip()
    return data


def find_python_site_packages(venv_dir: Path) -> Optional[Path]:
    # Linux/mac
    lib_dir = venv_dir / "lib"
    if lib_dir.exists():
        for child in lib_dir.iterdir():
            if child.is_dir() and child.name.startswith("python"):
                sp = child / "site-packages"
                if sp.exists():
                    return sp
    # Windows
    sp = venv_dir / "Lib" / "site-packages"
    if sp.exists():
        return sp
    return None


def detect_python_venv() -> Optional[Path]:
    env_path = os.environ.get("NOTICE_PYTHON_VENV")
    if env_path:
        v = Path(env_path)
        if v.exists():
            return v
    default = FASTAPI_DIR / ".venv"
    if default.exists():
        return default
    active = os.environ.get("VIRTUAL_ENV")
    if active and FASTAPI_DIR.as_posix() in Path(active).as_posix():
        return Path(active)
    return None


def scan_python_packages(site_packages_dir: Path) -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    dist_infos = sorted(site_packages_dir.glob("*.dist-info"))
    for dist in dist_infos:
        metadata_path = dist / "METADATA"
        if not metadata_path.exists():
            continue
        meta = parse_rfc822_metadata(read_text_safe(metadata_path))
        name = meta.get("Name", "").strip()
        version = meta.get("Version", "").strip()
        license_name = meta.get("License", "").strip()
        if not name:
            # Fallback to folder name pattern
            # e.g., requests-2.32.3.dist-info
            base = dist.name[:-10]
            if "-" in base:
                parts = base.rsplit("-", 1)
                if len(parts) == 2:
                    name = parts[0]
                    version = version or parts[1]
        author = meta.get("Author", meta.get("Maintainer", meta.get("Author-email", ""))).strip()

        # License text candidates inside dist-info
        license_text = ""
        for cand in PY_LICENSE_CANDIDATES:
            p = dist / cand
            if p.exists():
                license_text = read_text_safe(p)
                if license_text:
                    break

        # Search via RECORD for license files elsewhere
        if not license_text:
            record = dist / "RECORD"
            if record.exists():
                for line in read_text_safe(record).splitlines():
                    path_part = line.split(",", 1)[0]
                    lower = path_part.lower()
                    if any(token in lower for token in ["license", "licence", "copying", "notice"]):
                        target = site_packages_dir / path_part
                        if target.exists():
                            license_text = read_text_safe(target)
                            if license_text:
                                break

        # As last resort, embed the License: field content
        if not license_text and license_name:
            license_text = f"License field from METADATA:\n{license_name}"

        entries.append({
            "name": name or dist.name,
            "version": version,
            "license": license_name,
            "author": author,
            "license_text": license_text,
        })

    # Sort by name for stability
    entries.sort(key=lambda e: (e["name"].lower(), e["version"]))
    return entries


def find_license_file_in_dir(base_dir: Path, depth_limit: int = 2) -> Optional[Path]:
    # First, try immediate candidates
    for cand in NODE_LICENSE_CANDIDATES:
        p = base_dir / cand
        if p.exists():
            return p
        # case-insensitive check
        for child in base_dir.iterdir():
            if child.is_file() and child.name.lower() == cand.lower():
                return child

    # Recursive limited-depth scan excluding nested node_modules
    def walk(dir_path: Path, depth: int) -> Optional[Path]:
        if depth > depth_limit:
            return None
        try:
            it = list(dir_path.iterdir())
        except Exception:
            return None
        for child in it:
            name_lower = child.name.lower()
            if child.is_dir():
                if child.name == "node_modules" or child.name.startswith('.'):
                    continue
                found = walk(child, depth + 1)
                if found:
                    return found
            else:
                if any(tok in name_lower for tok in ["license", "licence", "copying", "notice"]):
                    return child
        return None

    return walk(base_dir, 0)


def scan_node_modules(node_modules_dir: Path) -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    seen: set[str] = set()

    def visit_pkg(pkg_dir: Path):
        pkg_json = pkg_dir / "package.json"
        if not pkg_json.exists():
            return
        try:
            data = json.loads(read_text_safe(pkg_json) or "{}")
        except Exception:
            return
        name = data.get("name") or pkg_dir.name
        version = str(data.get("version") or "")
        key = f"{name}@{version}"
        if key in seen:
            return
        seen.add(key)

        license_name = ""
        lic_field = data.get("license")
        if isinstance(lic_field, str):
            license_name = lic_field
        elif isinstance(lic_field, dict):
            license_name = lic_field.get("type", "")
        elif isinstance(data.get("licenses"), list):
            license_name = ", ".join([str(x.get("type", "")) for x in data["licenses"] if isinstance(x, dict)])

        author = ""
        a = data.get("author")
        if isinstance(a, str):
            author = a
        elif isinstance(a, dict):
            author = a.get("name", "")

        license_text = ""
        lic_file = find_license_file_in_dir(pkg_dir, depth_limit=2)
        if lic_file:
            license_text = read_text_safe(lic_file)

        entries.append({
            "name": name,
            "version": version,
            "license": license_name,
            "author": author,
            "license_text": license_text,
        })

    def walk_node_modules(base: Path):
        if not base.exists():
            return
        for entry in base.iterdir():
            if not entry.is_dir():
                continue
            if entry.name == ".bin":
                continue
            if entry.name.startswith("@"):  # scoped packages
                for scoped in entry.iterdir():
                    if scoped.is_dir():
                        visit_pkg(scoped)
                        # nested node_modules inside the package
                        nested = scoped / "node_modules"
                        walk_node_modules(nested)
                continue
            visit_pkg(entry)
            nested = entry / "node_modules"
            walk_node_modules(nested)

    walk_node_modules(node_modules_dir)
    # Sort by package name
    entries.sort(key=lambda e: (e["name"].lower(), e["version"]))
    return entries


def format_section(title: str, entries: List[Dict[str, str]]) -> str:
    header = [
        "-------------------------------------",
        title,
        "-------------------------------------",
        "",
    ]
    lines: List[str] = ["\n".join(header)]
    for e in entries:
        block = [
            e.get("name", "").strip(),
            e.get("version", "").strip(),
            e.get("license", "").strip(),
            e.get("author", "").strip(),
            "",
            (e.get("license_text", "") or "LICENSE TEXT NOT FOUND").strip(),
            "",
            "",
        ]
        lines.append("\n".join(block))
    return "".join(lines).rstrip() + "\n"


def main():
    # Optional CLI overrides
    import argparse
    parser = argparse.ArgumentParser(description="Rebuild NOTICE from installed packages")
    parser.add_argument("--python-venv", dest="python_venv", default=None, help="Path to Python venv to scan")
    parser.add_argument("--node-modules", dest="node_modules", default=None, help="Path to node_modules to scan")
    args = parser.parse_args()
    python_entries: List[Dict[str, str]] = []
    node_entries: List[Dict[str, str]] = []

    # Python scan
    venv = Path(args.python_venv) if args.python_venv else detect_python_venv()
    if venv:
        sp = find_python_site_packages(venv)
        if sp and sp.exists():
            python_entries = scan_python_packages(sp)
        else:
            print(f"Warning: site-packages not found under {venv}", file=sys.stderr)
    else:
        print("Warning: Python venv not found. Set NOTICE_PYTHON_VENV or create servers/fastapi/.venv", file=sys.stderr)

    # Node scan
    node_modules_dir = Path(args.node_modules or os.environ.get("NOTICE_NODE_MODULES") or (NEXT_DIR / "node_modules"))
    if node_modules_dir.exists():
        node_entries = scan_node_modules(node_modules_dir)
    else:
        print(f"Warning: node_modules not found at {node_modules_dir}", file=sys.stderr)

    # Build NOTICE content
    parts: List[str] = []
    if python_entries:
        parts.append(format_section("PYTHON PACKAGES", python_entries))
    if node_entries:
        parts.append(format_section("NODE PACKAGES", node_entries))
    if not parts:
        print("Error: No sections generated. Ensure .venv and node_modules exist.", file=sys.stderr)
        sys.exit(1)

    content = "\n".join(parts)
    NOTICE_PATH.write_text(content, encoding="utf-8")
    print("NOTICE rebuilt from installed packages")


if __name__ == "__main__":
    main()


