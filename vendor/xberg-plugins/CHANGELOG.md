# Changelog

All notable changes to Xberg Plugins are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

- **xberg-enterprise** plugin and its skills

## [0.2.2] - 2026-06-20

### Changed

- Switch the repo to **pnpm** workspaces (`pnpm-workspace.yaml` + `pnpm-lock.yaml`); upgrade dependencies to latest; CI installs/publishes via pnpm.
- Align `.pre-commit-config.yaml` with the shared `xberg-io/pre-commit-hooks` set (adds actionlint, shebang checks, `gh-actions-updater`, and `typos`); repo lints clean.

## [0.2.1] - 2026-06-20

### Fixed

- Scope the cli-proxy npm packages to `@xberg-io/<tool>-cli` (npx); update the MCP launchers and install docs accordingly. PyPI/uvx names stay flat (`<tool>-cli`).

## [0.2.0] - 2026-06-20

### Added

- **html-to-markdown** plugin: fast, lossless HTML→Markdown with metadata, tables, and document-structure extraction
- **liter-llm** plugin: universal LLM API client for 143 providers (chat, streaming, tools, embeddings, search, OCR) plus an OpenAI-compatible proxy and an MCP server
- **tree-sitter-language-pack** plugin: parse and extract code intelligence from 300+ languages (structure, imports, symbols, syntax-aware chunking)
- Auto-installing MCP launchers (existing binary → npx → uvx → brew → checksum-verified prebuilt download) for xberg, crawlberg, and liter-llm; CLI/MCP wiring for html-to-markdown and tree-sitter-language-pack
- New skills — xberg: `chunking`, `batch-extraction`, `extracting-keywords`; crawlberg: `mapping-urls`, `automating-the-browser`, `serving-the-api`; xberg-enterprise: `versioning-documents`
- `<tool>-cli` npm/PyPI proxy packages so `npx <tool>-cli` / `uvx <tool>-cli` install and run each CLI

### Changed

- Standardized skill conventions, frontmatter, README structure, and manifest capabilities across all plugins (documented in CONTRIBUTING.md)
- Corrected install documentation to the real channels (brew tap, npx/uvx, prebuilt release binaries)

## [0.1.0] - 2026-06-08

### Added

- **xberg** plugin: local document extraction (PDF, Office, images with OCR, HTML, email, archives, academic; 91+ formats)
- **crawlberg** plugin: web crawling and scraping with HTML→Markdown and headless-Chrome fallback
- **xberg-enterprise** plugin: managed extraction API (skills-only)
- Multi-harness support: Claude Code, Codex CLI, Cursor, Gemini CLI, Factory Droid, GitHub Copilot CLI, opencode
- Skill-based agent integration with automatic tool loading
- Marketplace registration for official Claude Code and Factory Droid (pending review)
- Self-hosted marketplace for all harnesses
- Contributing guidelines and security policy

[Unreleased]: https://github.com/xberg-io/plugins/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/xberg-io/plugins/releases/tag/v0.1.0
