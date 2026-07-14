---
name: python-orchestrator
description: "Orchestrate the Senior Python Developer harness team. Use for any non-trivial Python task — new features, refactors, data pipelines, ML models, performance work, packaging, or testing."
compatibility: opencode
metadata:
  domain: python-engineering
  audience: senior-python-developer
---

# Python Orchestrator

Coordinate the Senior Python Developer harness team. This skill defines the multi-agent workflow, dispatch logic, quality gates, synthesis protocol, and artifact conventions.

**Loaded by:** Python Engineer Lead (`teams/python-devloper-lead.md`, mode: `all`). The Lead agent loads this skill on every invocation and follows the workflow defined here.

## When to use

Load this skill for any Python engineering task that benefits from multi-agent workflow. The Python Engineer Lead uses this skill to classify tasks, dispatch specialists via `task`, and manage `_workspace/` artifacts. Simple one-line fixes or questions should be answered directly without loading this skill.

---

## Workflow Phases

### Phase 1: Classify and Triage

1. **Read the task description** carefully. Identify the primary domain and any cross-cutting concerns.
2. **Inspect the existing codebase:**
   - Read `pyproject.toml` for Python version, dependencies, build system, and tool config.
   - Identify the package structure (flat vs src-layout, namespace packages).
   - Find existing tests and their conventions.
   - Note the lint/format/type-check/test setup.
3. **Classify the task domain** using this table:

| Domain | Indicators | Primary Agent(s) |
|---|---|---|
| Architecture / Design | New project, major refactor, module restructuring, interface definition | `python-architect` |
| API Design | Public function signatures, FastAPI/Flask routes, REST/GraphQL contracts, versioning | `api-design-reviewer` (+ `python-architect` for cross-module) |
| Implementation | Writing new code, feature development, bug fixes | `python-implementer` (after `python-architect` if needed) |
| Code Review | Before merge, after implementation, audit existing code | `python-reviewer` (+ `api-design-reviewer` for public surface) |
| Data Engineering | ETL, Polars pipelines, schema enforcement, large dataset transforms | `polars-data-engineer` (+ `python-reviewer`, `performance-engineer`) |
| ML Training | Model training, feature engineering, evaluation, experiment tracking | `ml-engineer` (+ `polars-data-engineer` for data prep) |
| MLOps / Deployment | Model serving, Docker, monitoring, drift detection, A/B testing | `mlops-engineer` (+ `api-design-reviewer`, `performance-engineer`) |
| Performance | Profiling, optimization, benchmarking, memory analysis | `performance-engineer` → `python-implementer` (apply) |
| Testing | Test strategy, test suite creation, coverage improvement, property-based testing | `testing-engineer` |
| Packaging / Dependencies | pyproject.toml, uv, dependency resolution, build/publish, CLI entrypoints | `packaging-uv-engineer` |
| Security | User input handling, SQL injection, path traversal, secrets, auth | `python-reviewer` (security dimension) |
| Error Handling / Observability | Exception patterns, structured logging, error taxonomy | `python-reviewer` (error handling) + `python-architect` (taxonomy) |
| Documentation | Docstrings, README, module docs, API reference | `documentation-maintainer` (+ `api-design-reviewer`) |
| CLI / Tooling | CLI design, argparse/typer/click, entrypoints, shell completions | `packaging-uv-engineer` + `python-architect` |

4. **For cross-domain tasks**, plan the dependency chain before dispatching. Example:
   ```
   Full ML Pipeline: Architect → Polars Data Engineer → ML Engineer → Python Reviewer → Testing Engineer → MLOps Engineer → API Design Reviewer
   Full Feature: Architect → Implementer → Reviewer → Testing Engineer → Performance Engineer → API Design Reviewer → Documentation Maintainer
   ```

5. **Create a `todowrite`** to track all phases. Mark Phase 1 as in_progress.

### Phase 2: Plan

1. **If architectural design is needed**, launch `python-architect` first and wait for `_workspace/01_architecture.md`.
2. **If dependencies will change**, launch `packaging-uv-engineer` in parallel with architect or immediately after.
3. **For data/ML tasks**, identify data dependencies and order agents accordingly.
4. **For performance tasks**, establish baseline metrics before dispatching.
5. **Record the plan** — which agents, in what order, with what dependencies.

### Phase 3: Dispatch and Monitor

