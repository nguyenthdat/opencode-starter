# Python Scripting Rule

When writing or modifying Python scripts, always prefer modern, reliable tooling and libraries over ad-hoc shell glue or manual parsing.

## Runtime & Tooling
- Always use `uv` for Python execution, dependency management, virtualenv, and scripts.
- Prefer:
  - `uv run script.py`
  - `uv add <package>`
  - `uv sync`
  - `uv tool run <tool>`
- Do not use raw `pip`, `python -m venv`, or global Python packages unless the project explicitly requires it.
- If the script is standalone, use an inline `uv` script header when useful:
```python
# /// script
# dependencies = [
#   "httpx",
#   "pydantic",
#   "rich",
# ]
# ///
```
Library-First Policy

Prefer well-maintained libraries instead of manually parsing or reimplementing behavior.

Use libraries for:

* JSON / JSONL: orjson, msgspec, pydantic
* YAML: ruamel.yaml or PyYAML
* TOML: tomllib / tomli-w
* CSV / TSV: polars, csv, or pyarrow
* HTML/XML parsing: selectolax, beautifulsoup4, lxml
* HTTP/API: httpx
* CLI: typer, click, argparse
* Logging/output: rich, structlog, logging
* Paths/files: pathlib, shutil, tempfile
* Dates/times: datetime, dateutil, pendulum
* Data processing: polars, pyarrow, duckdb
* Validation/config: pydantic, msgspec, dynaconf
* Retries/backoff: tenacity
* Parallel/concurrent work: asyncio, anyio, concurrent.futures

Performance

* Prefer polars over pandas for large CSV/Parquet/dataframe workloads unless the project already standardizes on pandas.
* Prefer orjson or msgspec for heavy JSON workloads.
* Use streaming/chunking for large files instead of loading everything into memory.
* Avoid slow line-by-line shell pipelines when Python libraries can parse the data safely.
* Avoid regex-heavy parsing when a structured parser exists.
* Use async HTTP with httpx.AsyncClient for many network requests.
* Use pathlib and typed data models for maintainability.

Parsing Rules

* Never manually parse structured formats when a parser exists.
* Do not parse JSON/YAML/TOML/XML/HTML/CSV with regex.
* Do not split strings for command output unless the format is simple and stable.
* Prefer structured command output flags like --json, --porcelain, --format, or API responses.
* If parsing CLI output is unavoidable, isolate parsing into a small tested function.

Script Quality

* Scripts must have clear CLI arguments.
* Add type hints for public functions and core data structures.
* Use main() with if __name__ == "__main__":.
* Handle errors with useful messages.
* Avoid hardcoded absolute paths unless explicitly requested.
* Keep scripts idempotent when they modify files.
* Add --dry-run for destructive or bulk changes.
* Prefer atomic writes for generated files.

Default Style

Write Python scripts as small, fast, maintainable tools:

1. Use uv.
2. Use libraries.
3. Parse structured data structurally.
4. Optimize for correctness first, then performance.
5. Avoid fragile custom parsing unless there is no reasonable alternative.
