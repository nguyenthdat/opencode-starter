# GitHub Code Search Fallback Instructions

When library, framework, SDK, API, CLI, or cloud-service documentation has been searched and still does not contain the needed information, use the GitHub MCP `github_search_code` tool as the next fallback before guessing.

- Search the official repository or organization first when it is known.
- Prefer targeted searches for symbols, config keys, examples, tests, and error messages.
- Use GitHub code results to infer real usage patterns, but treat them as implementation evidence rather than authoritative documentation.
- Mention when an answer relies on code search because documentation was insufficient.
