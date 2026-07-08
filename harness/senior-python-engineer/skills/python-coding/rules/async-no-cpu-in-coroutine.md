# async-no-cpu-in-coroutine

> Offload CPU-bound work from async coroutines using `loop.run_in_executor()`.

## Why
CPU-bound work blocks the event loop, preventing other coroutines from making progress. Offloading to a thread or process pool keeps the event loop responsive.

## Bad
```python
async def process(data: bytes) -> dict:
    result = heavy_computation(data)  # Blocks event loop
    return result
```

## Good
```python
import asyncio

async def process(data: bytes) -> dict:
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, heavy_computation, data)
    return result
```
