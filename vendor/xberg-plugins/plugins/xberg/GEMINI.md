# xberg

Local document intelligence for Gemini CLI sessions. Extracts text, tables,
metadata, and images from 91+ formats (PDF, Office, images, HTML, email,
archives, academic) using the local `xberg` CLI. OCR is built in via
Tesseract; PaddleOCR, EasyOCR, and VLM backends are opt-in.

## How this plugin works

Installing the extension auto-registers a Model Context Protocol server that
runs `xberg mcp --transport stdio`. You get one MCP server named
`xberg` with tools for single-file extraction, batch extraction, MIME
detection, and cache management. Prefer those MCP tools when available; fall
back to shelling out to the `xberg` binary directly when the server is
unreachable.

The CLI must be installed separately:

```bash
brew install xberg-io/tap/xberg
# or run it without a persistent install (self-installs the binary):
npx @xberg-io/xberg-cli --help
uvx --from xberg-cli xberg --help
# or download a prebuilt binary from the latest GitHub release, or build from source:
cargo install xberg-cli
```

## Skills in this plugin

Discovery is via `skills/`. Use the skill descriptions to route the user's
intent:

- `xberg/SKILL.md` — full Xberg surface across CLI, Python, Node, Rust.
  Use when writing extraction code in any supported language.
- `extracting-with-ocr/SKILL.md` — scanned PDFs and images. Covers backends,
  language packs, `--force-ocr`.
- `extracting-tables/SKILL.md` — tabular extraction (layout models, output
  shapes, known limits).
- `picking-a-format/SKILL.md` — choose between `text`, `markdown`, `json`,
  `djot`, or `html` for the downstream consumer.

## Working with the user

State which CLI command you will run before running it. Quote the file path.
When configuration gets non-trivial, prefer a `xberg.toml` over long flag
chains — Xberg auto-discovers it in the cwd and parents.

For installation instructions across other agents and the marketplace, see
the [plugins repo README](https://github.com/xberg-io/plugins).
