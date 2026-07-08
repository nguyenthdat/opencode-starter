# Plugin Routing Rules

## Core Principle

When a task can be handled by an installed OpenCode plugin/tool, use the plugin/tool before answering from memory.

Do not say a capability is unsupported until you have checked whether an available plugin/tool can perform the task.

## Xberg

Use `@xberg-io/opencode-xberg` for document, image, OCR, PDF, screenshot, file extraction, and content analysis tasks.

Trigger examples:
- User attaches an image and asks to analyze it.
- User asks to extract text from screenshot/image/PDF.
- User asks to inspect a local file.
- User asks to convert or understand visual/file content.

Required behavior:
1. If the user provides an image/file path, pass that path to xberg first.
2. Extract visible text, metadata, layout, or OCR content when relevant.
3. Base the answer on extracted evidence.
4. If extraction fails, report the failure and ask for a valid path or file.

Never respond with “I cannot view images” when xberg is available and the user provided an image or file path.

## Crawlberg

Use `@xberg-io/opencode-crawlberg` for web crawling, scraping, URL investigation, webpage extraction, and multi-page research.

Trigger examples:
- User asks to analyze a URL.
- User asks to crawl a website.
- User asks to extract page content.
- User asks to investigate phishing pages, redirects, login forms, or suspicious domains.

Required behavior:
1. Crawl/fetch the URL with crawlberg first.
2. Capture page title, text, links, redirects, forms, scripts, screenshots if available.
3. For security tasks, preserve evidence and avoid interacting with dangerous forms unless explicitly approved.
4. Summarize findings with source URLs.

## HTML to Markdown

Use `@xberg-io/opencode-html-to-markdown` when HTML content needs to be read, cleaned, summarized, indexed, or passed to another agent/model.

Trigger examples:
- Raw HTML is provided.
- Crawlberg returns HTML.
- User asks to convert webpage content to markdown.
- User asks to summarize a webpage cleanly.

Required behavior:
1. Convert HTML to markdown before summarizing when the raw HTML is noisy.
2. Preserve headings, links, tables, code blocks, and meaningful structure.
3. Remove navigation/footer boilerplate when it is clearly irrelevant.

## Tree-sitter Language Pack

Use `@xberg-io/opencode-tree-sitter-language-pack` for code parsing, symbol extraction, AST-aware search, code structure analysis, and language-aware refactoring.

Trigger examples:
- User asks to inspect code structure.
- User asks to find functions/classes/imports/usages.
- User asks to refactor safely.
- User asks to analyze unfamiliar languages.

Required behavior:
1. Prefer tree-sitter parsing over regex for code structure.
2. Use AST/symbol results to locate definitions and references.
3. Use regex only for simple text search or when tree-sitter cannot parse the file.
4. Explain findings using file paths and symbol names.

## Priority Order

For image/file analysis:
1. xberg
2. native file reading tools
3. ask user for a valid path/file

For web/page analysis:
1. crawlberg
2. html-to-markdown
3. normal fetch/browser fallback

For code understanding:
1. ripgrep for fast discovery
2. tree-sitter for structure
3. direct file reads for final verification

## Failure Handling

If a plugin/tool is missing, unavailable, or fails:
- State the exact blocker briefly.
- Use the next best available method.
- Do not pretend the plugin was used.
