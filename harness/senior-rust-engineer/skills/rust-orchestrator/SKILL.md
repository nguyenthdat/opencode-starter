---
name: rust-orchestrator
description: "Coordinates the Senior Rust Engineer harness team for Rust development tasks. Use for new Rust features, refactors, crate design, performance optimization, async implementation, security audits, or any Rust engineering work that needs multi-agent review. Also use for rerun, update, revise, improve, partial rerun, audit, or sync of previous Rust harness outputs."
---

# Senior Rust Engineer Orchestrator

Coordinates specialist agents to produce production-grade Rust code with architecture design, implementation, multi-perspective review, testing, and final summary.

## Execution mode

Hybrid: parallel discovery → sequential design/implementation → parallel review gates → sequential testing → integration.

## Agent map

| Agent | File | Role | Output |
|---|---|---|---|
| Rust Architect | `teams/rust-architect.md` | Architecture, crate design, error strategy | `_workspace/01_architecture.md` |
| Rust Implementer | `teams/rust-implementer.md` | Implementation, applies `rust-coding` | changed files + `_workspace/03_implementation.md` |
| Rust Reviewer | `teams/rust-reviewer.md` | Correctness, safety, anti-patterns | `_workspace/04_review_findings.md` |
| Async Rust Specialist | `teams/async-rust-specialist.md` | Tokio, async patterns, cancellation | `_workspace/0X_async_*.md` |
| Performance Engineer | `teams/performance-engineer.md` | Profiling, benchmarking, optimization | `_workspace/04_perf_findings.md` |
| Security Reviewer | `teams/security-reviewer.md` | Unsafe audit, supply chain, vulnerabilities | `_workspace/04_security_findings.md` |
| Testing Engineer | `teams/testing-engineer.md` | Tests, fuzzing, CI gates | `_workspace/05_tests.md` |
| API Design Reviewer | `teams/api-design-reviewer.md` | Public API ergonomics, semver, naming | `_workspace/04_api_findings.md` |
| Documentation Maintainer | `teams/docs-maintainer.md` | Docs, examples, maintainability | `_workspace/04_docs_findings.md` |

**HARNESS_ROOT** = `harness/senior-rust-engineer`

All agent prompts live at `${HARNESS_ROOT}/teams/<name>.md`. Read the agent file before each task spawn and pass its content as the task prompt body, appended with the task-specific context.

## Workflow

### Phase 0: Context check

1. Check whether `_workspace/` exists.
2. Decide:
   - No `_workspace/` → initial run, continue to Phase 1.
   - `_workspace/` exists + revision request → targeted rerun of affected phases only.
   - `_workspace/` exists + new task → archive old workspace as `_workspace_{YYYYMMDD_HHMMSS}/`, create fresh `_workspace/`.
3. If targeted rerun, include prior artifact paths and user feedback in specialist task prompts.

### Phase 1: Understand the task

1. Parse the user request. Identify scope: new feature, refactor, bug fix, optimization, audit.
2. Determine which agents are needed from the agent map above:
   - All tasks need: Architect + Implementer + Reviewer.
   - Async code → add Async Specialist.
   - Performance-sensitive → add Performance Engineer.
   - `unsafe` or FFI → add Security Reviewer.
   - Public API changes → add API Design Reviewer.
   - New or changed public items → add Docs Maintainer.
   - All tasks: Testing Engineer.
3. Explore the codebase with a `task` subagent (subagent_type `explore`):
   - Read `Cargo.toml`, key modules, existing public API, test structure.
   - Return: crate structure, dependencies, existing patterns, key types.
4. Create `_workspace/` directory.
5. Save task analysis to `_workspace/00_task.md`.

### Phase 2: Architecture

**Mode:** Sequential (depends on Phase 1 exploration).

1. Read `${HARNESS_ROOT}/teams/rust-architect.md`.
2. Spawn a `task(subagent_type="general")` with the Architect prompt + task context + codebase findings.
3. Architect returns `_workspace/01_architecture.md`.
4. Gate: architecture doc must specify crate structure, key types/traits, error strategy, dependency choices, and risks.

