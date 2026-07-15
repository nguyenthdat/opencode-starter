import { tool } from "@opencode-ai/plugin";
import {
  pushOption,
  resolveReadableFile,
  runCli,
  validateJsonObject,
} from "../src/utils/opencode-plugin-utils.js";

const schema = tool.schema;

const wireFormat = schema
  .enum(["text", "json", "toon"])
  .default("json")
  .describe("CLI output format.");

const contentFormat = schema
  .enum(["plain", "markdown", "djot", "html", "json"])
  .optional()
  .describe("Document content rendering format.");

const INSTALL_HINT =
  "xberg was not found. Install it with `brew install xberg-io/tap/xberg`, or use `bunx @xberg-io/xberg-cli` / `uvx --from xberg-cli xberg`.";

function executeXberg(args, context) {
  return runCli({
    command: "xberg",
    args,
    context,
    timeoutMs: 600_000,
    installHint: INSTALL_HINT,
  });
}

export const XbergPlugin = async () => ({
  tool: {
    xberg_extract: tool({
      description:
        "Extract text, tables, metadata, and images from a local document with the xberg CLI.",
      args: {
        path: schema.string().min(1).describe("Path to the local document."),
        format: wireFormat,
        content_format: contentFormat,
        mime_type: schema
          .string()
          .min(1)
          .optional()
          .describe("Optional MIME type hint."),
        config_json: schema
          .string()
          .min(2)
          .optional()
          .describe("Optional ExtractionConfig JSON."),
      },
      async execute(args, context) {
        validateJsonObject(args.config_json, "config_json");
        const path = await resolveReadableFile(args.path, context);

        const cliArgs = ["extract", path, "--format", args.format];
        pushOption(cliArgs, "--content-format", args.content_format);
        pushOption(cliArgs, "--mime-type", args.mime_type);
        pushOption(cliArgs, "--config-json", args.config_json);

        return executeXberg(cliArgs, context);
      },
    }),
    xberg_detect: tool({
      description: "Detect the MIME type for a local file with the xberg CLI.",
      args: {
        path: schema.string().min(1).describe("Path to the local file."),
        format: wireFormat,
      },
      async execute(args, context) {
        const path = await resolveReadableFile(args.path, context);
        return executeXberg(["detect", path, "--format", args.format], context);
      },
    }),
    xberg_formats: tool({
      description: "List document formats supported by the xberg CLI.",
      args: {
        format: wireFormat,
      },
      async execute(args, context) {
        return executeXberg(["formats", "--format", args.format], context);
      },
    }),
  },
});

export default XbergPlugin;
