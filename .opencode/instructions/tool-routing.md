# Plugin Routing Rules

## Core Principle

When a task can be handled by an installed OpenCode plugin, MCP, tool, or dynamically loadable skill, use that capability before answering from memory.

Do not claim a capability is unsupported until you have checked whether an available plugin, MCP, tool, or dynamic skill can perform the task.

Prefer evidence-based execution over guessing.

---

## Dynamic Skill Loading

Use the `dynamic-skill-loading` plugin whenever a task may benefit from a specialized skill that is not already loaded in context.

Trigger examples:
- User asks to create, edit, optimize, or review a harness.
- User asks to create, edit, optimize, or review an OpenCode skill.
- User asks to create, edit, optimize, or review an MCP server.
- User asks for coding work that may require a language/framework-specific skill.
- User asks for security analysis, phishing investigation, SOC workflow, threat hunting, or report generation.
- User asks for document/report generation, DOCX templates, PDF handling, or structured deliverables.
- User asks for UX/UI, software architecture, API design, testing, refactoring, or code review.
- The current task mentions a known skill name, skill folder, harness path, team path, or domain-specific workflow.

Required behavior:
1. Search configured skill paths before starting the task.
2. Prefer the most specific matching skill over a generic skill.
3. Load only relevant skills needed for the task.
4. If multiple skills match, load the smallest useful set.
5. Follow the loaded skill instructions before applying general reasoning.
6. If the task is about creating or modifying skills, load the skill-creator skill first.
7. If the task is about creating or modifying harness teams, load the harness skill first.
8. If the task is about creating or modifying MCP servers, load the mcp-builder skill first.
9. If no relevant skill is found, continue with the best available plugin/tool and state that no matching skill was found only when useful.

Default priority:
1. Explicitly referenced skill path or skill name.
2. Project-local skills.
3. Harness/team-specific skills.
4. User-configured external/vendor skills.
5. Global OpenCode skills.
6. General reasoning fallback.

Never manually copy large skill files into context when the dynamic loader can load them.

---

## Xberg

Use `xberg` for document, image, OCR, PDF, screenshot, file extraction, metadata extraction, and visual/content analysis tasks.

Trigger examples:
- User attaches an image and asks to analyze it.
- User asks to extract text from screenshot, image, PDF, DOCX, or local file.
- User asks to inspect a local file path.
- User asks to convert, summarize, or understand visual/file content.
- User provides an OpenCode temp image path.

Required behavior:
1. If the user provides an image/file path, pass that path to xberg first.
2. Extract visible text, metadata, layout, OCR content, tables, links, and embedded file information when relevant.
3. Base the answer on extracted evidence.
4. If extraction fails, state the exact failure briefly and ask for a valid path/file only if no fallback exists.
5. For security-sensitive files, avoid executing content. Extract and inspect only.

Never respond with “I cannot view images” when xberg is available and the user provided an image or file path.

---

## Crawlberg

Use `crawlberg` for web crawling, scraping, URL investigation, webpage extraction, redirect analysis, and multi-page research.

Trigger examples:
- User asks to analyze a URL.
- User asks to crawl a website.
- User asks to extract page content.
- User asks to investigate phishing pages, redirects, login forms, suspicious domains, or brand abuse.
- User asks for webpage evidence, screenshots, forms, scripts, links, or page text.

Required behavior:
1. Crawl/fetch the URL with crawlberg first.
2. Capture page title, final URL, status code, redirects, visible text, links, forms, scripts, screenshots, and relevant metadata if available.
3. For security tasks, preserve evidence and avoid interacting with dangerous forms unless explicitly approved.
4. Do not submit credentials, tokens, personal data, or payloads into forms.
5. Summarize findings with source URLs and evidence.
6. For phishing or malicious URL analysis, include verdict, confidence, and recommended next steps.

---

## HTML to Markdown

Use `html-to-markdown` when HTML content needs to be cleaned, read, summarized, indexed, searched, or passed to another agent/model.

Trigger examples:
- Raw HTML is provided.
- Crawlberg returns noisy HTML.
- User asks to convert webpage content to Markdown.
- User asks to summarize a webpage cleanly.
- User asks to preserve readable structure from crawled content.

