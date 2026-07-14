# Rust Design Pattern Catalog

Use this catalog after establishing a concrete design pressure. The Rust form is a starting point, not a requirement. Prefer a standard trait, enum, function, or concrete type when it is sufficient.

## Creational Patterns

| Pattern | Use When | Idiomatic Rust Form | Avoid or Verify |
|---|---|---|---|
| Abstract Factory | A client must create compatible families of related products without naming concrete families. | Factory trait with associated product types for static dispatch; object-safe factory returning boxed products only for runtime-selected families. | A single product or family does not justify it. Verify products from one family remain compatible and public associated types do not over-constrain users. |
| Builder | Construction has many optional fields, ordered steps, validation, or multiple outputs from one recipe. | Consuming or mutable builder; `build(self) -> Result<T, E>`; associated output type for genuinely different products; typestate only when compile-time step enforcement earns its complexity. | Fluent setters alone are not necessarily Builder. Do not hide missing required fields behind production `expect`; validate and return typed errors. |
| Factory Method | Shared workflow must defer creation of one product to an implementation. | Trait method, generic constructor function, associated type, or enum-based factory function. | Prefer `new`, `TryFrom`, or a plain function for simple selection. Verify the factory abstraction has multiple real creation policies. |
| Prototype | Callers need independent copies without knowing concrete construction details. | `Clone` or explicit `clone_from`; document deep versus shared clone semantics. | Cloning `Arc`, `Rc`, handles, file descriptors, or caches may share state rather than duplicate it. Make cost and independence explicit. |
| Singleton | A process-wide resource truly has one initialization or identity. | Prefer explicit dependency injection. For unavoidable globals use `OnceLock`/`LazyLock` for one-time initialization and safe synchronization for mutation. | Global state harms modularity and tests. Never use `static mut`; define initialization failure, lock poisoning, and shutdown. Because one-time cells do not provide process-wide reset, keep resettable test state injected or use process isolation. |

## Structural Patterns

| Pattern | Use When | Idiomatic Rust Form | Avoid or Verify |
|---|---|---|---|
| Adapter | A foreign or legacy interface must satisfy a local consumer contract. | Newtype wrapper implementing a local target trait; `From`/`TryFrom` for data conversion. | Respect orphan rules rather than leaking foreign types into the API. Preserve error and ownership semantics; do not silently lose information. |
| Bridge | Two dimensions of behavior must vary independently without a Cartesian product of types. | Abstraction struct parameterized by an implementation trait, or a boxed trait object when the implementation changes at runtime. | Two simple enums may be clearer for closed variants. Verify each axis is independently variable and the bridge does not expose implementation details. |
| Composite | Leaves and containers need uniform recursive operations. | Recursive enum for closed node kinds; `Vec<Box<dyn Component>>` for an open heterogeneous tree; arena plus IDs for large mutable graphs. | Define traversal order, recursion/depth limits, cycle policy, and mutation ownership. Do not use reference-counted cycles by default. |
| Decorator | Behavior must be layered around the same interface and wrapper order matters. | Generic wrapper `T: Trait` for static composition; boxed trait object for runtime stacks; follow standard wrappers such as `BufReader<R>`. | Forward all required behavior and preserve errors. Test wrapper order, duplicate decoration, cancellation, and whether buffering/caching changes observability. |
| Facade | Clients need a small workflow-oriented entry point over a complex subsystem. | Focused service or module API owning/coordinating internal components. | Avoid a god object. Keep domain errors and transactional boundaries visible, and retain lower-level escape hatches when advanced users need them. |
| Flyweight | Many objects repeat large immutable intrinsic state and measurement shows memory pressure. | `Arc<T>` containing immutable intrinsic state, interning, indexed arenas, or keyed caches; keep per-instance extrinsic state outside the shared value. | Measure before adding cache complexity. Define key correctness, eviction, contention, lifetime, and mutation policy. |
| Proxy | Access to a service needs authorization, lazy loading, caching, rate limiting, retries, or remote indirection behind the same contract. | Wrapper implementing the service trait and delegating after policy checks. | Preserve the service's success/error semantics. Verify policy cannot be bypassed, cache invalidation is correct, retries are safe, and concurrent access is bounded. |

## Behavioral Patterns

