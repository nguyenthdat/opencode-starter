# func-kw-only-optional

> Use keyword-only arguments for optional parameters: `def func(*, optional_arg=default)`.

## Why
Keyword-only arguments prevent callers from passing values positionally in the wrong order, and make adding new optional parameters backward-compatible.

## Bad
```python
def fetch_users(limit=100, offset=0, status="active"):
    ...

fetch_users(50, 10, "inactive")  # Unclear which is which
```

## Good
```python
def fetch_users(*, limit: int = 100, offset: int = 0, status: str = "active") -> list[User]:
    ...

fetch_users(limit=50, offset=10, status="inactive")
```
