# OpenCode Starter

[![CI](https://github.com/nguyenthdat/opencode-starter/actions/workflows/ci.yml/badge.svg)](https://github.com/nguyenthdat/opencode-starter/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An opinionated global [OpenCode](https://opencode.ai) configuration for
software engineering work. It combines reusable agents and skills, MCP
integrations, a hardened local search plugin, custom TUI styling, and an
optional cross-platform workstation bootstrap.

Install the repository at `~/.config/opencode` so OpenCode can load it as the
global configuration. Project-level `.opencode` files can still override these
defaults.

## Highlights

- Practical global instructions for code search, GitHub, document handling,
  Python tooling, Bun-first JavaScript workflows, and agent orchestration.
- A research agent plus hidden grader, comparator, and analyzer agents for
  skill evaluation workflows.
- Built-in skills for DOCX, PDF, PPTX, XLSX, harness design, MCP server
  development, and OpenCode skill creation.
- Enabled MCP integrations for codebase memory, Git, GitHub, Context7, Exa,
  and browser automation through CloakBrowser.
- Remote plugins for Anthropic authentication, document extraction, crawling,
  HTML conversion, and tree-sitter analysis.
- A local `grep` tool that handles large matching lines while preserving
  OpenCode permission checks and cancellation.
- An Ansible playbook for reproducible macOS and Debian/RedHat-family setup.

## Quick Start

The enabled local tools require Git, OpenCode, Bun 1.3.14, uv, ripgrep, and
`codebase-memory-mcp`.

### 1. Clone the configuration

```bash
git clone \
  https://github.com/nguyenthdat/opencode-starter.git \
  "$HOME/.config/opencode"
cd "$HOME/.config/opencode"
```

### 2. Install dependencies

```bash
bun install --frozen-lockfile
```

`bun.lock` is the authoritative JavaScript lockfile.

### 3. Configure credentials

The enabled remote MCP servers read credentials from environment variables:

```bash
export GITHUB_TOKEN="..."
export CONTEXT7_API_KEY="..."
export EXA_API_KEY="..."
```

Set only the credentials for services you use. Keep secrets in your shell,
password manager, or secret-management system; never commit them to this
repository.

### 4. Start OpenCode

```bash
cd /path/to/your/project
opencode
```

Restart OpenCode after changing `opencode.jsonc`, an agent, a skill, or a
plugin because configuration-time files are loaded only at startup.

## Workstation Bootstrap

The optional playbook installs the command-line tools used by this setup,
including pinned versions of Bun, uv, OpenCode, yq, codebase-memory-mcp, and
several Rust tools. It supports macOS and Debian/RedHat-family Linux on arm64
and x86_64 with Bash, Fish, or Zsh.

Install Ansible and Git first. On macOS, Homebrew is also required.

```bash
ansible-galaxy collection install -r scripts/requirements.yaml
```

Run the playbook on macOS:

```bash
ansible-playbook scripts/tools-setup.playbook.yaml
```

Run it on Linux with privilege escalation for system packages:

```bash
ansible-playbook --ask-become-pass scripts/tools-setup.playbook.yaml
```

If `just` is already installed, `just bootstrap` and `just bootstrap-linux`
provide equivalent shortcuts and install the required Ansible collection
first. The playbook does not install credentials or GUI applications.

## Included Components

### Agents

| Agent | Purpose |
| --- | --- |
| `search` | Collects, validates, and summarizes external research using the most appropriate search or extraction tool |
| `skill-creator-grader` | Grades skill evaluation outputs against explicit expectations |
| `skill-creator-comparator` | Blindly compares two skill evaluation outputs |
| `skill-creator-analyzer` | Explains comparison results and proposes improvements |

The skill evaluation agents are hidden and are invoked only by the
`skill-creator` workflow.

### Skills

| Skill | Purpose |
| --- | --- |
| `docx` | Create, inspect, edit, and validate Word documents |
| `pdf` | Extract, transform, fill, OCR, and create PDF files |
| `pptx` | Read, edit, render, and create PowerPoint presentations |
| `xlsx` | Analyze, edit, recalculate, and create spreadsheets |
| `harness` | Design and maintain orchestrated subagent fleets |
| `mcp-builder` | Build and evaluate MCP servers across supported SDK languages |
| `skill-creator` | Create, validate, benchmark, and package OpenCode skills |

### MCP Servers

| Server | Transport | Purpose |
| --- | --- | --- |
| `codebase-memory` | Local | Code knowledge graph, architecture, and call-path analysis |
| `git` | Local | Repository inspection and Git operations |
| `github` | Remote | GitHub repositories, issues, pull requests, and code search |
| `context7` | Remote | Current library and framework documentation |
| `exa` | Remote | Web search and page retrieval |
| `cloakbrowser` | Local | Browser automation through Playwright and CloakBrowser |

## Repository Layout

| Path | Purpose |
| --- | --- |
| `opencode.jsonc` | Main OpenCode configuration, permissions, plugins, agents, and MCP servers |
| `tui.json` | TUI configuration and selected theme |
| `AGENTS.md` | Global engineering and tool-routing instructions |
| `agents/` | Custom subagent definitions |
| `skills/` | Reusable skills, scripts, schemas, and reference material |
| `plugins/` | Auto-loaded local TypeScript plugins |
| `instructions/` | Additional reusable instruction blocks |
| `prompts/` | Prompt overrides such as session compaction |
| `themes/` | Custom OpenCode themes |
| `scripts/` | Workstation bootstrap playbook and Ansible requirements |
| `.github/workflows/` | Continuous integration workflows |
| `justfile` | Local setup and validation commands |

## Development

Use the checked-in Bun version and lockfile:

```bash
just install
just typecheck
just check
```

Available validation commands:

| Command | Purpose |
| --- | --- |
| `just install` | Install dependencies from `bun.lock` without updating it |
| `just typecheck` | Run strict TypeScript checks for local plugins |
| `just check` | Install dependencies, check `justfile` formatting, and typecheck |
| `just ci` | Run the same source checks used by GitHub Actions |
| `just ansible-check` | Install the required collection, syntax-check, and lint the playbook |

GitHub Actions runs source checks on Ubuntu and macOS and validates the
Ansible playbook separately on Ubuntu.

## Updating

```bash
git pull --ff-only
bun install --frozen-lockfile
```

Review changes to `opencode.jsonc` before restarting OpenCode, especially new
plugins, MCP servers, permissions, and environment-variable requirements.

## License

Released under the [MIT License](LICENSE). Third-party dependencies and
referenced tools retain their respective licenses.
