# OpenCode Starter Kit

Shared OpenCode configuration skeleton designed to be consumed as a **git submodule** at
`<project>/.opencode`. Brings consistent agents, instructions, MCP servers, skills,
and tooling into any project with a single submodule add.

## Quick Start

### 1. Add opencode-base as a submodule to your project

```bash
cd /path/to/your-project
git submodule add https://github.com/your-org/opencode-base.git .opencode
```

### 2. Initialize and update submodules (vendor skills)

The `.opencode` skeleton pulls in vendor skills via its own nested submodules:

```bash
git submodule update --init --recursive
```

### 3. Verify

```bash
ls .opencode/
# agents/   instructions/   opencode.jsonc   skills/   vendor/   …
```

OpenCode will automatically pick up `.opencode/opencode.jsonc` when launched from
the project root.

---

## What's Included

| Path | Purpose |
|---|---|
| `opencode.jsonc` | Main config: agent, permissions, MCP servers, plugins, instructions glob |
| `dynamic-skills.jsonc` | Skill search paths (project-local and vendor) |
| `tui.json` | Terminal UI settings (theme, etc.) |
| `instructions/` | Markdown instruction files loaded as system prompts |
| `agents/` | Custom agents; reusable teams live under `agents/<team-id>/` |
| `skills/` | Project-local OpenCode skills |
| `harness/` | Schema and per-team component manifests consumed by the harness team plugin |
| `vendor/` | Git submodules pointing to external skill repos |
| `plugins/` | Thin, auto-loaded OpenCode plugin entrypoints |
| `packages/` | Bun workspace packages for shared/plugin TypeScript implementation |
| `crates/` | Cargo workspace crates used by native plugins |
| `Cargo.toml` | Rust workspace and shared lint policy |
| `tsconfig.json` | Strict TypeScript checks for workspace packages and plugins |

### Plugin Workspace

The `developer` branch keeps plugin discovery separate from implementation:

```text
plugins/                         # stable OpenCode auto-load entrypoints
packages/plugin-kit/             # shared CLI, path, and execution policy
packages/harness-teams/          # manifest validation and config mutation
packages/native-memory/          # custom tools, recall hooks, and sidecar client
crates/opencode-native-memory/   # Rust zvec sidecar and retrieval engine
scripts/build-native-memory.ts   # packages the zvec runtime beside the binary
tests/                           # Bun unit and integration tests
```

