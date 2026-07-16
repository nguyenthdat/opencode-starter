# Senior Rust Developer

## Goal

Deliver production-grade Rust architecture, implementation, review, testing, security, performance, API, and documentation work through a predictable multi-agent workflow.

## Activation

Select `senior-rust-developer/rust-devloper-lead` as the primary agent for non-trivial Rust work. The lead must load `rust-orchestrator`. Tiny questions and one-line, low-risk edits can be handled directly without fan-out.

## Topology

Use a flat topology:

```text
user -> rust-devloper-lead -> named specialist -> rust-devloper-lead
```

- Only `rust-devloper-lead` may call `task`.
- Specialists never call, route to, or message another specialist.
- A specialist returns `handoff_requests`; the lead decides whether another call is justified.
- The lead invokes `senior-rust-developer/<agent-name>`, never `general` with copied prompt text.
- Independent work runs in parallel, with at most three calls per wave. Dependent work is sequenced through current-run artifacts.

## Agents

| Layer | Agents | Boundary |
|---|---|---|
| Orchestrator | `rust-devloper-lead` | Sole task caller, run owner, integrator, conflict resolver, final decision owner |
| Design | `rust-architect`, `async-rust-specialist`, `api-design-reviewer` | Architecture and specialist advice; no production implementation |
| Production | `rust-implementer` | Sole owner of production-code changes in the normal pipeline |
| Review | `rust-reviewer`, `security-reviewer`, `performance-engineer`, `api-design-reviewer`, `async-rust-specialist` | Evidence-based findings; no production fixes |
| Quality | `docs-maintainer`, `testing-engineer` | Documentation changes and test/verification changes after code stabilizes |
| Deep audit | `rust-review-worker`, `rust-review-dedup-judge`, `rust-review-fp-judge` | Parallel cluster review, deduplication, then adjudication; dispatched only by the lead |

## Decision Ownership

- Architect owns crate/module boundaries, key abstractions, dependency fit, and error strategy.
- Implementer owns production edits but never approves its own work.
- Rust Reviewer owns correctness and idiomatic Rust; Security Reviewer owns threat boundaries, unsafe, FFI, and supply chain.
- Async Specialist owns concurrency-model and cancellation-safety advice; Performance Engineer owns measured performance claims.
- API Reviewer owns public API and semver assessment; Docs Maintainer owns documentation quality; Testing Engineer owns coverage and verification gaps.
- The lead alone decides routing, resolves disagreements, accepts skips, and declares the final state.

## Shared State

All current-run artifacts live under `_workspace/rust-engineer/` in the target project. `run_manifest.json` is the allowlist for the active run. Agents receive exact artifact paths from the lead and must not consume unrelated or superseded workspace files.

## Skills

| Skill | Purpose |
|---|---|
| `rust-orchestrator` | Routing, task contracts, workflow phases, retries, synthesis, and completion gates |
| `rust-coding` | Rust 2024 implementation and review rules |
| `design-patterns` | Evidence-based GoF pattern selection and idiomatic Rust implementation |
| `rust-review` | Risk-based Rust security and correctness audit methodology |
| `uniffi` | Rust bindings for Kotlin and Swift |

## Completion Gate

Apply only gates relevant to the task scope. For implementation work:

- `cargo fmt --check`, `cargo check`, `cargo clippy --all-targets -- -D warnings`, and `cargo test` pass, or exact scoped alternatives and limitations are reported.
- No unresolved BLOCKER or confirmed Critical/High finding remains.
- New or changed non-trivial abstractions record the design pressure, selected pattern or simpler Rust construct, dispatch and ownership model, costs, and tested invariants.
- Required public documentation and regression tests are present.
- The manifest lists every accepted artifact and verification result.
- The lead reports called agents, intentionally skipped agents, changed files, findings, command results, and residual risk.

## Change History

| Date | Change | Target | Reason |
|---|---|---|---|
| 2026-07-07 | Initial harness | all | Establish Rust specialist team |
| 2026-07-09 | Strengthen lead orchestration | lead and orchestrator | Add delegation and synthesis protocols |
| 2026-07-13 | Adopt named-agent flat orchestration | lead, orchestrator, all specialists | Prevent unsupported nested calls, copied prompts, overlapping edits, and stale artifact mixing |
| 2026-07-14 | Add idiomatic Rust design-pattern guidance | design-patterns skill, lead, architect, implementer, reviewers, testing | Require evidence-based pattern selection and prevent class-oriented or over-abstracted translations |
