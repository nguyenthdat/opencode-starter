---
name: uv-packaging
description: "UV package management patterns: pyproject.toml configuration, dependency resolution, virtual environments, build/publish, CLI entrypoints, and monorepo support."
compatibility: opencode
metadata:
  domain: python-engineering
  audience: senior-python-developer
---

# UV Packaging Patterns

Production patterns for uv-based Python project packaging and dependency management.

## pyproject.toml structure

```toml
[project]
name = "myproject"
version = "0.1.0"
description = "What this project does"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
    "polars>=1.0",
    "pydantic>=2.0",
    "structlog>=24.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-cov>=5.0",
    "pytest-benchmark>=4.0",
    "hypothesis>=6.0",
    "ruff>=0.5",
    "pyright>=1.1",
    "httpx>=0.27",
    "pre-commit>=3.0",
]
ml = [
    "scikit-learn>=1.5",
    "mlflow>=2.14",
    "torch>=2.3",
]
serve = [
    "fastapi>=0.111",
    "uvicorn[standard]>=0.30",
]

[project.scripts]
mycli = "mypackage.cli:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP", "B", "C4", "SIM", "TCH", "RUF"]

[tool.ruff.format]
quote-style = "double"

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = ["--strict-markers", "--tb=short"]

[tool.pyright]
typeCheckingMode = "strict"
reportMissingTypeStubs = false
```

## UV command reference

```bash
# Create virtualenv
uv venv

# Install dependencies
uv sync                     # Install all (including dev)
uv sync --no-dev            # Production only
uv sync --group ml          # Install specific optional group

# Add/remove dependencies
uv add polars>=1.0
uv add --dev pytest
uv add --optional ml torch
uv remove some-package

# Update dependencies
uv lock --upgrade           # Upgrade all
uv lock --upgrade-package polars  # Upgrade specific

# Run commands in venv
uv run python script.py
uv run pytest
uv run ruff check .
uv run pyright .

# Build
uv build                   # Build sdist + wheel

# Publish
uv publish                 # Publish to PyPI

# Tools (global install)
uv tool install ruff
uv tool install pyright
```json

## UV workflow by scenario

### New project
```bash
uv init myproject
cd myproject
uv add polars pydantic structlog
uv add --dev pytest pytest-cov ruff pyright
uv run pytest
uv run ruff check .
```

### Clone and setup
```bash
git clone <repo>
cd <repo>
uv sync
uv run pytest
```

### CI pipeline
```bash
uv sync --frozen
uv run ruff check .
uv run ruff format --check .
uv run pyright .
uv run pytest --cov --cov-report=xml
uv build
```

### Pre-commit integration
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.5.0
    hooks:
      - id: ruff
      - id: ruff-format
  - repo: local
    hooks:
      - id: pyright
        name: pyright
        entry: uv run pyright
        language: system
        types: [python]
```

## Dependency resolution strategy

- **Applications:** commit `uv.lock` to VCS for reproducible deployments.
- **Libraries:** `.gitignore` `uv.lock`; CI regenerates to test against latest compatible versions.
- Lower bounds on direct dependencies; let uv resolve upper bounds.
- Use `uv lock --check` in CI to detect stale lockfiles.
- When resolution fails: check for incompatible version requirements, use `uv add --resolution=lowest-direct` to debug.

## CLI entrypoints

```python
# src/mypackage/cli.py
import argparse

def main() -> None:
    parser = argparse.ArgumentParser(description="My CLI tool")
    parser.add_argument("--input", required=True)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    ...

if __name__ == "__main__":
    main()
```

- Define entrypoints in `[project.scripts]`.
- Use `argparse` for simple CLIs, `typer` or `click` for complex ones.
- CLI entrypoint function should not contain business logic — import and call.

## Don't

- Don't mix uv with pip/poetry/conda in the same project.
- Don't use `setup.py`, `setup.cfg`, `requirements.txt` with uv-managed projects.
- Don't commit `uv.lock` for libraries.
- Don't use unbounded version constraints (`>=`) without an upper cap for critical dependencies.
- Don't add dependencies without updating `pyproject.toml`.
- Don't use `pip install -e .` — use `uv sync`.
