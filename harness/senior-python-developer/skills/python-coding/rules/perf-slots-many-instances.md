# perf-slots-many-instances

> Use `__slots__` for classes with thousands or more instances.

## Why
By default, Python classes store attributes in a `__dict__`, which adds ~64-128 bytes per instance for the dict overhead. `__slots__` stores attributes in a fixed C array, reducing memory by 40-60% for classes with many instances.

## Bad
```python
class DataPoint:
    def __init__(self, x: float, y: float, label: str):
        self.x = x
        self.y = y
        self.label = label
```

## Good
```python
class DataPoint:
    __slots__ = ("x", "y", "label")

    def __init__(self, x: float, y: float, label: str):
        self.x = x
        self.y = y
        self.label = label
```

## Exceptions
- Don't use `__slots__` if you need `__dict__` for dynamic attribute assignment.
- Don't use `__slots__` for classes with few instances — the memory savings aren't worth the constraint.
- Must re-declare `__slots__` in subclasses.
