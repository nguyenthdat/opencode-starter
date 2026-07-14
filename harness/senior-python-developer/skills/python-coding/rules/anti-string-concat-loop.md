# anti-string-concat-loop

> Never concatenate strings in a loop with `+=`. Use `"".join()`.

## Why
Strings are immutable. Each `+=` creates a new string, copying the entire accumulated content. This is O(n^2) time and memory. `"".join()` is O(n).

## Bad
```python
result = ""
for item in items:
    result += str(item) + ","
```

## Good
```python
result = ",".join(str(item) for item in items)
```
