# api-typed-responses

> FastAPI endpoints must declare `response_model` — never return raw dicts or ORM objects.

## Why
Without `response_model`, FastAPI can't generate OpenAPI docs, validate response types, or filter fields. Returning ORM objects leaks internal schema.

## Bad
```python
@router.get("/users/{user_id}")
async def get_user(user_id: str) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    return {"id": user.id, "name": user.name}
```

## Good
```python
@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str) -> UserResponse:
    user = user_service.get(user_id)
    return UserResponse(id=user.id, name=user.name)
```
