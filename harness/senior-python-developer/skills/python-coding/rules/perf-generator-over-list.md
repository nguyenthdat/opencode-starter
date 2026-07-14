# perf-generator-over-list

> Use generators (`yield`) instead of building large lists in memory.

## Why
Building a list requires holding all items in memory simultaneously. Generators produce items one at a time, enabling constant-memory processing.

## Bad
```python
def get_all_records(db) -> list[dict]:
    results = []
    cursor = db.execute("SELECT * FROM large_table")
    for row in cursor:
        results.append(dict(row))
    return results  # All in memory
```

## Good
```python
def iter_records(db) -> Generator[dict, None, None]:
    cursor = db.execute("SELECT * FROM large_table")
    for row in cursor:
        yield dict(row)
```
