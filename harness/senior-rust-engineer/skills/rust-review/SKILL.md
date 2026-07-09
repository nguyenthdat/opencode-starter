---
name: rust-review
description: >- 
  Expert Rust security, correctness, and maintainability review. Use for Rust code audits, PR/diff review, unsafe audit, dependency review, or reviewing any Rust crate, module, or codebase. Triggered by: security review, audit, code review, PR review, unsafe review, vulnerability scan, dependency audit, crate review, Rust review.
compatibility: opencode
metadata:
  workflow: rust-security-review
  review-clusters: 15
  bug-classes: 69
---

# Rust Security Review

Expert Rust code review covering security, correctness, safety, and maintainability. This skill combines manual code reasoning, Rust-specific security analysis, and tool-assisted validation. It is not a linter wrapper — it understands Rust semantics, memory models, concurrency hazards, and attack surfaces.

## When to Use

- Full repository security audit
- PR or git diff review
- Unsafe Rust audit
- Dependency and supply chain review
- Single module or crate deep-dive
- Verification of fixes
- Bug-class-specific detection (e.g., "find all cancel-safety issues")

## Review Modes

Before starting, clarify the scope. If not explicit in the user's request, ask one question:

| Mode | Trigger phrases | What to do |
|---|---|---|
| Full Audit | "audit", "security review", "review the repo" | Whole-repo risk-based review |
| Diff Review | "PR", "diff", "this change", "review my changes" | Review changed code + callers/callees |
| Module Review | "review src/x/", "review the parser" | Deep-dive on a subtree |
| Unsafe Audit | "unsafe", "unsafe audit" | Every unsafe block, function, trait impl |
| Dependency Review | "dependencies", "supply chain" | Cargo.toml, Cargo.lock, build scripts |
| Fix Verification | "did I fix", "verify the fix" | Confirm a fix and check for regressions |
| Bug-Class Hunt | "find all cancel-safety issues" | Targeted grep + review for one bug class |

## Workflow

### Phase 1: Repository Discovery

Before reviewing any code, understand the repo structure:

```bash
# Workspace layout and crate list
cargo metadata --format-version=1 --no-deps 2>/dev/null || true

# Key files
find . -maxdepth 3 -name 'Cargo.toml' | head -20
find . -maxdepth 2 -name 'build.rs' | head -10
find . -maxdepth 3 -name 'rust-toolchain.toml' -print -quit
```

Read `Cargo.toml` (workspace root and per-crate), `Cargo.lock`, `rust-toolchain.toml` if present, and any `README.md`.

Identify:
- Workspace members and crate boundaries
- Entry points: `src/main.rs`, `src/lib.rs`, `examples/`, `tests/`, `benches/`
- Feature flags and their impact
- Build scripts (`build.rs`) and what they do
- Key dependencies (by count and sensitivity: crypto, networking, parsing, FFI)
- CI configuration (`.github/workflows/`, `Makefile`, `justfile`)

### Phase 2: Capability Detection

Probe the codebase for risk-relevant features. Use fast targeted commands:

```bash
# Unsafe blocks, functions, traits
rg -l 'unsafe\s*(extern|fn|impl|trait|\{)' --type rust | head -5

# FFI boundaries
rg -l 'extern\s+"(C|system)' --type rust | head -5

# Concurrency primitives
rg -l '\b(std::thread|std::sync::|tokio::sync|parking_lot|crossbeam|Atomic|Mutex|RwLock|UnsafeCell)' --type rust | head -5

# Async code
rg -l '\basync\s+fn\b|\.await\b' --type rust | head -5

# Path/FS operations
rg -l '\b(PathBuf|File::|OpenOptions|std::fs|tokio::fs|read_dir|create_dir)' --type rust | head -5

# Networking
rg -l '\b(TcpListener|TcpStream|UdpSocket|HttpClient|hyper|reqwest|tonic)\b' --type rust | head -5

# Serialization/deserialization
rg -l '\b(serde|Deserialize|Serialize|from_reader|from_slice|serde_json|serde_yaml|bincode|toml)\b' --type rust | head -5

# Process execution
rg -l '\b(Command::new|std::process|subprocess|exec::|system\()' --type rust | head -5

# Cryptography
rg -l '\b(ring::|aes::|rsa::|hmac::|sha2::|ed25519|p256|ecdsa|chacha|aead|digest::|signature::|hpke)\b' --type rust | head -5
```

For each capability detected, note which crates/modules are involved.

### Phase 3: Build Review Plan

Based on capability flags and scope, prioritize review areas. High-risk surfaces get priority:

