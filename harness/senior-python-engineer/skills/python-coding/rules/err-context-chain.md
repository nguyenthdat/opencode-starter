# err-context-chain

> Use `raise ... from ...` to preserve exception chains. Use `raise ... from None` only when intentionally hiding context.

## Why
Exception chaining preserves the full error trace, making debugging possible. `from None` should be used sparingly — only when the inner exception is an implementation detail that would confuse callers.

## Bad
```python
try:
    response = httpx.get(url)
except httpx.HTTPError:
    raise DataFetchError("Failed to fetch data")  # Lost original error
```

## Good
```python
try:
    response = httpx.get(url)
except httpx.HTTPError as e:
    raise DataFetchError("Failed to fetch data") from e
```

## Exceptions
Use `from None` when the inner exception is an implementation detail that callers should not depend on (e.g., catching a library-specific error and raising a project error in a public API).
