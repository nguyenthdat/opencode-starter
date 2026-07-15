import { tool } from "@opencode-ai/plugin";
import {
  assertHttpUrl,
  pushFlag,
  pushOption,
  requireExactlyOne,
  resolveReadableFile,
  runCli,
} from "../src/utils/opencode-plugin-utils.js";

const schema = tool.schema;

const headingStyle = schema
  .enum(["atx", "underlined", "atx-closed"])
  .optional()
  .describe("Markdown heading style. Default: atx.");

const codeBlockStyle = schema
  .enum(["backticks", "indented", "tildes"])
  .optional()
  .describe("Code block fence style. Default: backticks.");

const outputFormat = schema
  .enum(["markdown", "djot", "plain"])
  .optional()
  .describe("Output markup format. Default: markdown.");

const preset = schema
  .enum(["minimal", "standard", "aggressive"])
  .optional()
  .describe(
    "Preprocessing aggressiveness. Requires `preprocess`. Default: standard.",
  );

const INSTALL_HINT =
  "html-to-markdown was not found. Install it with `brew install xberg-io/tap/html-to-markdown`, or use `bunx @xberg-io/html-to-markdown-cli` / `uvx --from html-to-markdown-cli html-to-markdown`.";

function executeHtmlToMarkdown(args, context, stdin) {
  return runCli({
    command: "html-to-markdown",
    args,
    context,
    stdin,
    timeoutMs: 300_000,
    installHint: INSTALL_HINT,
    title: "html-to-markdown",
  });
}

function styleArgs(args, params) {
  if (params.preset && params.preprocess !== true) {
    throw new Error("`preset` requires `preprocess: true`");
  }
  pushOption(args, "--heading-style", params.heading_style);
  pushOption(args, "--code-block-style", params.code_block_style);
  pushOption(args, "--output-format", params.output_format);
  pushFlag(args, "--preprocess", params.preprocess);
  pushOption(args, "--preset", params.preset);
}

export const HtmlToMarkdownPlugin = async () => ({
  tool: {
    html_to_markdown_convert: tool({
      description:
        "Convert an HTML file or HTML string to Markdown (or Djot) with the html-to-markdown CLI. Provide either `path` or `html`.",
      args: {
        path: schema
          .string()
          .min(1)
          .optional()
          .describe("Path to a local HTML file."),
        html: schema
          .string()
          .min(1)
          .optional()
          .describe("Inline HTML to convert (used when `path` is omitted)."),
        heading_style: headingStyle,
        code_block_style: codeBlockStyle,
        output_format: outputFormat,
        preprocess: schema
          .boolean()
          .optional()
          .describe("Strip navigation, ads, and forms before converting."),
        preset,
      },
      async execute(args, context) {
        const source = requireExactlyOne(args, ["path", "html"]);
        const cliArgs = [];
        styleArgs(cliArgs, args);

        if (source === "path") {
          cliArgs.push(await resolveReadableFile(args.path, context));
          return executeHtmlToMarkdown(cliArgs, context);
        }
        return executeHtmlToMarkdown(cliArgs, context, args.html);
      },
    }),
    html_to_markdown_fetch_url: tool({
      description:
        "Fetch a URL and convert its HTML to Markdown (or Djot) with the html-to-markdown CLI.",
      args: {
        url: schema
          .string()
          .url()
          .describe("HTTP(S) URL to fetch and convert."),
        heading_style: headingStyle,
        code_block_style: codeBlockStyle,
        output_format: outputFormat,
        preprocess: schema
          .boolean()
          .optional()
          .describe("Strip navigation, ads, and forms before converting."),
        preset,
        user_agent: schema
          .string()
          .min(1)
          .optional()
          .describe("Custom User-Agent header for the fetch."),
      },
      async execute(args, context) {
        const cliArgs = ["--url", assertHttpUrl(args.url)];
        pushOption(cliArgs, "--user-agent", args.user_agent);
        styleArgs(cliArgs, args);
        return executeHtmlToMarkdown(cliArgs, context);
      },
    }),
    html_to_markdown_extract: tool({
      description:
        "Extract structured metadata, tables, and (optionally) document structure from HTML as JSON. Returns the full ConversionResult. Provide `path`, `html`, or `url`.",
      args: {
        path: schema
          .string()
          .min(1)
          .optional()
          .describe("Path to a local HTML file."),
        html: schema
          .string()
          .min(1)
          .optional()
          .describe(
            "Inline HTML to analyze (used when `path` and `url` are omitted).",
          ),
        url: schema
          .string()
          .url()
          .optional()
          .describe("URL to fetch and analyze."),
        include_structure: schema
          .boolean()
          .optional()
          .describe("Include the document structure tree in the JSON output."),
        no_content: schema
          .boolean()
          .optional()
          .describe(
            "Suppress the Markdown content field — return metadata/tables/images only.",
          ),
      },
      async execute(args, context) {
        const source = requireExactlyOne(args, ["path", "html", "url"]);
        const cliArgs = ["--json"];
        pushFlag(cliArgs, "--include-structure", args.include_structure);
        pushFlag(cliArgs, "--no-content", args.no_content);

        if (source === "url") {
          cliArgs.push("--url", assertHttpUrl(args.url));
          return executeHtmlToMarkdown(cliArgs, context);
        }
        if (source === "path") {
          cliArgs.push(await resolveReadableFile(args.path, context));
          return executeHtmlToMarkdown(cliArgs, context);
        }
        return executeHtmlToMarkdown(cliArgs, context, args.html);
      },
    }),
  },
});

export default HtmlToMarkdownPlugin;
