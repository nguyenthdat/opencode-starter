---
name: design-patterns
description: "Rust design-pattern selection and implementation for architecture, refactors, reusable abstractions, runtime polymorphism, factories/builders, wrappers, state machines, commands, observers, and other GoF patterns. Use when non-trivial Rust design needs a pattern decision or when reviewing pattern-heavy code. Prefer idiomatic Rust constructs and simpler concrete code; do not use for naming a pattern after implementation without a real design pressure."
compatibility: opencode
metadata:
  domain: rust
  audience: senior-rust-developer
  workflow: architecture-implementation-review
---

# Rust Design Patterns

Use design patterns as a vocabulary for recurring design pressures, not as a target architecture. Prefer the smallest Rust construct that makes the required variation, ownership, and invariants explicit.

Refactoring.Guru examples are pedagogical. Preserve their intent, but normalize production implementations through `rust-coding`: use typed errors instead of `String`, propagate failures instead of unwrapping, avoid unnecessary cloning, and replace legacy or unsafe global-state techniques with current safe Rust.

Load `rust-coding` whenever implementation or code review is in scope. For architecture-only advice, apply the decision process here without requiring code-quality commands that have no target repository.

## Required Workflow

### 1. Establish the Pressure

Inspect the current code and identify:

- The concrete duplication, coupling, unstable dependency, runtime variation, state transition, or lifecycle problem.
- Which axis is expected to change and which must remain stable.
- Whether variants are closed and known at compile time or open and selected at runtime.
- Ownership, lifetime, thread-safety, cancellation, persistence, and semver constraints.
- A concrete second implementation or near-term requirement. Keep one-off private code concrete unless abstraction clearly reduces risk.

If no recurring pressure exists, do not add a pattern. Record the simpler alternative and continue with concrete code.

### 2. Try Native Rust First

Evaluate these before introducing a custom trait hierarchy:

1. A function or closure for stateless behavior injection.
2. An `enum` plus exhaustive `match` for a closed set of variants or states.
3. A standard trait such as `Iterator`, `IntoIterator`, `From`, `TryFrom`, `AsRef`, `Borrow`, `Read`, `Write`, or `Clone`.
4. A generic parameter or associated type for compile-time polymorphism.
5. A newtype wrapper for adaptation, validation, or policy enforcement.
6. A channel or explicit event enum for asynchronous coordination.

Use a named GoF pattern only when it communicates the design better than these constructs alone. Read `references/catalog.md` for the pattern-specific decision matrix.

### 3. Choose the Dispatch Model

Use the least flexible model that satisfies the requirement:

| Requirement | Preferred Rust Form |
|---|---|
| Closed variants with variant-specific data | `enum` and exhaustive `match` |
| Stateless replaceable behavior | Function, closure, or `Fn` bound |
| Compile-time composition and hot paths | Generics, `impl Trait`, associated types |
| Runtime choice among a closed, compile-time-known set | `enum`/`match` or branch-local generic calls |
| Open or stored heterogeneous runtime implementations | `dyn Trait` behind `&`, `Box`, or `Arc` |
| Cross-task or cross-thread events | Typed channels and owned messages |

Before choosing `dyn Trait`, verify object safety, ownership, lifetimes, `Send`/`Sync` needs, allocation, and downcasting requirements. Before choosing generics, assess monomorphization, compile time, binary size, and public API exposure.

Libraries should normally preserve a static generic or associated-type API so callers retain the dispatch choice. A binary that must store one runtime-selected implementation may erase the type at its composition boundary without forcing dynamic dispatch on every library user.

### 4. Design Ownership Explicitly

