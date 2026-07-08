# perf-lru-cache

> Use `functools.lru_cache` for expensive pure functions called repeatedly with the same arguments.

## Why
LRU caching avoids recomputing identical results, trading a small amount of memory for significant CPU savings on repeated calls.

## Bad
```python
def calculate_score(user_id: str) -> float:
    # Expensive database query
    ...
```

## Good
```python
from functools import lru_cache

@lru_cache(maxsize=1024)
def calculate_score(user_id: str) -> float:
    # Expensive database query — cached after first call
    ...
```
