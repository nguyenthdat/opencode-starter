<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/xberg-io/assets@v1/banner/readme-banner-dark.svg">
    <img alt="Xberg" width="420" src="https://cdn.jsdelivr.net/gh/xberg-io/assets@v1/banner/readme-banner-light.svg">
  </picture>
</p>

# Xberg Plugins Marketplace

Document-intelligence plugins for coding agents. Install any of the five into Claude Code, Codex CLI, Cursor, Gemini CLI, Factory Droid, GitHub Copilot CLI, or opencode.

## Badges

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/xberg-io/plugins/blob/main/LICENSE)
[![Version: 0.2.2](https://img.shields.io/badge/version-0.2.2-blue.svg)](https://github.com/xberg-io/plugins/releases)
[![GitHub stars](https://img.shields.io/github/stars/xberg-io/plugins?style=social)](https://github.com/xberg-io/plugins)
[![Discord](https://img.shields.io/badge/Discord-Chat-007ec6?logo=discord&logoColor=white)](https://discord.gg/xt9WY3GnKR)

## What You Get

| Plugin | Value Proposition | Status |
|--------|-------------------|--------|
| **xberg** | Local document extraction from 91+ formats (PDF, Office, images with OCR, HTML, email, archives, academic) | Stable — v0.2.2 |
| **crawlberg** | Web crawling and scraping with HTML→Markdown and headless-Chrome fallback | Stable — v0.2.2 |
| **html-to-markdown** | Fast, lossless HTML→Markdown with structured metadata and tables | Stable — v0.2.2 |
| **liter-llm** | Universal LLM API client for 143 providers (chat, streaming, tools, embeddings) | Stable — v0.2.2 |
| **tree-sitter-language-pack** | Parse and extract code intelligence from 300+ languages | Stable — v0.2.2 |

## Install

<details open>
<summary><strong>Claude Code</strong></summary>

Once approved by the marketplace:

```text
/plugin install xberg@claude-community
/plugin install crawlberg@claude-community
/plugin install html-to-markdown@claude-community
/plugin install liter-llm@claude-community
/plugin install tree-sitter-language-pack@claude-community
```

Self-host (works today):

```text
/plugin marketplace add xberg-io/plugins
/plugin install xberg@xberg
/plugin install crawlberg@xberg
/plugin install html-to-markdown@xberg
/plugin install liter-llm@xberg
/plugin install tree-sitter-language-pack@xberg
```

Pending review for official Claude marketplace.
</details>

<details>
<summary><strong>Codex CLI</strong></summary>

Self-host install:

```text
/plugins add https://github.com/xberg-io/plugins
```

Then search for the plugin you want — e.g. `xberg`, `crawlberg`, `html-to-markdown`, `liter-llm`, or `tree-sitter-language-pack` — and select "Install Plugin".
</details>

<details>
<summary><strong>Cursor</strong></summary>

Self-host install only:

Settings → Plugins → Add from URL → `https://github.com/xberg-io/plugins`. Select the plugin(s) you want.
</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

Self-host install:

```text
gemini extensions install https://github.com/xberg-io/plugins
```

</details>

<details>
<summary><strong>Factory Droid</strong></summary>

Self-host install:

```text
droid plugin marketplace add https://github.com/xberg-io/plugins
droid plugin install xberg@xberg
droid plugin install crawlberg@xberg
droid plugin install html-to-markdown@xberg
droid plugin install liter-llm@xberg
droid plugin install tree-sitter-language-pack@xberg
```

Pending review for official Factory Droid marketplace.
</details>

<details>
<summary><strong>GitHub Copilot CLI</strong></summary>

Self-host install:

```text
copilot plugin marketplace add https://github.com/xberg-io/plugins
copilot plugin install xberg@xberg
copilot plugin install crawlberg@xberg
copilot plugin install html-to-markdown@xberg
copilot plugin install liter-llm@xberg
copilot plugin install tree-sitter-language-pack@xberg
```

</details>

<details>
<summary><strong>opencode</strong></summary>

Add the published packages to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "@xberg-io/opencode-xberg",
    "@xberg-io/opencode-crawlberg",
    "@xberg-io/opencode-html-to-markdown",
    "@xberg-io/opencode-tree-sitter-language-pack"
  ]
}
```

`liter-llm` has no opencode package.
</details>

## Binary Requirements

Each plugin shells out to a real CLI. Install whichever you use:

| Plugin | Binary | Install |
|--------|--------|---------|
| xberg | `xberg` | `brew install xberg-io/tap/xberg` |
| crawlberg | `crawlberg` | `brew install xberg-io/tap/crawlberg` |
| html-to-markdown | `html-to-markdown` | `brew install xberg-io/tap/html-to-markdown` |
| liter-llm | `liter-llm` | `brew install xberg-io/tap/liter-llm` |
| tree-sitter-language-pack | `tree-sitter-language-pack` | `brew install xberg-io/tap/tree-sitter-language-pack` |

## How Agent Skills Work

Each plugin ships SKILL.md files describing what it can do. Agent harnesses auto-load skills based on the `description:` frontmatter in each file. When you ask your agent to extract a document or crawl a site, the matching skill fires automatically — you don't invoke skills directly.

Example: when you say "extract text and tables from this PDF", the `xberg` skill detects the request and loads the `extract` MCP tool from the local `xberg` binary. The agent then calls that tool with your document, getting back structured text, tables, and metadata. The same pattern applies to web crawling with `crawlberg`.

Skills are loaded at agent startup. Their descriptions stay in context so agents can decide when to use them. This means skills consume zero tokens unless the agent decides to invoke them.

## Layout

```text
.claude-plugin/
├── marketplace.json           # Claude marketplace
.github/plugin/
├── marketplace.json           # Copilot CLI marketplace
plugins/
├── xberg/
│   └── plugin.json            # MCP server config
└── crawlberg/
    └── plugin.json
scripts/
├── bump-version.sh            # version bump/sync
└── validate-manifests.sh      # CI parity check
```

## Releasing

Two independent version lines:

- **Marketplace plugins** (Claude / Codex / Cursor / Factory / GitHub / Gemini manifests) track `VERSION`.
- **opencode npm packages** (`@xberg-io/opencode-*`) track `OPENCODE_VERSION` and publish to npm.

`bump-version.sh` writes the version file and every manifest in that group when given a version. Without a version, it syncs the group's manifests from its source-of-truth version file. `validate-manifests.sh` checks both groups.

```bash
scripts/bump-version.sh 0.2.3                    # marketplace plugins (default group)
scripts/bump-version.sh --group opencode 0.1.1   # opencode npm packages
scripts/bump-version.sh --group opencode         # resync from OPENCODE_VERSION
scripts/validate-manifests.sh
git commit -am "chore: release"
git tag vX.Y.Z && git push --tags
```

The opencode packages publish from `.github/workflows/publish.yaml` (npm Trusted Publishing, with provenance) when a GitHub release is published. The first release was done locally with `scripts/publish-opencode.sh`.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on adding skills, testing locally, and bumping versions.

## Security

Report security vulnerabilities privately at [SECURITY.md](SECURITY.md). Do not open public issues for security concerns.

## FAQ

**Can I use just one plugin?**

Yes. `/plugin install xberg@xberg` installs only xberg.

**Do skills consume context?**

Only when triggered. Skill descriptions load at startup (~300 tokens total) but stay in context. They consume zero tokens unless the agent decides to invoke the MCP tools.

**Can I customize a skill locally?**

Yes. Fork the repo, edit the skill SKILL.md, and use `/plugin marketplace add <local-path>` to self-host your version.

**How do I report a broken skill?**

Open an issue at [xberg-io/plugins](https://github.com/xberg-io/plugins/issues) with the plugin name, agent harness, and exact request that failed.

## License

MIT. See [LICENSE](LICENSE).

## Part of Xberg.dev

- [Xberg](https://github.com/xberg-io/xberg) — document intelligence: text, tables, metadata from 91+ formats with optional OCR.
- [Xberg Enterprise](https://github.com/xberg-io/xberg-enterprise) — managed extraction API with SDKs, dashboards, and observability.
- [crawlberg](https://github.com/xberg-io/crawlberg) — web crawling and scraping with HTML→Markdown and headless-Chrome fallback.
- [html-to-markdown](https://github.com/xberg-io/html-to-markdown) — fast, lossless HTML→Markdown engine.
- [liter-llm](https://github.com/xberg-io/liter-llm) — universal LLM API client with native bindings for 14 languages and 143 providers.
- [tree-sitter-language-pack](https://github.com/xberg-io/tree-sitter-language-pack) — tree-sitter grammars and code-intelligence primitives.
- [alef](https://github.com/xberg-io/alef) — the polyglot binding generator that produces every per-language binding across the 5 polyglot repos.
