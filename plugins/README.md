# OpenCode Custom Plugins

This directory contains five auto-loaded OpenCode plugins. Four expose bounded wrappers around trusted local CLIs; `dynamic-skills` discovers and loads skills without placing every skill body in the model context.

Restart OpenCode after changing a plugin, dependency, or plugin configuration because plugins are loaded once at startup.

## Plugin Inventory

| Plugin                         | Tools                                                                                | Required CLI       | Wall-Clock Limit |
| ------------------------------ | ------------------------------------------------------------------------------------ | ------------------ | ---------------- |
| `crawlberg.js`                 | `crawlberg_scrape`, `crawlberg_crawl`, `crawlberg_map`                               | `crawlberg`        | 15 minutes       |
| `html-to-markdown.js`          | `html_to_markdown_convert`, `html_to_markdown_fetch_url`, `html_to_markdown_extract` | `html-to-markdown` | 5 minutes        |
| `tree-sitter-language-pack.js` | `tspack_parse`, `tspack_process`, `tspack_info`                                      | `ts-pack`          | 5 minutes        |
| `xberg.js`                     | `xberg_extract`, `xberg_detect`, `xberg_formats`                                     | `xberg`            | 10 minutes       |
| `dynamic-skills.js`            | `skills_list`, `skills_find`, `skills_load`, `skills_refresh`, `skills_doctor`       | None               | In-process       |

OpenCode auto-discovers JavaScript files in `plugins/`; no `plugin` entry is required in `opencode.jsonc` for this layout.

## Installation

Install JavaScript dependencies with Bun:

```bash
bun install
```

Install only the CLIs needed by the enabled tools:

```bash
brew install xberg-io/tap/crawlberg
brew install xberg-io/tap/html-to-markdown
brew install xberg-io/tap/ts-pack
brew install xberg-io/tap/xberg
```

The wrappers also return package-specific `bunx` and `uvx` guidance when a binary is unavailable. They do not silently install or execute a moving `latest` version.

## Shared CLI Contract

The four CLI plugins use `scripts/opencode-plugin-utils.js` for consistent execution:

- Commands are spawned with argument arrays and no shell interpolation.
- Relative paths resolve against `context.directory`, then canonicalize through `realpath`.
- Successful stdout remains unchanged; stderr is placed in result metadata so warnings cannot corrupt JSON.
- Missing binaries and non-zero exits are tool failures with bounded diagnostic text.
- Combined stdout and stderr are capped at 8 MiB before OpenCode applies its own display truncation.
- Cancellation and timeout terminate the process group, with a forced kill after a short grace period.
- Inline stdin errors are handled instead of escaping as unhandled `EPIPE` events.

CLI subprocesses inherit the OpenCode environment because some tools require proxy, certificate, cache, or authentication variables. Treat these binaries as trusted local code.

## File Security Boundary

`xberg`, `ts-pack`, and file-based HTML conversion accept only regular files:

1. Resolve the requested path relative to the active project.
2. Resolve symlinks to the canonical target.
3. Allow files inside `context.directory` or `context.worktree`.
4. Call `context.ask` with `external_directory` before reading a canonical target outside those roots.

This prevents `../` traversal and in-worktree symlinks from silently bypassing OpenCode's external-directory policy. Approval applies to the canonical file, not the symlink path.

## Network and Input Safety

- Crawlberg and HTML fetching accept only `http://` and `https://` targets.
- Internal/private HTTP targets remain supported intentionally; use normal tool permissions and trusted prompts when accessing them.
- Crawlberg accepts at most 20 seeds, 10,000 pages/results, and concurrency 64 per call.
- Raw Crawlberg and Xberg configuration must be a non-null JSON object no larger than 64 KiB.
- HTML conversion requires exactly one source: `path`, `html`, or `url`, depending on the tool.
- An HTML preprocessing `preset` requires `preprocess: true`.

## Dynamic Skills

`dynamic-skills.js` recursively discovers `SKILL.md` files, parses JSONC configuration and YAML frontmatter with maintained parsers, resolves duplicate names by source priority, and loads full content only when requested.

### Configuration

For a normal project, create `<project>/.opencode/dynamic-skills.jsonc`:

```jsonc
{
  "searchPaths": [
    ".opencode/skills",
    "harness/*/skills",
    ".opencode/vendor/*/skills",
  ],
  "cacheTTL": 300,
  "allowAbsolutePaths": false,
  "debug": false,
  "maxSkillFileSize": 1048576,
}
```

When the workspace itself is `~/.opencode`, use direct-root paths:

```jsonc
{
  "searchPaths": ["skills", "harness/*/skills", "vendor/*/skills"],
}
```

Configuration constraints:

| Field                | Constraint                                      |
| -------------------- | ----------------------------------------------- |
| `searchPaths`        | 1-64 non-empty paths                            |
| `cacheTTL`           | 0-86,400 seconds; `0` disables caching          |
| `allowAbsolutePaths` | Absolute and home-expanded roots require `true` |
| `maxSkillFileSize`   | Positive integer, maximum 4 MiB                 |

Cache entries are isolated by canonical workspace root and invalidated when the selected config file changes. Recursive discovery is deterministic and bounded to depth 12 and 20,000 directories per configured root.

### Source Priority

Lower numbers win when names conflict:

| Source  | Priority | Typical Pattern                                                            |
| ------- | -------: | -------------------------------------------------------------------------- |
| Local   |        0 | `.opencode/skills` or direct-root `skills`                                 |
| Harness |       10 | `harness/<team>/skills`                                                    |
| Vendor  |       20 | `.opencode/vendor/<vendor>/skills` or direct-root `vendor/<vendor>/skills` |
| Global  |       30 | Approved absolute/external roots                                           |

Duplicate occurrences are reported by `skills_doctor`. Equal-priority entries are resolved in deterministic scan order.

### Tool Usage

```text
skills_list  { limit?, offset?, include_paths?, debug? }
skills_find  { query?, team?, source?, tag?, limit?, offset?, include_paths?, debug? }
skills_load  { name? | path?, debug? }
skills_refresh { debug? }
skills_doctor  { debug? }
```

`skills_list` and `skills_find` omit absolute paths by default and return `total`, `offset`, and `has_more` for pagination. `skills_load.path` must resolve inside a configured skill root, including its final canonical `SKILL.md`; symlink escapes are rejected.

Discovery reads at most 64 KiB for frontmatter. Full content is read only by `skills_load` and remains subject to `maxSkillFileSize`.

## Testing

Run all project tests:

```bash
bun test
```

Run focused suites:

```bash
bun test tests/custom-plugins.test.js
bun test tests/dynamic-skills.test.js
bun run vendor/xberg-plugins/scripts/validate-opencode.mjs
```

The wrapper suite uses fake executables to verify argv construction, stderr separation, failures, timeout, output limits, canonical paths, external-directory approval, stdin, and input validation. The dynamic-skills suite covers direct and nested OpenCode layouts, recursive discovery, source priority, pagination, workspace cache isolation, TTL zero, doctor behavior, traversal, and symlink escape protection.

## Architecture

```text
OpenCode tool call
  -> plugin-specific schema and argv construction
  -> shared CLI runner / canonical file approval
  -> trusted local binary
  -> bounded stdout result + diagnostic metadata

dynamic-skills.jsonc
  -> workspace-scoped config and cache
  -> bounded recursive discovery
  -> JSONC + YAML parsing
  -> deterministic conflict resolution
  -> paginated metadata or explicit SKILL.md load
```
