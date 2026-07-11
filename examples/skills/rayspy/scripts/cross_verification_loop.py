"""Cross-Verification Loop — adaptive multi-platform discovery via verified identities.

Flow:
  Verified Identity (name / handle / email)
    → Adaptive Search (generate platform-specific queries)
    → New Accounts Found
    → Harvest (optional browser)
    → Face Verify (optional)
    → Verified?
      → YES → Extract identifiers (handle, email, org)
      → Generate More Queries
      → Repeat
      → NO → Stop

This replaces Sherlock/SpiderFoot with adaptive DDG search.
"""

from __future__ import annotations

import json
import time
from typing import Any, Optional

try:
    from . import adaptive_searcher as _as
except ImportError:
    import adaptive_searcher as _as

try:
    from . import identifier_discovery as _id
except ImportError:
    import identifier_discovery as _id

try:
    from . import url_canonicalizer as _uc
except ImportError:
    import url_canonicalizer as _uc

MAX_ITERATIONS = 5


class CrossVerificationLoop:
    """Iterative cross-verification using adaptive search."""

    def __init__(
        self,
        searcher: Optional[_as.AdaptiveSearcher] = None,
        identifier_extractor: Optional[_id.IdentifierDiscovery] = None,
    ):
        self.searcher = searcher or _as.AdaptiveSearcher()
        self.extractor = identifier_extractor or _id.IdentifierDiscovery()
        self._discovered_profiles: list[dict] = []
        self._verified_accounts: list[dict] = []
        self._all_identifiers: dict = {
            "names": set(),
            "usernames": {},
            "emails": set(),
            "websites": set(),
            "organizations": set(),
        }

    def run(
        self,
        initial_identifiers: dict,
        max_iterations: int = MAX_ITERATIONS,
    ) -> dict:
        """Run the cross-verification loop starting from initial identifiers.

        Args:
            initial_identifiers: Dict with keys: usernames, emails, websites, names.
            max_iterations: Maximum depth of iterative discovery.

        Returns:
            Dict with all discovered profiles, verified accounts, identifiers.
        """
        # Seed the searcher with known identifiers
        for plat, handle in initial_identifiers.get("usernames", {}).items():
            self.searcher.register_handle(plat, handle)
            self._all_identifiers["usernames"][plat] = handle
            self._all_identifiers["names"].add(handle)

        for email in initial_identifiers.get("emails", []):
            self.searcher.register_email(email)
            self._all_identifiers["emails"].add(email)

        for url in initial_identifiers.get("websites", []):
            self._all_identifiers["websites"].add(url)

        for name in initial_identifiers.get("names", []):
            self.searcher.register_name(name)
            self._all_identifiers["names"].add(name)

        iteration_history = []

        for iteration in range(max_iterations):
            iter_result = self._iteration(iteration)
            iteration_history.append(iter_result)

            if not iter_result.get("new_profiles_found"):
                break

        return {
            "total_iterations": len(iteration_history),
            "total_profiles_discovered": len(self._discovered_profiles),
            "total_verified": len(self._verified_accounts),
            "all_identifiers": {
                "names": sorted(self._all_identifiers["names"]),
                "usernames": dict(self._all_identifiers["usernames"]),
                "emails": sorted(self._all_identifiers["emails"]),
                "websites": sorted(self._all_identifiers["websites"]),
                "organizations": sorted(self._all_identifiers["organizations"]),
            },
            "discovered_profiles": self._discovered_profiles,
            "verified_accounts": self._verified_accounts,
            "iteration_history": iteration_history,
        }

    def _iteration(self, iteration_num: int) -> dict:
        """Single iteration: generate queries → search → harvest → extract identifiers."""
        result = {
            "iteration": iteration_num,
            "queries_run": 0,
            "new_profiles_found": 0,
            "new_verified": 0,
        }

        # Step 1: Run adaptive search
        search_result = self.searcher.iterate(max_iterations=1, max_queries_per_iter=15)
        new_profiles = search_result.get("profiles", [])

        # Step 2: Register new profiles
        for p in new_profiles:
            if p not in self._discovered_profiles:
                self._discovered_profiles.append(p)
                self.searcher.register_from_profile(p)
                result["new_profiles_found"] += 1

        result["queries_run"] = len(search_result.get("iteration_history", [{}])[0].get("queries", [])) if search_result.get("iteration_history") else 0

        # Step 3: Extract identifiers from discovered profiles
        for p in self._discovered_profiles:
            identifiers = self.extractor.extract_from_profiles([p])
            self._merge_identifiers(identifiers)

        result["new_identifiers"] = {
            "names": sorted(self._all_identifiers["names"]),
            "usernames": dict(self._all_identifiers["usernames"]),
            "emails": sorted(self._all_identifiers["emails"]),
        }

        return result

    def _merge_identifiers(self, identifiers: dict):
        for plat, uname in identifiers.get("usernames", {}).items():
            if plat not in self._all_identifiers["usernames"]:
                self._all_identifiers["usernames"][plat] = uname
                self.searcher.register_handle(plat, uname)
        for email in identifiers.get("emails", []):
            self._all_identifiers["emails"].add(email)
            self.searcher.register_email(email)
        for site in identifiers.get("websites", []):
            self._all_identifiers["websites"].add(site)
