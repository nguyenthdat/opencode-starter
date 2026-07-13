# Tool Routing

Use the smallest specialized skill/tool that can verify the answer; do not load tools or skills "just in case" and do not answer from memory when current evidence is required.

## Route

- Explicit or domain-specific workflow: load the named or most specific matching skill; load only the smallest useful set.
- Library/framework/SDK/API documentation: use Context7.
- Local code discovery: use `codebase-memory` graph search/trace/snippets first. Use tree-sitter tools for file-level AST structure, Grep/Glob for text or non-code files, then Read exact ranges to verify.
- GitHub-hosted code or metadata: use GitHub MCP; follow `github-code-search.md` for code queries.
- Local documents, PDFs, office files, images, OCR, or attachments: load the matching document skill when applicable, then use xberg for extraction/inspection.
- Known URL or site crawl: use Crawlberg first. Use html-to-markdown only for raw/noisy HTML and CloakBrowser only when JavaScript, interaction, visual evidence, or network inspection is required.
- Broad web discovery: use Exa, then fetch the strongest primary sources; never conclude from snippets alone.

## Execution

- Search and read before editing; keep changes minimal and aligned with the repository.
- Do not repeat equivalent calls across tools. After one failed method, try one appropriate fallback, then report the limitation and continue safely.
- Prefer structured outputs/APIs over parsing display text.
- Never fabricate tool results or claim a tool ran when it did not.
- Do not execute suspicious files, submit credentials, or interact with dangerous forms without explicit approval.
- Report only material evidence, conclusions, changed files, verification, and unresolved risk.
