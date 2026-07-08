# class-dataclass-over-manual

> Use `@dataclass` instead of manually writing `__init__`, `__repr__`, and `__eq__`.

## Why
Manually written boilerplate is error-prone (forgetting to update `__eq__` when adding a field). Dataclasses generate all boilerplate correctly and make intent explicit.

## Bad
```python
class User:
    def __init__(self, name: str, email: str, age: int):
        self.name = name
        self.email = email
        self.age = age

    def __repr__(self):
        return f"User(name={self.name!r}, email={self.email!r})"

    def __eq__(self, other):
        if not isinstance(other, User):
            return NotImplemented
        return self.name == other.name and self.email == other.email
```

## Good
```python
from dataclasses import dataclass

@dataclass(frozen=True)
class User:
    name: str
    email: str
    age: int
```
