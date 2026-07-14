---
name: python-testing
description: "Pytest testing patterns: fixtures, parametrize, mocking, coverage, property-based testing with hypothesis, and test organization. Use for writing and maintaining tests."
compatibility: opencode
metadata:
  domain: python-engineering
  audience: senior-python-developer
---

# Python Testing Patterns

Production testing patterns with pytest, hypothesis, and coverage.

## Test organization

```
project/
├── src/
│   └── mypackage/
│       ├── __init__.py
│       ├── core.py
│       └── utils.py
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_core.py
    └── test_utils.py
```

- Tests mirror source structure: `src/mypackage/core.py` → `tests/test_core.py`.
- `conftest.py` at each level for shared fixtures.
- One test file per source module.

## Test naming

```
test_<function_name>_<scenario>_<expected_outcome>
```

Examples:
- `test_calculate_total_empty_list_returns_zero`
- `test_fetch_user_not_found_raises_user_not_found_error`
- `test_pipeline_null_values_fills_with_default`

## Fixtures

```python
# conftest.py
import pytest
import polars as pl

@pytest.fixture
def sample_df() -> pl.DataFrame:
    return pl.DataFrame({
        "id": [1, 2, 3],
        "amount": [100.0, 200.0, 300.0],
    })

@pytest.fixture
def temp_db():
    db = create_test_db()
    yield db
    db.close()

@pytest.fixture
def mock_client(mocker):
    return mocker.patch("mypackage.client.APIClient")
```

- Use `conftest.py` for fixtures shared across test files.
- Use `yield` for setup/teardown.
- Scope fixtures: `function` (default), `class`, `module`, `package`, `session`.
- Avoid fixture dependencies more than 2 levels deep.

## Parametrize

```python
import pytest

@pytest.mark.parametrize("input_val, expected", [
    (0, "zero"),
    (1, "one"),
    (-1, "negative"),
    (None, "unknown"),
])
def test_format_value_edge_cases(input_val, expected):
    assert format_value(input_val) == expected
```

- One `parametrize` per logical group of test cases.
- Include edge cases: zero, empty, None, max, min, negative.
- Use `pytest.param` with `marks` for expected failures.

## Mocking

```python
# Mock external I/O
def test_send_report(mocker):
    mock_post = mocker.patch("httpx.post")
    send_report(data={"key": "value"})
    mock_post.assert_called_once_with(
        "https://api.example.com/reports",
        json={"key": "value"},
        timeout=30,
    )

# Mock at module import boundary
def test_process_data(mocker):
    mocker.patch("mypackage.core.load_from_db", return_value=[1, 2, 3])
    result = process_data()
    assert result == 6
```

- Mock external I/O: HTTP, DB, filesystem, external APIs.
- Mock at the call site, not the definition site: `mocker.patch("mypackage.module.dependency")`.
- Never mock domain logic or the code under test.
- Use `mocker.spy()` to observe calls without changing behavior.

## Property-based testing (hypothesis)

```python
from hypothesis import given, strategies as st
from hypothesis.extra.polars import dataframes

@given(st.lists(st.integers()))
def test_sort_is_idempotent(lst):
    assert sorted(sorted(lst)) == sorted(lst)

@given(st.lists(st.floats(allow_nan=False), min_size=1))
def test_mean_in_range(values):
    mean = sum(values) / len(values)
    assert min(values) <= mean <= max(values)
```

- Use for pure functions with clear mathematical properties.
- Use `hypothesis.extra.polars` for Polars DataFrame strategies.
- Set `max_examples` higher for critical path functions.

## Coverage

```bash
uv run pytest --cov=mypackage --cov-report=term --cov-report=html
```

- Target: > 80% line coverage for new code.
- But prioritize meaningful tests over coverage metrics.
- Check branch coverage for complex conditionals.
- Use `# pragma: no cover` sparingly and with a comment justifying.

## Testing data pipelines

```python
def test_pipeline_transforms_correctly():
    input_df = pl.DataFrame({
        "id": [1, 2, 3],
        "amount": [100.0, None, 300.0],
        "category": ["a", "b", "a"],
    })
    result = pipeline(input_df.lazy()).collect()

    assert result.schema == EXPECTED_SCHEMA
    assert result["amount"].null_count() == 0  # nulls filled
    assert result["amount"].min() == 100.0

def test_pipeline_empty_input_handled():
    input_df = pl.DataFrame(schema=INPUT_SCHEMA)
    result = pipeline(input_df.lazy()).collect()
    assert len(result) == 0
    assert result.schema == EXPECTED_SCHEMA
```

## Testing FastAPI endpoints

```python
from fastapi.testclient import TestClient
from mypackage.serve import app

client = TestClient(app)

def test_predict_returns_valid_response():
    response = client.post("/predict", json={
        "features": [[1.0, 2.0, 3.0]],
    })
    assert response.status_code == 200
    data = response.json()
    assert "predictions" in data
    assert len(data["predictions"]) == 1

def test_predict_rejects_invalid_input():
    response = client.post("/predict", json={"features": "not_a_list"})
    assert response.status_code == 422

def test_health_returns_model_status():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
```

## Don't

- Don't test implementation details — test behavior.
- Don't mock the code under test.
- Don't write tests that depend on execution order.
- Don't use `time.sleep()` for async tests — use `asyncio.wait_for()` or `pytest-asyncio`.
- Don't commit test artifacts to VCS.
- Don't skip tests without a tracking issue reference.
