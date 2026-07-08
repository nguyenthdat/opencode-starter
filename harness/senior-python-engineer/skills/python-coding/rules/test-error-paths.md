# test-error-paths

> Test error paths and edge cases — not just happy paths.

## Why
Untested error paths are where production bugs live. Every `raise` and `except` should have a corresponding test.

## Bad
```python
def test_create_user_success():
    user = create_user("Alice", "alice@example.com")
    assert user.name == "Alice"

# Missing: test_create_user_duplicate_email_raises_error
# Missing: test_create_user_empty_name_raises_error
```

## Good
```python
def test_create_user_duplicate_email_raises_conflict_error():
    create_user("Alice", "alice@example.com")
    with pytest.raises(ConflictError, match="email already exists"):
        create_user("Bob", "alice@example.com")

def test_create_user_empty_name_raises_validation_error():
    with pytest.raises(ValidationError, match="name must not be empty"):
        create_user("", "alice@example.com")
```
