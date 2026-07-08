---
name: python-coding
description: "Production Python coding standards covering project structure, typing, error handling, async patterns, data validation, performance, naming, and testing. Apply these rules during all Python implementation."
compatibility: opencode
metadata:
  domain: python-engineering
  audience: senior-python-developer
  edition: "2026.07"
---

# Python Coding Standards

Production Python coding rules. Apply these rules during all implementation. Rules are organized by category; load only the categories relevant to the current task.

## Rule categories

| Prefix | Category | When to apply |
|---|---|---|
| `proj-*` | Project structure | Greenfield projects, refactoring package layout |
| `type-*` | Typing | All implementation — type annotations are mandatory |
| `err-*` | Error handling | Always — error handling is non-negotiable |
| `async-*` | Async/await | Async code, FastAPI endpoints, asyncio |
| `data-*` | Data validation | Pydantic models, dataclasses, schema enforcement |
| `perf-*` | Performance | Hot paths, large datasets, Polars pipelines |
| `name-*` | Naming conventions | All code |
| `func-*` | Function design | All function/method implementation |
| `class-*` | Class design | All class implementation |
| `api-*` | API patterns | FastAPI/Flask endpoints, library public API |
| `test-*` | Test patterns | Test code (also see python-testing skill) |
| `anti-*` | Anti-patterns | Always — catch these before review |

## Rule format

Each rule file follows this template:

```markdown
# {prefix}-{name}

> One-line principle

## Why
Brief rationale.

## Bad
```python
# anti-pattern
```

## Good
```python
# recommended pattern
```

## Exceptions
When this rule may be intentionally violated.
```

## See also

- `python-review` skill for review methodology
- `python-testing` skill for test infrastructure
