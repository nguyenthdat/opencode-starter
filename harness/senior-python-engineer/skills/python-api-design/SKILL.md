---
name: python-api-design
description: "Python API design patterns: FastAPI routes, Pydantic models, error handling, versioning, pagination, async endpoints, and backward compatibility."
compatibility: opencode
metadata:
  domain: python-engineering
  audience: senior-python-developer
---

# Python API Design Patterns

Production patterns for internal Python APIs and external HTTP APIs (FastAPI).

## Internal Python API design

### Function signatures

```python
# Good — keyword-only for optional args, type hints on everything
def fetch_users(
    *,
    limit: int = 100,
    offset: int = 0,
    status: UserStatus = UserStatus.ACTIVE,
    sort_by: str = "created_at",
) -> list[User]:
    ...

# Bad — boolean trap, positional optional args
def fetch_users(limit=100, offset=0, active=True):
    ...
```

- Keyword-only arguments (`*`) for optional parameters.
- Avoid boolean parameters — use enums or keyword arguments.
- Return consistent types: don't return `User | None` from one method and raise `UserNotFoundError` from another.
- Document all raised exceptions in docstring `Raises:` section.

### Protocol/ABC contracts

```python
from typing import Protocol

class UserRepository(Protocol):
    def get_by_id(self, user_id: str) -> User: ...
    def save(self, user: User) -> None: ...
    def list_active(self, *, limit: int = 100) -> list[User]: ...

# Or with ABC for shared implementation
from abc import ABC, abstractmethod

class BaseRepository(ABC):
    @abstractmethod
    def get_by_id(self, entity_id: str) -> Any: ...

    @abstractmethod
    def save(self, entity: Any) -> None: ...
```

- Use `Protocol` for structural subtyping (interface contracts).
- Use `ABC` when you need shared implementation or `@abstractmethod` enforcement.
- Keep interfaces small (2-5 methods); split large interfaces.

### Module public API

- Define `__all__` in `__init__.py` for explicit public surface.
- Re-export key types from package `__init__.py` for convenience.
- Use `from mypackage import User` not `from mypackage.models.user import User`.

## FastAPI HTTP API design

### Route structure

```python
# Good — typed, documented, with error responses
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/v1/users", tags=["users"])

class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    created_at: str

class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None

@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"model": ErrorResponse, "description": "User already exists"},
        422: {"model": ErrorResponse, "description": "Validation error"},
    },
)
async def create_user(req: CreateUserRequest) -> UserResponse:
    ...
```

- One router per resource, mounted in `app.include_router(router)`.
- Version in URL path: `/v1/users`, `/v2/users`.
- Use `response_model` on every endpoint.
- Document error responses explicitly in `responses` dict.
- Tag routers for OpenAPI grouping.

### Pagination

```python
from pydantic import BaseModel

class PaginationParams:
    def __init__(self, limit: int = 100, offset: int = 0):
        self.limit = min(limit, 1000)
        self.offset = max(offset, 0)

class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    limit: int
    offset: int

@router.get("/", response_model=PaginatedResponse)
async def list_users(
    limit: int = 100,
    offset: int = 0,
) -> PaginatedResponse:
    ...
```

- Consistent pagination across all list endpoints.
- `limit` with a reasonable maximum (100-1000).
- Return `total` count for UI pagination controls.
- Consider cursor-based pagination for real-time or frequently-updated data.

### Error handling

```python
class AppError(Exception):
    """Base application error."""
    status_code: int = 500
    message: str = "Internal server error"

class NotFoundError(AppError):
    status_code = 404
    message = "Resource not found"

class ConflictError(AppError):
    status_code = 409
    message = "Resource conflict"

# Global exception handler
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message, "detail": str(exc)},
    )
```

- Custom exception hierarchy with HTTP status codes.
- Global exception handler catches application errors.
- Never expose stack traces in production responses.

### Async best practices

```python
# Good — async with concurrent I/O
@router.get("/enriched/{user_id}")
async def get_enriched_user(user_id: str) -> EnrichedUserResponse:
    user, orders, preferences = await asyncio.gather(
        user_repo.get_by_id(user_id),
        order_service.get_for_user(user_id),
        pref_service.get_preferences(user_id),
    )
    return EnrichedUserResponse(...)

# Bad — sequential awaits
@router.get("/enriched/{user_id}")
async def get_enriched_user(user_id: str):
    user = await user_repo.get_by_id(user_id)
    orders = await order_service.get_for_user(user_id)
    preferences = await pref_service.get_preferences(user_id)
    ...
```

- Use `asyncio.gather()` for independent I/O.
- Avoid CPU-bound work in async endpoints.
- Set timeouts on external calls.

## Naming conventions

| Context | Convention | Example |
|---|---|---|
| REST endpoints | Plural nouns, kebab-case params | `/v1/users`, `/v1/user-orders` |
| Pydantic models | PascalCase with Request/Response suffix | `CreateUserRequest`, `UserResponse` |
| Router tags | Lowercase plural | `tags=["users"]` |
| Query parameters | snake_case | `?sort_by=name&page_size=50` |
| Headers | kebab-case | `X-Request-ID`, `X-API-Version` |

## Backward compatibility

- Additive changes only in minor versions: new fields, new endpoints.
- Deprecate before removing: warn for at least one major version.
- Use `DeprecationWarning` for internal APIs; custom `Sunset` header for HTTP APIs.
- Never change field types or semantics in-place.

## Don't

- Don't use `response_model` with `Any` — always define explicit schemas.
- Don't catch `Exception` in endpoint handlers — use specific exception types.
- Don't mix sync and async route handlers in the same router without good reason.
- Don't embed business logic in route handlers — delegate to service layer.
- Don't return raw ORM objects — always map to response models.
- Don't use GET for state-changing operations.
