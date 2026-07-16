# OpenCode Native Memory

This crate is the persistent Rust sidecar used by the local OpenCode custom
plugin. It is not an MCP server.

The process accepts bounded newline-delimited JSON requests on stdin and writes
one JSON response per line on stdout. It keeps one `zvec` collection, one
atomic lifecycle-state ledger, and one `multilingual-e5-small` embedding model
alive for the lifetime of OpenCode. RPC methods cover search, store, get, list,
update, delete/forget, purge, feedback, shared-Markdown synchronization,
optimize, doctor, status, and shutdown.

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

The sidecar rejects likely credentials and instruction-shaped untrusted memory,
bounds all inputs/results, flushes writes, and holds a per-project single-writer
lock. Its additive `state.json` tracks session/agent/project/repository scopes,
per-kind TTL and decay, tombstones, code-file hashes, and idempotent retrieval
feedback while preserving zvec schema v1 collections.

Search runs independent dense and lexical channels, calibrates their scores,
filters expired/stale/wrong-scope records, deduplicates layered copies, applies
MMR diversity, and packs a variable number of results into a caller-provided
character budget. Low-confidence searches abstain instead of injecting the
top-ranked record unconditionally.

The writer lock is held for the engine lifetime. Multiple parent and subagent
sessions inside one OpenCode process share the sidecar, but a second OpenCode
process cannot open the same worktree's memory concurrently.
