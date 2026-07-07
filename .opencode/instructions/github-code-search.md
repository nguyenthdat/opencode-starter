# GitHub Code Search

When the user asks to search for code on GitHub — such as finding functions, classes, symbols, implementations, examples, or patterns across repositories — you MUST use the GitHub MCP server's `search_code` tool instead of webfetch, Exa search, or any other web fetching tool.

The GitHub MCP `search_code` tool directly queries GitHub's native code search engine and supports qualifiers like `repo:`, `org:`, `user:`, `language:`, `path:`, `extension:`, `filename:`, etc. This is always more precise and efficient than fetching web pages.

Do NOT use webfetch, crawlberg_scrape, or exa_web_search_exa for GitHub code search tasks. Use `github_search_code` instead.
