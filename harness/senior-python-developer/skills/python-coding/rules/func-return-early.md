# func-return-early

> Return early from functions instead of deep nesting with `if`/`else` ladders.

## Why
Early returns reduce nesting depth, make the happy path linear, and make error/edge case handling explicit at the top.

## Bad
```python
def process(data):
    if data is not None:
        if data.is_valid():
            if data.has_items():
                return compute(data)
            else:
                return []
        else:
            raise ValueError("Invalid")
    else:
        raise ValueError("None")
```

## Good
```python
def process(data):
    if data is None:
        raise ValueError("Data is None")
    if not data.is_valid():
        raise ValueError("Invalid data")
    if not data.has_items():
        return []
    return compute(data)
```
