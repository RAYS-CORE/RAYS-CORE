# Changelog

All notable changes to RAYS-CORE will be documented in this file.

## [Unreleased]

### Changed

- Package layout: application modules and bundled `config.yaml` live under `src/rays_core/` (`src`-layout setuptools package). CLI entrypoint is `rays_core.rays_main:main`.

### Added

- GitHub Actions CI (`.github/workflows/ci.yml`): runs on pushes and PRs to `main`/`master` on Ubuntu, macOS, and Windows.
- Minimal `tests/` suite: import smoke checks, bytecode compile of tracked `.py` files, `config_locator` basics.
- `project.optional-dependencies.dev` (`pytest`, `build`, `twine`) and `[tool.pytest.ini_options]`.
- `ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`.
- Issue templates (`bug_report`, `feature_request`) and pull request template.
- Pinned/ranged runtime dependencies in `pyproject.toml` / `setup.py`.

## [1.5.4] - 2026-04-25

### Changed

- Bumped package version to `1.5.4` for a fresh TestPyPI/PyPI upload cycle.

## [1.5.3] - 2026-04-25

### Fixed

- Resolved Windows startup crash caused by missing `readline` module.
- Added graceful fallbacks for environments without `tty`/`termios`.
- Guarded `SIGQUIT` registration for platforms that do not expose it.

### Changed

- Bumped package version to `1.5.3` in `pyproject.toml` and `setup.py`.

## [1.5.2] - 2026-04-25

### Changed

- Confirmed all public repository links point to `https://github.com/markknoffler/RAYS-CORE-CLI`.
- Updated package version to `1.5.2` in `pyproject.toml` and `setup.py`.
- Fixed README clone flow to `cd RAYS-CORE-CLI`.

## [1.0.0] - 2026-04-24

### Added

- Standalone `RAYS-CORE` repository structure.
- Professional OSS documentation (`README`, `CONTRIBUTING`, `SECURITY`).
- Modern Python packaging via `pyproject.toml`.
- Strict `.gitignore` for runtime state, secrets, and build artifacts.

### Changed

- Project metadata aligned for public release and PyPI publishing.
- Documentation expanded for providers, environment setup, modes, prompts, and pipeline.

### Removed

- Local runtime artifacts (`.rays`, `__pycache__`, compiled binaries).
- `trial_codebases` from publish-ready tree.
- Unused Node metadata files.

