import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const plugins = [
  {
    path: "plugins/xberg/.opencode/plugins/xberg.js",
    exportName: "XbergPlugin",
    tools: ["xberg_extract", "xberg_detect", "xberg_formats"],
  },
  {
    path: "plugins/crawlberg/.opencode/plugins/crawlberg.js",
    exportName: "CrawlbergPlugin",
    tools: ["crawlberg_scrape", "crawlberg_crawl", "crawlberg_map"],
  },
  {
    path: "plugins/html-to-markdown/.opencode/plugins/html-to-markdown.js",
    exportName: "HtmlToMarkdownPlugin",
    tools: ["html_to_markdown_convert", "html_to_markdown_fetch_url", "html_to_markdown_extract"],
  },
  {
    path: "plugins/tree-sitter-language-pack/.opencode/plugins/tree-sitter-language-pack.js",
    exportName: "TreeSitterLanguagePackPlugin",
    tools: ["tspack_parse", "tspack_process", "tspack_info"],
  },
];

for (const plugin of plugins) {
  const moduleUrl = pathToFileURL(resolve(root, plugin.path));
  const mod = await import(moduleUrl.href);
  const factory = mod.default ?? mod[plugin.exportName];

  if (typeof factory !== "function") {
    throw new Error(`${plugin.path} does not export a plugin function`);
  }

  const hooks = await factory({});
  const tools = hooks?.tool ?? {};
  const actual = Object.keys(tools).sort();
  const expected = plugin.tools.toSorted();

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${plugin.path} tools ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
    );
  }

  for (const name of expected) {
    if (typeof tools[name]?.execute !== "function") {
      throw new Error(`${plugin.path} tool ${name} is missing an execute function`);
    }
  }
}

console.log(`validate-opencode: ${plugins.length} entrypoints import cleanly`);