**Dispatch rules:**
- Independent agents run **in parallel** with batched `task` calls.
- Dependent agents run **sequentially**, each consuming the prior agent's output.
- Each `task` call must follow the **Standard Subagent Call Protocol** (see below).

**Monitoring:**
- Track which agents have completed and which artifacts are produced.
- If an agent times out, retry once with narrower scope.
- If an agent returns BLOCKER, route back to the fixer agent.
- If an agent cannot complete due to missing context, gather it and re-dispatch.

### Phase 4: Review

1. Launch `python-reviewer` on all changed files after implementation.
2. For API work, also launch `api-design-reviewer`.
3. For async code, ensure reviewer checks async-specific rules.
4. For data pipelines, also have reviewer check Polars patterns.
5. BLOCKER findings must be resolved before proceeding to test phase.

### Phase 5: Test

1. Launch `testing-engineer` to write/update tests.
2. Run `uv run pytest` to confirm tests pass.
3. If tests reveal bugs, route back to `python-implementer`.
4. If tests reveal untestable code, ask `python-implementer` to refactor.

### Phase 6: Synthesize

Follow the **Synthesis Protocol** from the Lead agent definition:

1. **Collect** all `_workspace/` artifacts.
2. **Compare** findings across agents.
3. **Resolve** conflicts (same-severity → flag both; cross-agent contradiction → decide or re-dispatch).
4. **Identify** uncertainty (conflicts, low confidence, ambiguous requirements).
5. **Produce** actionable next steps with owner, priority, and risk.
6. **Write** `_workspace/09_final_summary.md` with the full template.

### Phase 7: Verify and Complete

1. **Run quality gates:**
   ```bash
   uv run ruff check            # Must pass with no errors
   uv run ruff format --check   # Must pass
   uv run pyright .             # Must pass (or uv run mypy .)
   uv run pytest                # Must pass
   ```
2. **If any gate fails**, route failures to the responsible agent.
3. **Confirm all completion criteria:**
   - No unresolved BLOCKER findings.
   - All public functions/classes/modules have docstrings.
   - All artifacts present in `_workspace/`.
   - Final recommendation has a clear risk level.

---

## Standard Subagent Call Protocol

Every `task` call to a subagent MUST include these fields:

```
task(
  description: "<3-5 word summary>",
  subagent_type: "general",
  prompt: """You are the <Agent Name>. Load teams/<agent-file>.md for your role definition.

**Task Objective:**
<One sentence describing what to accomplish.>

**Context:**
- Relevant files/paths: <list>
- Architecture reference: <_workspace/01_architecture.md or "none">
- Prior artifacts: <list of _workspace/ files>

**Runtime Environment:**
- Python version: <3.11+>
- Package manager: uv
- Build system: <hatchling / setuptools / other>
- Key dependencies: <list>

**Constraints:**
- <Specific constraints>

**Expected Output:**
- Primary artifact: <_workspace/0X_name.md>
- Format: <structured markdown / JSON / code diff>
- Required sections: <list>
- File changes (if applicable): <list>

**Risks to Check:**
- <Domain-specific risks>

**Final Recommendation Required:** <Yes/No>
"""
)
```

---

## Agent Launch Templates

### Python Architect

```
task(
  description: "Design Python architecture",
  subagent_type: "general",
  prompt: """You are the Python Architect. Load teams/python-architect.md for your role definition.

**Task Objective:** Design architecture for {description}.

**Context:**
- Relevant files/paths: {existing project path or "greenfield"}
- Architecture reference: none (this is the first architecture doc)
- Prior artifacts: none

**Runtime Environment:**
- Python version: {detected or "3.11+"}
- Package manager: uv
- Build system: {detected or "hatchling"}
- Key dependencies: {detected or "to be determined"}

**Constraints:**
- {specific constraints from task}
- Follow proj-* rules from python-coding skill.
- Prefer flat-to-shallow package structures.

**Expected Output:**
- Primary artifact: _workspace/01_architecture.md
- Format: Markdown with ASCII diagrams
- Required sections: Package/module tree, interface contracts (Protocol/ABC names), error type hierarchy, data flow diagram, dependency graph, rationale for key decisions.
- File changes: none (read-only)

**Risks to Check:**
- Circular dependencies between modules
- Overly deep package nesting
- Missing error taxonomy
- Tight coupling between business logic and I/O

**Final Recommendation Required:** Yes — must include recommended module layout with risk level.
"""
)
```

### Python Implementer

