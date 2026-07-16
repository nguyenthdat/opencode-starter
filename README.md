# opencode-base

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
| `dynamic-skills.jsonc` | Skill search paths (project-local, vendor, team) |
| `tui.json` | Terminal UI settings (theme, etc.) |
| `instructions/` | Markdown instruction files loaded as system prompts |
| `agents/` | Custom agent definitions |
| `skills/` | Project-local OpenCode skills |
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

`plugins/opencode-memory.ts` auto-loads five OpenCode custom tools without MCP:
`native_memory_search`, `native_memory_store`, `native_memory_get`,
`native_memory_forget`, and `native_memory_status`.

The plugin recalls relevant project memory before model execution and injects it
as untrusted historical context. It also preserves durable candidates during
compaction. The Rust sidecar combines multilingual E5 embeddings, zvec HNSW,
full-text search, importance, and recency. Data is isolated by canonical Git
worktree under `~/.local/share/opencode/native-memory`; downloaded models live
under `~/.cache/opencode/native-memory/models`.

The first setup downloads the local embedding model:

```bash
bun run memory:build:release
bun run memory:warmup
```

### Instructions

Instruction files in `.opencode/instructions/` are loaded from both
`.opencode/instructions/*` and `~/.config/opencode/instructions/*` / `~/.opencode/instructions/*`
(global user overrides).

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

Drop `.md` files into `.opencode/instructions/`. They are loaded via the glob
`instructions: [".opencode/instructions/*"]` in `opencode.jsonc`.

### 3. Add project-local MCP servers

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

### 4. Customize permissions

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
│   ├── skills/              # your project-local skills
│   ├── vendor/              # nested submodules (vendor skills)
│   ├── plugins/
│   └── tools/
└── your-app-code/
```
