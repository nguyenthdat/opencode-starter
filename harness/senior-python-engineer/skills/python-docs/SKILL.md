---
name: python-docs
description: "Python documentation standards: Google-style docstrings, module docs, README, API reference generation, and documentation maintenance. Use when writing or reviewing docs."
compatibility: opencode
metadata:
  domain: python-engineering
  audience: senior-python-developer
---

# Python Documentation Standards

Production documentation patterns for Python projects.

## Docstring format (Google style)

```python
def train_model(
    train_data: pl.DataFrame,
    *,
    learning_rate: float = 0.001,
    epochs: int = 10,
    early_stopping_patience: int = 3,
    validation_data: pl.DataFrame | None = None,
) -> TrainingResult:
    """Train a classification model with early stopping.

    Uses cross-entropy loss with AdamW optimizer. Early stopping
    monitors validation loss and restores the best checkpoint.

    Args:
        train_data: Training dataset with features and target column.
        learning_rate: Initial learning rate for AdamW optimizer.
        epochs: Maximum number of training epochs.
        early_stopping_patience: Number of epochs without improvement
            before stopping early.
        validation_data: Optional validation dataset. If None, 20%
            of training data is used for validation.

    Returns:
        TrainingResult with trained model, metrics history, and best epoch.

    Raises:
        ValueError: If train_data has fewer than 10 samples.
        DataValidationError: If required columns are missing.

    Example:
        >>> result = train_model(df, learning_rate=0.01, epochs=5)
        >>> print(result.best_val_loss)
        0.234
    """
    ...
```

### Module docstrings

```python
"""Customer churn prediction pipeline.

This module provides end-to-end churn prediction:
1. Data preprocessing — `preprocess()`
2. Feature engineering — `FeaturePipeline`
3. Model training — `train_model()`
4. Evaluation — `evaluate_model()`

Typical usage:
    >>> from churn import preprocess, FeaturePipeline, train_model
    >>> df = preprocess(pl.read_csv("data.csv"))
    >>> features = FeaturePipeline().fit_transform(df)
    >>> result = train_model(features)
"""
```

### Class docstrings

```python
class FeaturePipeline:
    """Feature engineering pipeline for churn prediction.

    Applies standard scaling to numeric features and one-hot encoding
    to categorical features. The pipeline must be fit on training data
    before transforming.

    Attributes:
        scaler: Fitted StandardScaler for numeric features.
        categorical_cols: List of categorical column names.
        numeric_cols: List of numeric column names.
        fitted: Whether the pipeline has been fitted.

    Example:
        >>> pipeline = FeaturePipeline()
        >>> pipeline.fit(train_df)
        >>> transformed = pipeline.transform(test_df)
    """
```

## README structure

```markdown
# Project Name

One-line description of what this project does.

## Quickstart

```bash
uv sync
uv run mycli --help
```

## Key features

- Feature 1
- Feature 2

## Documentation

Full documentation at [link].

## Development

```bash
uv sync
uv run pytest
uv run ruff check .
uv run pyright .
```
```

- Must include: project purpose, quickstart with `uv`, key features, development setup.
- Keep README concise; detailed docs in separate documentation.

## API reference

- Auto-generate from docstrings (mkdocstrings + mkdocs, Sphinx + autodoc, or pdoc).
- All public functions must have docstrings for auto-generation to work.
- Include cross-references between related functions and classes.

## Documentation checklist

- [ ] Every public module has a module docstring explaining purpose and key exports.
- [ ] Every public class has Args/Attributes/Example in docstring.
- [ ] Every public function has Args/Returns/Raises in docstring.
- [ ] README has quickstart and development sections.
- [ ] Examples in docstrings are runnable.
- [ ] No stale or placeholder documentation (`TODO: document this`).
- [ ] Cross-references use correct markdown/docstring syntax.

## Don't

- Don't document obvious parameters (e.g., `self`, `cls`).
- Don't repeat the function signature in plain English.
- Don't leave placeholder docstrings (`"""TODO"""`) — either write proper docs or omit.
- Don't use Sphinx-specific `:param:` syntax in Google-style docstrings.
- Don't write docstrings that just restate the function name.
- Don't forget to update docs when changing function signatures.