```
task(
  description: "Implement Python code",
  subagent_type: "general",
  prompt: """You are the Python Implementer. Load teams/python-implementer.md for your role definition.

**Task Objective:** Implement {feature/module} per _workspace/01_architecture.md.

**Context:**
- Relevant files/paths: {list of files to create or modify}
- Architecture reference: _workspace/01_architecture.md
- Prior artifacts: _workspace/01_architecture.md

**Runtime Environment:**
- Python version: {detected}
- Package manager: uv
- Build system: {hatchling / setuptools}
- Key dependencies: {list from pyproject.toml}

**Constraints:**
- Apply all relevant python-coding skill rules.
- Every public function must have type hints and Google-style docstring.
- Use uv for all operations.
- Keep functions < 50 lines; single responsibility.
- {additional constraints}

**Expected Output:**
- Primary artifact: _workspace/02_implementation.md
- Format: Markdown summary + list of created/modified files
- Required sections: Files changed, design decisions made, deviations from architecture (if any).
- File changes: {list of files to create/modify}

**Risks to Check:**
- Breaking existing tests or public API
- Introducing mutable default arguments
- Silent exception swallowing
- Missing type annotations on public API

**Final Recommendation Required:** Yes — must confirm implementation is complete and note any unresolved questions.
"""
)
```

### Python Reviewer

```
task(
  description: "Review Python code",
  subagent_type: "general",
  prompt: """You are the Python Reviewer. Load teams/python-reviewer.md for your role definition.

**Task Objective:** Review all changes from _workspace/02_implementation.md.

**Context:**
- Relevant files/paths: {list of changed files}
- Architecture reference: _workspace/01_architecture.md
- Prior artifacts: _workspace/02_implementation.md

**Runtime Environment:**
- Python version: {detected}
- Package manager: uv
- Build system: {detected}
- Key dependencies: {list}

**Constraints:**
- Apply python-review methodology: correctness, typing, error handling, anti-patterns, security.
- Run pyright/mypy on changed files.
- Do not modify code — report findings only.

**Expected Output:**
- Primary artifact: _workspace/03_review.md
- Format: Structured markdown, one finding per section
- Required sections: Findings with BLOCKER/WARNING/SUGGESTION severity, file path, line reference, issue description, recommended fix.
- File changes: none (read-only)

**Risks to Check:**
- Correctness of business logic
- Missing or incorrect type annotations
- Bare except / exception swallowing
- Mutable default arguments
- Resource leaks (unclosed files, connections)
- SQL injection / path traversal
- Incorrect async/await usage
- Inefficient Polars patterns

**Final Recommendation Required:** Yes — must state APPROVE / NEEDS FIXES / REJECT with risk level.
"""
)
```

### Performance Engineer

```
task(
  description: "Profile Python performance",
  subagent_type: "general",
  prompt: """You are the Performance Engineer. Load teams/performance-engineer.md for your role definition.

**Task Objective:** Profile {code paths/module} and identify optimization opportunities.

**Context:**
- Relevant files/paths: {list of target files}
- Architecture reference: _workspace/01_architecture.md
- Prior artifacts: _workspace/02_implementation.md

**Runtime Environment:**
- Python version: {detected}
- Package manager: uv
- Key dependencies: {list}

**Constraints:**
- Profile before optimizing — no guesses.
- Performance targets: {latency/throughput/memory if specified}.
- Tools: py-spy, scalene, cProfile, memray, pytest-benchmark as appropriate.

**Expected Output:**
- Primary artifact: _workspace/04_performance.md
- Format: Structured markdown with tables
- Required sections: Hotspot identification (file:line, function, % time), memory allocation hotspots, root cause analysis, ranked optimization recommendations with estimated impact, before/after benchmarks if applied.
- File changes: none (read-only)

**Risks to Check:**
- GIL contention in threaded code
- CPU-bound work in async event loop
- Eager evaluation of large Polars queries
- Excessive memory allocation
- N+1 query patterns
- Missing connection pooling

**Final Recommendation Required:** Yes — must rank optimizations by impact and risk.
"""
)
```

### Testing Engineer

