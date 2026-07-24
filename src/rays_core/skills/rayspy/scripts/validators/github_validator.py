from __future__ import annotations
from .base_validator import BaseValidator, ValidationResult
import re


class GitHubValidator(BaseValidator):
    def validate(self, url: str, html: str, dom: dict | None = None) -> ValidationResult:
        signals = []
        warnings = []

        matched_neg = self._check_patterns(html, self.rules.get("negative_indicators", []))
        if matched_neg:
            return self._not_found(f"GitHub: {matched_neg[0]}", signals=matched_neg)

        matched_login = self._check_patterns(html, self.rules.get("login_indicators", []))
        if matched_login:
            return self._login_required("GitHub: Login required", signals=matched_login)

        matched_low = self._check_patterns(html, self.rules.get("low_value_indicators", []))
        if matched_low:
            warnings.extend(matched_low)

        matched_pos = self._check_patterns(html, self.rules.get("positive_indicators", []))
        if matched_pos:
            signals.extend(matched_pos)
            confidence = self._compute_confidence(matched_pos, matched_neg, matched_low)
            return self._found(f"GitHub profile found: {len(matched_pos)} positive signals",
                               confidence=confidence, signals=signals, warnings=warnings)

        return self._not_found("GitHub: No recognizable profile signals", signals=signals)

    def _compute_confidence(self, positives: list[str], negatives: list[str],
                            low_value: list[str]) -> float:
        weights = self.rules.get("confidence_weights", {})
        base = 0.6
        for p in positives:
            for key, w in weights.items():
                if key in p.lower() or p.lower() in key:
                    base += w
        for n in negatives:
            base += weights.get("negative_match", -0.5)
        if low_value:
            base *= 0.5
        return max(0.0, min(1.0, base))
