# OpenCode Native Memory

This crate is the persistent Rust sidecar used by the local OpenCode custom
plugin. It is not an MCP server.

The process accepts bounded newline-delimited JSON requests on stdin and writes
one JSON response per line on stdout. It keeps one `zvec` collection and one
`multilingual-e5-small` embedding model alive for the lifetime of OpenCode.

Data is scoped by the canonical Git worktree and stored under
`$XDG_DATA_HOME/opencode/native-memory` (or `~/.local/share/...`). Models are
cached under `$XDG_CACHE_HOME/opencode/native-memory/models`.

```bash
bun run memory:build:release
bun run memory:warmup
```

The first warmup downloads the local ONNX embedding model. Later starts are
offline. Override paths with `OPENCODE_MEMORY_DATA_DIR`,
`OPENCODE_MEMORY_MODEL_CACHE`, and `OPENCODE_MEMORY_PROJECT_ROOT`.

The sidecar rejects likely credentials, bounds all inputs/results, deduplicates
identical memories, flushes writes, and holds a per-project single-writer lock.
