---
name: rust-orchestrator
description: "Reference skill for the Senior Rust Engineer harness. Loaded by the Rust Engineer Lead agent (`teams/rust-engineer-lead.md`). Documents workflow phases, agent dispatch patterns, task prompt templates, and error handling. Use when orchestrating the senior-rust-engineer team."
---

# Senior Rust Engineer Orchestrator

Loaded by the **Rust Engineer Lead** (`teams/rust-engineer-lead.md` — `mode: all`, task permitted) to coordinate the senior-rust-engineer harness team. This skill documents the workflow; the lead agent executes it.

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

## Orchestrator responsibility

The Rust Engineer Lead coordinates the team. It is not a mega-agent and should not personally perform specialist work when a dedicated subagent should own it. The lead owns routing, context handoff, conflict resolution, final decisions, and user-facing synthesis.

Direct lead-only handling is reserved for tiny, low-risk questions or one-line edits with no public API, unsafe, async, security, dependency, or performance implications. For non-trivial Rust engineering, delegate to the smallest set of specialists that covers the risk.

## Delegation rules

| Task or risk | Required delegation | Context to pass | Expected output |
|---|---|---|---|
| Architecture/design review | Rust Architect | User goal, crate layout, key modules, constraints, dependency boundaries | Architecture recommendation, risks, final design decision needed |
| Implementation planning | Rust Architect first; Rust Implementer for feasibility and code changes | Architecture artifact, target files, acceptance criteria, protected files | Implementation plan or changed files, verification status, final recommendation |
| Unsafe code review | Security Reviewer; Rust Reviewer for idiomatic correctness | Unsafe blocks/functions, FFI boundaries, invariants, tests, threat model | BLOCKER/WARNING/INFO findings and safety recommendation |
| Async/concurrency review | Async Rust Specialist; Security Reviewer for atomics/manual `Send`/`Sync` or shared mutable state | Async call graph, runtime assumptions, locks/channels/tasks, cancellation requirements | Concurrency hazards, runtime strategy, test scenarios, final recommendation |
| Performance optimization | Performance Engineer; Rust Architect for design-level bottlenecks | Hot paths, benchmarks/profiles, target metrics, changed files | Measured/proposed optimizations, tradeoffs, final recommendation |
| API design | API Design Reviewer; Rust Architect for public type/trait design | Public API diff, semver expectations, feature flags, docs expectations | API findings, semver impact, accept/change recommendation |
| Testing strategy | Testing Engineer | Architecture, implementation notes, review findings, edge cases, invariants | Test plan, test changes, command output, remaining gaps |
| Security review | Security Reviewer | Trust boundaries, untrusted inputs, auth/secrets, dependencies, unsafe/FFI, diff | Vulnerability findings, severity, ship/block recommendation |
| Dependency/crate review | Rust Architect + Security Reviewer; Performance Engineer if compile time/binary size matters | `Cargo.toml`, `Cargo.lock`, features, alternatives, licensing/security constraints | Dependency decision, supply-chain risks, maintenance status, final recommendation |
| Documentation review | Documentation Maintainer; API Design Reviewer for public API wording/naming | Public items, README/docs paths, examples, doc-test expectations | Missing docs, suggested text, doc readiness recommendation |

Routing defaults:

- Always include Rust Reviewer before final approval of non-trivial code changes.
- Always include Testing Engineer before claiming a code change is complete unless the task is explicitly review-only or planning-only.
- Include Security Reviewer for untrusted input, `unsafe`, FFI, deserialization, filesystem path handling, credentials, dependency changes, or supply-chain questions.
- Include Async Rust Specialist for `.await`, Tokio, channels, locks, tasks, cancellation, atomics in async paths, or concurrency design.
- Include API Design Reviewer for any `pub` API, trait, type, feature flag, semver, error type, or user-facing naming change.
- Include Documentation Maintainer when public items, README, examples, or docs are created or changed.
- If a relevant specialist is skipped due to low risk, record the reason in `_workspace/00_task.md`.

## Workflow

Use the full implementation pipeline only when the user asks for code changes. For planning-only, review-only, audit-only, or documentation-only tasks, run only the relevant phases and record skipped phases in `_workspace/00_task.md`.

### Phase 0: Context check

1. Check whether `_workspace/` exists.
2. Decide:
   - No `_workspace/` → initial run, continue to Phase 1.
   - `_workspace/` exists + revision request → targeted rerun of affected phases only.
   - `_workspace/` exists + new task → archive old workspace as `_workspace_{YYYYMMDD_HHMMSS}/`, create fresh `_workspace/`.
3. If targeted rerun, include prior artifact paths and user feedback in specialist task prompts.

### Phase 1: Understand the task