- Prefer composition and top-down ownership. Rust does not need inheritance-shaped object graphs to express GoF intent.
- Pass context into operations when it is short-lived; do not store self-referential or permanent references merely to imitate class diagrams.
- Avoid `Rc<RefCell<_>>` or `Arc<Mutex<_>>` as a default graph-building tool. Prefer ownership transfer, stable IDs, arenas, `Weak`, or channels when they make cycles and mutation clearer.
- Avoid Singleton by default. Prefer dependency injection from `main`; use `OnceLock` or `LazyLock` for immutable one-time initialization, and a lock only when shared mutation is a real requirement. Never introduce `static mut` for this pattern. `OnceLock` and `LazyLock` are not reset mechanisms: keep per-test state injected or use process isolation when reset is required.
- Keep lock scope bounded and never hold a blocking guard across `.await`. Define poison, cancellation, reentrancy, and backpressure behavior where relevant.

### 5. Implement the Pattern Contract

- Keep traits narrow and consumer-oriented. Seal public extension points when external implementations are not part of the contract.
- Preserve domain errors and return `Result` for fallible construction, adaptation, proxying, undo, persistence, and notification.
- Make ordering, short-circuiting, retries, cache invalidation, subscription lifetime, and state transitions explicit.
- Add `#[must_use]` to builders and transition values when discarding them is likely a bug.
- Do not add dependencies only to obtain a pattern name. Prefer `std` and existing project abstractions.
- Do not expose the pattern vocabulary in public names unless it helps users understand the API.

### 6. Record the Decision

For every introduced or materially changed pattern, add this to the architecture or implementation artifact. For read-only advice without an artifact, return the same decision record in the response:

```text
Pressure: <specific problem and axis of change>
Decision: <pattern or simpler Rust construct>
Rust form: <enum | closure | generic | associated type | dyn Trait | channel | wrapper>
Ownership: <who owns state and how references/messages flow>
Alternatives: <at least one rejected option and why>
Costs: <allocation, dispatch, compile time, binary size, locking, API/semver>
Invariants: <behavior that tests must enforce>
```

Naming a pattern without these fields is not a design decision.

## Review Rules

Treat these as BLOCKER when they can affect correctness, soundness, or public compatibility; otherwise report them as WARNING:

- A pattern solves no demonstrated pressure or duplicates a simpler standard-library construct.
- Dynamic dispatch, shared mutability, or allocation was introduced without a runtime requirement.
- Ownership cycles, lock scope, callback reentrancy, cancellation, or thread-safety are unspecified.
- Pattern-specific semantics are broken, such as a proxy bypassing policy, a chain continuing after handling, or state transitions permitting invalid states.
- Public traits expose accidental implementation details or create an unnecessary semver commitment.
- A Singleton hides a dependency, blocks test isolation, or uses unsafe mutable global state.

Do not block merely because code does not use a named GoF pattern. Concrete code is preferred when it is simpler and sufficient.

## Verification

Run the normal `rust-coding` gates and add tests for the selected pattern's contract:

- Construction: required fields, incompatible families, validation failures, and clone depth.
- Pluggable algorithms/backends: one conformance suite across implementations, correct runtime selection, and static callers remaining free of forced type erasure.
- Wrappers: transparent behavior, error propagation, policy enforcement, and wrapper ordering.
- Trees and chains: traversal/order, short-circuit behavior, empty cases, and depth/resource bounds.
- Commands and snapshots: idempotency where required, undo/redo, failed execution, and versioned restore.
- Events: subscribe/unsubscribe lifetime, reentrancy, slow consumers, backpressure, and delivery guarantees.
- State: allowed and rejected transitions, exhaustiveness, persistence, and concurrency behavior.
- Process-wide resources: no `static mut`, explicit initialization behavior, and isolated parallel tests without cross-test state leakage.

Use property tests for stable invariants and transition systems when the state space justifies them. Benchmark only when the pattern choice includes a performance claim.

## References

- `references/catalog.md` - Read when selecting, implementing, or reviewing any of the 22 creational, structural, or behavioral patterns.
- [Refactoring.Guru: Design Patterns in Rust](https://refactoring.guru/design-patterns/rust) - Source catalog and conceptual Rust examples.
- [Rust Design Patterns](https://rust-unofficial.github.io/patterns/) - Rust-specific idioms, patterns, and anti-patterns.
