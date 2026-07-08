# anti-is-value-comparison

> Use `==` for value comparison, not `is`. `is` checks identity, not equality.

## Why
`is` compares object identity (memory address), not value. Small integers and short strings are interned by CPython, making `is` appear to work in simple cases but fail unpredictably in real code.

## Bad
```python
if user.status is "active":  # Works by accident, fails for long strings
    ...

if count is 1000:  # Works by accident for small ints, fails for >256
    ...
```

## Good
```python
if user.status == "active":
    ...

if count == 1000:
    ...
```

`is` should only be used for: `is None`, `is True`, `is False`, and singleton comparisons.
