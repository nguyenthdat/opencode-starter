# GitHub Code Search

Use `github_search_code` for source-code searches on GitHub, with qualifiers such as `repo:`, `org:`, `language:`, or `path:`. Do not use Exa, `crawlberg` operations, or WebFetch for GitHub code search. Use the matching GitHub MCP read/search tool for repositories, issues, pull requests, commits, and releases.

# Custom Plugin Routing

When given only a filename or relative path, search:

* Attachment metadata and prompt paths
* Workspace and current directory
* OpenCode temp, cache, artifact, and tool-output directories
* `/tmp`

Prefer exact matches, then workspace files, then the newest readable file. Ask for a path only after resolution fails. Never ask when a valid absolute path is provided.

* `crawlberg`: download URLs, including PDFs, Office files, archives, and other remote content; also scrape, crawl, map links, and interact with dynamic websites.
* `xberg`: always process downloaded or local files for MIME detection, extraction, inspection, and structured content parsing.
* `html-to-markdown`: convert existing HTML into Markdown and extract metadata, tables, links, and images.
* `tree-sitter-language-pack`: perform syntax-aware code parsing, language detection, symbol extraction, diagnostics, and code chunking.

For remote files: use `crawlberg` to download first, then pass the resulting local file to `xberg`.

# Project Memory

Use the Qdrant MCP server as durable, project-scoped memory for non-trivial work.

1. Recall: before planning or editing, call `qdrant-find` with a concise semantic query containing the current goal plus relevant errors, components, or symbols. If Qdrant is unavailable or returns no useful result, continue without blocking the task.
2. Validate: treat recalled memory as a lead, not as authority. Confirm it against the current repository, configuration, tests, and user request; current evidence wins whenever memory is stale or conflicting.
3. Persist: after successful verification, call `qdrant-find` once more to avoid duplicates, then use `qdrant-store` only for new durable knowledge such as architectural decisions, project conventions, confirmed fixes, recurring pitfalls, or reliable commands.

- Store one self-contained fact per memory, including enough rationale or evidence to make it useful in a future session.
- Add compact metadata when useful, such as `type`, `component`, and `source`; do not rely on metadata instead of clear memory text.
- Do not store transient progress, full conversation summaries, speculative conclusions, raw logs, large code blocks, generated artifacts, secrets, credentials, tokens, or personal data.
- Do not persist a memory until the relevant change or conclusion has been validated. If a previous memory is wrong, follow current repository evidence and store a clearly labeled correction only when it will prevent recurrence.

# Python Scripting

- Use `uv` for execution, dependencies, environments, and tools: `uv run`, `uv add`, `uv sync`, and `uv tool run`. Preserve another workflow only when the project explicitly standardizes on it.
- Prefer maintained libraries and structured parsers over shell glue or regex. Never parse JSON, YAML, TOML, XML, HTML, or CSV with regex.
- Prefer `pathlib`/`shutil`/`tempfile`, `httpx`, `pydantic` or `msgspec`, and format-specific libraries. Use Polars/PyArrow/DuckDB for large tabular workloads when the project has no conflicting standard.
- Stream or chunk large inputs; use async I/O only for real concurrency benefits.
- Add type hints to public/core APIs, a guarded `main()`, actionable errors, and explicit CLI arguments.
- Keep mutations idempotent; use atomic writes and `--dry-run` for destructive or bulk operations.
- Use inline `uv` script metadata for standalone scripts with dependencies when useful.

# Harness / Skill / MCP Work

Load only the workflow skill relevant to the change:

- Load `harness` for harness teams, agents, team instructions, or orchestration architecture.
- Also load `skill-creator` when creating or substantially changing a `SKILL.md`.
- Also load `mcp-builder` only when creating or changing MCP servers, tools, transports, or client integrations.

Use the skill loader; do not copy complete skill files into prompts manually.

# Bun-First Runtime

Use Bun unless the user or existing project requires another runtime/package manager.

- Inspect `package.json` and lockfiles first. Treat `bun.lock`/`bun.lockb` as authoritative when present.
- Prefer `bun install`, `bun add [-d]`, `bun remove`, `bun update`, `bun run <script>`, and `bunx` over npm/npx equivalents.
- Prefer `bun <file>` and `bun test` when compatible.
- Do not create or modify `package-lock.json` unless preserving an npm workflow is explicitly required.
- Fall back to npm/npx only for demonstrated incompatibility, npm-only tooling, official requirements, or an explicit user request; state the reason briefly.
