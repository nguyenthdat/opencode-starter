# name-is-has-bool

> Prefix boolean functions and properties with `is_`, `has_`, `can_`, or `should_`.

## Why
Boolean names should answer a yes/no question. The prefix makes the boolean nature immediately obvious at the call site.

## Bad
```python
if user.active:  # Is this a bool or an object?
    ...

if pipeline.valid():
    ...
```

## Good
```python
if user.is_active:
    ...

if pipeline.is_valid():
    ...
```