```
task(
  description: "Write Python tests",
  subagent_type: "general",
  prompt: """You are the Testing Engineer. Load teams/testing-engineer.md for your role definition.

**Task Objective:** Write tests for {modules}.

**Context:**
- Relevant files/paths: {source modules to test}
- Architecture reference: _workspace/01_architecture.md
- Prior artifacts: _workspace/02_implementation.md

**Runtime Environment:**
- Python version: {detected}
- Package manager: uv
- Test framework: pytest
- Key dependencies: pytest, pytest-cov, hypothesis, httpx (if API testing)

**Constraints:**
- Coverage target: >80% for new code.
- Test error paths, not just happy paths.
- Mock external I/O; never mock domain logic.
- For data pipelines: test against known small fixtures.

**Expected Output:**
- Primary artifact: _workspace/06_test_summary.md
- Format: Markdown summary + test files
- Required sections: Test count, coverage %, edge cases covered, bugs found during testing, recommendations for additional scenarios.
- File changes: test files in tests/ directory

**Risks to Check:**
- Tests that pass but don't assert anything
- Over-mocking that hides real bugs
- Missing error path coverage
- Flaky tests (timing-dependent, random-dependent)
- Tests that depend on external services without mocks

**Final Recommendation Required:** Yes — must confirm test coverage is adequate and note gaps.
"""
)
```

### Packaging / UV Engineer

```
task(
  description: "Manage Python packaging",
  subagent_type: "general",
  prompt: """You are the Packaging/UV Engineer. Load teams/packaging-uv-engineer.md for your role definition.

**Task Objective:** {Add/update/remove} dependencies or configure packaging for {purpose}.

**Context:**
- Relevant files/paths: pyproject.toml
- Architecture reference: _workspace/01_architecture.md
- Prior artifacts: {list}

**Runtime Environment:**
- Python version: {detected}
- Package manager: uv
- Build system: {hatchling / setuptools}

**Constraints:**
- uv for all operations.
- pyproject.toml as single source of truth.
- Pin direct dependencies with lower bounds.
- No setup.py, setup.cfg, requirements.txt unless legacy.

**Expected Output:**
- Primary artifact: _workspace/10_packaging.md
- Format: Markdown summary + config diffs
- Required sections: Dependency changes (added/removed/upgraded), resolution conflicts and solutions, build verification output.
- File changes: pyproject.toml, uv.lock

**Risks to Check:**
- Dependency conflicts with existing packages
- Upper-bound version pins that block upgrades
- Missing optional-dependencies for dev/test extras
- CLI entrypoint name collisions
- Breaking changes in dependency major version bumps

**Final Recommendation Required:** Yes — must confirm dependency changes are safe.
"""
)
```

### API Design Reviewer

```
task(
  description: "Review API design",
  subagent_type: "general",
  prompt: """You are the API Design Reviewer. Load teams/api-design-reviewer.md for your role definition.

**Task Objective:** Review API contracts for {module/endpoint}.

**Context:**
- Relevant files/paths: {files containing public API surface}
- Architecture reference: _workspace/01_architecture.md
- Prior artifacts: _workspace/02_implementation.md

**Runtime Environment:**
- Python version: {detected}
- Framework: {FastAPI / Flask / library / "internal Python API"}

**Constraints:**
- Check naming consistency, parameter ordering, return type consistency.
- Verify backward compatibility.
- No boolean trap parameters.
- Consistent pagination patterns.

**Expected Output:**
- Primary artifact: _workspace/05_api_review.md
- Format: Structured markdown
- Required sections: Findings with BLOCKER/WARNING/SUGGESTION severity, issue description and location, recommended change with rationale, backward compatibility impact.
- File changes: none (read-only)

**Risks to Check:**
- Breaking changes to existing consumers
- Inconsistent error response schemas
- Missing versioning strategy
- Overly broad or narrow endpoints
- Missing auth/rate limiting considerations
- Inconsistent pagination

**Final Recommendation Required:** Yes — must state APPROVE / NEEDS CHANGES with risk level.
"""
)
```

### Documentation Maintainer

```
task(
  description: "Write Python documentation",
  subagent_type: "general",
  prompt: """You are the Documentation Maintainer. Load teams/documentation-maintainer.md for your role definition.

**Task Objective:** {Write/update/review} documentation for {modules}.

**Context:**
- Relevant files/paths: {source modules to document}
- Architecture reference: _workspace/01_architecture.md
- Prior artifacts: _workspace/02_implementation.md, _workspace/05_api_review.md

**Runtime Environment:**
- Python version: {detected}
- Documentation style: Google docstrings

**Constraints:**
- Google-style docstrings for all public items.
- Every public function: Args, Returns, Raises, Example/Examples.
- Module docstrings explain purpose and usage entrypoint.
- Do not change code — only docstrings and documentation files.

**Expected Output:**
- Primary artifact: _workspace/11_docs.md
- Format: Markdown summary + list of documented files
- Required sections: Items documented, gaps or TODOs.
- File changes: updated docstrings in source files, possibly README or doc files

**Risks to Check:**
- Docstrings that don't match actual signatures
- Missing Raises: section for functions that raise
- Stale examples that don't run
- Missing module-level docstrings

**Final Recommendation Required:** Yes — must confirm documentation is complete or note gaps.
"""
)
```

