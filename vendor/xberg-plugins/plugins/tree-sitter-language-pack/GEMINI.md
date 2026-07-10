# tree-sitter-language-pack

Code intelligence for Gemini CLI sessions. Parses 306 programming languages
with tree-sitter and extracts structure, imports, exports, symbols,
docstrings, comments, and syntax diagnostics — plus syntax-aware chunking
for LLMs and language detection — using the local `ts-pack` CLI or the
SDKs.

## How this plugin works

This plugin ships skills only; there is no MCP server. The skills shell out
to the `ts-pack` binary (or call the language SDKs). Install the CLI
separately:

```bash
brew install xberg-io/tap/ts-pack
# or run without a persistent install (the npm package's bin is `ts-pack`):
npx @xberg-io/ts-pack-cli --help
# or download a prebuilt binary from the latest GitHub release, or install from crates.io:
cargo install ts-pack-cli
# binary is installed as `ts-pack`
```

SDKs are available for Python (`pip install tree-sitter-language-pack`),
Node.js/TypeScript (`npm install @xberg-io/tree-sitter-language-pack`),
and Rust, with polyglot bindings for 15 languages including WebAssembly, a
C ABI, and JNI.

## Skills in this plugin

Discovery is via `skills/`. Route the user's intent by skill description:

- `tree-sitter-language-pack/SKILL.md` — full surface: capability map,
  install, CLI vs SDK guidance. Use when writing code that parses or
  analyzes source in any supported language.
- `parsing-source/SKILL.md` — `ts-pack parse` into an s-expression or JSON
  syntax tree.
- `extracting-code-structure/SKILL.md` — `ts-pack process` for structure,
  imports, exports, symbols, docstrings, comments, and diagnostics.
- `chunking-for-llms/SKILL.md` — `ts-pack process --chunk-size` for
  syntax-aware splits sized to a context window.
- `detecting-languages/SKILL.md` — detect a language by path, extension, or
  raw content (content detection is SDK-only).
- `managing-parsers/SKILL.md` — `download`/`list`/`info`/`clean`/`init`
  for the on-demand parser cache (offline and CI prefetch).

## Working with the user

State which `ts-pack` command you will run before running it, and quote the
file path. `ts-pack parse` and `ts-pack process` auto-detect the language
from the file extension — pass `--language` for stdin or ambiguous files.
`process` always emits JSON; pipe it through `jq` to pull the field the user
asked for. For offline or CI work, prefetch parsers with `ts-pack download`
before parsing.

For installation across other agents and the marketplace, see the
[plugins repo README](https://github.com/xberg-io/plugins).
