# anti-over-abstraction

> Don't abstract until you have at least three concrete use cases. Prefer duplication over wrong abstraction.

## Why
Premature abstraction creates rigid, hard-to-change interfaces based on assumptions that may not hold. Duplicate code is easier to refactor later than a wrong abstraction is to unwind.

## Bad
```python
def transform_data(data, operations):
    """Generic transformer for any sequence of operations on any data."""
    for op in operations:
        data = op(data)
    return data
# Only one caller — over-engineered
```

## Good
```python
def clean_and_normalize(data: pl.DataFrame) -> pl.DataFrame:
    return data.filter(...).with_columns(...)
# Simple, obvious, directly serves the one use case
```
