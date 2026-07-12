from __future__ import annotations
from typing import Optional

from models import ValidationResult


class BaseValidator:
    def __init__(self, rules: Optional[dict] = None):
        self.rules = rules or {}

    def validate(self, url: str, html: str, dom: Optional[dict] = None) -> ValidationResult:
        raise NotImplementedError

    def _found(self, reason: str, confidence: float = 1.0, signals: Optional[list[str]] = None,
               warnings: Optional[list[str]] = None) -> ValidationResult:
        return ValidationResult(
            exists=True, accessible=True, status="FOUND_PUBLIC", confidence=confidence,
            reason=reason, signals=signals or [], warnings=warnings or [],
        )

    def _not_found(self, reason: str, signals: Optional[list[str]] = None,
                   warnings: Optional[list[str]] = None) -> ValidationResult:
        return ValidationResult(
            exists=False, accessible=False, status="NOT_FOUND", confidence=0.0,
            reason=reason, signals=signals or [], warnings=warnings or [],
        )

    def _login_required(self, reason: str, signals: Optional[list[str]] = None) -> ValidationResult:
        return ValidationResult(
            exists=True, accessible=False, status="FOUND_LOGIN_REQUIRED", confidence=0.5,
            reason=reason, signals=signals or [],
        )

    def _suspended(self, reason: str, signals: Optional[list[str]] = None) -> ValidationResult:
        return ValidationResult(
            exists=False, accessible=False, status="SUSPENDED", confidence=0.0,
            reason=reason, signals=signals or [],
        )

    def _private(self, reason: str, signals: Optional[list[str]] = None) -> ValidationResult:
        return ValidationResult(
            exists=True, accessible=False, status="FOUND_PRIVATE", confidence=0.5,
            reason=reason, signals=signals or [],
        )

    def _protected(self, reason: str, signals: Optional[list[str]] = None) -> ValidationResult:
        return ValidationResult(
            exists=True, accessible=False, status="FOUND_LIMITED", confidence=0.3,
            reason=reason, signals=signals or [],
        )

    def _error(self, reason: str, warnings: Optional[list[str]] = None) -> ValidationResult:
        return ValidationResult(
            exists=False, accessible=False, status="ERROR", confidence=0.0,
            reason=reason, warnings=warnings or [],
        )

    def _check_patterns(self, html: str, patterns: list[str]) -> list[str]:
        import re
        return [p for p in patterns if re.search(p, html, re.IGNORECASE | re.DOTALL)]