### Phase 3: Implementation

**Mode:** Sequential with optional parallel specialist consultation.

1. If async is involved, first consult Async Specialist:
   - Read `${HARNESS_ROOT}/teams/async-rust-specialist.md`.
   - Spawn `task(subagent_type="general")` with async prompt + architecture doc.
   - Output: `_workspace/03_async_design.md`.
2. Read `${HARNESS_ROOT}/teams/rust-implementer.md`.
3. Spawn `task(subagent_type="general")` with Implementer prompt + architecture doc + task description.
4. Implementer returns: changed files, `cargo check`/`cargo clippy` output, `_workspace/03_implementation.md`.
5. Gate: `cargo check` must pass. `cargo clippy` must have zero warnings. If not, ask Implementer to fix before proceeding.

### Phase 4: Review gates

**Mode:** Parallel fan-out. Launch all applicable reviewers in one turn.

For each applicable reviewer, read its team file, then spawn a `task(subagent_type="general")` with the agent prompt + diff of changes + architecture doc.

| Reviewer | When to include |
|---|---|
| Rust Reviewer | Always |
| API Design Reviewer | Public API changes |
| Security Reviewer | `unsafe`, FFI, or handling untrusted input |
| Performance Engineer | Hot-path changes or explicit performance goals |
| Async Specialist | Async code (if not already consulted in Phase 3) |
| Docs Maintainer | New/changed public items |

Each reviewer writes findings to `_workspace/04_{reviewer}_findings.md`.

Gate: collect all findings. Categorize:
- **BLOCKER:** Must fix before proceeding. Send back to Implementer.
- **WARNING:** Should fix. Record in summary, proceed.
- **INFO:** Consider. Record, no action required.

If blockers exist, return to Phase 3 with findings. Limit to one revision loop. If blockers remain after retry, report to user with options.

### Phase 5: Testing

**Mode:** Sequential (depends on reviewed code being final).

1. Read `${HARNESS_ROOT}/teams/testing-engineer.md`.
2. Spawn `task(subagent_type="general")` with Testing Engineer prompt + changed files + architecture doc + review findings (for edge cases to test).
3. Testing Engineer writes: new/modified tests, `cargo test` output, `_workspace/05_tests.md`.
4. Gate: `cargo test` must pass. If not, fix tests or flag as incomplete.

### Phase 6: Final summary

**Mode:** Primary agent integration.

1. Read all `_workspace/` artifacts.
2. Produce final summary inline. Include:
   - What was done (brief).
   - Changed files.
   - Review findings summary (total, by severity, resolved/unresolved).
   - Test results.
   - Risks and tradeoffs.
   - Next steps.
3. Preserve `_workspace/` for audit and reruns.

## Task prompt template

For each specialist spawn, the prompt must follow this structure:

```text
{Agent prompt body from teams/<name>.md}

## Task context
**Goal:** {specific, measurable outcome}
**Constraints:** {performance targets, compatibility requirements, etc.}
**Read:** {file paths to read before starting}
**Do not modify:** {protected files}
**Write output to:** {artifact path}

## Acceptance criteria
{checklist of verifiable conditions}

## Return to orchestrator
- Summary of what was done
- List of changed or created files
- Verification output (command + result)
- Risks and unresolved questions
- Artifact paths
```

## Error handling

| Situation | Response |
|---|---|
| One reviewer fails | Retry once with same prompt. If fails again, mark that review area as incomplete in summary. |
| Implementer `cargo check` fails | Return to Implementer with error output. Two attempts max. |
| Blocker findings after retry | Report to user with blockers, severity, and options. |
| Multiple critical failures | Stop, report failures, ask user before continuing. |
| Ambiguous requirements | List assumptions made. Flag decisions needing user input. |

## Follow-up triggers

- rerun, run again, update, revise, improve, fix, sync, audit
- partial rerun, only redo architecture, only redo review, only redo tests
- based on previous output, improve the last result, fix the review findings
