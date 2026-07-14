# async-gather-concurrent

> Run independent async tasks with `asyncio.gather()`, not sequential `await`.

## Why
Sequential `await` for independent I/O operations serializes them, wasting time. `asyncio.gather()` runs them concurrently.

## Bad
```python
user = await fetch_user(user_id)
orders = await fetch_orders(user_id)
prefs = await fetch_preferences(user_id)
```

## Good
```python
user, orders, prefs = await asyncio.gather(
    fetch_user(user_id),
    fetch_orders(user_id),
    fetch_preferences(user_id),
)
```
