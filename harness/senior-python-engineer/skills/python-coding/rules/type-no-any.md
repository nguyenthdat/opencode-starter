# type-no-any

> Avoid `Any` in production code. Use `Protocol`, `Generic`, `TypeVar`, or explicit union types instead.

## Why
`Any` disables type checking for that value, hiding bugs that static analysis would catch. Every `Any` is a missed opportunity for type safety.

## Bad
```python
def process(payload: Any) -> Any:
    return payload["result"]
```

## Good
```python
from typing import Protocol

class HasResult(Protocol):
    result: dict[str, str]

def process(payload: HasResult) -> dict[str, str]:
    return payload.result
```
```python
# Or with explicit types
def process(payload: dict[str, object]) -> dict[str, str]:
    result = payload.get("result", {})
    if not isinstance(result, dict):
        raise TypeError(f"Expected dict, got {type(result)}")
    return {str(k): str(v) for k, v in result.items()}
```

## Exceptions
- Acceptable at system boundaries (JSON deserialization) with a validation step that narrows to a concrete type.
- Acceptable in generic decorators that truly accept any callable.
