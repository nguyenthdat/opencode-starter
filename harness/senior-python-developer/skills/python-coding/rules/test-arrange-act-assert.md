# test-arrange-act-assert

> Structure tests with Arrange-Act-Assert (AAA) pattern. Separate setup, execution, and verification with blank lines.

## Why
AAA makes test intent immediately clear. Without structure, the reader must parse the entire test to understand what's being tested and what's setup.

## Bad
```python
def test_create_user():
    user = create_user("Alice", "alice@example.com")
    assert user.name == "Alice"
    db = setup_test_db()
    save_user(db, user)
    assert fetch_user(db, user.id).email == "alice@example.com"
```

## Good
```python
def test_create_user_saves_to_database():
    db = setup_test_db()
    repo = UserRepository(db)

    user = User(name="Alice", email="alice@example.com")
    repo.save(user)

    retrieved = repo.get_by_id(user.id)
    assert retrieved.name == "Alice"
    assert retrieved.email == "alice@example.com"
```
