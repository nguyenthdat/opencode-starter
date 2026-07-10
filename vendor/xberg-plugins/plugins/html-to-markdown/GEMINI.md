# html-to-markdown

Fast, lossless HTML→Markdown conversion for Gemini CLI sessions. Converts HTML
to Markdown, Djot, or plain text and extracts structured metadata (title, OG
tags, JSON-LD, headers, links, images), GFM tables, inline images, and a
document-structure tree using the local `html-to-markdown` CLI.

## How this plugin works

This plugin ships skills only — there is no MCP server. Skills shell out to the
`html-to-markdown` binary (flags only, no subcommands) or call the language
SDKs (Rust, Python, TypeScript, Go, Ruby, PHP, Java, C#, Elixir, R, C, WASM).

The CLI must be installed separately:

```bash
brew install xberg-io/tap/html-to-markdown
# or run without a persistent install (self-installs the binary):
npx @xberg-io/html-to-markdown-cli --help
uvx --from html-to-markdown html-to-markdown --help
# or build from source:
cargo install html-to-markdown-cli
```

## Skills in this plugin

Discovery is via `skills/`. Use the skill descriptions to route the user's
intent:

- `html-to-markdown/SKILL.md` — full surface across CLI and 12 language
  bindings. Use when writing conversion code in any supported language.
- `converting-html/SKILL.md` — core conversion: output formats (markdown /
  djot / plain), heading and code-block styles, preprocessing.
- `extracting-metadata/SKILL.md` — title, OG, JSON-LD, headers, links, images,
  language from HTML via `--json`.
- `extracting-tables/SKILL.md` — GFM tables and structured cell grids.
- `fetching-and-converting-urls/SKILL.md` — `--url` fetch-and-convert and the
  `--json` output shape.

## When to use html-to-markdown

- **html-to-markdown** — you already have HTML (a string, file, or single URL)
  and want clean Markdown plus structured extraction.
- **xberg** — you have documents (PDF, Office, images) and need full
  extraction with OCR.
- **crawlberg** — you need to crawl or scrape many pages with headless-Chrome
  fallback.

## Working with the user

State which CLI command you will run before running it. Quote file paths. Use
`--json` when the user needs metadata or tables rather than plain Markdown; use
plain output (no `--json`) when they just want the Markdown text.

For installation across other agents and the marketplace, see the
[plugins repo README](https://github.com/xberg-io/plugins).
