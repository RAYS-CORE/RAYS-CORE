"""Resolve RAYS_HOME for standalone skill scripts.

Skill scripts may run outside the RAYS-CORE process (e.g. system Python,
nix env, CI) where ``rays-core_constants`` is not importable.  This module
provides the same ``get_rays_core_home()`` and ``display_rays_core_home()``
contracts as ``rays-core_constants`` without requiring it on ``sys.path``.

When ``rays-core_constants`` IS available it is used directly so that any
future enhancements (profile resolution, Docker detection, etc.) are
picked up automatically.  The fallback path replicates the core logic
from ``rays-core_constants.py`` using only the stdlib.

All scripts under ``google-workspace/scripts/`` should import from here
instead of duplicating the ``RAYS_HOME = Path(os.getenv(...))`` pattern.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from rays-core_constants import display_rays_core_home as display_rays_core_home
    from rays-core_constants import get_rays_core_home as get_rays_core_home
except (ModuleNotFoundError, ImportError):

    def get_rays_core_home() -> Path:
        """Return the RAYS-CORE home directory (default: ~/.rays-core).

        Mirrors ``rays-core_constants.get_rays_core_home()``."""
        val = os.environ.get("RAYS_HOME", "").strip()
        return Path(val) if val else Path.home() / ".rays-core"

    def display_rays_core_home() -> str:
        """Return a user-friendly ``~/``-shortened display string.

        Mirrors ``rays-core_constants.display_rays_core_home()``."""
        home = get_rays_core_home()
        try:
            return "~/" + str(home.relative_to(Path.home()))
        except ValueError:
            return str(home)
