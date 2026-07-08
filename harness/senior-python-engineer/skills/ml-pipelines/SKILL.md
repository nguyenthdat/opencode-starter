---
name: ml-pipelines
description: "ML training pipeline patterns: experiment tracking, reproducible training, feature engineering, evaluation, model serialization. Use for ML model development."
compatibility: opencode
metadata:
  domain: machine-learning
  audience: senior-python-developer
---

# ML Training Pipeline Patterns

Production patterns for ML model training, evaluation, and experiment tracking.

## Reproducibility

```python
import random
import numpy as np
import torch

def set_seed(seed: int = 42) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
```

- Set seeds for `random`, `numpy`, `torch`, and `tf` at the top of every training script.
- Log the seed as an experiment parameter.
- For non-deterministic GPU ops, document expected variance.

## Experiment tracking

- Use MLflow (preferred) or Weights & Biases.
- Track at minimum: hyperparameters, metrics, dataset hash, code version (git commit).
- Auto-log with framework-specific integrations: `mlflow.pytorch.autolog()`.
- Use nested runs for hyperparameter sweeps.
- Tag runs: `mlflow.set_tag("data_version", data_hash)`.

```python
import mlflow

mlflow.set_experiment("customer-churn")
with mlflow.start_run() as run:
    mlflow.log_params({"lr": 0.001, "batch_size": 64, "epochs": 10})
    # ... training ...
    mlflow.log_metrics({"val_accuracy": 0.92, "val_f1": 0.89})
    mlflow.log_artifact("confusion_matrix.png")
    mlflow.sklearn.log_model(model, "model")
    mlflow.log_param("git_commit", git_commit_hash)
```

## Feature engineering

- Separate feature engineering into a dedicated module: `features.py`.
- Fit feature transforms on training data only; transform validation/test.
- Save preprocessing pipeline with the model (sklearn `Pipeline`, or custom `Preprocessor` class).
- Document feature definitions, data types, and expected ranges.
- Validate feature distributions against training baseline before inference.

```python
# features.py
from sklearn.preprocessing import StandardScaler
import joblib

class FeaturePipeline:
    def __init__(self):
        self.scaler = StandardScaler()
        self.fitted = False

    def fit(self, X_train: np.ndarray) -> "FeaturePipeline":
        self.scaler.fit(X_train)
        self.fitted = True
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        if not self.fitted:
            raise RuntimeError("FeaturePipeline not fitted")
        return self.scaler.transform(X)

    def save(self, path: str) -> None:
        joblib.dump(self, path)

    @staticmethod
    def load(path: str) -> "FeaturePipeline":
        return joblib.load(path)
```

## Data splitting

- Stratified splits for classification with imbalanced classes.
- Time-based splits for temporal data (no future leakage).
- Group-based splits when samples share groups (e.g., same user).
- Document and justify the split strategy.

```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)
```

## Training loop

- Config as typed dataclass, not dict.

```python
from dataclasses import dataclass

@dataclass
class TrainConfig:
    learning_rate: float = 0.001
    batch_size: int = 64
    epochs: int = 10
    early_stopping_patience: int = 3
    weight_decay: float = 1e-5
```

- Early stopping with restoration of best weights.
- Gradient clipping for stability.
- Learning rate scheduling.
- Log per-epoch metrics (loss, accuracy, val_loss, val_accuracy).
- Save best model checkpoint, not last.

## Evaluation

- Use multiple metrics: accuracy alone is insufficient.
- For classification: precision, recall, F1, ROC-AUC, confusion matrix.
- For regression: MAE, RMSE, R², MAPE.
- Analyze errors: best/worst predictions, error distribution.
- Test for bias across subgroups (fairness audit).
- Include baseline comparison (simple heuristic, or previous model).

## Model serialization

- Save model + preprocessing pipeline together.
- Use `mlflow.<framework>.save_model()` for framework-native formats.
- Export to ONNX for framework-agnostic serving when needed.
- Include a `predict` method with input validation.

```python
class ModelBundle:
    def __init__(self, model, preprocessor: FeaturePipeline):
        self.model = model
        self.preprocessor = preprocessor

    def predict(self, X_raw: np.ndarray) -> np.ndarray:
        X = self.preprocessor.transform(X_raw)
        return self.model.predict(X)

    def save(self, path: str) -> None:
        mlflow.sklearn.save_model(self.model, f"{path}/model")
        self.preprocessor.save(f"{path}/preprocessor.joblib")
```

## Don't

- Don't hardcode paths — use config or CLI args.
- Don't train without experiment tracking.
- Don't leak test data into training (feature engineering, imputation, scaling).
- Don't use accuracy as the only metric.
- Don't deploy a model without saving the preprocessing pipeline.
- Don't ignore class imbalance.
