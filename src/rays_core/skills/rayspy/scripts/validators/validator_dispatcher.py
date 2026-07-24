from __future__ import annotations
from pathlib import Path
from typing import Optional
from .base_validator import BaseValidator
from models import ValidationResult
from .generic_validator import GenericValidator
from .reddit_validator import RedditValidator
from .github_validator import GitHubValidator
from .linkedin_validator import LinkedInValidator
from .instagram_validator import InstagramValidator
from .twitter_validator import TwitterValidator
from .facebook_validator import FacebookValidator
from .medium_validator import MediumValidator
from .profile_quality_validator import assess_investigative_value


def _load_yaml(path: Path) -> dict:
    try:
        import yaml
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
    except ImportError:
        pass
    except Exception:
        pass
    return {}


RULES_DIR = Path(__file__).parent / "rules"

VALIDATOR_MAP: dict[str, type[BaseValidator]] = {
    "reddit": RedditValidator,
    "github": GitHubValidator,
    "linkedin": LinkedInValidator,
    "instagram": InstagramValidator,
    "twitter": TwitterValidator,
    "x": TwitterValidator,
    "facebook": FacebookValidator,
    "medium": MediumValidator,
}


def _guess_platform(url: str) -> str:
    u = url.lower()
    if "reddit.com" in u:
        return "reddit"
    if "github.com" in u:
        return "github"
    if "linkedin.com" in u:
        return "linkedin"
    if "instagram.com" in u:
        return "instagram"
    if "x.com" in u or "twitter.com" in u:
        return "twitter"
    if "facebook.com" in u or "fb.com" in u:
        return "facebook"
    if "medium.com" in u:
        return "medium"
    return "generic"


def dispatch(url: str, html: str, dom: Optional[dict] = None,
             platform: Optional[str] = None) -> ValidationResult:
    plat = platform or _guess_platform(url)
    validator_cls = VALIDATOR_MAP.get(plat, GenericValidator)

    rule_file = RULES_DIR / f"{plat}.yaml"
    rules = _load_yaml(rule_file)

    validator = validator_cls(rules=rules)
    return validator.validate(url, html, dom)


def dispatch_with_quality(url: str, html: str, profile: Optional[dict] = None,
                          dom: Optional[dict] = None,
                          platform: Optional[str] = None) -> dict:
    validation = dispatch(url, html, dom, platform)
    profile_data = profile or {}
    quality = assess_investigative_value(profile_data, validation)
    return {
        "validation": validation.to_dict(),
        "quality": quality,
    }
