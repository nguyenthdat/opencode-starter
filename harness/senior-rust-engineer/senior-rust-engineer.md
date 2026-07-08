# Harness Team: Senior Rust Engineer

## Goal

Production-grade Rust engineering with multi-agent architecture, implementation, review, testing, and security audit.

## Lead agent

**Rust Engineer Lead** (`teams/rust-engineer-lead.md`) — `mode: all`, permission to spawn subagents. Orchestrates the full team, dispatches specialists, integrates outputs. Load `rust-orchestrator` and `rust-coding` skills on every run.

## Specialists

| Agent | File | Responsibility |
|---|---|---|
| Rust Architect | `teams/rust-architect.md` | Crate design, trait/generic strategy, error handling, module layout |
| Rust Implementer | `teams/rust-implementer.md` | Production Rust code, applies `rust-coding` skill |
| Rust Reviewer | `teams/rust-reviewer.md` | Correctness, safety, anti-patterns, error handling review |
| Async Rust Specialist | `teams/async-rust-specialist.md` | Tokio runtime, async/await, cancellation safety, backpressure |
| Performance Engineer | `teams/performance-engineer.md` | Profiling, benchmarking, cache-friendly optimization |
| Security Reviewer | `teams/security-reviewer.md` | Unsafe audit, supply chain, FFI safety, vulnerability review |
| Testing Engineer | `teams/testing-engineer.md` | Unit/integration/proptest, fuzzing, CI quality gates |
| API Design Reviewer | `teams/api-design-reviewer.md` | Public API ergonomics, semver, naming conventions |
| Documentation Maintainer | `teams/docs-maintainer.md` | Module docs, API docs, examples, README |

## Shared context

All agents share `_workspace/` under the project root. Every artifact is written to `_workspace/XX_name.md`. Agents read prior artifacts from the same directory. The lead agent preserves `_workspace/` after completion for audit and reruns.

## Strict role boundaries

- Architect designs, does not implement.
- Implementer implements, does not approve own work.
- Reviewer reports findings, does not modify code.
- Security Reviewer owns unsafe/FFI/supply-chain; Reviewer owns correctness/idioms.
- API Reviewer owns public API surface; Reviewer owns internal correctness.
- Docs Maintainer owns documentation; API Reviewer owns API naming.

## Trigger

For Rust development that benefits from multi-agent workflow — new features, refactors, crate design, performance optimization, async, security audits — use the **Rust Engineer Lead** as primary agent. Simple single-line fixes or questions can be answered directly.

## Skills

| Skill | Location | Purpose |
|---|---|---|
| `rust-orchestrator` | `skills/rust-orchestrator/SKILL.md` | Team coordination, workflow phases, task templates |
| `rust-coding` | `skills/rust-coding/SKILL.md` | 179 Rust best-practice rules across 14 categories |
| `rust-review` | `skills/rust-review/SKILL.md` | Security audit methodology (Trail of Bits) |
| `uniffi` | `skills/uniffi/SKILL.md` | UniFFI Kotlin/Swift bindings from Rust |

## Completion gate

- `cargo check` passes.
- `cargo clippy -- -D warnings` passes.
- `cargo fmt --check` passes.
- `cargo test` passes.
- No unresolved BLOCKER review findings.
- All public items documented.
- Architecture, implementation notes, review findings, and test results preserved in `_workspace/`.

## Change history

| Date | Change | Target | Reason |
|---|---|---|---|
| 2026-07-07 | Initial harness | all | - |
| 2026-07-07 | Add Rust Engineer Lead agent | teams/rust-engineer-lead.md | Dedicated orchestrator with mode:all and task permission |
