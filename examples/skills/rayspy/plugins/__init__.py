"""Plugin architecture for RaySpy v4.

Plugins are callable modules registered by interface:

- validators: ProfileValidatorPlugin — validate_profile(url, platform, dom) -> dict
- harvesters: HarvesterPlugin — harvest(candidate, workspace) -> list[dict]
- extractors: ExtractorPlugin — extract(candidate, workspace) -> dict
- canonicalizers: CanonicalizerPlugin — canonicalize(url, platform) -> str
- quality_rules: QualityRulePlugin — score(candidate) -> dict

Built-in plugins reference scripts/ modules by default.
Custom plugins can be registered via INVESTIGATION_PLUGINS env or config.
"""

import os
import importlib.util
import inspect
from pathlib import Path


PLUGIN_DIRS = {
    "validators": "scripts.validators",
    "harvesters": "scripts",
    "extractors": "scripts",
    "canonicalizers": "scripts",
    "quality_rules": "scripts",
}

_BUILTIN_INTERFACES = {
    "validators": "dispatch_with_quality",
    "harvesters": "is_profile_eligible",
    "extractors": "compute_quality_score",
    "canonicalizers": "normalize_profile_url_wrapper",
    "quality_rules": "compute_quality_score",
}


class PluginManager:
    def __init__(self):
        self._registry: dict[str, dict[str, callable]] = {
            k: {} for k in PLUGIN_DIRS
        }
        self._load_builtins()

    def _load_builtins(self):
        for kind, func_name in _BUILTIN_INTERFACES.items():
            mod_path = PLUGIN_DIRS[kind]
            try:
                mod = importlib.import_module(mod_path)
                fn = getattr(mod, func_name, None)
                if fn and callable(fn):
                    self._registry[kind]["builtin"] = fn
            except (ImportError, AttributeError):
                pass

    def get(self, kind: str, name: str = "builtin") -> callable:
        return self._registry.get(kind, {}).get(name)

    def register(self, kind: str, name: str, fn: callable):
        self._registry.setdefault(kind, {})[name] = fn

    def list(self, kind: str) -> list[str]:
        return list(self._registry.get(kind, {}).keys())

    def discover(self, kind: str, path: str = None):
        search_dir = path or os.path.join(os.path.dirname(__file__), kind)
        if not os.path.isdir(search_dir):
            return
        for fname in os.listdir(search_dir):
            if fname.endswith(".py") and not fname.startswith("_"):
                mod_name = f"plugins.{kind}.{fname[:-3]}"
                try:
                    mod = importlib.import_module(mod_name)
                    for name, obj in inspect.getmembers(mod, inspect.isfunction):
                        self._registry.setdefault(kind, {})[name] = obj
                except ImportError:
                    pass