### Polars Data Engineer

```
task(
  description: "Build Polars pipeline",
  subagent_type: "general",
  prompt: """You are the Polars Data Engineer. Load teams/polars-data-engineer.md for your role definition.

**Task Objective:** Build data pipeline for {description}.

**Context:**
- Relevant files/paths: {data sources, existing pipeline code}
- Architecture reference: _workspace/01_architecture.md
- Prior artifacts: {list}

**Runtime Environment:**
- Python version: {detected}
- Package manager: uv
- Key dependencies: polars

**Constraints:**
- Prefer lazy evaluation for datasets > 100K rows.
- Define explicit schemas for pipeline inputs and outputs.
- Use Parquet over CSV for intermediate/output data.
- Never use apply/map_elements on hot paths.

**Expected Output:**
- Primary artifact: _workspace/12_data_pipeline.md
- Format: Code + summary markdown
- Required sections: Query plan explanation, schema documentation, performance characteristics, error handling for malformed data.
- File changes: pipeline implementation files

**Risks to Check:**
- OOM on large datasets (missing streaming)
- Schema mismatch between pipeline stages
- Null handling gaps
- Collect() called too early in lazy chain
- Inefficient apply/map_elements usage

**Final Recommendation Required:** Yes — must confirm pipeline correctness and note performance characteristics.
"""
)
```

### ML Engineer

```
task(
  description: "Train ML model",
  subagent_type: "general",
  prompt: """You are the ML Engineer. Load teams/ml-engineer.md for your role definition.

**Task Objective:** Build ML training pipeline for {task type}.

**Context:**
- Relevant files/paths: {dataset description, location}
- Architecture reference: _workspace/01_architecture.md
- Prior artifacts: _workspace/12_data_pipeline.md (if data prep exists)

**Runtime Environment:**
- Python version: {detected}
- Package manager: uv
- Key dependencies: {scikit-learn / pytorch / xgboost / etc.}

**Constraints:**
- Reproducibility: seed everything, log configs, version data and code.
- Target metric: {metric}.
- Constraints: {latency, memory, interpretability}.
- Use experiment tracking (MLflow or project convention).

**Expected Output:**
- Primary artifact: _workspace/07_ml_run.md
- Format: Code + run summary + model card
- Required sections: Feature engineering code, training code, evaluation results, experiment tracker run ID, model card (assumptions, limitations).
- File changes: training pipeline code, model artifacts

**Risks to Check:**
- Data leakage between train/val/test
- Overfitting to validation set
- Missing feature normalization in serving pipeline
- Non-deterministic training
- Insufficient data for the task

**Final Recommendation Required:** Yes — must include model performance summary, limitations, and deployment readiness.
"""
)
```

### MLOps Engineer

```
task(
  description: "Deploy ML model",
  subagent_type: "general",
  prompt: """You are the MLOps Engineer. Load teams/mlops-engineer.md for your role definition.

**Task Objective:** Deploy model from {source}.

**Context:**
- Relevant files/paths: model artifact path, preprocessing pipeline
- Architecture reference: _workspace/01_architecture.md
- Prior artifacts: _workspace/07_ml_run.md

**Runtime Environment:**
- Python version: {detected}
- Package manager: uv
- Framework: FastAPI
- Infrastructure: {Docker / Kubernetes / cloud}

**Constraints:**
- Load models once at startup; never per-request.
- Input validation with Pydantic models.
- Structured logging for all serving events.
- Latency target: {target}, throughput: {target}.

**Expected Output:**
- Primary artifact: _workspace/08_deployment.md
- Format: Code + deployment docs
- Required sections: FastAPI app with /predict and /health, Pydantic request/response models, Dockerfile, monitoring setup, operational runbook.
- File changes: serving code, Dockerfile, deployment config

**Risks to Check:**
- Model loading latency at startup
- Memory pressure from model size
- Missing input validation
- No graceful degradation on failure
- Missing model version tracking in responses
- No drift monitoring

**Final Recommendation Required:** Yes — must confirm deployment readiness with operational risk level.
"""
)
```

