# api-separate-service-layer

> Route handlers delegate to a service layer. Never put business logic directly in endpoint functions.

## Why
Business logic in route handlers can't be tested without HTTP, can't be reused across endpoints, and violates separation of concerns. The service layer is independently testable and reusable.

## Bad
```python
@router.post("/users")
async def create_user(req: CreateUserRequest):
    if db.query(User).filter(User.email == req.email).exists():
        raise HTTPException(409)
    user = User(name=req.name, email=req.email)
    db.add(user)
    db.commit()
    send_welcome_email(user)
    return UserResponse.from_orm(user)
```

## Good
```python
@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(req: CreateUserRequest) -> UserResponse:
    user = await user_service.create(req.name, req.email)
    return UserResponse.from_orm(user)
```
