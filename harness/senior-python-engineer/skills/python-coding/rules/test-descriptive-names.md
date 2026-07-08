# test-descriptive-names

> Test function names must describe the scenario and expected outcome: `test_<what>_<condition>_<expected>`.

## Why
Descriptive test names serve as documentation. When a test fails, the name immediately tells you what broke and under what conditions.

## Bad
```python
def test_pipeline():
    ...

def test_error():
    ...
```

## Good
```python
def test_pipeline_empty_input_returns_empty_dataframe():
    ...

def test_pipeline_null_values_fills_fill_null_defaults():
    ...

def test_pipeline_missing_column_raises_schema_validation_error():
    ...
```
