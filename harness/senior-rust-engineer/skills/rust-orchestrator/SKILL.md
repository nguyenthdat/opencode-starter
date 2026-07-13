---
name: rust-orchestrator
description: "Coordinates the Senior Rust Engineer harness for Rust features, refactors, debugging, architecture, async, performance, API, security, unsafe/FFI, dependency review, testing, documentation, full audits, reruns, partial reruns, and fix verification. Use when Rust work benefits from named specialist delegation; not needed for a tiny low-risk question or one-line edit."
compatibility: opencode
metadata:
  domain: rust
  audience: senior-rust-engineer
  workflow: flat-hybrid-supervisor
---

# Senior Rust Engineer Orchestrator

Coordinate a flat, caller-led Rust workflow. The Rust Engineer Lead is the only task caller. Specialists return outputs and `handoff_requests` to the lead instead of calling one another.

## Runtime Topology

The link script installs agents under `agents/senior-rust-engineer/`. Invoke them as:

```text
senior-rust-engineer/<agent-file-name-without-.md>
```

Never use `general` plus an injected team file when a named agent exists. Named dispatch preserves role instructions and permission boundaries.

```text
User
  -> Rust Engineer Lead
       -> discovery when needed
       -> design and risk consults
       -> one production Implementer
       -> independent review wave(s)
       -> one targeted fix loop
       -> documentation maintenance when needed
       -> testing and final verification
       -> lead synthesis and delivery
```

Maximum specialist delegation depth is one. A specialist must never call, route to, or message another specialist.

## Execution Modes

Choose the cheapest mode that safely covers the request:

| Mode | Use When | Required Flow |
|---|---|---|
| Direct | Tiny question or one-line low-risk edit | Lead handles directly; no workspace required |
| Plan | Architecture, dependency, API, async, or performance design only | Discovery -> relevant design agents -> lead synthesis |
| Implement | User requests code changes | Discovery -> design as needed -> Implementer -> review -> fix -> docs -> tests -> synthesis |
| Review | Diff, PR, module, or fix verification | Discovery/diff map -> relevant reviewers -> lead synthesis |
| Audit | Full security/correctness audit | Discovery -> review workers -> dedup -> adjudication -> lead synthesis |
| Targeted rerun | User asks to revise or verify prior output | Reuse manifest -> supersede affected artifacts -> rerun only dependent phases |

## Run State

Use `_workspace/rust-engineer/` in the target project. Before delegation:

1. No workspace: create a new run ID and manifest.
2. Existing workspace plus related follow-up: keep the run ID, mark replaced artifacts `SUPERSEDED`, and preserve unaffected accepted artifacts.
3. Existing workspace plus unrelated task: archive the directory with a UTC timestamp, then initialize a fresh run.

`run_manifest.json` must record:

- `run_id`, `mode`, `objective`, `scope`, `constraints`, and acceptance criteria.
- Agent dispatches with task IDs, exact inputs, expected output, and status.
- Artifact path, producer, status (`PLANNED`, `COMPLETE`, `PARTIAL`, `BLOCKED`, `SUPERSEDED`), and verification evidence.
- Intentional specialist skips and rationale.

The manifest is the current-run allowlist. Do not ask agents to glob or infer which historical artifacts are current.

## Routing Matrix

| Signal | Required Owner | Add When |
|---|---|---|
| Crate/module boundary, core type/trait, error taxonomy, dependency choice | `rust-architect` | Always for broad refactors or new subsystem design |
| Production code requested | `rust-implementer` | Exactly one normal-pipeline production writer |
| Non-trivial code or diff | `rust-reviewer` | Always before implementation approval |
| `.await`, Tokio, tasks, channels, locks, cancellation, concurrency | `async-rust-specialist` | Design consult before implementation; review consult after when risk remains |
| `unsafe`, FFI, untrusted input, deserialization, paths, secrets, auth, dependency changes | `security-reviewer` | Add `rust-reviewer` for general correctness |
| Public `pub` surface, traits, error types, features, semver, user-facing naming | `api-design-reviewer` | Add Architect when public type design changes |
| Hot path, latency, throughput, memory, binary size, compile time | `performance-engineer` | Add Architect for structural optimization |
| Public items, examples, README, package metadata | `docs-maintainer` | Run after code review/fix so docs describe stable code |
| Code or test behavior changed | `testing-engineer` | Always before claiming implementation complete |
| Whole-repo or high-depth security/correctness audit | `rust-review-worker` -> `rust-review-dedup-judge` -> `rust-review-fp-judge` | Lead owns every stage; no nested calls |

