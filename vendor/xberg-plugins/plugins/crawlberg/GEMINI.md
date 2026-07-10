# crawlberg

Web crawling and scraping with HTML→Markdown conversion and a headless-Chrome
fallback. This extension wraps the local `crawlberg` CLI and registers its
MCP server.

## What you get

- `crawlberg scrape <url>` — fetch a single page and render it as clean
  Markdown plus structured metadata.
- `crawlberg crawl <url>` — follow links across a domain, bounded by
  `--depth`, `--max-pages`, and `--concurrent`.
- `crawlberg map <url>` — enumerate URLs from sitemaps and link extraction
  without rendering content.
- `crawlberg interact <url> --actions <json>` — drive a real browser to
  click, type, scroll, and capture the resulting DOM.
- `crawlberg batch-scrape <url...>` / `crawlberg batch-crawl <url...>` —
  scrape or crawl many URLs concurrently.
- `crawlberg download <url>` — download a document and report its file
  metadata.
- `crawlberg citations <input>` — rewrite markdown links as numbered
  citations (`<input>` is markdown text or `@file.md`).
- `crawlberg version` — print the crawlberg version as JSON.
- `crawlberg mcp` — the MCP server (stdio transport) is auto-registered for
  Gemini CLI when this extension is installed. It exposes nine tools: `scrape`,
  `crawl`, `map`, `batch_scrape`, `batch_crawl`, `download`, `interact`,
  `generate_citations`, and `get_version`.
- `crawlberg serve` — Firecrawl-v1-compatible REST API server (`api` feature).

## Prerequisite

The `crawlberg` binary must be on `PATH`. Install one of:

```bash
brew install xberg-io/tap/crawlberg
# or run without a persistent install (self-installs the binary):
npx @xberg-io/crawlberg-cli --help
uvx --from crawlberg-cli crawlberg --help
# or build from source (mcp/api subcommands are non-default features):
cargo install crawlberg-cli --features all
```

## Skills

Reach for the focused skills before invoking the CLI by hand:

- `skills/crawlberg/` — installation, command surface, when to use the MCP
  server.
- `skills/crawling-a-site/` — when the user wants to follow links across a
  domain.
- `skills/scraping-html-to-markdown/` — when the user wants a single page as
  Markdown.
- `skills/headless-fallback/` — when static fetches return empty bodies or
  WAF blocks.

## Notes

- All commands accept `--format markdown` to print raw Markdown instead of
  JSON. Use Markdown when piping to a file the user will read; use JSON when
  programmatic consumers downstream need metadata.
- Use the MCP tools (auto-registered) when available — they save shelling out
  and surface typed errors. Fall back to the CLI for scripting and pipelines.
- Respect `robots.txt` by default with `--respect-robots-txt`. Crawl politely:
  `--rate-limit` defaults to 200 ms per domain.
