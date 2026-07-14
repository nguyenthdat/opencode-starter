# test-mock-boundary

> Mock at module import boundaries, not at the definition site. Use `mocker.patch("mypackage.module.dependency")`.

## Why
Mocking at the definition site bypasses the import system and doesn't actually intercept the call. Mocking at the import boundary where the dependency is used ensures the mock is effective.

## Bad
```python
# test_core.py
def test_process(mocker):
    mock_send = mocker.patch("external_lib.send")  # Definition site
    process()
    mock_send.assert_called_once()  # May not work
```

## Good
```python
# test_core.py
def test_process(mocker):
    mock_send = mocker.patch("mypackage.core.send")  # Import boundary
    process()
    mock_send.assert_called_once()  # Works reliably
```