Use only matching agents. Record low-risk skips in `01_task.md` and final coverage.

## Dispatch Budget

- Run no more than three specialist calls in one parallel wave.
- Parallelize only read-only or disjoint work with the same stable input snapshot.
- Never run two production writers concurrently on overlapping files.
- Sequence Architect before Implementer when design decisions affect implementation.
- Sequence Implementer before reviewers, fixes before re-review, Docs before final Testing, and dedup before adjudication.
- Reuse the same task ID for one narrow retry. Do not replace one failed call with an expanding chain of agents.

## Workflow

### Phase 0: Intake and Discovery

1. Classify mode, scope, acceptance criteria, MSRV/edition, compatibility constraints, protected files, and required gates.
2. Detect risk flags from the routing matrix.
3. Inspect `Cargo.toml`, `Cargo.lock`, crate layout, relevant source, tests, and the current diff. Use `explore` only when bounded discovery is cheaper than direct inspection.
4. Write `01_task.md` and `10_discovery.md`; initialize the manifest before specialist dispatch.

### Phase 1: Design and Consults

Dispatch Architect when structure or contracts may change. Dispatch Async, API, Security, or Performance specialists only for matching risks.

Independent design consults may share a wave after discovery. Architect owns the integrated architecture artifact; the lead resolves conflicts and records accepted constraints before implementation.

Gate: `20_architecture.md` must state affected boundaries, key types/traits, error strategy, dependency decisions, compatibility constraints, risks, and implementation acceptance criteria.

### Phase 2: Implementation

Dispatch `rust-implementer` with accepted design artifacts, exact target files, acceptance criteria, protected paths, and required commands. The Implementer is the sole production-code writer in the normal pipeline.

If it returns a `handoff_request`, the lead decides whether to pause and consult a specialist. The Implementer must not call that specialist directly.

Gate: changed files are listed in `30_implementation.md`; scoped formatting and compilation checks pass before review, or exact failures are marked blocking.

### Phase 3: Review Waves

Freeze the implementation snapshot and dispatch up to three independent reviewers per wave. Every reviewer receives the same diff/commit, exact files, architecture artifact, implementation artifact, and risk-specific questions.

Normalize findings as:

- `BLOCKER`: must be fixed before completion.
- `WARNING`: material but may be accepted with explicit rationale.
- `INFO`: non-blocking improvement or observation.

Security audit outputs may retain Critical/High/Medium/Low severity; map confirmed Critical/High to BLOCKER for implementation completion.

### Phase 4: Targeted Fix and Re-review

1. Lead deduplicates findings and writes `80_synthesis.md` with owner and acceptance criteria for each required fix.
2. Dispatch the Implementer once with only accepted BLOCKER fixes.
3. Re-dispatch only reviewers whose findings were affected, using their prior task IDs where possible.
4. If blockers remain after one fix loop, stop and report options instead of cycling indefinitely.

### Phase 5: Documentation

When public items or user-facing behavior changed, dispatch Docs Maintainer after production fixes. It may edit documentation and rustdoc only. Sequence this before Testing so doctests are part of final verification.

### Phase 6: Testing and Final Verification

Dispatch Testing Engineer with stable code, accepted findings, changed files, invariants, and docs artifact. It may add or modify tests and test infrastructure, then run the scoped completion commands.

The lead verifies command evidence and records any unavailable or intentionally skipped gate. Do not convert a proposed command into a passed result.

### Phase 7: Synthesis and Delivery

Read all manifest-accepted artifacts. Resolve conflicts using this priority:

