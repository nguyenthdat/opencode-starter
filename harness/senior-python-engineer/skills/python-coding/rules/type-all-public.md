# type-all-public

> All public functions, methods, and class attributes must have complete type annotations.

## Why
Type annotations are documentation, enable IDE autocompletion, catch bugs at static analysis time, and make code self-documenting for new contributors.

## Bad
```python
def process(data, config=None):
    result = do_work(data, config)
    return result
```

## Good
```python
def process(
    data: pl.DataFrame,
    config: ProcessingConfig | None = None,
) -> ProcessingResult:
    result = do_work(data, config)
    return result
```
