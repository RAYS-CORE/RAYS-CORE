"""Validator plugins. Each exports a callable with signature:

    validate(url: str, platform: str, dom: str = "") -> dict

Returns dict with keys: status, http_status, reason, final_url, dom
"""

from .sherlock_validator import validate as sherlock_validate

BUILTIN = sherlock_validate
