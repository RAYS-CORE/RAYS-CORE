"""Resolve RAYS_HOME for standalone skill scripts.

Skill scripts may run outside the Rays process (e.g. system Python,
nix env, CI) where ``rays_constants`` is not importable.  This module
provides the same ``get_rays_home()`` and ``display_rays_home()``
contracts as ``rays_constants`` without requiring it on ``sys.path``.

When ``rays_constants`` IS available it is used directly so that any
future enhancements (profile resolution, Docker detection, etc.) are
picked up automatically.  The fallback path replicates the core logic
from ``rays_constants.py`` using only the stdlib.

All scripts under ``google-workspace/scripts/`` should import from here
instead of duplicating the ``RAYS_HOME = Path(os.getenv(...))`` pattern.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from rays_constants import display_rays_home as display_rays_home
    from rays_constants import get_rays_home as get_rays_home
except (ModuleNotFoundError, ImportError):

    def get_rays_home() -> Path:
        """Return the Rays home directory (default: ~/.rays).

        Mirrors ``rays_constants.get_rays_home()``."""
        val = os.environ.get("RAYS_HOME", "").strip()
        return Path(val) if val else Path.home() / ".rays"

    def display_rays_home() -> str:
        """Return a user-friendly ``~/``-shortened display string.

        Mirrors ``rays_constants.display_rays_home()``."""
        home = get_rays_home()
        try:
            return "~/" + str(home.relative_to(Path.home()))
        except ValueError:
            return str(home)
