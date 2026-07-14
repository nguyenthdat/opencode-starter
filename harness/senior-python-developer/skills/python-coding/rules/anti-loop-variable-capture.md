# anti-loop-variable-capture

> Avoid late-binding closures that capture loop variables. Use default argument binding or `functools.partial`.

## Why
Loop variables are captured by reference, not by value. All closures created in a loop see the final value of the loop variable — not the value at iteration time.

## Bad
```python
handlers = []
for name in ["alice", "bob", "charlie"]:
    handlers.append(lambda: print(f"Hello, {name}"))

# All print "Hello, charlie" — BUG!
```

## Good
```python
handlers = []
for name in ["alice", "bob", "charlie"]:
    handlers.append(lambda name=name: print(f"Hello, {name}"))

# Each prints the correct name
```
