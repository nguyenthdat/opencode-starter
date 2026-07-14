# api-consistent-error-schema

> All endpoints must return errors in a consistent JSON schema: `{"error": "<code>", "detail": "<human message>"}`.

## Why
Inconsistent error formats force API consumers to write custom parsing per endpoint. A consistent schema enables generic error handling on the client side.

## Bad
```python
# Endpoint A
raise HTTPException(404, detail="User not found")

# Endpoint B
return {"message": "Order not found", "code": 404}  # Inconsistent
```

## Good
```python
class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None

@router.get("/users/{user_id}", responses={404: {"model": ErrorResponse}})
async def get_user(user_id: str) -> UserResponse:
    raise HTTPException(404, detail="User not found")
```
