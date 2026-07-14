---
name: polars-data
description: "Polars DataFrame and data pipeline patterns: lazy queries, schema enforcement, streaming, expressions, file I/O, and memory optimization. Use for any Polars-based data work."
compatibility: opencode
metadata:
  domain: data-engineering
  audience: senior-python-developer
---

# Polars Data Engineering Patterns

Production patterns for Polars DataFrame and LazyFrame pipelines. Apply these patterns for all data engineering work using Polars.

## Core rules

### Lazy-first

- Use `pl.scan_*` (not `pl.read_*`) for datasets > 100K rows.
- Chain all transformations lazily; `collect()` only at the final step.
- Use `LazyFrame.explain()` to inspect query plans before collection.
- Use `LazyFrame.show_graph()` for visual plan debugging.

```python
# Good — lazy end to end
q = (
    pl.scan_parquet("data/raw/")
    .filter(pl.col("status") == "active")
    .group_by("category")
    .agg(pl.col("amount").sum())
    .sort("amount", descending=True)
)
result = q.collect(streaming=True)  # stream for large results
```

### Schema enforcement

- Define schemas explicitly at pipeline boundaries.
- Validate schemas, don't silently coerce types.
- Use `pl.Schema` for schema definitions.
- Reject unknown columns in production pipelines.

```python
# Good
INPUT_SCHEMA = pl.Schema({
    "id": pl.Int64,
    "name": pl.Utf8,
    "amount": pl.Float64,
    "timestamp": pl.Datetime("us"),
})

df = pl.scan_parquet("data.parquet")
actual = df.collect_schema()
assert INPUT_SCHEMA == actual, f"Schema mismatch: {INPUT_SCHEMA} vs {actual}"
```

### Expression patterns

- Prefer native expressions over custom Python: `.filter()`, `.with_columns()`, `.group_by()`.
- Use `pl.when().then().otherwise()` for conditional logic.
- Use `pl.col()` with method chaining: `pl.col("name").str.to_lowercase().str.strip()`.
- Never use `.map_elements()` on hot paths; find an expression equivalent.
- Use `pl.Expr` type for expression composition functions.

```python
# Good — expression-based
def add_total_pct(df: pl.LazyFrame) -> pl.LazyFrame:
    return df.with_columns(
        (pl.col("amount") / pl.col("amount").sum() * 100).alias("pct")
    )

# Bad — map_elements on hot path
df.with_columns(
    pl.col("amount").map_elements(lambda x: x / total * 100).alias("pct")
)
```

### Memory and streaming

- Use `collect(streaming=True)` when data exceeds available RAM.
- For iterative algorithms, process in chunks with `pl.read_csv_batched()`.
- Use `pl.concat()` with `how="vertical"` for merging partitions.
- Prefer `pl.scan_ipc` (Arrow IPC) for intermediate checkpoints; it's faster than Parquet.

### File I/O patterns

- **Read:** `pl.scan_parquet("path/")` (directory scans all parts), `pl.scan_csv()`, `pl.scan_ipc()`.
- **Write:** Use partitioned writes: `df.write_parquet("out/", partition_by=["year", "month"])`.
- **Format choice:** Parquet (storage, exchange), Arrow IPC (intermediate, speed), CSV only for human-readable exports.
- Always specify `use_pyarrow=True` for datetime/timezone handling with Parquet.

### Null handling

- Handle nulls at known pipeline points, not at the end.
- `fill_null(strategy="forward")` for time series.
- `fill_null(value)` for categorical defaults.
- `drop_nulls()` only when nulls indicate corrupt data, not missing data.
- Distinguish `null` (missing) from `NaN` (not a number); Polars treats them separately.

```python
# Good — explicit null strategy
df.with_columns(
    pl.col("amount").fill_null(0.0),
    pl.col("category").fill_null("unknown"),
).filter(~pl.col("id").is_null())  # id null means corrupt row
```

### Pipeline testing

- Test against small fixtures, not production datasets.
- Use `pl.DataFrame({...})` inline for test fixtures.
- Test schema output, row counts, and aggregate values.
- Test null handling and edge cases (empty input, all-null columns).
- Test query plan: verify optimizations are applied with `explain()`.

```python
# Good — test with inline fixture
def test_pipeline():
    df = pl.DataFrame({
        "id": [1, 2, None],
        "amount": [100.0, None, 300.0],
        "category": ["a", "b", "a"],
    })
    result = pipeline(df.lazy()).collect()
    assert result.schema == EXPECTED_SCHEMA
    assert len(result) == 2
```

### Don't

- Don't use `.to_pandas()` in the middle of a pipeline.
- Don't use `.collect()` mid-pipeline then re-wrap in `.lazy()`.
- Don't use `apply`/`map_elements` on hot paths — find a native expression.
- Don't read CSV without specifying `dtypes` for production pipelines.
- Don't ignore `explain()` output; unexpected scans or sorts signal missed optimizations.
