# perf-vectorize

> Replace Python loops over numeric data with numpy/polars vectorized operations.

## Why
Python loops have interpreter overhead (~50ns per iteration). Vectorized operations run in compiled C/Rust, 10-100x faster for numeric workloads.

## Bad
```python
result = []
for x in data:
    result.append(x * 2 + 1)
```

## Good
```python
import numpy as np
result = np.array(data) * 2 + 1

# Or with Polars
df = df.with_columns((pl.col("x") * 2 + 1).alias("result"))
```