Use Bun as the only JavaScript package manager. `bun.lock` is authoritative;
`package-lock.json` is intentionally not maintained.

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run memory:build:release
bun run memory:warmup
bun run test:memory:e2e
bun run check
```

New plugins should keep only a small entrypoint in `plugins/` and place reusable
or multi-file code in a named package under `packages/`. Native code belongs in
a dedicated crate under `crates/`. Stateful native libraries should run in an
isolated sidecar so a native fault cannot terminate OpenCode.

### Native Project Memory

`plugins/opencode-memory.ts` auto-loads native memory without MCP. Its custom
tools cover search, store, get, list, update, batch delete, feedback, promotion,
purge, optimize, doctor, status, and the deprecated `forget` alias. The plugin
also registers `/memory` as the human management workflow.

Recall uses calibrated multilingual E5 and full-text ranks, kind-specific
retention, feedback, MMR diversity, relevance abstention, and a model-relative
context budget. Recalled records are injected as untrusted historical context.
Code-linked memories carry Git/file hashes and are withheld when their files
change.

Memory has four scopes: `session`, `agent`, `project`, and `repository`.
`session` is keyed to the root OpenCode session, so a parent and all of its task
subagents share temporary context while unrelated sessions remain isolated.
`agent` persists for one agent role, `project` stays private to the worktree,
and reviewed memories can be promoted to Git-shareable
`.opencode/memory/*.md` files as `repository` scope.

Compaction stores only strict, bounded durable candidates rather than raw
summaries. A private atomic state ledger adds TTLs, tombstones, provenance,
retrieval feedback, and code anchors without changing the existing zvec schema.
Data is isolated by canonical Git worktree under
`~/.local/share/opencode/native-memory`; downloaded models live under
`~/.cache/opencode/native-memory/models`. One plugin process supports many
sessions and subagents; a second OpenCode process for the same worktree remains
unsupported because the sidecar intentionally holds an exclusive writer lock.

The first setup downloads the local embedding model:

```bash
bun run memory:build:release
bun run memory:warmup
```

### Instructions

Project instruction files are registered individually in `opencode.jsonc`; global user
overrides may still use `~/.config/opencode/instructions/*` or
`~/.opencode/instructions/*`.

### MCP Servers

Pre-configured MCP servers in `opencode.jsonc`:

- **github** — GitHub API (requires `GITHUB_TOKEN`)
- **context7** — Documentation lookup (requires `CONTEXT7_API_KEY`)
- **exa** — Web search (requires `EXA_API_KEY`)
- **git** — Git operations via `uvx mcp-server-git`
- **codebase-memory** — Local code graph and structural search, distinct from durable project memory
- **cloakbrowser** — Headless browser automation
- **time** — Timezone utilities

### Vendor Skills (submodules)

| Vendor | Source |
|---|---|
| Cloudflare | `github.com/cloudflare/skills` |
| ClickHouse | `github.com/ClickHouse/agent-skills` |
| Qdrant | `github.com/qdrant/skills` |
| Redpanda | `github.com/redpanda-data/skills` |
| Windmill | `github.com/windmill-labs/windmill-cli-docs` |
| Engineer's Skills | `github.com/mattpocock/skills` |
| ECC | `github.com/affaan-m/ECC` |
| Xberg Plugins | `github.com/xberg-io/plugins` |

---

## Updating

### Update the opencode-base skeleton itself

```bash
cd .opencode
git fetch
git merge origin/main
cd ..
git add .opencode
git commit -m "chore: bump opencode-base"
```

### Update vendor skill submodules

```bash
cd .opencode
git submodule update --remote --recursive
cd ..
git add .opencode
git commit -m "chore: update vendor skills"
```

---

## Configuring for Your Project

### 1. Add project-local skills

Create skills under `.opencode/skills/<skill-name>/SKILL.md`:

```markdown
# My Project Skill

Description of what this skill teaches the agent.
```

Skills are auto-discovered (no config change needed).

### 2. Add project-specific instructions

Drop `.md` files into `.opencode/instructions/` and register each path explicitly in
`opencode.jsonc`. Explicit paths let the harness team plugin enable or disable one instruction
without rebuilding a shared wildcard.

### 3. Add a language or domain harness team

Use a stable team namespace instead of placing language-specific roles at the root:

```text
agents/<team-id>/lead.md
agents/<team-id>/architect.md
agents/<team-id>/implementer.md
agents/<team-id>/reviewer.md
instructions/<team-id>.md
harness/teams/<team-id>.jsonc
```

The runtime agent ID is `<team-id>/<role>`. The lead agent owns the complete workflow:
run state, routing, task contracts, retries, review order, and completion gates. Keep
specialized skills uniquely named, such as `rust-design-patterns`, so another language
can add its own guidance without a discovery collision.

Run artifacts belong under `_workspace/harness/<team-id>/<run-id>/`. Add the team
instruction to the consuming project's instruction configuration and compact harness
index when applicable. The team manifest is declarative component inventory for the
plugin that toggles exact agents, skills, MCPs, and instructions; it must not duplicate
the lead's workflow prompt. Use `/harness` or `Ctrl+P` → `Harness Teams` to update
manifest switches and reload the current instance without quitting the TUI. See
`harness/README.md`.

### 4. Add project-local MCP servers

Edit `.opencode/opencode.jsonc` and add entries under the `mcp` key:

```jsonc
{
  "mcp": {
    "my-server": {
      "enabled": true,
      "type": "local",
      "command": ["bunx", "my-mcp-server"]
    }
  }
}
```

### 5. Customize permissions

Adjust the `permission` map in `opencode.jsonc` to tighten or loosen access for
your project.

---

## All-in-One: Fresh Project Setup

```bash
# In your new project
git init
git submodule add https://github.com/your-org/opencode-base.git .opencode
git submodule update --init --recursive

# Copy the root .gitignore from opencode-base (optional)
cp .opencode/../.gitignore .gitignore 2>/dev/null

# Commit
git add .gitmodules .opencode .gitignore
git commit -m "chore: add opencode-base as submodule"
```

---

## File Layout After Setup

```
your-project/
├── .gitmodules              # points .opencode → opencode-base
├── .opencode/               # ← submodule (this repo)
│   ├── opencode.jsonc
│   ├── dynamic-skills.jsonc
│   ├── tui.json
│   ├── instructions/
│   ├── agents/
│   ├── harness/             # team component manifests and schema
│   ├── skills/              # your project-local skills
│   ├── vendor/              # nested submodules (vendor skills)
│   ├── plugins/
│   └── tools/
└── your-app-code/
```
