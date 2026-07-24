from __future__ import annotations
from .base_validator import BaseValidator, ValidationResult
import re


class RedditValidator(BaseValidator):
    def validate(self, url: str, html: str, dom: dict | None = None) -> ValidationResult:
        signals = []
        matched_neg = self._check_patterns(html, self.rules.get("negative_indicators", []))
        if matched_neg:
            return self._not_found(f"Reddit: {matched_neg[0]}", signals=matched_neg)

        matched_susp = self._check_patterns(html, self.rules.get("suspended_indicators", []))
        if matched_susp:
            return self._suspended(f"Reddit: {matched_susp[0]}", signals=matched_susp)

        matched_priv = self._check_patterns(html, self.rules.get("private_indicators", []))
        if matched_priv:
            return self._private(f"Reddit: {matched_priv[0]}", signals=matched_priv)

        matched_login = self._check_patterns(html, self.rules.get("login_indicators", []))
        if matched_login:
            return self._login_required("Reddit: Login required", signals=matched_login)

        matched_pos = self._check_patterns(html, self.rules.get("positive_indicators", []))
        if matched_pos:
            signals.extend(matched_pos)
            confidence = self._compute_confidence(matched_pos, matched_neg)
            return self._found(f"Reddit profile found: {len(matched_pos)} positive signals",
                               confidence=confidence, signals=signals)

        return self._not_found("Reddit: No recognizable profile signals", signals=signals)

    def _compute_confidence(self, positives: list[str], negatives: list[str]) -> float:
        weights = self.rules.get("confidence_weights", {})
        base = 0.5
        for p in positives:
            for key, w in weights.items():
                if key in p.lower() or p.lower() in key:
                    base += w
        for n in negatives:
            base += weights.get("negative_match", -0.5)
        return max(0.0, min(1.0, base))
