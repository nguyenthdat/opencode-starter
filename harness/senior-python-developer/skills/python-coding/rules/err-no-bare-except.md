# err-no-bare-except

> Never use bare `except:` or overly broad `except Exception:`. Catch specific exception types.

## Why
Bare `except:` catches `KeyboardInterrupt`, `SystemExit`, and `GeneratorExit` — preventing graceful shutdown. Overly broad `except Exception:` masks unexpected bugs and makes debugging difficult.

## Bad
```python
try:
    process_data()
except:
    logger.error("Processing failed")
```

## Good
```python
try:
    process_data()
except DataValidationError as e:
    logger.warning("invalid_data", error=str(e))
    raise
except IOError as e:
    logger.error("io_failure", error=str(e))
    raise DataPipelineError("IO error in processing", step="process") from e
```
