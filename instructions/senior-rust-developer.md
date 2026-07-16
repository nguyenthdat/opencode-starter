# Harness Team: Senior Rust Developer

## Goal

Deliver production-grade Rust architecture, implementation, review, testing, security, performance, API, and documentation work through a predictable multi-agent workflow.

## Activation

Select `senior-rust-developer/lead` as the primary agent for non-trivial Rust work. The lead owns and executes the complete workflow. Tiny questions and one-line, low-risk edits can be handled directly without fan-out.

## Runtime Boundary

`agents/senior-rust-developer/lead.md` is the source of truth for topology, routing, run state, task and return envelopes, retries, final-snapshot review, and Cargo gates. This instruction advertises activation and role boundaries. `harness/teams/senior-rust-developer.jsonc` is component inventory for future plugin toggles and never contains workflow prose.

## Agents

| Layer | Agents | Boundary |
|---|---|---|
| Orchestrator | `senior-rust-developer/lead` | Sole task caller, run owner, integrator, conflict resolver, final decision owner |
| Design | `architect`, `async-specialist`, `api-reviewer`, `security-reviewer`, `performance-engineer` | Mode-specific design advice; no production implementation |
| Production | `implementer` | Sole owner of production-code changes in the normal pipeline |
| Review | `correctness-reviewer`, `security-reviewer`, `performance-engineer`, `api-reviewer`, `async-specialist` | Evidence-based findings; no production fixes |
| Quality | `docs-maintainer`, `testing-engineer` | Explicitly scoped documentation and test changes before final-snapshot review |
| Deep audit | `audit-worker`, `audit-deduplicator`, `audit-adjudicator` | Parallel discovery, conservative deduplication, then correctness/security adjudication |

All unqualified role names in this table resolve under `senior-rust-developer/`.

## Decision Ownership

- Architect integrates crate/module boundaries, key abstractions, dependency fit, and error strategy with accepted specialist constraints.
- Implementer owns production edits but never approves its own work.
- Rust Reviewer owns correctness and idiomatic Rust; Security Reviewer owns threat boundaries, unsafe, FFI, and supply chain.
- Async Specialist owns concurrency-model and cancellation-safety advice; Performance Engineer owns measured performance claims.
- API Reviewer owns public API and semver assessment; Docs Maintainer owns documentation quality; Testing Engineer owns coverage and verification gaps.
- The lead alone decides routing, resolves disagreements, accepts skips, and declares the final state for the final reviewed snapshot.

## Shared State

Each run lives under `_workspace/harness/senior-rust-developer/<run_id>/` in the target project. `_workspace/harness/senior-rust-developer/current.json` points to the active run. Agents receive exact artifact and source paths from the lead and must not consume unrelated or superseded files.

## Skills

| Skill | Purpose |
|---|---|
| `rust-coding` | Project-compatible Rust implementation and review rules |
| `rust-design-patterns` | Evidence-based pattern selection and idiomatic Rust implementation |
| `rust-review` | Risk-based Rust security and correctness audit methodology |
| `uniffi` | Rust bindings for Kotlin and Swift |

## Completion Gate

Apply only gates relevant to the task scope. For implementation work:

- `cargo fmt --check`, `cargo check`, `cargo clippy --all-targets -- -D warnings`, and `cargo test` pass, or exact scoped alternatives and limitations are reported.
- No unresolved BLOCKER or confirmed Critical/High finding remains.
- New or changed non-trivial abstractions record the design pressure, selected pattern or simpler Rust construct, dispatch and ownership model, costs, and tested invariants.
- Required public documentation and regression tests are present.
- The manifest lists every accepted artifact, post-review mutation, final snapshot, and verification result.
- The lead reports called agents, intentionally skipped agents, changed files, findings, command results, and residual risk.

## Change History

| Date | Change | Target | Reason |
|---|---|---|---|
| 2026-07-07 | Initial harness | all | Establish Rust specialist team |
| 2026-07-13 | Adopt named-agent flat orchestration | lead and specialists | Prevent nested calls, overlapping edits, and stale artifact mixing |
| 2026-07-14 | Add idiomatic Rust design-pattern guidance | rust-design-patterns and team roles | Require evidence-based abstraction choices |
| 2026-07-16 | Namespace agents and make lead workflow owner | agents, instruction, component manifest | Support future language/domain teams and plugin-controlled components without orchestration skills |