---

## Synthesis Protocol

When multiple subagents return outputs, follow these steps:

### 1. Collect
Read every designated `_workspace/` artifact. If any are missing, re-dispatch.

### 2. Compare
Build a comparison matrix of findings across agents. Identify:
- **Agreements** (multiple agents arrive at same conclusion → high confidence)
- **Disagreements** (conflicting recommendations → needs resolution)
- **Gaps** (something no agent addressed → dispatch additional agent)

### 3. Resolve
- Same-severity disagreement → flag both with tradeoff, escalate to human
- Cross-agent contradiction → Lead decides based on architecture principles
- BLOCKER vs non-BLOCKER → BLOCKER wins; implementation must be fixed

### 4. Identify Uncertainty
List: conflicts, low-confidence outputs, ambiguous requirements, unverified assumptions.

### 5. Next Steps
Each step: **what** (specific action), **who** (owner agent), **priority** (P0/P1/P2), **risk**.

### 6. Final Recommendation
Write `_workspace/09_final_summary.md` with: changes, architecture decisions, review findings, quality gate results, risks & tradeoffs, next steps table, and final recommendation with risk level (LOW/MEDIUM/HIGH/CRITICAL).

---

## Quality Gates

Run these before declaring completion. The Lead runs them; failures are routed to responsible agents.

```bash
uv run ruff check            # Must pass with no errors
uv run ruff format --check   # Must pass
uv run pyright .             # Must pass (or uv run mypy .)
uv run pytest                # Must pass
```

| Failure Type | Route To |
|---|---|
| ruff lint errors | `python-implementer` |
| ruff format check fails | `python-implementer` |
| pyright/mypy errors (new) | `python-implementer` |
| pyright/mypy errors (pre-existing) | note in final summary, do not block |
| pytest failures (test bug) | `testing-engineer` |
| pytest failures (code bug) | `python-implementer` |

---

## Artifact Conventions

| Artifact | Path | Producer | When Produced |
|---|---|---|---|
| Architecture document | `_workspace/01_architecture.md` | `python-architect` | After Phase 2 |
| Implementation summary | `_workspace/02_implementation.md` | `python-implementer` | After Phase 3 |
| Review findings | `_workspace/03_review.md` | `python-reviewer` | After Phase 4 |
| Performance report | `_workspace/04_performance.md` | `performance-engineer` | On demand |
| API review | `_workspace/05_api_review.md` | `api-design-reviewer` | When API surface changes |
| Test summary | `_workspace/06_test_summary.md` | `testing-engineer` | After Phase 5 |
| ML run summary | `_workspace/07_ml_run.md` | `ml-engineer` | After ML training |
| Deployment docs | `_workspace/08_deployment.md` | `mlops-engineer` | After ML deployment |
| Final summary | `_workspace/09_final_summary.md` | Lead | After Phase 6 |
| Packaging report | `_workspace/10_packaging.md` | `packaging-uv-engineer` | When deps change |
| Documentation gap report | `_workspace/11_docs.md` | `documentation-maintainer` | When docs are written |
| Data pipeline docs | `_workspace/12_data_pipeline.md` | `polars-data-engineer` | After data pipeline work |

---

## Error Handling

- If an agent returns BLOCKER, route back to the appropriate fixer agent.
- If an agent times out, retry once with narrower scope.
- If two agents produce conflicting recommendations, flag in final summary for human decision.
- If quality gates fail, route failures to the responsible agent for resolution before declaring completion.
- If `_workspace/` already exists from a prior run, archive old artifacts (`mv _workspace _workspace.prev.$(date +%s)`) and start fresh unless the user requests a partial rerun.
- If a subagent cannot complete because required context is missing, gather the context and re-dispatch.

---

## Follow-up Triggers

- **"rerun", "update", "revise"** — rerun affected agents only, re-synthesize.
- **"audit", "status", "check"** — verify quality gates and review findings, report status.
- **"continue", "next steps"** — read `_workspace/09_final_summary.md` and proceed with P0 next steps.
- **"optimize"** — dispatch `performance-engineer` on the current implementation.
- **"review"** — dispatch `python-reviewer` on current state.
