---
name: python-review
description: "Code review methodology for Python: correctness, typing, error handling, anti-pattern detection, security, and maintainability. Use when reviewing any Python code."
compatibility: opencode
metadata:
  domain: python-engineering
  audience: senior-python-developer
---

# Python Review Methodology

Systematic code review checklist for production Python. Use this methodology when reviewing any Python code change.

## Review dimensions

Run each dimension in order. Stop at BLOCKER findings in each dimension before proceeding.

### 1. Correctness (BLOCKER)
- Does the code do what it claims to do?
- Are edge cases handled? (empty inputs, None, empty collections, negative numbers, overflow)
- Are conditional branches all reachable and correct?
- Is the logic obviously wrong in any path?

### 2. Typing (BLOCKER)
- Are all public functions and methods fully type-annotated?
- Are type ignores (`# type: ignore`) justified and minimal?
- Are `Any` usages justified or should they be generic/Protocol?
- Do overload signatures resolve correctly?
- Run `pyright` or `mypy` and check output.

### 3. Error handling (BLOCKER)
- No bare `except:` or `except Exception:`.
- Exceptions are specific and inherit from a project base exception.
- Resources are cleaned up (context managers, `finally`).
- Errors are logged with context, not swallowed silently.
- Exception messages are lowercase, no trailing punctuation.

### 4. Anti-patterns (WARNING)
- Mutable default arguments: `def f(x=[])`.
- Late-binding closures with loop variables.
- `is` used for value comparison instead of `==`.
- Class-level mutable attributes shared across instances.
- `map`/`filter` where comprehension is clearer.

### 5. Performance (WARNING)
- N+1 queries in loops.
- Eager materialization of large datasets where lazy is possible.
- `apply`/`map_elements` on hot paths in Polars.
- Unnecessary copies of large data structures.
- Busy loops without `asyncio.sleep(0)` yields.

### 6. Security (BLOCKER on HIGH, WARNING on MEDIUM)
- SQL injection via string formatting.
- Command injection via `os.system`/`subprocess` with user input.
- Path traversal via unsanitized file paths.
- Hardcoded secrets or API keys.
- Unsafe `pickle` deserialization of untrusted data.
- Unvalidated redirect URLs.

### 7. Maintainability (SUGGESTION)
- Functions over 50 lines without strong justification.
- Deep nesting (>3 levels).
- Magic numbers without named constants.
- Duplicated logic across modules.
- Missing or misleading docstrings.

## Severity definitions

| Severity | Meaning | Action |
|---|---|---|
| BLOCKER | Must fix before merge | Return to implementer |
| WARNING | Should fix; exceptions must be justified | Document if not fixed |
| SUGGESTION | Nice to have; implementer discretion | Optional |

## Output format

Each finding:
```markdown
### [SEVERITY] <short title>

- **File:** `path/to/file.py:42`
- **Issue:** <description>
- **Fix:** <recommended change>
- **Rationale:** <why this matters>
```

Group by file, then by severity (BLOCKER first).