1. Unsafe code and FFI — always review first
2. Input parsing at trust boundaries
3. Authentication and authorization
4. Cryptography and secrets
5. Networking and protocol handling
6. Filesystem and process interaction
7. Concurrency, async, and shared state
8. Panic/unwrap paths reachable from untrusted input
9. Public API safety contracts
10. Build scripts and proc macros

Do NOT try to read every file equally. Use risk-based sampling: deep-dive the high-risk files, skim the rest.

### Phase 4: Review Execution

Review by cluster (see Review Clusters below). For each cluster:

1. Identify relevant files in scope using `rg` / `grep`
2. Read the high-risk files (not every match)
3. Trace data flow through trust boundaries
4. Validate assumptions with tools where available
5. Record findings in the standard finding format

Use local tools to validate, not guess:

| Goal | Command |
|---|---|
| Syntax/type errors | `cargo check 2>&1` |
| Lint warnings | `cargo clippy --all-targets 2>&1` |
| Formatting | `cargo fmt --check` |
| Tests | `cargo test 2>&1` |
| Dependency advisories | `cargo audit 2>&1` if installed |
| Unsafe counter | `rg -c 'unsafe\s*\{' --type rust` |
| Unwrap counter | `rg -c '\.unwrap\(' --type rust` |
| Miri (unsafe validation) | `cargo +nightly miri test 2>&1` if available |
| Semgrep (if rules exist) | `semgrep --config auto 2>&1` |

If a tool is not installed, note it as a limitation and continue with manual review. Do not install tools without user approval.

### Phase 5: Produce Report

See Output Format below for the report structure. Key rules:
- Every finding must reference specific code (file path, function, line when available)
- Separate confirmed issues from suspicious patterns
- Include fix guidance for each finding
- Note tools that were and were not run
- If doing a diff review, flag blocking issues first

## Review Clusters

The skill's reference prompt library provides 15 review clusters covering 69 bug classes. The prompts live in `prompts/clusters/` and `prompts/general/`. Use them as review guides — not as scripts to execute blindly. Read the relevant cluster prompt before reviewing that area, then apply the methodology with the actual code.

### Cluster Reference Table

| Cluster | Gate | Key Bug Classes | Prompt |
|---|---|---|---|
| Unsafe Boundary & Safety Contracts | always | unsafe APIs, transmute, raw pointers, repr(C), safety docs, debug-assert safety | `prompts/clusters/unsafe-boundary.md` |
| Memory Safety (unsafe) | has_unsafe | uninit reads, set_len, UAF, double-free, buffer overflow, union UB, panic-unwind | `prompts/clusters/memory-safety.md` |
| Concurrency: Locking | has_concurrency | double-lock, ABBA deadlock, condvar, channel starvation, once reentrancy | `prompts/clusters/concurrency-locking.md` |
| Concurrency: Data Races | has_concurrency | atomic races, unsafe Send/Sync, shared memory, static mut | `prompts/clusters/concurrency-data-race.md` |
| Panic & DoS | always | unwrap on untrusted, overflow, OOB index, str-slice boundary, refcell borrow, resource exhaustion | `prompts/clusters/panic-dos.md` |
| Recursion DoS | always | recursive deserialize, recursive format, recursive drop stack overflow | `prompts/clusters/recursion-dos.md` |
| Error Handling | always | discarded Result, drop panic, lossy conversions, unflushed buffers | `prompts/clusters/error-handling.md` |
| Logic Correctness | always | Ord/Eq/Hash consistency, float edge, string comparison, nondeterminism, collection key mutation | `prompts/clusters/logic-correctness.md` |
| FFI Cross-Language | has_ffi | CString dangling, ABI mismatch, repr(C) padding, opaque pointers, foreign drop, closure FFI, dyn trait FFI | `prompts/clusters/ffi-cross-language.md` |
| Layout Safety | has_packed_repr | packed field references | `prompts/clusters/layout-safety.md` |
| Async Runtime | has_async | async blocking, cancel safety, select bias | `prompts/clusters/async-runtime.md` |
| Static Hygiene | always | cargo lint config, MSRV mismatch, deprecated APIs | `prompts/clusters/static-hygiene.md` |
| Resource Handling | always | raw fd lifecycle, destructor skip | `prompts/clusters/resource-handling.md` |
| Input & OS Safety | has_fs_io | path traversal via join, TOCTOU | `prompts/clusters/input-os-safety.md` |
| Info Disclosure | always | pointer exposure via Debug/Display | `prompts/clusters/info-disclosure.md` |

