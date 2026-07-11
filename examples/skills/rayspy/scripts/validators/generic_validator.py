from __future__ import annotations
from .base_validator import BaseValidator, ValidationResult
import re


class GenericValidator(BaseValidator):
    # Common social-media "not found" patterns beyond raw 404
    _NOT_FOUND_PATTERNS = re.compile(
        r"404|page not found|not found|this page could not be found|"
        r"doesn't exist|doesn't exist|user not found|account not found|"
        r"this account doesn't exist|no user found|couldn't find that|"
        r"this profile doesn't exist|page isn't available|"
        r"the link you followed may be broken|"
        r"this page is no longer available",
        re.IGNORECASE,
    )

    _SUSPENDED_PATTERNS = re.compile(
        r"403|forbidden|access denied|"
        r"suspended|account suspended|this account has been suspended|"
        r"this account has been terminated|deactivated|"
        r"this account has been deactivated",
        re.IGNORECASE,
    )

    _PRIVATE_PATTERNS = re.compile(
        r"this account is private|this profile is private|"
        r"this timeline is private|"
        r"these posts are hidden|subscribers only|"
        r"this content is private",
        re.IGNORECASE,
    )

    _RATE_LIMITED_PATTERNS = re.compile(
        r"rate limit|too many requests|try again later|"
        r"please slow down|rate limited",
        re.IGNORECASE,
    )

    def validate(self, url: str, html: str, dom: dict | None = None) -> ValidationResult:
        signals = []
        warnings = []

        if not html or len(html.strip()) < 50:
            return self._error("Empty or near-empty page", warnings=["page_empty"])

        m = self._NOT_FOUND_PATTERNS.search(html)
        if m:
            return self._not_found(m.group(0), signals=["not_found"])

        m = self._SUSPENDED_PATTERNS.search(html)
        if m:
            return self._suspended(m.group(0), signals=["suspended"])

        m = self._PRIVATE_PATTERNS.search(html)
        if m:
            return self._private(m.group(0), signals=["private"])

        if re.search(r"500|internal server error", html, re.IGNORECASE):
            return self._error("HTTP 500 Internal Server Error", warnings=["500"])

        if re.search(r"log in|sign in|login|create an account", html, re.IGNORECASE):
            return self._login_required("Login wall detected", signals=["login_required"])

        if re.search(r"captcha|verify you are human|challenge", html, re.IGNORECASE):
            return self._login_required("CAPTCHA / bot challenge", signals=["captcha"])

        m = self._RATE_LIMITED_PATTERNS.search(html)
        if m:
            warnings.append("rate_limited")

        if re.search(r"robots\.txt|noindex|nofollow", html, re.IGNORECASE):
            warnings.append("robots_exclusion")

        signals.append("page_loaded")
        return self._found("Page loaded with content", confidence=0.5, signals=signals, warnings=warnings)
