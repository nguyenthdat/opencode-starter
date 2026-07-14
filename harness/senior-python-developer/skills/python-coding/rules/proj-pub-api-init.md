# proj-pub-api-init

> Define `__all__` in `__init__.py` and re-export the public API surface.

## Why
Explicit `__all__` makes the public API discoverable, prevents accidental exports of internal implementation details, and guides consumers to the intended usage.

## Bad
```python
# mypackage/__init__.py — empty or wildcard imports
from .core import *
from .utils import *
```

## Good
```python
# mypackage/__init__.py
from .core import Pipeline, Config, run_pipeline
from .models import User, Order

__all__ = [
    "Pipeline",
    "Config",
    "run_pipeline",
    "User",
    "Order",
]
```
