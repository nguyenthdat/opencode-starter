# Dynamic Skills Plugin

On-demand skill discovery and loading for OpenCode agents and subagents.

Instead of relying solely on the central `.opencode/skills/` folder (which requires manual symlinking), this plugin discovers skills from multiple configurable search paths and loads them only when an agent explicitly requests them — preventing context bloat.

## Quick Start

1. **Config file** — Create `.opencode/dynamic-skills.jsonc` (an example is included in this repo).

2. **Plugin auto-loads** — The plugin at `.opencode/plugins/dynamic-skills.js` is auto-discovered by OpenCode. No registration needed.

3. **Use the tools** — Agents and subagents can now call `skills_list`, `skills_find`, `skills_load`, `skills_refresh`, and `skills_doctor`.

## Configuration

`.opencode/dynamic-skills.jsonc`:

```jsonc
{
  "searchPaths": [
    ".opencode/skills",        // project-local skills
    "harness/*/skills",        // harness team skills
    ".opencode/vendor/*/skills" // vendor skills
  ],
  "cacheTTL": 300,              // seconds
  "allowAbsolutePaths": false,  // safety: reject /absolute/paths
  "debug": false,
  "maxSkillFileSize": 1048576   // 1 MiB max per SKILL.md
}
```

### Search Path Types

| Pattern | Example | Resolves To |
|---------|---------|------------|
| Relative | `.opencode/skills` | `<project>/.opencode/skills` |
| Glob | `harness/*/skills` | `harness/senior-rust-engineer/skills`, etc. |
| Home | `~/opencode-shared/skills` | `/Users/you/opencode-shared/skills` |
| Absolute | `/opt/shared/skills` | (requires `allowAbsolutePaths: true`) |

## Conflict Resolution Priority

When multiple skills share the same name, the plugin picks the highest-priority source:

1. **local** (`.opencode/skills/`) — priority 0
2. **harness** (`harness/<team>/skills/`) — priority 10
3. **vendor** (`.opencode/vendor/<vendor>/skills/`) — priority 20
4. **global** (absolute/external paths) — priority 30

Lower priority number = higher precedence. Explicit `path` on `skills_load` bypasses all resolution.

## Tools

### `skills_list`
List all discovered skills.

```
skills_list { debug?: boolean }
```

### `skills_find`
Search skills by name, tag, team, source, or free-text query.

```
skills_find { query?: string, team?: string, source?: string, tag?: string }
```

### `skills_load`
Load a skill's full SKILL.md content on demand.

```
skills_load { name: string } | { path: string }
```

### `skills_refresh`
Force re-scan of all configured paths.

```
skills_refresh { debug?: boolean }
```

### `skills_doctor`
Validate configuration and skill files. Reports missing SKILL.md, unreadable files, and invalid paths.

```
skills_doctor { debug?: boolean }
```

## Directory Structure

```
project/
  .opencode/
    dynamic-skills.jsonc        # plugin config
    plugins/
      dynamic-skills.js          # plugin code
    skills/                      # local skills (discovered)
      docx/SKILL.md
      pdf/SKILL.md

  harness/
    lead-orchestrator/
      skills/
        context-routing/SKILL.md
        delegation-patterns/SKILL.md
    senior-rust-engineer/
      skills/
        rust-coding/SKILL.md
        rust-review/SKILL.md

  .opencode/vendor/
    xberg-plugins/
      skills/                    # vendor skills (discovered)
        xberg/SKILL.md
```

## Usage Examples

### Lead agent loading a team skill for a subagent

```
1. Call skills_find with team="senior-rust-engineer"
2. Receive: ["rust-coding", "rust-review", "rust-orchestrator", "uniffi"]
3. Call skills_load with name="rust-coding"
4. Receive the full SKILL.md content
5. Pass the content as instructions to a rust-implementer subagent via task()
```

### Discovering what's available

```
skills_list → returns all discovered skills across all teams/vendors
skills_find { query: "security" } → returns incident-response, security-review, etc.
skills_find { source: "harness" } → returns only harness team skills
```

### Checking skill health

```
skills_doctor → validates all paths, files, frontmatter
```

## Safety

- **No code execution** — only reads `.md` files and reference documents.
- **Path traversal protection** — resolved paths must be within configured search roots.
- **Absolute path gating** — absolute paths require explicit `allowAbsolutePaths: true`.
- **Size limits** — SKILL.md files larger than `maxSkillFileSize` are rejected.
- **Dot-directories skipped** — directories starting with `.` are ignored.

## Running Tests

```bash
bun test tests/dynamic-skills.test.js
```

## Architecture

```
dynamic-skills.jsonc          skill search paths
         │
         ▼
dynamic-skills.js (plugin)    auto-loaded by OpenCode
         │
    ┌────┴────────────────────────────┐
    │                                 │
    ▼                                 ▼
  Discovery                        Cache
  (recursive scan)              (in-memory, TTL)
    │                                 │
    ├── parse frontmatter             │
    ├── classify source               │
    ├── resolve conflicts             │
    └── return metadata               │
         │                            │
         ▼                            ▼
    skills_list / skills_find     skills_load
    (metadata only)               (full SKILL.md content)
```

The plugin only reads SKILL.md frontmatter during discovery (name, description, tags). The full file content is never loaded until an agent calls `skills_load` — keeping context small and fast.