Required behavior:
1. Convert HTML to Markdown before summarizing when the raw HTML is noisy.
2. Preserve headings, links, tables, code blocks, lists, and meaningful structure.
3. Remove navigation, cookie banners, ads, repeated menus, and footer boilerplate when clearly irrelevant.
4. Keep source URLs attached to extracted content where possible.
5. Do not discard forms, scripts, or hidden fields when doing security analysis.

---

## Tree-sitter Language Pack

Use `tree-sitter-language-pack` for code parsing, symbol extraction, AST-aware search, code structure analysis, language-aware refactoring, and safe code navigation.

Trigger examples:
- User asks to inspect code structure.
- User asks to find functions, classes, imports, exports, interfaces, structs, traits, usages, or references.
- User asks to refactor safely.
- User asks to analyze unfamiliar or mixed-language code.
- User asks to understand architecture from source files.

Required behavior:
1. Prefer tree-sitter parsing over regex for structural code analysis.
2. Use AST/symbol results to locate definitions and references.
3. Use regex only for simple text search or when tree-sitter cannot parse the file.
4. Verify important findings by reading the exact file ranges.
5. Explain findings using file paths, symbol names, and relevant relationships.
6. For refactoring, identify affected symbols before editing.

---

## Code Search and Repository Inspection

For code understanding:
1. Use `ripgrep` for fast discovery.
2. Use `tree-sitter-language-pack` for structure.
3. Use direct file reads for final verification.
4. Use GitHub MCP for GitHub code search instead of generic web fetch when available.
5. Use dynamic skill loading when the language, framework, or domain has a matching skill.

Required behavior:
1. Search before editing.
2. Read before modifying.
3. Prefer AST-aware changes for non-trivial refactors.
4. Avoid broad regex rewrites unless the affected scope is proven safe.
5. Keep changes minimal and aligned with existing style.

---

## Priority Order

### Skill-aware tasks

1. Explicitly referenced skill.
2. Dynamic skill loading plugin.
3. Relevant plugin/MCP/tool.
4. Native file/code/web tooling.
5. General reasoning fallback.

### Image/file analysis

1. Dynamic skill loading if a relevant document/security/report skill exists.
2. Xberg.
3. Native file reading tools.
4. Ask user for a valid path/file only when no usable input exists.

### Web/page analysis

1. Dynamic skill loading if the task is domain-specific.
2. Crawlberg.
3. html-to-markdown.
4. Browser/fetch fallback.
5. General reasoning fallback.

### Code understanding

1. Dynamic skill loading for language/framework/domain-specific rules.
2. ripgrep for discovery.
3. tree-sitter-language-pack for structure.
4. Direct file reads for verification.
5. Manual reasoning fallback.

---

## Failure Handling

If a plugin, MCP, tool, or dynamic skill is missing, unavailable, misconfigured, or fails:

1. State the exact blocker briefly.
2. Use the next best available method.
3. Do not pretend the plugin/tool/skill was used.
4. Do not stop unless the task truly cannot continue.
5. If the task can continue partially, continue and clearly mark what was not verified.
6. If user input is invalid, explain what input is needed.

Never hide tool failure behind generic statements like “unsupported” or “not possible.”

---

## Anti-Patterns

Do not:
- Answer from memory when a relevant plugin/tool/skill is available.
- Claim images/files cannot be read when xberg can process the provided path.
- Use regex for structural code analysis when tree-sitter is available.
- Use generic fetch for GitHub code search when GitHub MCP is available.
- Summarize noisy HTML before cleaning it when html-to-markdown is available.
- Create harnesses, skills, or MCP servers without loading the relevant builder skill first.
- Load every available skill “just in case.”
- Invent plugin results, file contents, redirects, screenshots, symbols, or scan results.
- Execute suspicious files just to inspect them.
- Interact with phishing forms without explicit approval.

---

## Output Expectations

When a plugin/tool/skill was used, summarize:
- What was checked.
- What evidence was found.
- What conclusion follows.
- What remains uncertain.

For implementation tasks, include:
- Files changed.
- Why the change was made.
- Any assumptions.
- How to test or verify.

For investigation tasks, include:
- Evidence.
- Verdict.
- Confidence.
- Recommended next steps.
