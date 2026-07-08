---
name: python-orchestrator
description: "Orchestrate the Senior Python Engineer harness team. Use for any non-trivial Python task — new features, refactors, data pipelines, ML models, performance work, packaging, or testing."
compatibility: opencode
metadata:
  domain: python-engineering
  audience: senior-python-developer
---

# Python Orchestrator

Coordinate the Senior Python Engineer harness team. This skill defines the multi-agent workflow, dispatch logic, quality gates, and artifact conventions.

## When to use

Load this skill for any Python engineering task that benefits from multi-agent workflow. Simple one-line fixes or questions can be answered directly.

## Workflow

### Phase 1: Understand and classify

1. Read the task description.
2. Inspect the existing codebase: `pyproject.toml`, package structure, existing tests, and conventions.
3. Classify the task domain:

| Domain | Indicators | Primary agents |
|---|---|---|
| App / Dev | Feature work, refactoring, bug fixes, new modules | Architect → Implementer → Reviewer → Testing Engineer |
| Data Engineering | ETL, data transforms, Polars queries, pipelines | Polars Data Engineer → Reviewer → Testing Engineer |
| ML | Model training, feature engineering, evaluation, experiment tracking | ML Engineer → Reviewer → Testing Engineer |
| MLOps | Model serving, deployment, monitoring, A/B testing | MLOps Engineer → Reviewer → Testing Engineer |
| Performance | Profiling, optimization, benchmarking | Performance Engineer → Implementer (apply) → Reviewer |
| Testing | Test coverage, test infrastructure, property-based tests | Testing Engineer |
| Packaging | Dependencies, build, publish, CLI, pyproject.toml | Packaging/UV Engineer → Reviewer |
| API Design | API contracts, naming, versioning, FastAPI routes | API Design Reviewer → Implementer (apply) |
| Documentation | Docstrings, README, API reference | Documentation Maintainer |

For cross-domain tasks, run agents sequentially in dependency order (e.g., Architect → Data Engineer → ML Engineer → MLOps Engineer).

### Phase 2: Plan

1. Create a todo list with `todowrite`.
2. If architectural design is needed, launch Python Architect first and wait for `_workspace/01_architecture.md`.
3. For data/ML tasks, identify data dependencies and order agents accordingly.

### Phase 3: Implement

1. Launch implementation agents as `task` subagents with explicit prompts.
2. Each agent prompt must include: task description, input artifact paths, expected output paths, and acceptance criteria.
3. Independent agents can run in parallel. Dependent agents run sequentially.

### Phase 4: Review

1. Launch Python Reviewer on all changed files.
2. For API work, also launch API Design Reviewer.
3. BLOCKER findings must be resolved before proceeding.

### Phase 5: Test

1. Launch Testing Engineer to write/update tests.
2. Run `uv run pytest` to confirm tests pass.

### Phase 6: Verify and summarize

1. Run quality gates (see below).
2. Produce final summary with: changes, risks, tradeoffs, next steps.
3. Preserve all artifacts in `_workspace/`.

## Quality gates

Run these before declaring completion:

```bash
uv run ruff check        # Must pass with no errors
uv run ruff format --check  # Must pass
uv run pyright .          # Must pass (or uv run mypy .)
uv run pytest             # Must pass
```

If any gate fails, route failures to the appropriate agent for resolution.

## Artifact conventions

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
| Final summary | `_workspace/09_final_summary.md` | Orchestrator |

## Agent launch templates

### Python Architect
```
Task: Design architecture for {description}.
Existing project: {path or "greenfield"}.
Output: _workspace/01_architecture.md with module tree, interfaces, error hierarchy, data flow, and dependency graph.
```

### Python Implementer
```
Task: Implement {feature/module} per _workspace/01_architecture.md.
Files to create/modify: {list or "determine from architecture"}.
Apply python-coding skill rules.
Output: _workspace/02_implementation.md with changed file list and decisions.
```

### Python Reviewer
```
Task: Review all changes from _workspace/02_implementation.md.
Architecture reference: _workspace/01_architecture.md.
Apply python-review methodology.
Output: _workspace/03_review.md with BLOCKER/WARNING/SUGGESTION findings.
```

### Polars Data Engineer
```
Task: Build data pipeline for {description}.
Input data: {source, schema}.
Output requirements: {format, schema, performance constraints}.
Output: implementation code + query plan explanation.
```

### ML Engineer
```
Task: Build ML training pipeline for {task type}.
Dataset: {description, location}.
Target metric: {metric}.
Constraints: {latency, memory, interpretability}.
Output: training code, evaluation results, model artifact, MLflow run ID.
```

### MLOps Engineer
```
Task: Deploy model from MLflow run {run_id}.
Serving requirements: {latency, throughput, availability}.
Output: FastAPI app, Dockerfile, monitoring setup, deployment docs at _workspace/08_deployment.md.
```

### Performance Engineer
```
Task: Profile {code paths / module}.
Performance target: {latency / throughput / memory}.
Output: _workspace/04_performance.md with hotspots and ranked recommendations.
```

### Testing Engineer
```
Task: Write tests for {modules}.
Coverage target: {target}%.
Existing tests: {path or "none"}.
Output: test files + _workspace/06_test_summary.md.
```

### Packaging / UV Engineer
```
Task: {Add/update/remove} dependencies or configure packaging for {purpose}.
Current state: {existing pyproject.toml summary}.
Output: updated config files + resolution summary.
```

### API Design Reviewer
```
Task: Review API contracts for {module/endpoint}.
Current API surface: {file paths or spec}.
Output: _workspace/05_api_review.md.
```

### Documentation Maintainer
```
Task: {Write/update/review} documentation for {modules}.
Output: updated docstrings/files + gap report.
```

## Error handling

- If an agent returns a BLOCKER, route it back to the appropriate fixer agent.
- If an agent times out, retry once with narrower scope.
- If two agents produce conflicting recommendations, flag in final summary for human decision.
- If quality gates fail, route failures to the responsible agent for resolution before declaring completion.
- If `_workspace/` already exists from a prior run, archive old artifacts and start fresh unless the user requests a partial rerun.

## Follow-up triggers

- "rerun", "update", "revise" — rerun affected agents only
- "audit", "status", "check" — verify quality gates and review findings
- "continue", "next steps" — read `_workspace/09_final_summary.md` and proceed
