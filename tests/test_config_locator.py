"""Thin tests for bundled config discovery (pipx-friendly installs)."""


def test_resolve_prefers_explicit_path(tmp_path):
    from rays_core.config_locator import resolve_config_path

    cfg = tmp_path / "config.yaml"
    cfg.write_text("llm:\n  provider: ollama\n", encoding="utf-8")
    resolved = resolve_config_path(str(cfg))
    assert resolved.resolve() == cfg.resolve()


def test_resolve_finds_sibling_config_from_package_dir():
    from rays_core.config_locator import resolve_config_path

    # Bundled defaults live alongside config_locator in the rays_core package
    resolved = resolve_config_path(None)
    assert resolved.name == "config.yaml"
    assert resolved.exists()
