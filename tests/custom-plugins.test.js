import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import CrawlbergPlugin from "../plugins/crawlberg.js";
import HtmlToMarkdownPlugin from "../plugins/html-to-markdown.js";
import TreeSitterLanguagePackPlugin from "../plugins/tree-sitter-language-pack.js";
import XbergPlugin from "../plugins/xberg.js";
import { runCli } from "@opencode-config/plugin-kit";

let testRoot;
let workspace;
let originalPath;

const fakeCli = `#!/usr/bin/env bun
const mode = process.env.FAKE_CLI_MODE || "ok";
if (mode === "hang") {
  setInterval(() => {}, 1000);
} else if (mode === "flood") {
  process.stdout.write("x".repeat(1024 * 1024));
} else if (mode === "fail") {
  console.error("intentional failure");
  process.exit(7);
} else {
  if (mode === "warning") console.error("non-fatal warning");
  const stdin = await Bun.stdin.text();
  console.log(JSON.stringify({ args: process.argv.slice(2), stdin }));
}
`;

function context(directory = workspace) {
  const approvals = [];
  return {
    directory,
    worktree: directory,
    abort: new AbortController().signal,
    metadata() {},
    approvals,
    async ask(request) {
      approvals.push(request);
    },
  };
}

beforeAll(() => {
  testRoot = mkdtempSync(join(tmpdir(), "opencode-plugins-"));
  workspace = join(testRoot, "workspace");
  const bin = join(testRoot, "bin");
  mkdirSync(workspace, { recursive: true });
  mkdirSync(bin, { recursive: true });
  for (const command of ["crawlberg", "html-to-markdown", "ts-pack", "xberg"]) {
    const path = join(bin, command);
    writeFileSync(path, fakeCli);
    chmodSync(path, 0o755);
  }
  originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath}`;
});

afterEach(() => {
  delete process.env.FAKE_CLI_MODE;
});

afterAll(() => {
  process.env.PATH = originalPath;
  rmSync(testRoot, { recursive: true, force: true });
});

describe("shared CLI runner", () => {
  it("keeps successful stderr out of JSON stdout", async () => {
    process.env.FAKE_CLI_MODE = "warning";
    const hooks = await XbergPlugin();
    const result = await hooks.tool.xberg_formats.execute(
      { format: "json" },
      context(),
    );
    expect(() => JSON.parse(result.output)).not.toThrow();
    expect(result.metadata.stderr).toContain("non-fatal warning");
  });

  it("rejects non-zero exits", async () => {
    process.env.FAKE_CLI_MODE = "fail";
    const hooks = await XbergPlugin();
    await expect(
      hooks.tool.xberg_formats.execute({ format: "json" }, context()),
    ).rejects.toThrow("exit code 7");
  });

  it("enforces timeout and output limits", async () => {
    process.env.FAKE_CLI_MODE = "hang";
    await expect(
      runCli({
        command: "xberg",
        args: ["formats"],
        context: context(),
        timeoutMs: 50,
      }),
    ).rejects.toThrow("timed out");

    process.env.FAKE_CLI_MODE = "flood";
    await expect(
      runCli({
        command: "xberg",
        args: ["formats"],
        context: context(),
        maxOutputBytes: 1024,
      }),
    ).rejects.toThrow("output limit");
  });
});

describe("local file wrappers", () => {
  it("canonicalizes workspace files and requests approval for external files", async () => {
    const local = join(workspace, "local.txt");
    const external = join(testRoot, "external.txt");
    const link = join(workspace, "external-link.txt");
    writeFileSync(local, "local");
    writeFileSync(external, "external");
    symlinkSync(external, link);

    const hooks = await XbergPlugin();
    const localContext = context();
    const localResult = await hooks.tool.xberg_detect.execute(
      { path: "local.txt", format: "json" },
      localContext,
    );
    expect(JSON.parse(localResult.output).args).toContain(realpathSync(local));
    expect(localContext.approvals).toHaveLength(0);

    const externalContext = context();
    await hooks.tool.xberg_detect.execute(
      { path: "external-link.txt", format: "json" },
      externalContext,
    );
    expect(externalContext.approvals).toHaveLength(1);
    expect(externalContext.approvals[0].permission).toBe("external_directory");
    expect(externalContext.approvals[0].patterns).toEqual([
      realpathSync(external),
    ]);
  });

  it("passes canonical source paths to ts-pack", async () => {
    const source = join(workspace, "sample.js");
    writeFileSync(source, "export const value = 1;");
    const hooks = await TreeSitterLanguagePackPlugin();
    const result = await hooks.tool.tspack_parse.execute(
      { file: "sample.js", format: "json" },
      context(),
    );
    expect(JSON.parse(result.output).args).toContain(realpathSync(source));
  });
});

describe("HTML wrapper validation", () => {
  it("requires exactly one source", async () => {
    const file = join(workspace, "page.html");
    writeFileSync(file, "<h1>Title</h1>");
    const hooks = await HtmlToMarkdownPlugin();
    await expect(
      hooks.tool.html_to_markdown_convert.execute(
        { path: file, html: "<p>inline</p>" },
        context(),
      ),
    ).rejects.toThrow("exactly one");
  });

  it("requires preprocessing for a preset and rejects non-HTTP URLs", async () => {
    const hooks = await HtmlToMarkdownPlugin();
    await expect(
      hooks.tool.html_to_markdown_convert.execute(
        { html: "<p>inline</p>", preset: "aggressive", preprocess: false },
        context(),
      ),
    ).rejects.toThrow("requires `preprocess: true`");
    await expect(
      hooks.tool.html_to_markdown_fetch_url.execute(
        { url: "ftp://example.com/file" },
        context(),
      ),
    ).rejects.toThrow("http:// or https://");
  });

  it("supports plain output and inline stdin", async () => {
    const hooks = await HtmlToMarkdownPlugin();
    const result = await hooks.tool.html_to_markdown_convert.execute(
      { html: "<p>inline</p>", output_format: "plain" },
      context(),
    );
    const output = JSON.parse(result.output);
    expect(output.args).toEqual(["--output-format", "plain"]);
    expect(output.stdin).toBe("<p>inline</p>");
  });
});

describe("network and JSON validation", () => {
  it("rejects non-object config and non-HTTP crawl targets", async () => {
    const hooks = await CrawlbergPlugin();
    await expect(
      hooks.tool.crawlberg_scrape.execute(
        {
          url: "https://example.com",
          format: "json",
          timeout: 30_000,
          browser_mode: "never",
          config: "[]",
        },
        context(),
      ),
    ).rejects.toThrow("JSON object");
    await expect(
      hooks.tool.crawlberg_scrape.execute(
        {
          url: "file:///etc/passwd",
          format: "json",
          timeout: 30_000,
          browser_mode: "never",
        },
        context(),
      ),
    ).rejects.toThrow("http:// or https://");
  });
});
