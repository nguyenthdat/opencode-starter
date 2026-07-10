# liter-llm

Universal LLM client for Gemini CLI sessions. One interface to 143 providers
(OpenAI, Anthropic, Google Gemini, Groq, Mistral, Cohere, AWS Bedrock, Azure,
and more) for chat, streaming, tool calling, embeddings, image generation,
audio, moderation, web search, OCR, and reranking. Native bindings exist for 14
languages; routing is by `provider/model` prefix.

## How this plugin works

Installing the extension auto-registers a Model Context Protocol server. Its
command is the bundled launcher `scripts/mcp-launch.sh`, which runs
`liter-llm mcp --transport stdio`. The launcher resolves a `liter-llm` binary on
first run: it prefers one already on `PATH`, then tries `npx`/`uvx`, then
Homebrew, then downloads a checksum-verified prebuilt binary from the tool's
latest GitHub release. You get one
MCP server named `liter-llm` exposing 22 tools that mirror the proxy's REST
endpoints (`chat`, `embed`, `generate_image`, `speech`, `transcribe`,
`moderate`, `rerank`, `search`, `ocr`, `list_models`, plus file, batch, and
Responses API operations).

Prefer the MCP tools when available. To run code against the SDK instead, the
binding for your language installs separately:

```bash
# the CLI (proxy + MCP server):
brew install xberg-io/tap/liter-llm   # or: npx @xberg-io/liter-llm-cli / uvx --from liter-llm-cli liter-llm
# language SDKs/bindings (libraries, not the CLI):
pip install liter-llm                      # Python binding
pnpm add @xberg-io/liter-llm               # Node.js binding
```

## Skills in this plugin

Discovery is via `skills/`. Use the skill descriptions to route the user's
intent:

- `liter-llm/SKILL.md` — full surface across the SDK, proxy, and MCP server.
  Use when writing LLM code in any supported language or choosing an integration.
- `calling-llms/SKILL.md` — chat completions and `provider/model` routing.
- `streaming-responses/SKILL.md` — token streaming over SSE / async iterators.
- `tool-calling/SKILL.md` — function definitions and structured outputs.
- `embeddings-and-search/SKILL.md` — embeddings plus the search and OCR providers.
- `running-the-proxy/SKILL.md` — the `liter-llm api` OpenAI-compatible gateway.
- `using-the-mcp-server/SKILL.md` — the 22 MCP tools and when to prefer them.

## Working with the user

State which tool or command you will run before running it. Never hardcode API
keys — read them from environment variables (`OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, etc.). When configuration gets non-trivial, prefer a
`liter-llm.toml` (SDK) or `liter-llm-proxy.toml` (proxy) over long flag chains;
both auto-discover from the cwd upward.

For installation instructions across other agents and the marketplace, see the
[plugins repo README](https://github.com/xberg-io/plugins).
