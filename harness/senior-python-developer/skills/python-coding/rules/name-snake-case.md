# name-snake-case

> Use `snake_case` for functions, methods, variables, and module names.

## Why
PEP 8 mandates `snake_case`. Consistency reduces cognitive load and makes code predictable.

## Bad
```python
def CalculateTotal(orderList):
    itemCount = len(orderList)
    ...
```

## Good
```python
def calculate_total(order_list: list[Order]) -> float:
    item_count = len(order_list)
    ...
```
