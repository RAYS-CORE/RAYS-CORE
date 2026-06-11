"""ChromaDB PersistentClient factory.

Chromadb 0.6.x calls posthog.capture(distinct_id, event, properties) (pre-6 API).
Posthog 6+ only accepts capture(event, distinct_id=..., properties=...).
We shim the legacy call shape and disable telemetry so init stays quiet.
"""

from __future__ import annotations

import chromadb
from chromadb.config import Settings

_CHROMA_SETTINGS = Settings(anonymized_telemetry=False)
_PATCHED = False


def _patch_posthog_capture() -> None:
    global _PATCHED
    if _PATCHED:
        return
    try:
        import posthog
    except ImportError:
        _PATCHED = True
        return

    def _noop_capture(*_args, **_kwargs):
        return None

    posthog.capture = _noop_capture  # type: ignore[method-assign]
    _PATCHED = True


_patch_posthog_capture()


def persistent_client(path: str) -> chromadb.ClientAPI:
    return chromadb.PersistentClient(path=path, settings=_CHROMA_SETTINGS)
