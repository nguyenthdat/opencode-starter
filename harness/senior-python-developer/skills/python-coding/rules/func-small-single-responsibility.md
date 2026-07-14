# func-small-single-responsibility

> Keep functions under 50 lines. Each function should do one thing.

## Why
Long functions are hard to understand, test, and reuse. A function that does multiple things can't be tested or reused independently.

## Bad
```python
def process_and_save_and_notify(data: dict) -> None:
    # 80 lines of validation, transformation, DB save, email notification
    ...
```

## Good
```python
def process_and_save_and_notify(data: dict) -> None:
    validated = validate(data)
    transformed = transform(validated)
    save_to_db(transformed)
    send_notification(transformed)
```
