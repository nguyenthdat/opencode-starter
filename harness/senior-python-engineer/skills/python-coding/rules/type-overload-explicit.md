# type-overload-explicit

> Use `@overload` for functions whose return type depends on input argument types.

## Why
Without overloads, the return type must be a union, forcing callers to narrow manually. Overloads let the type checker infer the exact return type.

## Bad
```python
def get(key: str, default: int | None = None) -> str | int | None:
    ...
```

## Good
```python
from typing import overload

@overload
def get(key: str) -> str | None: ...
@overload
def get(key: str, default: str) -> str: ...
@overload
def get(key: str, default: None) -> str | None: ...

def get(key: str, default: str | None = None) -> str | None:
    ...
```
