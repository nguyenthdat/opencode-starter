# data-dataclass-config

> Use frozen dataclasses for immutable configuration objects.

## Why
Mutable config objects can be accidentally modified mid-execution, causing hard-to-debug behavior. Frozen dataclasses prevent mutation and work well with type checkers.

## Bad
```python
config = {
    "learning_rate": 0.001,
    "epochs": 10,
}
config["epochs"] = 5  # Silent mutation
```

## Good
```python
from dataclasses import dataclass

@dataclass(frozen=True)
class TrainConfig:
    learning_rate: float = 0.001
    batch_size: int = 64
    epochs: int = 10
    early_stopping_patience: int = 3

config = TrainConfig(epochs=5)  # Immutable
```
