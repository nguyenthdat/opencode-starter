---
name: python-performance
description: "Python performance profiling and optimization patterns: CPU profiling, memory profiling, benchmarking, Polars query optimization, and async I/O tuning."
compatibility: opencode
metadata:
  domain: python-engineering
  audience: senior-python-developer
---

# Python Performance Engineering

Profiling and optimization patterns for production Python.

## Profiling tools

| Tool | Use case | Command |
|---|---|---|
| `py-spy` | CPU sampling (production-safe) | `py-spy top -- python script.py` |
| `scalene` | CPU + memory + GPU profiling | `scalene script.py` |
| `cProfile` + `snakeviz` | CPU call-graph profiling | `python -m cProfile -o out.prof script.py && snakeviz out.prof` |
| `memray` | Memory allocation profiling | `memray run script.py && memray flamegraph memray-out.bin` |
| `pytest-benchmark` | Micro-benchmarking | `pytest --benchmark-only` |
| `timeit` | Quick micro-benchmarks | `python -m timeit -s "setup" "stmt"` |

## CPU optimization checklist

1. **Profile first** — never optimize without profiling data.
2. **Vectorize with numpy/polars** — replace Python loops.
3. **Use built-in functions** — `sum()`, `min()`, `max()` are in C.
4. **List comprehensions > `map` with lambda** — comprehensions are faster in CPython.
5. **Local variable caching** — `local = module.func` in tight loops.
6. **`__slots__`** for classes with many instances.
7. **Avoid attribute access in loops** — cache `obj.attr` in a local variable.
8. **Use `functools.lru_cache`** for expensive pure functions.
9. **Pre-allocate lists** with `[None] * n` instead of `.append()` in loops.
10. **Use `collections.deque`** for FIFO queues, not `list.pop(0)`.

```python
# Before
result = []
for item in items:
    result.append(expensive_func(item))

# After
expensive_func_local = expensive_func
append = result.append
for item in items:
    append(expensive_func_local(item))
```

## Memory optimization checklist

1. **Profile with memray** — find allocation hotspots.
2. **Generators over lists** — `yield` instead of building large lists.
3. **`array.array`** or `numpy` for numeric arrays (not `list[int]`).
4. **`__slots__`** for classes with millions of instances.
5. **`sys.intern()`** for duplicate strings.
6. **Streaming for large datasets** — `scan_parquet(streaming=True)`.
7. **Use `weakref`** for caches that should not prevent GC.
8. **`del` large objects** when done (explicit GC hint).

## Polars-specific optimization

- Check query plan: `LazyFrame.explain()` — look for unexpected scans or sorts.
- Use `collect(streaming=True)` for datasets larger than RAM.
- Avoid `sort()` before `group_by()` — prefer `group_by().agg()` then sort.
- Filter early: push `filter()` as high in the pipeline as possible.
- Use `with_columns()` with multiple expressions — one pass, not multiple.

## Async I/O optimization

- Use `asyncio.gather()` for parallel I/O, not sequential `await`.
- Use `asyncio.Semaphore` to limit concurrent connections.
- Use `aiohttp.ClientSession` with connection pooling (reuse sessions).
- Avoid CPU-bound work in async coroutines — use `loop.run_in_executor()`.
- Profile with `asyncio` debug mode: `PYTHONASYNCIODEBUG=1`.

```python
import asyncio

async def fetch_all(urls: list[str], concurrency: int = 10) -> list[dict]:
    sem = asyncio.Semaphore(concurrency)

    async def fetch_one(session, url):
        async with sem, session.get(url) as resp:
            return await resp.json()

    async with aiohttp.ClientSession() as session:
        tasks = [fetch_one(session, url) for url in urls]
        return await asyncio.gather(*tasks)
```

## Benchmarking

```python
# conftest.py
import pytest

@pytest.fixture
def benchmark_data():
    # return representative data, not trivial data
    ...

# test_perf.py
def test_pipeline_throughput(benchmark, benchmark_data):
    result = benchmark(pipeline, benchmark_data)
    assert result.schema == EXPECTED_SCHEMA
```

## Don't

- Don't optimize without profiling.
- Don't sacrifice correctness for speed.
- Don't use `apply`/`map_elements` on hot paths in Polars.
- Don't await in a loop when `gather` works.
- Don't load entire datasets into memory when streaming is available.
- Don't assume threading speeds up CPU-bound Python code (GIL).
