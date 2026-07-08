# class-protocol-over-inheritance

> Prefer `Protocol` for interface contracts; use inheritance only for shared implementation.

## Why
Inheritance couples classes tightly and makes testing harder. Protocol enables structural subtyping — any class with matching methods satisfies the interface without explicit inheritance.

## Bad
```python
class Repository(ABC):
    @abstractmethod
    def save(self, entity: Any) -> None: ...

class PostgresRepository(Repository):
    def save(self, entity: Any) -> None: ...

class InMemoryRepository(Repository):
    def save(self, entity: Any) -> None: ...
```

## Good
```python
from typing import Protocol

class Repository(Protocol):
    def save(self, entity: Any) -> None: ...

class PostgresRepository:
    def save(self, entity: Any) -> None: ...

class InMemoryRepository:
    def save(self, entity: Any) -> None: ...

def persist(repo: Repository, entity: Any) -> None:
    repo.save(entity)  # Works with any class that has save()
```
