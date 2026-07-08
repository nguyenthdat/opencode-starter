# anti-comprehension-side-effects

> List/dict comprehensions should not have side effects. Use a `for` loop if the purpose is mutation, not value construction.

## Why
Comprehensions are for building new collections. Using them for side effects (printing, appending to another list, I/O) is misleading and builds a throwaway list.

## Bad
```python
[print(item) for item in items]  # Builds [None, None, None]
results = [other_list.append(process(x)) for x in items]  # Confusing
```

## Good
```python
for item in items:
    print(item)

results = []
for x in items:
    results.append(process(x))
```
