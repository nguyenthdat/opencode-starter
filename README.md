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
packages/native-diagnostics/     # Bun plugin implementation and FFI loader
crates/opencode-native-diagnostics/ # Rust cdylib with a versioned C ABI
tests/                           # Bun unit and integration tests
```

Use Bun as the only JavaScript package manager. `bun.lock` is authoritative;
`package-lock.json` is intentionally not maintained.

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run test:native
bun run check
```

New plugins should keep only a small entrypoint in `plugins/` and place reusable
or multi-file code in a named package under `packages/`. Native code belongs in
a dedicated crate under `crates/`; expose a narrow, versioned C ABI and load it
lazily so OpenCode can still start before native artifacts are built.

### Instructions

Instruction files in `.opencode/instructions/` are loaded from both
`.opencode/instructions/*` and `~/.config/opencode/instructions/*` / `~/.opencode/instructions/*`
(global user overrides).

### MCP Servers

Pre-configured MCP servers in `opencode.jsonc`:

- **github** — GitHub API (requires `GITHUB_TOKEN`)
- **context7** — Documentation lookup (requires `CONTEXT7_API_KEY`)
- **exa** — Web search (requires `EXA_API_KEY`)
- **filesystem** — File system operations
- **git** — Git operations via `uvx mcp-server-git`
- **memory** — Persistent knowledge graph
- **qdrant** — Long-term project memory (requires running Qdrant)
- **sequential-thinking** — Structured reasoning
- **cloakbrowser** — Headless browser automation
- **token-optimizer** — Token usage optimization
- **time** — Timezone utilities
- **everything** — MCP testing/demo server

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
