# type-newtype-ids

> Use `NewType` for semantic identifier types (user IDs, order IDs) to prevent accidental mixing.

## Why
`user_id: str` and `order_id: str` are both strings — the type checker won't catch passing a UserId where an OrderId is expected. `NewType` adds zero-cost type safety.

## Bad
```python
def get_order(user_id: str, order_id: str) -> Order:
    ...

get_order(order_id, user_id)  # Swapped args — no type error!
```

## Good
```python
from typing import NewType

UserId = NewType("UserId", str)
OrderId = NewType("OrderId", str)

def get_order(user_id: UserId, order_id: OrderId) -> Order:
    ...

get_order(order_id, user_id)  # Type error!
```
