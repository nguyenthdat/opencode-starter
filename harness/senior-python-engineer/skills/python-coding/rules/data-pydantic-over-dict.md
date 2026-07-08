# data-pydantic-over-dict

> Use Pydantic models for structured data; avoid `dict[str, Any]` for data flowing through the application.

## Why
`dict[str, Any]` provides no validation, no documentation, no IDE support, and silently propagates typos. Pydantic models validate at boundaries and carry type information throughout the codebase.

## Bad
```python
def create_user(data: dict[str, Any]) -> dict[str, Any]:
    name = data["name"]
    ...
```

## Good
```python
from pydantic import BaseModel, Field, EmailStr

class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr

class UserResponse(BaseModel):
    id: str
    name: str
    email: str

def create_user(req: CreateUserRequest) -> UserResponse:
    ...
```
