# Python Scripting

- Use `uv` for execution, dependencies, environments, and tools: `uv run`, `uv add`, `uv sync`, and `uv tool run`. Preserve another workflow only when the project explicitly standardizes on it.
- Prefer maintained libraries and structured parsers over shell glue or regex. Never parse JSON, YAML, TOML, XML, HTML, or CSV with regex.
- Prefer `pathlib`/`shutil`/`tempfile`, `httpx`, `pydantic` or `msgspec`, and format-specific libraries. Use Polars/PyArrow/DuckDB for large tabular workloads when the project has no conflicting standard.
- Stream or chunk large inputs; use async I/O only for real concurrency benefits.
- Add type hints to public/core APIs, a guarded `main()`, actionable errors, and explicit CLI arguments.
- Keep mutations idempotent; use atomic writes and `--dry-run` for destructive or bulk operations.
- Use inline `uv` script metadata for standalone scripts with dependencies when useful.