In addition to the cluster prompts, the `prompts/general/` directory contains 48 individual bug-class finder prompts. These are useful for targeted bug-class hunts. Read the relevant finder prompt when the user asks for a specific bug class.

### Expanded Review Scope

The cluster prompts cover specific bug classes. A thorough review must also examine broader design-level concerns:

**Cryptography and Secrets:**
- Custom crypto, weak algorithms, weak RNG (non-CSPRNG)
- Key/nonce/IV reuse, missing constant-time comparison
- Secret material logged or leaked via Debug/Display
- TLS configuration, certificate verification, hostname validation
- Token generation and handling

**Auth and Trust Boundaries:**
- Auth bypass, missing role/permission checks
- Tenant/workspace isolation, confused deputy
- Privilege escalation paths, policy enforcement location
- Server-side vs client-side validation

**Filesystem and OS Interaction:**
- Symlink attacks, temp file races (TOCTOU, `/tmp` usage)
- Insecure permissions on created files
- Command injection via `Command::new` with untrusted args
- Environment variable trust, signal handling

**Networking and Protocol Handling:**
- SSRF risks, redirect handling, proxy trust
- DNS trust, timeout/retry behavior
- Protocol parser ambiguity, request smuggling assumptions
- Unbounded connection or body size

**API Design and Maintainability:**
- Type-state opportunities for misuse resistance
- Public API invariants and their enforcement
- Missing `#[must_use]` on fallible operations
- Trait bounds that leak implementation details
- Visibility (`pub` vs `pub(crate)`) audit
- Documentation of safety contracts on unsafe APIs

**Testing and Verification:**
- Unsafe invariant tests, Miri coverage
- Error-path testing, panic-path testing
- Concurrency test coverage (loom, shuttle)
- Fuzz targets (`cargo fuzz`), property tests (proptest)
- Regression tests for fixed bugs

**Performance and Resource Safety:**
- Unbounded allocation from untrusted input
- Unbounded recursion risk
- Memory leaks (Arc cycles, channel leaks, task leaks)
- File descriptor or connection leaks
- Blocking I/O in async contexts
- Clone-heavy hot paths

## Tool Usage Rules

**Always prefer fast, targeted commands.** Check repo size before running anything expensive:

```bash
# Quick size check
find . -name '*.rs' | wc -l
wc -l Cargo.lock 2>/dev/null
```

- For targeted review: `cargo check -p <crate>`, `cargo clippy -p <crate>`, `cargo test -p <crate>`
- Do not run `cargo build --workspace` on large repos without need
- Prefer `rg` with `--type rust` over reading every file
- Use `git grep` for version-controlled code searches
- For large results, pipe to `head` or `wc -l` first, then drill down

**When tools are unavailable:**
- Report it and continue with manual review
- Do not install tools without user approval
- Use `cargo metadata` for dependency info if `cargo audit`/`cargo deny` are missing

**Git-aware review:**
- For diff reviews: `git diff`, `git log --oneline`, `git diff --stat`
- Check what changed: `git diff HEAD~1` or `git diff <base>...<head>`
- Look at test changes alongside code changes

## Finding Format

Every finding must use this structure:

```markdown
### Finding: [Title]

- **Severity:** Critical | High | Medium | Low | Informational
- **Confidence:** High | Medium | Low
- **Category:** [e.g., Unsafe/Memory Safety, Concurrency, Error Handling, Input Validation, ...]
- **Affected code:**
  - **File:** `path/to/file.rs`
  - **Function/module:** `fn_name` or `module::path`
  - **Line(s):** L123-L145 (when available)
- **Evidence:** [Code snippet or description of the issue]
- **Why it matters:** [Security/correctness impact]
- **Exploitability / failure mode:** [How this could be triggered or exploited]
- **Recommended fix:** [Concrete suggestion]
- **Validation:** [How to verify the fix]
- **Regression test suggestion:** [What test to add]
```

### Severity Guidance

| Severity | Criteria |
|---|---|
| Critical | RCE, auth bypass, private key/credential exposure, reliable memory unsafety across trust boundary, severe data compromise |
| High | Likely exploitable bug, privilege escalation, serious DoS, unsound unsafe abstraction, sensitive data exposure |
| Medium | Security-relevant bug requiring specific conditions, significant correctness issue, missing auth check on limited path, dependency risk |
| Low | Hard-to-exploit, defense-in-depth gap, minor panic/DoS, weak validation with limited impact |
| Informational | Maintainability, clarity, test coverage, hardening suggestion |

### Evidence Rules

