# Harness Team: Senior Python Developer

## Goal

Production-grade Python engineering with multi-agent architecture, implementation, review, testing, data engineering, ML/MLOps, and performance optimization. The Lead agent orchestrates all specialist subagents through standardized dispatch, synthesis, and quality gate protocols.

## Agents

**Lead:** Python Engineer Lead (`teams/python-devloper-lead.md`, mode: `all`) orchestrates the team, classifies tasks, routes to specialists via standardized call protocol, synthesizes subagent outputs, runs quality gates, and produces final recommendations with risk assessment. Always loads `python-orchestrator` skill. **Never implements or reviews directly — delegates all specialized work.**

**Specialists (defined in `.opencode/agents/`):**

| Agent | File | Mode | Responsibility |
|---|---|---|---|
| Python Engineer Lead | `python-devloper-lead.md` | `all` | Orchestration, task classification, dispatch, synthesis, quality gates, final recommendation |
| Python Architect | `python-architect.md` | `subagent` | Module design, dependency graphs, error taxonomies, interface contracts, project layout |
| Python Implementer | `python-implementer.md` | `subagent` | Production Python code, applies `python-coding` skill, type hints, structured logging |
| Python Reviewer | `python-reviewer.md` | `subagent` | Correctness, typing, error handling, anti-patterns, security, async review |
| API Design Reviewer | `api-design-reviewer.md` | `subagent` | Public API contracts, naming, versioning, FastAPI patterns, backward compatibility |
| Performance Engineer | `performance-engineer.md` | `subagent` | CPU/memory/I/O profiling, benchmarking, bottleneck analysis, ranked recommendations |
| Testing Engineer | `testing-engineer.md` | `subagent` | Test strategy, pytest fixtures, coverage, property-based testing, integration tests |
| Packaging / UV Engineer | `packaging-uv-engineer.md` | `subagent` | pyproject.toml, uv workflows, dependency resolution, build config, CLI entrypoints |
| Polars Data Engineer | `polars-data-engineer.md` | `subagent` | Polars pipelines, lazy queries, schema enforcement, streaming, ETL |
| ML Engineer | `ml-engineer.md` | `subagent` | Model training, feature engineering, evaluation, experiment tracking |
| MLOps Engineer | `mlops-engineer.md` | `subagent` | Model serving, FastAPI endpoints, Docker, monitoring, drift detection, rollback |
| Documentation Maintainer | `documentation-maintainer.md` | `subagent` | Google-style docstrings, README, module docs, API reference |

## Strict Role Boundaries

- **Lead orchestrates, does not implement or review.** Delegates all specialized work to subagents.
- **Architect** designs, does not implement.
- **Implementer** implements, does not approve own work.
- **Reviewer** reports findings, does not modify code.
- **API Designer** reviews contracts; Implementer implements them.
- **Performance Engineer** profiles and recommends; Implementer applies optimizations.
- **Testing Engineer** writes tests, does not modify production code.
- **Polars Data Engineer** owns data pipelines; ML Engineer owns model logic.
- **ML Engineer** owns training; MLOps Engineer owns deployment.
- **Packaging/UV Engineer** owns pyproject.toml and builds; other agents request dependencies through them.
- **Documentation Maintainer** owns documentation quality; API Designer owns API naming.

## Trigger

For Python development work that benefits from multi-agent workflow — new features, refactors, data pipelines, ML model development, performance optimization, API design, packaging, security reviews, testing strategy, or documentation — load the `python-orchestrator` skill and dispatch via **Python Engineer Lead**. Simple single-line fixes or questions can be answered directly.

## Lead Agent Protocols

The Lead agent uses three core protocols (defined in full in `teams/python-devloper-lead.md`):

1. **Routing Table** — Maps every Python engineering task type to the correct primary and supporting agents.
2. **Standard Subagent Call Protocol** — Every `task` call includes: task objective, context (files/paths/artifacts), runtime environment, constraints, expected output format, risks to check, and final recommendation requirement.
3. **Synthesis Protocol** — Collect all subagent outputs → compare findings → resolve conflicts → identify uncertainty → produce actionable next steps with ownership → final recommendation with risk level (LOW/MEDIUM/HIGH/CRITICAL).

## Shared Context (`_workspace/`)

All agents share context through `_workspace/` artifacts. Each agent reads from and writes to numbered `_workspace/` files:

| Artifact | Path | Producer |
|---|---|---|
| Architecture document | `_workspace/01_architecture.md` | Python Architect |
| Implementation summary | `_workspace/02_implementation.md` | Python Implementer |
| Review findings | `_workspace/03_review.md` | Python Reviewer |
| Performance report | `_workspace/04_performance.md` | Performance Engineer |
| API review | `_workspace/05_api_review.md` | API Design Reviewer |
| Test summary | `_workspace/06_test_summary.md` | Testing Engineer |
| ML run summary | `_workspace/07_ml_run.md` | ML Engineer |
| Deployment docs | `_workspace/08_deployment.md` | MLOps Engineer |
| Final summary | `_workspace/09_final_summary.md` | Lead |
| Packaging report | `_workspace/10_packaging.md` | Packaging/UV Engineer |
| Documentation gap report | `_workspace/11_docs.md` | Documentation Maintainer |
| Data pipeline docs | `_workspace/12_data_pipeline.md` | Polars Data Engineer |

## Skills

| Skill | Location | Purpose |
|---|---|---|
| `python-orchestrator` | `skills/python-orchestrator/SKILL.md` | Team coordination, dispatch protocol, synthesis, quality gates, agent launch templates |
| `python-coding` | `skills/python-coding/SKILL.md` | Python best-practice rules across 12 categories (44 rule files) |
| `python-review` | `skills/python-review/SKILL.md` | Code review methodology: correctness, typing, error handling, anti-patterns, security |
| `python-api-design` | `skills/python-api-design/SKILL.md` | Internal + HTTP API contracts, FastAPI patterns, versioning, backward compatibility |
| `python-performance` | `skills/python-performance/SKILL.md` | Profiling tools, CPU/memory optimization, benchmarking, Polars query tuning |
| `python-testing` | `skills/python-testing/SKILL.md` | Pytest patterns, fixtures, parametrize, coverage, hypothesis property-based testing |
| `uv-packaging` | `skills/uv-packaging/SKILL.md` | UV workflows, pyproject.toml, dependency resolution, build/publish, CLI entrypoints |
| `polars-data` | `skills/polars-data/SKILL.md` | Polars DataFrame, lazy query, schema, pipeline patterns, streaming |
| `ml-pipelines` | `skills/ml-pipelines/SKILL.md` | ML training, evaluation, experiment tracking, reproducibility patterns |
| `mlops-deployment` | `skills/mlops-deployment/SKILL.md` | Model serving, FastAPI, Docker, monitoring, drift detection, rollback |
| `python-docs` | `skills/python-docs/SKILL.md` | Google-style docstrings, module docs, README, API reference generation |

## Python Standards

### Tooling
- Python 3.11+
- `uv` for all dependency, venv, build, and run operations (no pip/poetry/conda unless pre-existing)
- `pyproject.toml` as single source of truth for project config, dependencies, and tool settings
- `ruff` for linting (`ruff check`) and formatting (`ruff format --check`)
- `pyright` or `mypy` for static type checking
- `pytest` for testing
- `hatchling` as default build backend

### Code Quality
- Type hints on all public APIs and non-trivial internal logic; no `Any` without justification
- Well-maintained libraries over fragile custom parsers (httpx, pydantic, structlog, polars)
- Idempotent, observable scripts safe to rerun; `--dry-run` for destructive operations
- Atomic file writes for generated files
- Structured logging (`structlog` or `logging` JSON format); no `print()` in production
- Custom exception hierarchy per module
- No ad-hoc dependency installs — everything in `pyproject.toml` with version bounds

### Verification
- Every code change must pass: `ruff check`, `ruff format --check`, `pyright`, `pytest`
- Every new module must have a corresponding test file
- Every public function/class must have a Google-style docstring
- `_workspace/` artifacts must capture all changes and decisions

## Completion Gate

- `uv run ruff check` passes with no errors
- `uv run ruff format --check` passes
- `uv run pyright` (or `uv run mypy`) passes
- `uv run pytest` passes
- No unresolved BLOCKER review findings
- All public functions, classes, and modules have docstrings
- Architecture, implementation notes, review findings, test results, and final recommendation preserved in `_workspace/`
- Final recommendation includes risk level (LOW/MEDIUM/HIGH/CRITICAL)

## Change History

| Date | Change | Target | Reason |
|---|---|---|---|
| 2026-07-08 | Initial harness | all | — |
| 2026-07-09 | Optimize Lead agent | `python-devloper-lead.md`, `skills/python-orchestrator/SKILL.md` | Lead now acts as true orchestrator with routing table, call protocol, synthesis protocol, delegation rules, and Python execution rules |