1. Parse the user request. Identify scope: new feature, refactor, bug fix, optimization, audit.
2. Determine which agents are needed from the delegation rules above. Choose the smallest sufficient specialist set; do not default to every agent.
3. Explore the codebase with a `task` subagent (subagent_type `explore`):
   - Read `Cargo.toml`, key modules, existing public API, test structure.
   - Return: crate structure, dependencies, existing patterns, key types.
4. Create `_workspace/` directory.
5. Save task analysis to `_workspace/00_task.md`.

### Phase 2: Architecture

**Mode:** Sequential (depends on Phase 1 exploration).

Run this phase for design, implementation planning, dependency selection, refactors, public API changes, or any change that affects crate/module boundaries. Skip it for narrow code review or documentation-only tasks unless architecture risk is part of the request.

1. Read `${HARNESS_ROOT}/teams/rust-architect.md`.
2. Spawn a `task(subagent_type="general")` with the Architect prompt + task context + codebase findings.
3. Architect returns `_workspace/01_architecture.md`.
4. Gate: architecture doc must specify crate structure, key types/traits, error strategy, dependency choices, and risks.

### Phase 3: Implementation

**Mode:** Sequential with optional parallel specialist consultation.

Run this phase only when code changes are requested or when the user explicitly asks for an implementation plan from the Implementer. Skip it for review-only or audit-only tasks.

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

For each applicable reviewer, read its team file, then spawn a `task(subagent_type="general")` with the agent prompt + diff or target files plus the architecture doc when present.

| Reviewer | When to include |
|---|---|
| Rust Reviewer | Non-trivial code changes or code-review tasks |
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

Run this phase when code or test strategy changed. For planning-only or review-only tasks, ask Testing Engineer for a strategy artifact instead of modifying tests.

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

For each specialist spawn, the prompt must follow this structure. This is the standard subagent call protocol; keep every field present.

```text
{Agent prompt body from teams/<name>.md}

## Subagent call
**Task objective:** {specific, measurable outcome for this specialist}
**Relevant files/paths:** {source files, Cargo manifests, docs, tests, _workspace artifacts}
**Context to read first:** {_workspace/00_task.md, prior specialist artifacts, diff summary, command output}
**Constraints:** {MSRV, edition, semver, performance targets, compatibility, no-touch files, user preferences}
**Expected output format:** {artifact path plus required sections/table}
**Risks to check:** {specialist-specific risks, edge cases, threat model, perf/correctness traps}
**Verification to run or assess:** {commands, static checks, benchmark/test expectations, or explain why not run}
**Final recommendation required:** {ship/block/change/request-info with one-paragraph rationale}

## Return to orchestrator
- Summary of findings or changes
- Artifact path written
- Changed files, if any
- Verification output or reason verification was not run
- BLOCKER/WARNING/INFO findings, if reviewing
- Final recommendation: ship, block, change, or request-info
- Risks, uncertainty, and follow-up questions
```

Prompt handoff rules:

- Pass concrete file paths instead of broad directory names whenever possible.
- Pass prior artifacts by path, not by re-summarizing them, unless the artifact is short.
- For review tasks, include the diff or changed-file list plus architecture and implementation artifacts.
- For planning tasks, include constraints and acceptance criteria before asking for design options.
- Require a final recommendation from every specialist; the lead should not infer it from raw notes.

## Synthesis protocol

After subagents return, the lead integrates their outputs rather than concatenating them.

1. Compare findings by file, subsystem, and risk area. Deduplicate repeated issues while preserving the strongest rationale.
2. Resolve conflicts using this priority order: soundness/security, correctness, public API/semver, data loss, performance, maintainability, documentation, style.
3. Prefer measured evidence over speculation. Benchmark data beats guessed performance concerns; soundness/security blockers override API or performance approval.
4. Identify uncertainty explicitly: missing context, commands not run, incomplete specialist coverage, assumptions, or user decisions needed.
5. Convert findings into actionable next steps with exact files, owner role, required command, and acceptance criteria.
6. Assign ownership where useful: Implementer fixes code, Architect revises design, Security Reviewer re-checks unsafe/supply-chain fixes, Async Specialist re-checks concurrency, Testing Engineer adds coverage, Docs Maintainer updates docs.
7. Decide the final state: proceed, implement with constraints, request changes, block, or ask the user for a decision. Include why.

Final synthesis must include:

- Decision: proceed, plan, implemented, blocked, or needs user input.
- Specialist coverage: called agents and why; relevant agents intentionally skipped and why.
- Key findings: BLOCKER/WARNING/INFO counts and highest-risk items.
- Conflict resolution: disagreements and the lead's resolution.
- Action plan or completion summary: ordered, owned steps.
- Verification: commands run or required next commands.
- Residual risk and uncertainty.

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
