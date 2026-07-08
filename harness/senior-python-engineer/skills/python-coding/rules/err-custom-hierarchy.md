# err-custom-hierarchy

> Define a custom exception hierarchy rooted in a project-specific base exception.

## Why
A custom hierarchy allows callers to catch project errors specifically, enables consistent error metadata (status codes, error codes), and separates application errors from Python built-in exceptions.

## Bad
```python
raise ValueError("Invalid user data")
raise RuntimeError("Database connection failed")
```

## Good
```python
class AppError(Exception):
    """Base exception for all application errors."""

class ValidationError(AppError):
    """Input validation failed."""

class NotFoundError(AppError):
    """Resource not found."""

class DataPipelineError(AppError):
    """Data pipeline processing error."""
    def __init__(self, message: str, *, step: str, details: dict | None = None):
        super().__init__(message)
        self.step = step
        self.details = details or {}
```
