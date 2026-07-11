from __future__ import annotations
from .base_validator import BaseValidator, ValidationResult


class TwitterValidator(BaseValidator):
    def validate(self, url: str, html: str, dom: dict | None = None) -> ValidationResult:
        signals = []

        matched_neg = self._check_patterns(html, self.rules.get("negative_indicators", []))
        if matched_neg:
            if "suspended" in matched_neg[0].lower():
                return self._suspended(f"Twitter/X: {matched_neg[0]}", signals=matched_neg)
            return self._not_found(f"Twitter/X: {matched_neg[0]}", signals=matched_neg)

        matched_protected = self._check_patterns(html, self.rules.get("protected_indicators", []))
        if matched_protected:
            return self._protected(f"Twitter/X: {matched_protected[0]}", signals=matched_protected)

        matched_login = self._check_patterns(html, self.rules.get("login_indicators", []))
        if matched_login:
            return self._login_required("Twitter/X: Login required", signals=matched_login)

        matched_pos = self._check_patterns(html, self.rules.get("positive_indicators", []))
        if matched_pos:
            signals.extend(matched_pos)
            confidence = self._compute_confidence(matched_pos, matched_neg)
            return self._found(f"Twitter/X profile found: {len(matched_pos)} positive signals",
                               confidence=confidence, signals=signals)

        return self._not_found("Twitter/X: No recognizable profile signals", signals=signals)

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
