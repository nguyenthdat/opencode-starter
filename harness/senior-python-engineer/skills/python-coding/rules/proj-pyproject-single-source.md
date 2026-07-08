# proj-pyproject-single-source

> `pyproject.toml` is the single source of truth for project metadata, dependencies, and tool configuration.

## Why
Consolidating all config into `pyproject.toml` eliminates config sprawl (`setup.py`, `setup.cfg`, `.flake8`, `.isort.cfg`, `mypy.ini`, `pytest.ini`) and lets tools read from one standard place.

## Bad
Multiple config files: `setup.cfg`, `setup.py`, `.flake8`, `mypy.ini`, `pytest.ini`.

## Good
Everything in `pyproject.toml`:
```toml
[project]
name = "mypackage"
dependencies = ["polars>=1.0"]

[tool.ruff]
line-length = 100

[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.pyright]
typeCheckingMode = "strict"
```
