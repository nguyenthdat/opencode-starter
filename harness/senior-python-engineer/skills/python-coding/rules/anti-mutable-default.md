# anti-mutable-default

> Never use mutable objects (`[]`, `{}`, `set()`) as default argument values.

## Why
Default arguments are evaluated once at function definition, not at each call. Mutating a mutable default changes it for all subsequent calls — a classic and hard-to-debug Python bug.

## Bad
```python
def add_item(item: str, items: list[str] = []) -> list[str]:
    items.append(item)
    return items

# >>> add_item("a")  # returns ["a"]
# >>> add_item("b")  # returns ["a", "b"] — BUG!
```

## Good
```python
def add_item(item: str, items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    items.append(item)
    return items
```
