# async-semaphore-limit

> Use `asyncio.Semaphore` to limit concurrent connections to external services.

## Why
Unbounded concurrency can overwhelm external services, trigger rate limits, or exhaust system resources. A semaphore caps parallelism.

## Bad
```python
tasks = [fetch(url) for url in urls]
results = await asyncio.gather(*tasks)
```

## Good
```python
sem = asyncio.Semaphore(10)

async def fetch_bounded(session, url):
    async with sem:
        async with session.get(url) as resp:
            return await resp.json()

async with aiohttp.ClientSession() as session:
    tasks = [fetch_bounded(session, url) for url in urls]
    results = await asyncio.gather(*tasks)
```