| Pattern | Use When | Idiomatic Rust Form | Avoid or Verify |
|---|---|---|---|
| Chain of Responsibility | A request passes through ordered handlers that may handle, transform, reject, or forward it. | `Vec<Box<dyn Handler>>`, iterator pipeline, or typed middleware stack; return an explicit continue/handled/rejected result. | Define ordering, short-circuit rules, error propagation, mutation, and async backpressure. Do not encode a fixed simple sequence as deep boxed links. |
| Command | Operations need queuing, logging, remote execution, retries, undo, or heterogeneous history. | Enum for a closed command set; closure for one-shot behavior; trait object for open heterogeneous history. Pass mutable context into `execute` instead of storing a permanent context reference. | Define ownership of arguments, idempotency, authorization timing, failure recording, and undo data. Undo is not valid unless side effects can actually be compensated. |
| Iterator | A collection needs traversal without exposing representation. | Implement standard `Iterator`/`IntoIterator`; provide `iter`, `iter_mut`, and `into_iter` as ownership permits. | Do not invent a parallel iterator interface. Implement `ExactSizeIterator`, `DoubleEndedIterator`, or `FusedIterator` only when their contracts hold. |
| Mediator | Components have chaotic pairwise dependencies and coordination belongs in one owner. | Top-down owner stores components; pass `&mut dyn Mediator` during operations, or coordinate actors/tasks through typed messages and IDs. | Components should not retain cyclic mediator references. Prevent the mediator becoming a god object and define reentrancy, queueing, and failure isolation. |
| Memento | State needs undo, checkpoints, crash recovery, or snapshots without exposing internals. | Private snapshot type, `Clone` for in-memory state, or Serde for persistent/versioned state; restore with `Result`. | Persistent snapshots require schema versioning, validation, integrity/confidentiality, and resource limits. Never deserialize untrusted snapshots with unchecked assumptions. |
| Observer | Multiple consumers must react to events and subscription changes over time. | Typed callbacks for synchronous local events; RAII subscription handles; `broadcast`, `watch`, or `mpsc` channels for async delivery. | Define unsubscribe/drop behavior, callback reentrancy, listener mutation during notify, ordering, slow consumers, lag, cloning cost, and delivery guarantees. |
| State | Behavior and valid operations depend on current state. | Enum FSM for closed runtime states; typestate for compile-time protocol enforcement; boxed state trait for open runtime-extensible behavior. | Prefer enum/match unless extensibility requires dynamic state. Define every transition, invalid action, transition failure, persistence, and concurrent access. |
| Strategy | One algorithm varies independently from its caller. | Function/closure or `Fn` bound for stateless behavior; generic strategy for static dispatch; trait object for runtime replacement or heterogeneous storage. | Do not create a trait for a single callback. Account for captured closure ownership, `Send`/`Sync`, monomorphization, and runtime dispatch cost. |
| Template Method | An invariant algorithm skeleton has a few controlled customization steps. | Trait default method calling required methods/hooks, or a free function accepting callbacks/strategy values. | Rust has no class inheritance; prefer composition when steps need independent state or reuse. Keep hooks minimal and document call order and failure behavior. |
| Visitor | A stable set of element shapes needs many independently evolving operations. | Visitor trait with associated output/error types; Serde-style driven visitor; sometimes an enum plus exhaustive match is simpler. | Visitor favors stable elements and changing operations. If variants change often, exhaustive enum matching is usually clearer. Validate inputs before indexing or conversion. |

## Selection Heuristics

| Pressure | First Choice | Escalate When |
|---|---|---|
| Closed alternatives | `enum` + `match` | Open/external or stored heterogeneous implementations require `dyn Trait` |
| Inject one operation | Closure or function | Stateful/open algorithms justify Strategy |
| Construct one validated value | `new`, `TryFrom`, constructor function | Optional steps or multiple recipes justify Builder/Factory |
| Wrap one dependency | Newtype or generic wrapper | Runtime wrapper stacks justify Decorator/Proxy trait objects |
| Coordinate async components | Typed channels and event enums | Central policy across many components justifies Mediator |
| Model protocol states | Enum FSM | Compile-time misuse risk justifies typestate; plugin states justify dynamic State |
| Traverse a collection | Standard iterator adapters | Custom `Iterator` only when representation-specific traversal is needed |

## Production Normalization

When translating conceptual examples into production code:

- Replace demonstration `unwrap`/`expect` with typed errors unless an invariant is local, proven, and documented.
- Replace `Result<_, String>` with a domain error type.
- Borrow `&str`/`&[T]` instead of `&String`/`&Vec<T>` where ownership is not required.
- Avoid clones inserted only to satisfy a first-pass ownership model; redesign ownership or pass references where possible.
- Prefer `OnceLock`/`LazyLock` and explicit dependency injection over `lazy_static!` for new standard-library-compatible code.
- Add `Send`/`Sync` bounds only at actual thread boundaries.
- Test the pattern's observable contract, not its type or module names.
