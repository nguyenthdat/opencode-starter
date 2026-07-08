# anti-bare-except-pass

> Never silently swallow exceptions with `except: pass` or `except Exception: pass`.

## Why
Silently swallowing exceptions hides bugs and makes debugging nearly impossible. At minimum, log the error. If the error is truly ignorable, catch only that specific exception type.

## Bad
```python
try:
    process_data()
except:
    pass  # What happened? We'll never know.
```

## Good
```python
try:
    process_data()
except TemporaryFileError:
    pass  # Specific, documented reason: temp files may be cleaned by OS
except DataValidationError as e:
    logger.warning("skipping_invalid_record", error=str(e))
```