- Never report a vulnerability without code evidence
- If only suspicious, label it **Suspicious pattern / Needs validation** instead of a confirmed finding
- Do not inflate severity
- Do not claim memory safety issues in safe Rust unless unsafe, FFI, unsound logic, or dependency behavior supports it
- For unsafe code, analyze: what invariant is assumed, where it is established, whether callers can violate it, whether safety comments are complete
- For dependency issues, distinguish known advisories (RUSTSEC) from general supply-chain concern

## Unsafe Code Review Protocol

For every unsafe block, function, or trait impl, document:

1. **What invariant** the unsafe code assumes
2. **Where the invariant is established** — is it at the unsafe site, in a caller, or in a `// SAFETY:` comment?
3. **Whether callers can violate it** — is the unsafe API reachable from safe code? From external callers?
4. **Safety comment completeness** — does the `// SAFETY:` comment explain *why* each unsafe operation is sound?
5. **Enforcement mechanism** — are there tests, type system constraints, or runtime assertions?
6. **Failure mode** — what UB or unsoundness occurs if the invariant is violated?

A missing or incomplete `// SAFETY:` comment is at minimum a Medium finding. An unsafe API with no safety documentation is at minimum a High finding.

## Diff Review Mode

When reviewing a PR or diff:

1. Run `git diff --stat` and identify changed files
2. Identify security-sensitive changes (unsafe, FFI, parsing, auth, crypto, network, fs)
3. Review each changed file plus its callers and callees
4. Check that tests were updated with the change
5. Look for regression risk in adjacent code
6. Output blocking issues first, then recommendations

For diff review, include a section "Changed files and risk assessment" listing each changed file with its risk category.

## Large Task Delegation

For full audits of large repositories, delegate focused review areas to subagents using OpenCode's `task` tool:

| Subagent | Review scope |
|---|---|
| Unsafe reviewer | All unsafe blocks, functions, traits; FFI boundaries; safety doc completeness |
| Concurrency reviewer | Send/Sync, Mutex/RwLock, atomics, async runtime, cancel safety |
| Dependency reviewer | Cargo audit, supply chain, yanked crates, duplicate deps, build scripts |
| API design reviewer | Public API surface, invariants, visibility, trait design |
| Test reviewer | Test coverage, missing tests, fuzz targets, Miri coverage |

Each subagent should receive:
- The scope crate/module path
- The relevant cluster prompt(s) to guide review
- The finding format to use
- Instructions to return findings as structured text

The orchestrating agent deduplicates findings and produces the final report.

## Guardrails

- Do not rewrite code unless the user asked for fixes
- Do not run destructive commands (`rm`, `cargo clean`, `git reset --hard`, etc.)
- Do not install tools or modify project config without user permission
- Do not expose secrets found in files; redact them in findings
- Do not assume all Rust code is safe because it compiles
- Do not assume all unsafe code is wrong
- Do not focus on style over security/correctness
- Do not ignore tests, features, build scripts, or dependencies
- Do not invent command output; run the command or state that it was not run
- Do not copy Trail of Bits prompt text verbatim; adapt the methodology to the actual code

## Output Format

### Rust Review Report

#### Executive Summary

- **Review mode:** [Full Audit / Diff Review / Module Review / Unsafe Audit / Dependency Review / Fix Verification / Bug-Class Hunt]
- **Scope:** [What was reviewed]
- **Overall risk:** [Critical / High / Medium / Low]
- **Blocking issues:** [Count and summary]
- **High-priority recommendations:** [Top 3-5]

#### Repository Context

- **Workspace/crates:** [List]
- **Entry points:** [Binary entry, library root]
- **High-risk areas:** [Crates/modules]
- **Tools run:** [List]
- **Tools unavailable:** [List]

#### Review Plan

| Area | Reason | Files/Crates | Status |
|---|---|---|---|

#### Findings

Confirmed findings sorted by severity (Critical first).

#### Suspicious Patterns / Needs Validation

Patterns that need runtime tests, fuzzing, deeper context, or maintainer confirmation.

#### Dependency and Supply Chain Notes

`cargo audit`/`cargo deny` results or manual dependency review summary.

#### Unsafe Code Review

Summary of unsafe locations, invariants, and risk assessment.

#### Test and Verification Gaps

Missing tests, fuzz targets, property tests, regression tests, or Miri checks.

#### Recommended Next Steps

- **Immediate fixes:** [...]
- **Follow-up review:** [...]
- **Tests to add:** [...]
- **Tooling improvements:** [...]

#### Appendix: Commands

List commands run and key results.
