import { tool } from "@opencode-ai/plugin";
import {
  pushFlag,
  pushOption,
  resolveReadableFile,
  runCli,
} from "../scripts/opencode-plugin-utils.js";

const schema = tool.schema;

const parseFormat = schema
  .enum(["sexp", "json"])
  .default("sexp")
  .describe("Parse output format.");

const INSTALL_HINT =
  "ts-pack was not found. Install it with `brew install xberg-io/tap/ts-pack`, or use `bunx @xberg-io/ts-pack-cli`.";

function executeTsPack(args, context) {
  return runCli({
    command: "ts-pack",
    args,
    context,
    timeoutMs: 300_000,
    installHint: INSTALL_HINT,
  });
}

export const TreeSitterLanguagePackPlugin = async () => ({
  tool: {
    tspack_parse: tool({
      description:
        "Parse a source file into a tree-sitter syntax tree with the ts-pack CLI.",
      args: {
        file: schema.string().min(1).describe("Path to the source file."),
        language: schema
          .string()
          .min(1)
          .optional()
          .describe(
            "Language override (auto-detected from extension if omitted).",
          ),
        format: parseFormat,
      },
      async execute(args, context) {
        const file = await resolveReadableFile(args.file, context);
        const cliArgs = ["parse", file, "--format", args.format];
        pushOption(cliArgs, "--language", args.language);
        return executeTsPack(cliArgs, context);
      },
    }),
    tspack_process: tool({
      description:
        "Extract code intelligence (structure, imports, exports, symbols, docstrings, comments, diagnostics) from a source file with the ts-pack CLI. Output is JSON.",
      args: {
        file: schema.string().min(1).describe("Path to the source file."),
        language: schema
          .string()
          .min(1)
          .optional()
          .describe(
            "Language override (auto-detected from extension if omitted).",
          ),
        all: schema
          .boolean()
          .optional()
          .describe("Enable all analysis features."),
        structure: schema
          .boolean()
          .optional()
          .describe("Extract structure (functions, classes)."),
        imports: schema.boolean().optional().describe("Extract imports."),
        exports: schema.boolean().optional().describe("Extract exports."),
        comments: schema.boolean().optional().describe("Extract comments."),
        symbols: schema.boolean().optional().describe("Extract symbols."),
        docstrings: schema.boolean().optional().describe("Extract docstrings."),
        diagnostics: schema
          .boolean()
          .optional()
          .describe("Include syntax diagnostics."),
        chunk_size: schema
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Maximum chunk size in bytes (enables syntax-aware chunking).",
          ),
      },
      async execute(args, context) {
        const file = await resolveReadableFile(args.file, context);
        const cliArgs = ["process", file];
        pushOption(cliArgs, "--language", args.language);
        pushFlag(cliArgs, "--all", args.all);
        pushFlag(cliArgs, "--structure", args.structure);
        pushFlag(cliArgs, "--imports", args.imports);
        pushFlag(cliArgs, "--exports", args.exports);
        pushFlag(cliArgs, "--comments", args.comments);
        pushFlag(cliArgs, "--symbols", args.symbols);
        pushFlag(cliArgs, "--docstrings", args.docstrings);
        pushFlag(cliArgs, "--diagnostics", args.diagnostics);
        pushOption(cliArgs, "--chunk-size", args.chunk_size);
        return executeTsPack(cliArgs, context);
      },
    }),
    tspack_info: tool({
      description:
        "Show details about a language (whether it is known and cached) with the ts-pack CLI. Use to confirm a language is supported before parsing.",
      args: {
        language: schema
          .string()
          .min(1)
          .describe("Language name (e.g. python, rust, typescript)."),
      },
      async execute(args, context) {
        return executeTsPack(["info", args.language], context);
      },
    }),
  },
});

export default TreeSitterLanguagePackPlugin;
