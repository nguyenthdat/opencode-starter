import { realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { tool } from "@opencode-ai/plugin";
import type { Plugin, ToolContext, ToolResult } from "@opencode-ai/plugin";

const LINE_CAP = 2_000;
const MATCH_LIMIT = 100;
const HARD_LIMIT = 8 * 1024 * 1024;

// ---- path helpers ----

function resolveTarget(raw: string | undefined, ctx: ToolContext): string {
  let p = raw ?? ".";
  if (p === "~" || p.startsWith("~/")) {
    p = join(homedir(), p === "~" ? "." : p.slice(2));
  }
  if (!isAbsolute(p)) p = resolve(ctx.directory, p);
  return resolve(p);
}

function targetCwdName(resolved: string): { cwd: string; name: string } {
  const info = statSync(resolved);
  if (info.isFile()) return { cwd: dirname(resolved), name: basename(resolved) };
  if (info.isDirectory()) return { cwd: resolved, name: "." };
  throw new Error(`Expected a file or directory: ${resolved}`);
}

function isInsideDir(root: string, resolved: string): boolean {
  const rel = relative(root, resolved);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

// ---- permissions ----

async function askGrep(ctx: ToolContext, pattern: string, pathArg?: string, include?: string) {
  await ctx.ask({
    permission: "grep",
    patterns: [pattern],
    always: ["*"],
    metadata: { pattern, path: pathArg, include },
  });
}

async function askExternal(ctx: ToolContext, resolved: string) {
  const directory = resolve(ctx.directory);
  const worktree = resolve(ctx.worktree);
  if (isInsideDir(directory, resolved)) return;
  if (parse(worktree).root !== worktree && isInsideDir(worktree, resolved)) return;

  const isDir = (() => { try { return statSync(resolved).isDirectory(); } catch { return false; } })();
  const parent = isDir ? resolved : dirname(resolved);
  const glob = join(parent, "*").replace(/\\/g, "/");

  await ctx.ask({
    permission: "external_directory",
    patterns: [glob],
    always: [glob],
    metadata: { filepath: resolved, parentDir: parent },
  });
}

// ---- byte-level NDJSON parser ----

function isRgMatch(r: unknown): r is { type: "match"; data: { path: { text: string }; lines: { text: string }; line_number: number } } {
  if (!r || typeof r !== "object") return false;
  const m = r as Record<string, unknown>;
  if (m.type !== "match") return false;
  const d = m.data as Record<string, unknown> | undefined;
  if (!d || typeof d !== "object") return false;
  return typeof (d.path as Record<string, unknown> | null)?.text === "string" &&
    typeof (d.lines as Record<string, unknown> | null)?.text === "string" &&
    typeof d.line_number === "number";
}

async function* parseNdjson(
  stream: ReadableStream<Uint8Array>,
  hardLimit: number,
  signal: AbortSignal,
): AsyncGenerator<{ record: unknown; skipped: number }> {
  const decoder = new TextDecoder();
  let buf = new Uint8Array(65536);
  let len = 0;
  let discarding = 0;

  function growBuf(need: number) {
    if (need <= buf.length) return;
    const next = new Uint8Array(Math.min(Math.max(need, buf.length * 2), hardLimit));
    next.set(buf.subarray(0, len));
    buf = next;
  }

  const reader = stream.getReader();
  try {
    let chunk: Uint8Array | undefined;
    let pos = 0;

    while (true) {
      if (signal.aborted) { await reader.cancel(); return; }
      if (!chunk || pos >= chunk.length) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.length === 0) continue;
        chunk = value;
        pos = 0;
      }

      if (discarding > 0) {
        const nl = chunk.indexOf(0x0A, pos);
        if (nl === -1) { discarding += chunk.length - pos; pos = chunk.length; continue; }
        discarding += nl - pos;
        discarding = 0;
        yield { record: null, skipped: 1 };
        pos = nl + 1;
      }

      const nl = chunk.indexOf(0x0A, pos);
      if (nl === -1) {
        const add = chunk.length - pos;
        if (len + add > hardLimit) { discarding = add; len = 0; pos = chunk.length; continue; }
        growBuf(len + add);
        buf.set(chunk.subarray(pos), len);
        len += add;
        pos = chunk.length;
        continue;
      }

      const recordLen = len + (nl - pos);
      let effLen = recordLen;
      if (nl > pos && chunk[nl - 1] === 0x0D) effLen--;
      else if (nl === pos && len > 0 && buf[len - 1] === 0x0D) effLen--;

      if (effLen > hardLimit) {
        yield { record: null, skipped: 1 };
      } else {
        const rec = new Uint8Array(effLen);
        const fromBuf = Math.min(len, effLen);
        if (fromBuf > 0) rec.set(buf.subarray(0, fromBuf), 0);
        const fromChunk = effLen - fromBuf;
        if (fromChunk > 0) rec.set(chunk.subarray(pos, pos + fromChunk), fromBuf);

        try {
          const parsed = JSON.parse(decoder.decode(rec));
          if (isRgMatch(parsed)) yield { record: parsed, skipped: 0 };
        } catch (cause) {
          throw new Error(
            `Failed to parse rg JSON record (${effLen} bytes). Upgrade ripgrep or file a bug.`,
            { cause },
          );
        }
      }

      len = 0;
      pos = nl + 1;
    }

    if (discarding > 0) { yield { record: null, skipped: 1 }; }
    else if (len > 0) {
      const rec = buf.subarray(0, len);
      try {
        const parsed = JSON.parse(decoder.decode(rec));
        if (isRgMatch(parsed)) yield { record: parsed, skipped: 0 };
      } catch (cause) {
        throw new Error(`Failed to parse final rg JSON record (${rec.length} bytes).`, { cause });
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---- output formatting ----

type Match = { file: string; line: number; text: string };

function formatOutput(
  pattern: string,
  matches: Match[],
  truncated: boolean,
  partial: boolean,
  skippedOversized: number,
): ToolResult {
  const meta: Record<string, unknown> = {
    matches: matches.length,
    truncated,
    searchTruncated: truncated,
    partial,
    skippedOversized,
  };

  if (matches.length === 0 && !truncated && !partial && skippedOversized === 0) {
    return { title: pattern, output: "No files found", metadata: meta };
  }

  const byFile = new Map<string, string[]>();
  for (const m of matches) {
    let list = byFile.get(m.file);
    if (!list) { list = []; byFile.set(m.file, list); }
    const text = m.text.length > LINE_CAP ? m.text.slice(0, LINE_CAP) + "..." : m.text;
    list.push(`Line ${m.line}: ${text}`);
  }

  const parts: string[] = [];
  for (const [file, lines] of byFile) {
    parts.push(file);
    for (const l of lines) parts.push(l);
    parts.push("");
  }
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();

  let output = parts.join("\n");

  const notes: string[] = [];
  if (truncated) notes.push("Results truncated at 100 matches.");
  if (partial) notes.push("Search may be incomplete (rg exited abnormally).");
  if (skippedOversized > 0) {
    notes.push(`${skippedOversized} record(s) exceeded ${HARD_LIMIT / 1024 / 1024} MiB and were skipped.`);
  }
  if (notes.length > 0) output = (output ? output + "\n\n" : "") + notes.join("\n");

  return { title: pattern, output, metadata: meta };
}

/** Truncate line text to LINE_CAP with "..." suffix. */
function capLine(t: string): string {
  return t.length > LINE_CAP ? t.slice(0, LINE_CAP) + "..." : t;
}

// ---- main ----

async function executeGrep(
  args: { pattern: string; path?: string; include?: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  if (!args.pattern || args.pattern.trim().length === 0) {
    return {
      title: "Grep Error",
      output: "Pattern must be a non-empty string.",
      metadata: { error: true, matches: 0, truncated: false, searchTruncated: false, partial: false, skippedOversized: 0 },
    };
  }

  const rgPath = Bun.which("rg");
  if (!rgPath) {
    return {
      title: "Grep Error",
      output: "ripgrep (rg) is not installed. Install via brew, apt, or https://github.com/BurntSushi/ripgrep.",
      metadata: { error: true, missingBinary: "rg", matches: 0, truncated: false, searchTruncated: false, partial: false, skippedOversized: 0 },
    };
  }

  const requested = resolveTarget(args.path, ctx);
  await askGrep(ctx, args.pattern, args.path, args.include);
  await askExternal(ctx, requested);

  if (ctx.abort.aborted) {
    return { title: args.pattern, output: "Search cancelled.", metadata: { matches: 0, truncated: false, searchTruncated: false, partial: false, skippedOversized: 0, aborted: true } };
  }

  let resolved: string;
  let location: { cwd: string; name: string };
  try {
    resolved = realpathSync(requested);
    location = targetCwdName(resolved);
  } catch {
    return {
      title: "Grep Error",
      output: `Path not found, inaccessible, or not a regular file/directory: ${requested}`,
      metadata: { error: true, matches: 0, truncated: false, searchTruncated: false, partial: false, skippedOversized: 0 },
    };
  }

  const { cwd, name } = location;

  const rgArgs: string[] = ["--no-config", "--json", "--hidden", "--no-messages"];
  if (args.include && args.include.length > 0) rgArgs.push(`--glob=${args.include}`);
  rgArgs.push("--glob=!**/.git/**");
  rgArgs.push("--", args.pattern, name);

  const abortController = new AbortController();
  const onAbort = () => abortController.abort();

  let proc: ReturnType<typeof Bun.spawn> | undefined;
  let stderrPromise: Promise<string> = Promise.resolve("");
  const streams: ReadableStream[] = [];
  try {
    ctx.abort.addEventListener("abort", onAbort);
    if (ctx.abort.aborted) abortController.abort();

    proc = Bun.spawn([rgPath, ...rgArgs], {
      cwd, stdout: "pipe", stderr: "pipe",
      env: { ...process.env },
      signal: abortController.signal,
    });
    const outStream = proc.stdout as ReadableStream<Uint8Array>;
    const errStream = proc.stderr as ReadableStream<Uint8Array>;
    streams.push(outStream, errStream);

    // Background stderr drain
    stderrPromise = (async () => {
      let text = "";
      const dec = new TextDecoder();
      const r = errStream.getReader();
      try {
        while (true) {
          const { done, value } = await r.read();
          if (done) break;
          text += dec.decode(value, { stream: true });
          if (text.length > 2000) text = text.slice(0, 2000);
        }
        dec.decode();
      } finally { r.releaseLock(); }
      return text;
    })();

    const matches: Match[] = [];
    let totalSkipped = 0;
    let truncated = false;
    let partial = false;

    for await (const { record, skipped } of parseNdjson(outStream, HARD_LIMIT, ctx.abort)) {
      totalSkipped += skipped;
      if (ctx.abort.aborted) { proc.kill(); truncated = true; break; }

      if (record === null) continue;
      if (matches.length >= MATCH_LIMIT) { proc.kill(); truncated = true; break; }
      const m = record as { data: { path: { text: string }; lines: { text: string }; line_number: number } };
      const absPath = resolve(cwd, m.data.path.text);
      let text = m.data.lines.text;
      if (text.endsWith("\n")) text = text.slice(0, -1);
      if (text.endsWith("\r")) text = text.slice(0, -1);
      matches.push({ file: absPath, line: m.data.line_number, text: capLine(text) });
    }

    // Always drain/dismiss stderr, then check exit
    let stderrText = "";
    try { stderrText = await stderrPromise; } catch {}

    const exitCode = await proc.exited;
    const intentionalKill = truncated && matches.length >= MATCH_LIMIT;
    if (ctx.abort.aborted) {
      return { title: args.pattern, output: "Search cancelled.", metadata: { matches: 0, truncated: false, searchTruncated: false, partial: false, skippedOversized: 0, aborted: true } };
    }
    if (intentionalKill) {
      return formatOutput(args.pattern, matches, true, false, totalSkipped);
    }
    if (exitCode === 0 || exitCode === 1) {
      return formatOutput(args.pattern, matches, truncated, false, totalSkipped);
    }
    if (exitCode === 2) {
      const errMsg = stderrText.trim();
      if (errMsg.toLowerCase().includes("regex")) {
        return { title: "Invalid Regex", output: errMsg, metadata: { error: true, invalidRegex: true, matches: 0, truncated: false, searchTruncated: false, partial: false, skippedOversized: 0 } };
      }
      return formatOutput(args.pattern, matches, truncated, true, totalSkipped);
    }
    return {
      title: "Grep Error",
      output: stderrText.trim() || `rg exited with code ${exitCode}`,
      metadata: { error: true, exitCode, matches: 0, truncated: false, searchTruncated: false, partial: false, skippedOversized: 0 },
    };
  } catch (err) {
    try { proc?.kill(); } catch {}
    if (ctx.abort.aborted || (err instanceof DOMException && err.name === "AbortError")) {
      return { title: args.pattern, output: "Search cancelled.", metadata: { matches: 0, truncated: false, searchTruncated: false, partial: false, skippedOversized: 0, aborted: true } };
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("regex")) {
      return { title: "Invalid Regex", output: msg, metadata: { error: true, invalidRegex: true, matches: 0, truncated: false, searchTruncated: false, partial: false, skippedOversized: 0 } };
    }
    return { title: "Grep Error", output: msg, metadata: { error: true, matches: 0, truncated: false, searchTruncated: false, partial: false, skippedOversized: 0 } };
  } finally {
    ctx.abort.removeEventListener("abort", onAbort);
    try { await stderrPromise; } catch {}
    try { await proc?.exited; } catch {}
    await Promise.allSettled(streams.map((stream) => stream.cancel()));
  }
}

// Local override for anomalyco/opencode#35523; remove after the upstream fix ships.
const schema = tool.schema;

const GrepPlugin = (async () => ({
  tool: {
    grep: tool({
      description:
        "Fast content search tool that works with any codebase size. " +
        "Searches file contents using regular expressions. " +
        "Supports full regex syntax. " +
        "Filter files by pattern with the include parameter. " +
        "Returns file paths and line numbers with matching lines. " +
        "Handles large matching lines (up to 8 MiB) that the built-in tool fails on.",
      args: {
        pattern: schema.string().describe("The regex pattern to search for in file contents"),
        path: schema.string().optional().describe("The directory to search in. Defaults to the current working directory."),
        include: schema.string().optional().describe('File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")'),
      },
      execute: executeGrep,
    }),
  },
})) satisfies Plugin;

export default GrepPlugin;