1. Soundness and security.
2. Correctness and data integrity.
3. Public API and semver.
4. Measured performance and resource bounds.
5. Maintainability, documentation, and style.

Write `90_final.md`, update the manifest, and deliver the result. Prefer measured evidence over speculation and preserve unresolved disagreement or uncertainty.

## Deep Audit Pipeline

Use this only for full audits or large high-risk scopes:

1. Partition review clusters by non-overlapping risk area or crate. Dispatch up to three `rust-review-worker` calls per wave, each with an exact scope and unique artifact path `46_audit_worker_<scope>.md`.
2. Read worker artifacts and reject evidence-free findings before aggregation.
3. Dispatch `rust-review-dedup-judge` with only current-run worker artifacts. It conservatively merges exact duplicates into `47_audit_dedup.md`.
4. Dispatch `rust-review-fp-judge` with the threat model, discovery artifact, and deduplicated findings. It verifies code and reachability, then writes `48_audit_adjudication.md`.
5. Lead owns the final ship/block decision. The adjudicator does not dispatch fixes or other agents.

## Task Contract

Every specialist call must include:

```text
Agent: senior-rust-engineer/<name>
Run ID: <id>
Mode: <plan|implement|review|audit|targeted-rerun>
Objective: <one measurable specialist outcome>
Scope: <exact files, modules, diff, or crate>
Read first: <manifest-listed artifact paths>
Constraints: <MSRV, edition, semver, compatibility, targets, protected paths>
Edit scope: <none|production paths|test paths|documentation paths|artifact only>
Output artifact: _workspace/rust-engineer/<unique file>
Acceptance criteria: <objective checks>
Risks to assess: <specialist-specific list>
Verification: <commands or static checks; state why if not run>
```

Require this return envelope:

```text
status: COMPLETE | PARTIAL | BLOCKED
summary: <concise outcome>
artifact: <path written>
changed_files: <exact paths or none>
findings: <BLOCKER/WARNING/INFO counts or none>
verification: <commands and outcomes or not-run reason>
handoff_requests:
  - agent: <recommended named agent>
    objective: <narrow task>
    paths: <exact inputs>
    reason: <why owner expertise is needed>
    blocking: true | false
recommendation: ship | change | block | request-info
uncertainty: <gaps and assumptions>
```

An empty `handoff_requests` list is valid. A handoff request is advice to the lead, not permission for nested delegation.

## Failure Handling

| Situation | Response |
|---|---|
| Specialist fails or returns thin output | Retry once with same task ID, narrower scope, and explicit missing acceptance criteria |
| Retry fails | Mark artifact `PARTIAL` or `BLOCKED`; continue only if safe and disclose coverage gap |
| Implementer check fails | Return exact errors once; do not enter an open-ended fix loop |
| Reviewer disagreement | Lead checks code and evidence, applies priority order, records resolution |
| Required tool unavailable | Record attempted command and error; use a safe scoped alternative or lower confidence |
| Most critical calls fail | Stop and ask the user rather than claiming partial work is complete |
| Requirements require a product/semver decision | Ask the user when no safe reversible default exists |

## Completion Gate

For implementation mode, deliver complete only when:

- Manifest inputs and accepted artifacts belong to the current run.
- Required specialists are `COMPLETE`, or accepted `PARTIAL` status and impact are explicit.
- No unresolved BLOCKER or confirmed Critical/High finding remains.
- Relevant formatting, compilation, lint, test, and doctest commands pass.
- Public API documentation and regression tests match the final code.
- The lead reports intentional skips, unavailable tools, and residual risk.

For plan, review, and audit modes, do not require implementation-only commands; require evidence, scope coverage, and an explicit final recommendation instead.

## Dry Runs

- Normal path: async public API feature -> discovery -> Architect plus Async/API consults -> Implementer -> correctness/API/async reviews -> targeted fix -> Docs -> Testing -> final.
- Failure path: Security Reviewer unavailable -> one narrow retry -> mark security artifact partial -> block completion if unsafe/FFI is in scope; otherwise disclose reduced coverage and confidence.
