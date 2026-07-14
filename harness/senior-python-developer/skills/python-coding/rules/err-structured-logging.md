# err-structured-logging

> Log errors with structured context, not string interpolation. Use `structlog` or `logging` with JSON format.

## Why
Structured logging enables log aggregation, searching, and alerting. String-interpolated log messages lose the structure and cannot be queried by field.

## Bad
```python
logger.error(f"Failed to process user {user_id}: {error}")
```

## Good
```python
logger.error("user_processing_failed", user_id=user_id, error=str(e), step="validation")
```
