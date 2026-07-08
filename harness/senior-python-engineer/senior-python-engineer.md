# Harness Team: Senior Python Engineer

## Goal

Production-grade Python engineering with multi-agent architecture, implementation, review, testing, data engineering, ML/MLOps, and performance optimization.

## Agents

**Orchestrator:** Primary agent runs `python-orchestrator` skill.

**Specialists (defined in `harness/senior-python-engineer/teams/`):**

| Agent | File | Responsibility |
|---|---|---|
| Python Architect | `teams/python-architect.md` | Module design, dependency graph, error strategy, project layout |
| Python Implementer | `teams/python-implementer.md` | Production Python code, applies `python-coding` skill |
| Python Reviewer | `teams/python-reviewer.md` | Correctness, anti-patterns, typing, error handling review |
| Polars Data Engineer | `teams/polars-data-engineer.md` | Polars pipelines, lazy queries, schema enforcement, data transforms |
| ML Engineer | `teams/ml-engineer.md` | Model training, evaluation, feature engineering, experiment tracking |
| MLOps Engineer | `teams/mlops-engineer.md` | Model serving, deployment, monitoring, CI/CD for ML |
| Performance Engineer | `teams/performance-engineer.md` | Profiling, benchmarking, hot-path optimization |
| Testing Engineer | `teams/testing-engineer.md` | Test strategy, pytest, coverage, property-based testing |
| Packaging / UV Engineer | `teams/packaging-uv-engineer.md` | pyproject.toml, build config, uv workflows, CLI entrypoints |
| API Design Reviewer | `teams/api-design-reviewer.md` | Public API contracts, naming, consistency, backward compatibility |
| Documentation Maintainer | `teams/documentation-maintainer.md` | Docstrings, README, module docs, API reference |

**Strict role boundaries:**
- Architect designs, does not implement.
- Implementer implements, does not approve own work.
- Reviewer reports findings, does not modify code.
- Polars Data Engineer owns data pipelines; ML Engineer owns model logic.
- MLOps Engineer owns deployment; ML Engineer owns training.
- Performance Engineer profiles and recommends; Implementer applies optimizations.
- Testing Engineer writes tests, does not modify production code.
- API Designer reviews contracts; Implementer implements them.
- Docs Maintainer owns documentation quality; API Designer owns API naming.

## Trigger

For Python development work that benefits from multi-agent workflow — new features, refactors, data pipelines, ML model development, performance optimization, packaging — load the `python-orchestrator` skill. Simple single-line fixes or questions can be answered directly.

## Skills

| Skill | Location | Purpose |
|---|---|---|
| `python-orchestrator` | `skills/python-orchestrator/SKILL.md` | Team coordination, workflow, dispatch, quality gates |
| `python-coding` | `skills/python-coding/SKILL.md` | Python best-practice rules across 12 categories |
| `python-review` | `skills/python-review/SKILL.md` | Code review methodology, anti-pattern detection |
| `polars-data` | `skills/polars-data/SKILL.md` | Polars DataFrame, lazy query, schema, pipeline patterns |
| `ml-pipelines` | `skills/ml-pipelines/SKILL.md` | ML training, evaluation, experiment tracking patterns |
| `mlops-deployment` | `skills/mlops-deployment/SKILL.md` | Model serving, deployment, monitoring patterns |
| `python-performance` | `skills/python-performance/SKILL.md` | Profiling, optimization, benchmarking |
| `python-testing` | `skills/python-testing/SKILL.md` | Pytest patterns, fixtures, coverage, property testing |
| `uv-packaging` | `skills/uv-packaging/SKILL.md` | UV workflows, pyproject.toml, build, publish |
| `python-api-design` | `skills/python-api-design/SKILL.md` | API contracts, FastAPI patterns, versioning |
| `python-docs` | `skills/python-docs/SKILL.md` | Docstring standards, module docs, API reference |

## Default workflow

1. Understand the task and inspect the existing codebase.
2. Identify the domain: app/dev, data engineering, ML, MLOps, performance, testing, packaging, or docs.
3. Route to the right focused agents.
4. Produce a concise implementation plan.
5. Implement with production-grade Python.
6. Review for correctness, typing, performance, reliability, and maintainability.
7. Add or update tests.
8. Run or recommend checks: `uv run ruff check`, `uv run pytest`, `uv run pyright`.
9. Produce a final summary with changes, risks, tradeoffs, and next steps.

## Python standards

- Python 3.11+
- `uv` over pip/poetry/conda unless the project already requires otherwise
- `pyproject.toml` for all config
- `ruff` for lint and format
- `pytest` for tests
- `pyright` or `mypy` for static type checking
- Polars over pandas for new data-heavy code
- Lazy Polars queries for large datasets
- Explicit schemas for data pipelines
- Structured logging (`structlog` or `logging` with JSON format)
- Clear, typed error handling
- Reproducible ML experiments
- Production-ready ML serving patterns

## Completion gate

- `uv run ruff check` passes with no errors.
- `uv run ruff format --check` passes.
- `uv run pyright` (or `uv run mypy`) passes.
- `uv run pytest` passes.
- No unresolved BLOCKER review findings.
- All public functions, classes, and modules have docstrings.
- Architecture, implementation notes, review findings, and test results preserved in `_workspace/`.

## Change history

| Date | Change | Target | Reason |
|---|---|---|---|
| 2026-07-08 | Initial harness | all | - |
