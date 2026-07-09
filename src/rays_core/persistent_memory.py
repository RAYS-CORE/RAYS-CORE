import os
import json
import logging
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

ENTRY_DELIMITER = "\n§\n"

# msvcrt locking for Windows, fcntl for unix
msvcrt = None
try:
    import fcntl
except ImportError:
    fcntl = None
    try:
        import msvcrt
    except ImportError:
        pass

def atomic_replace(src: str, dst: str):
    """Atomically replace dst with src."""
    try:
        os.replace(src, dst)
    except OSError as e:
        if os.name == 'nt' and getattr(e, 'winerror', 0) == 5:
            # Access denied on Windows can sometimes be worked around
            try:
                os.remove(dst)
                os.rename(src, dst)
            except OSError:
                raise e
        else:
            raise e


def _drift_error(path: Path, bak_path: str) -> Dict[str, Any]:
    return {
        "success": False,
        "error": (
            f"Refusing to write {path.name}: file on disk has content that "
            f"wouldn't round-trip through the memory tool. "
            f"A snapshot was saved to {bak_path}. Resolve the drift first."
        ),
        "drift_backup": bak_path,
        "remediation": "Check the backup file and manually merge changes.",
    }


class MemoryStore:
    """
    Bounded curated memory with file persistence. One instance per session.

    Maintains two parallel states:
      - _system_prompt_snapshot: frozen at load time, used for system prompt injection.
      - memory_entries / user_entries: live state, mutated by tool calls.
    """
    _MAX_CONSOLIDATION_FAILURES_PER_TURN = 3

    def __init__(self, codebase_root: Path, memory_char_limit: int = 4000, user_char_limit: int = 4000):
        self.memory_entries: List[str] = []
        self.user_entries: List[str] = []
        self.memory_char_limit = memory_char_limit
        self.user_char_limit = user_char_limit
        self.codebase_root = codebase_root
        
        self.memory_dir = self.codebase_root / ".rays" / "memory"
        
        self._system_prompt_snapshot: Dict[str, str] = {"memory": "", "user": ""}
        self._consolidation_failures = 0

    def load_from_disk(self):
        """Load entries from MEMORY.md and USER.md, capture system prompt snapshot."""
        self.memory_dir.mkdir(parents=True, exist_ok=True)

        self.memory_entries = self._read_file(self.memory_dir / "MEMORY.md")
        self.user_entries = self._read_file(self.memory_dir / "USER.md")

        self.memory_entries = list(dict.fromkeys(self.memory_entries))
        self.user_entries = list(dict.fromkeys(self.user_entries))

        self._system_prompt_snapshot = {
            "memory": self._render_block("memory", self.memory_entries),
            "user": self._render_block("user", self.user_entries),
        }

    @staticmethod
    @contextmanager
    def _file_lock(path: Path):
        lock_path = path.with_suffix(path.suffix + ".lock")
        lock_path.parent.mkdir(parents=True, exist_ok=True)

        if fcntl is None and msvcrt is None:
            yield
            return

        fd = open(lock_path, "a+", encoding="utf-8")
        try:
            if fcntl:
                fcntl.flock(fd, fcntl.LOCK_EX)
            else:
                fd.seek(0)
                msvcrt.locking(fd.fileno(), msvcrt.LK_LOCK, 1)
            yield
        finally:
            if fcntl:
                try:
                    fcntl.flock(fd, fcntl.LOCK_UN)
                except (OSError, IOError):
                    pass
            elif msvcrt:
                try:
                    fd.seek(0)
                    msvcrt.locking(fd.fileno(), msvcrt.LK_UNLCK, 1)
                except (OSError, IOError):
                    pass
            fd.close()

    def _path_for(self, target: str) -> Path:
        if target == "user":
            return self.memory_dir / "USER.md"
        return self.memory_dir / "MEMORY.md"

    def _reload_target(self, target: str, skip_drift: bool = False) -> Optional[str]:
        path = self._path_for(target)
        bak = None if skip_drift else self._detect_external_drift(target)
        fresh = self._read_file(path)
        fresh = list(dict.fromkeys(fresh))
        if target == "user":
            self.user_entries = fresh
        else:
            self.memory_entries = fresh
        return bak

    def save_to_disk(self, target: str):
        self.memory_dir.mkdir(parents=True, exist_ok=True)
        entries = self.user_entries if target == "user" else self.memory_entries
        self._write_file(self._path_for(target), entries)

    def _char_count(self, target: str) -> int:
        entries = self.user_entries if target == "user" else self.memory_entries
        if not entries:
            return 0
        return len(ENTRY_DELIMITER.join(entries))

    def _char_limit(self, target: str) -> int:
        return self.user_char_limit if target == "user" else self.memory_char_limit

    def add(self, target: str, content: str) -> Dict[str, Any]:
        content = content.strip()
        if not content:
            return {"success": False, "error": "Content cannot be empty."}

        with self._file_lock(self._path_for(target)):
            self._reload_target(target, skip_drift=True)
            entries = self.user_entries if target == "user" else self.memory_entries
            limit = self._char_limit(target)

            if content in entries:
                return self._success_response(target, "Entry already exists.")

            new_entries = entries + [content]
            new_total = len(ENTRY_DELIMITER.join(new_entries))

            if new_total > limit:
                return self._consolidation_failure({
                    "success": False,
                    "error": f"Memory limit exceeded. Adding this would exceed {limit} chars.",
                    "current_entries": entries
                })

            entries.append(content)
            self.save_to_disk(target)

        return self._success_response(target, "Entry added.")

    def replace(self, target: str, old_text: str, new_content: str) -> Dict[str, Any]:
        old_text = old_text.strip()
        new_content = new_content.strip()
        if not old_text:
            return {"success": False, "error": "old_text cannot be empty."}
        if not new_content:
            return {"success": False, "error": "new_content cannot be empty."}

        with self._file_lock(self._path_for(target)):
            bak = self._reload_target(target)
            if bak:
                return _drift_error(self._path_for(target), bak)

            entries = self.user_entries if target == "user" else self.memory_entries
            matches = [(i, e) for i, e in enumerate(entries) if old_text in e]

            if not matches:
                return {"success": False, "error": f"No entry matched '{old_text}'."}

            if len(matches) > 1:
                unique_texts = {e for _, e in matches}
                if len(unique_texts) > 1:
                    return {"success": False, "error": "Multiple entries matched."}
            
            idx = matches[0][0]
            limit = self._char_limit(target)
            
            test_entries = entries.copy()
            test_entries[idx] = new_content
            if len(ENTRY_DELIMITER.join(test_entries)) > limit:
                return {"success": False, "error": "Replacement exceeds char limit."}

            entries[idx] = new_content
            self.save_to_disk(target)

        return self._success_response(target, "Entry replaced.")

    def remove(self, target: str, old_text: str) -> Dict[str, Any]:
        old_text = old_text.strip()
        if not old_text:
            return {"success": False, "error": "old_text cannot be empty."}

        with self._file_lock(self._path_for(target)):
            bak = self._reload_target(target)
            if bak:
                return _drift_error(self._path_for(target), bak)

            entries = self.user_entries if target == "user" else self.memory_entries
            matches = [(i, e) for i, e in enumerate(entries) if old_text in e]

            if not matches:
                return {"success": False, "error": f"No entry matched '{old_text}'."}

            if len(matches) > 1:
                unique_texts = {e for _, e in matches}
                if len(unique_texts) > 1:
                    return {"success": False, "error": "Multiple entries matched."}
            
            idx = matches[0][0]
            entries.pop(idx)
            self.save_to_disk(target)

        return self._success_response(target, "Entry removed.")
        
    def apply_batch(self, target: str, operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not operations:
            return {"success": False, "error": "operations list is empty."}
            
        with self._file_lock(self._path_for(target)):
            bak = self._reload_target(target)
            if bak:
                return _drift_error(self._path_for(target), bak)
                
            entries = self.user_entries if target == "user" else self.memory_entries
            working: List[str] = list(entries)
            limit = self._char_limit(target)
            
            for i, op in enumerate(operations):
                op = op or {}
                act = op.get("action")
                content = (op.get("content") or "").strip()
                old_text = (op.get("old_text") or "").strip()
                pos = f"Operation {i + 1} ({act or 'unknown'})"
                
                if act == "add":
                    if not content: return {"success": False, "error": f"{pos}: content required."}
                    if content not in working:
                        working.append(content)
                elif act == "replace":
                    if not old_text: return {"success": False, "error": f"{pos}: old_text required."}
                    matches = [j for j, e in enumerate(working) if old_text in e]
                    if not matches: return {"success": False, "error": f"{pos}: no match found."}
                    working[matches[0]] = content
                elif act == "remove":
                    if not old_text: return {"success": False, "error": f"{pos}: old_text required."}
                    matches = [j for j, e in enumerate(working) if old_text in e]
                    if not matches: return {"success": False, "error": f"{pos}: no match found."}
                    working.pop(matches[0])
                else:
                    return {"success": False, "error": f"{pos}: unknown action."}
                    
            if working and len(ENTRY_DELIMITER.join(working)) > limit:
                return {"success": False, "error": "Batch exceeds memory limits."}
                
            if target == "user":
                self.user_entries = working
            else:
                self.memory_entries = working
                
            self.save_to_disk(target)
            
        return self._success_response(target, f"Applied {len(operations)} operations.")

    def format_for_system_prompt(self) -> str:
        blocks = []
        user_block = self._system_prompt_snapshot.get("user")
        mem_block = self._system_prompt_snapshot.get("memory")
        if user_block:
            blocks.append(user_block)
        if mem_block:
            blocks.append(mem_block)
        
        if not blocks:
            return ""
            
        return (
            "<memory-context>\n"
            "[System note: The following is recalled memory context, "
            "NOT new user input. Treat as authoritative reference data — "
            "this is the agent's persistent memory and should inform all responses.]\n\n"
            + "\n\n".join(blocks) +
            "\n</memory-context>"
        )

    def _consolidation_failure(self, response: Dict[str, Any]) -> Dict[str, Any]:
        self._consolidation_failures += 1
        if self._consolidation_failures <= self._MAX_CONSOLIDATION_FAILURES_PER_TURN:
            return response
        return {
            "success": False,
            "done": True,
            "error": "Memory consolidation failed too many times."
        }

    def _success_response(self, target: str, message: str = "") -> Dict[str, Any]:
        self._consolidation_failures = 0
        return {
            "success": True,
            "done": True,
            "target": target,
            "message": message,
            "note": "Write saved."
        }

    def _render_block(self, target: str, entries: List[str]) -> str:
        if not entries:
            return ""
        limit = self._char_limit(target)
        content = ENTRY_DELIMITER.join(entries)
        current = len(content)
        pct = min(100, int((current / limit) * 100)) if limit > 0 else 0

        header = (
            f"USER PROFILE (who the user is) [{pct}% — {current:,}/{limit:,} chars]"
            if target == "user"
            else f"MEMORY (your personal notes) [{pct}% — {current:,}/{limit:,} chars]"
        )
        separator = "═" * 46
        return f"{separator}\n{header}\n{separator}\n{content}"

    @staticmethod
    def _read_file(path: Path) -> List[str]:
        if not path.exists():
            return []
        try:
            raw = path.read_text(encoding="utf-8")
        except (OSError, IOError):
            return []
        if not raw.strip():
            return []
        entries = [e.strip() for e in raw.split(ENTRY_DELIMITER)]
        return [e for e in entries if e]

    def _detect_external_drift(self, target: str) -> Optional[str]:
        path = self._path_for(target)
        if not path.exists():
            return None
        try:
            raw = path.read_text(encoding="utf-8")
        except (OSError, IOError):
            return None
        if not raw.strip():
            return None

        parsed = [e.strip() for e in raw.split(ENTRY_DELIMITER) if e.strip()]
        roundtrip = ENTRY_DELIMITER.join(parsed)

        char_limit = self._char_limit(target)
        max_entry_len = max((len(e) for e in parsed), default=0)

        if (raw.strip() != roundtrip) or (max_entry_len > char_limit):
            ts = int(time.time())
            bak_path = path.with_suffix(path.suffix + f".bak.{ts}")
            try:
                bak_path.write_text(raw, encoding="utf-8")
            except (OSError, IOError):
                pass
            return str(bak_path)
        return None

    @staticmethod
    def _write_file(path: Path, entries: List[str]):
        content = ENTRY_DELIMITER.join(entries) if entries else ""
        try:
            fd, tmp_path = tempfile.mkstemp(
                dir=str(path.parent), suffix=".tmp", prefix=".mem_"
            )
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    f.write(content)
                    f.flush()
                    os.fsync(f.fileno())
                atomic_replace(tmp_path, str(path))
            except BaseException:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                raise
        except (OSError, IOError) as e:
            raise RuntimeError(f"Failed to write memory file {path}: {e}")
