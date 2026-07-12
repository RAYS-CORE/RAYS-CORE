"""Evidence Iteration Loop — iterative collection until confidence stabilizes.

The core idea from the skills.md: instead of a single-pass pipeline,
keep gathering evidence until confidence is sufficient or no new
information can be found.

Flow:
  Evidence Collection
    → Confidence Calculation
    → Confidence ≥ Threshold?
      → YES → Done (return result)
      → NO → Planner: what's missing?
        → More profiles? → Sherlock on usernames
        → More images? → Browser harvest on new profiles
        → More evidence? → SpiderFoot on emails/domains
        → Repeat

Each iteration deepens the evidence base until:
  (a) Confidence reaches DOMINANT_THRESHOLD (0.85)
  (b) No new profiles/images found after N iterations
  (c) Maximum iterations reached
"""

from __future__ import annotations

import time
from typing import Any, Callable, Optional

try:
    from . import dynamic_confidence as _dc
except ImportError:
    import dynamic_confidence as _dc
try:
    from . import source_reliability as _sr
except ImportError:
    import source_reliability as _sr

DOMINANT_THRESHOLD = 0.85
MIN_CONFIDENCE = 0.50
MAX_ITERATIONS = 5
STABILITY_ROUNDS = 2  # consecutive rounds with no new evidence


class EvidenceIterationLoop:
    """Iterative evidence collection and confidence evaluation.

    The planner decides what to collect next based on what's missing.
    """

    def __init__(
        self,
        confidence_engine: Optional[_dc.BayesianConfidence] = None,
        source_reliability: Optional[_sr.SourceReliability] = None,
    ):
        self.confidence = confidence_engine or _dc.BayesianConfidence()
        self.reliability = source_reliability or _sr.SourceReliability()
        self._iteration_history: list[dict] = []
        self._all_profiles: list[dict] = []
        self._all_images: list[dict] = []
        self._all_identifiers: dict = {
            "usernames": {},
            "emails": set(),
            "websites": set(),
        }

    def run(
        self,
        initial_profiles: list[dict],
        initial_images: list[dict],
        collect_profiles_fn: Callable,
        collect_images_fn: Callable,
        verify_fn: Callable,
        max_iterations: int = MAX_ITERATIONS,
        target_confidence: float = DOMINANT_THRESHOLD,
    ) -> dict:
        """Run the evidence iteration loop.

        Args:
            initial_profiles: Starting set of social media profiles.
            initial_images: Starting set of images.
            collect_profiles_fn: Callable(identifiers) → list[dict] new profiles.
            collect_images_fn: Callable(profiles) → list[dict] new images.
            verify_fn: Callable(images, profiles) → dict with confidence, clusters, decision.
            max_iterations: Maximum loop iterations.
            target_confidence: Stop when this confidence is reached.

        Returns:
            Dict with final result, iteration history, convergence info.
        """
        self._all_profiles = list(initial_profiles)
        self._all_images = list(initial_images)

        stable_rounds = 0
        prev_profile_count = len(self._all_profiles)
        prev_image_count = len(self._all_images)
        final_result = None

        for iteration in range(max_iterations):
            iter_start = time.time()

            # Step 1: Collect profiles based on current identifiers
            new_profiles = collect_profiles_fn(self._all_identifiers)
            for p in new_profiles:
                if p not in self._all_profiles:
                    self._all_profiles.append(p)

            # Step 2: Collect images from all profiles
            new_images = collect_images_fn(self._all_profiles)
            for img in new_images:
                if img not in self._all_images:
                    self._all_images.append(img)

            # Step 3: Verify (face matching, clustering, scoring)
            verify_result = verify_fn(self._all_images, self._all_profiles)
            final_result = verify_result

            # Step 4: Extract identifiers from verified accounts
            self._extract_identifiers(verify_result)

            # Step 5: Calculate confidence
            confidence = self._calculate_confidence(verify_result)

            # Step 6: Check stopping criteria
            new_profiles_this_iter = len(self._all_profiles) - prev_profile_count
            new_images_this_iter = len(self._all_images) - prev_image_count
            prev_profile_count = len(self._all_profiles)
            prev_image_count = len(self._all_images)

            iter_time = (time.time() - iter_start) * 1000

            self._iteration_history.append({
                "iteration": iteration,
                "confidence": confidence,
                "profiles_total": len(self._all_profiles),
                "images_total": len(self._all_images),
                "new_profiles": new_profiles_this_iter,
                "new_images": new_images_this_iter,
                "time_ms": round(iter_time, 2),
                "decision": verify_result.get("decision", {}).get("verdict", "unknown"),
            })

            # Stability check
            if new_profiles_this_iter == 0 and new_images_this_iter == 0:
                stable_rounds += 1
            else:
                stable_rounds = 0

            if confidence >= target_confidence:
                break

            if stable_rounds >= STABILITY_ROUNDS:
                break

        # Build final response
        return {
            "final_confidence": final_result.get("decision", {}).get("verdict_confidence", 0.0)
                if final_result else 0.0,
            "total_profiles": len(self._all_profiles),
            "total_images": len(self._all_images),
            "iterations_completed": len(self._iteration_history),
            "converged": stable_rounds < STABILITY_ROUNDS if self._iteration_history else False,
            "stable_rounds": stable_rounds,
            "iteration_history": self._iteration_history,
            "final_result": final_result,
            "all_profiles": self._all_profiles,
            "all_images": self._all_images,
            "identifiers": {
                "usernames": self._all_identifiers["usernames"],
                "emails": sorted(self._all_identifiers["emails"]),
                "websites": sorted(self._all_identifiers["websites"]),
            },
        }

    def _extract_identifiers(self, verify_result: dict):
        """Extract usernames, emails, websites from verification results."""
        candidates = verify_result.get("candidates", [])
        for c in candidates:
            for pu in c.get("profile_urls", []):
                for plat, pat in [
                    ("github", r"github\.com/([a-zA-Z0-9_-]+)"),
                    ("instagram", r"instagram\.com/([a-zA-Z0-9_.]+)"),
                    ("linkedin", r"linkedin\.com/in/([a-zA-Z0-9_-]+)"),
                    ("x", r"(?:x|twitter)\.com/([a-zA-Z0-9_]+)"),
                ]:
                    import re
                    m = re.search(pat, pu)
                    if m and plat not in self._all_identifiers["usernames"]:
                        self._all_identifiers["usernames"][plat] = m.group(1)

    def _calculate_confidence(self, verify_result: dict) -> float:
        """Calculate overall confidence from verification result."""
        candidates = verify_result.get("candidates", [])
        if not candidates:
            return 0.0
        top = candidates[0]
        return top.get("confidence", 0.0)
