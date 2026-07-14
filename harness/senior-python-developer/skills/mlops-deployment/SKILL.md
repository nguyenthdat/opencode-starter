---
name: mlops-deployment
description: "MLOps deployment patterns: FastAPI model serving, Docker, monitoring, drift detection, model registry, CI/CD for ML. Use for deploying and operating ML models."
compatibility: opencode
metadata:
  domain: mlops
  audience: senior-python-developer
---

# MLOps Deployment Patterns

Production patterns for deploying, serving, and monitoring ML models.

## Model serving with FastAPI

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import structlog
import mlflow

logger = structlog.get_logger()

app = FastAPI(title="Model Serving API", version="1.0.0")
model_bundle = None  # loaded at startup

class PredictRequest(BaseModel):
    features: list[list[float]] = Field(..., min_length=1)
    request_id: str | None = None

class PredictResponse(BaseModel):
    predictions: list[float]
    model_version: str
    request_id: str | None

class HealthResponse(BaseModel):
    status: str
    model_version: str
    model_loaded: bool

class ErrorResponse(BaseModel):
    error: str
    detail: str | None

@app.on_event("startup")
async def load_model():
    global model_bundle
    model_bundle = ModelBundle.load("models/production/model")
    logger.info("model_loaded", version=model_bundle.version)

@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    if model_bundle is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    try:
        preds = model_bundle.predict(req.features)
        return PredictResponse(
            predictions=preds.tolist(),
            model_version=model_bundle.version,
            request_id=req.request_id,
        )
    except Exception as e:
        logger.error("prediction_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Prediction failed")

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="healthy",
        model_version=model_bundle.version if model_bundle else "none",
        model_loaded=model_bundle is not None,
    )
```

## Containerization

```dockerfile
FROM python:3.11-slim

RUN pip install uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY src/ ./src/
COPY models/ ./models/

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "src.serve:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Monitoring

- **Prediction latency:** p50, p95, p99 per endpoint.
- **Error rate:** 4xx and 5xx counts, error type breakdown.
- **Input drift:** compare input feature distributions to training baseline (use KS-test, PSI).
- **Prediction drift:** compare output distribution over time.
- **Throughput:** requests per second.
- Log all predictions with: `request_id`, `model_version`, `timestamp`, `input_hash`, `prediction`.

```python
@dataclass
class PredictionLog:
    request_id: str
    model_version: str
    timestamp: float
    input_hash: str
    prediction: float
    latency_ms: float
```

## Deployment strategies

- **Canary:** route 5% of traffic to new model; promote if metrics hold for N hours.
- **Shadow:** mirror traffic to new model without returning results; compare outputs.
- **Blue/green:** deploy new version alongside old; switch all traffic at once.
- **A/B test:** route traffic by user ID or request ID; compare business metrics.

## Model registry

- Register models in MLflow Model Registry.
- Stage transitions: None → Staging → Production → Archived.
- Each stage transition triggers CI/CD: tests for staging, deployment for production.
- Version models by semantic version: `MAJOR.MODEL_ARCHITECTURE.MINOR`.
- Keep at most 3 versions in production; archive older.

## CI/CD for ML

- On PR: run tests, lint, type check, smoke test model loading.
- On merge: train on full dataset, register model, promote to staging.
- Staging: integration tests with serving API.
- Production: manual approval gate, then canary → full rollout.
- Rollback: revert traffic to previous model version via registry.

## Don't

- Don't load model on every request — load once at startup.
- Don't skip input validation — Pydantic models catch bad inputs before inference.
- Don't deploy without health checks.
- Don't deploy without monitoring.
- Don't log raw input data containing PII.
- Don't hardcode model paths — use environment variables or config.
