/**
 * OpenCode apply_patch Tool - GNU/BSD patch CLI wrapper.
 *
 * This tool does not apply hunks in TypeScript. It validates patch header paths
 * for workspace safety, dry-runs the patch with GNU patch or BSD patch, then
 * applies the same patch through that CLI with stdin. Patch text is never passed
 * through a shell, heredoc, or shell-string interpolation.
 */

import { tool } from "@opencode-ai/plugin";
import * as path from "path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";

type PatchImplementation = "gnu" | "bsd";

interface PatchCli {
  command: string;
  implementation: PatchImplementation;
}

interface PatchRunResult {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface PatchHeaderFile {
  oldPath: string | null;
  newPath: string | null;
}

interface ValidatedPatchFile {
  displayPath: string;
  operation: "created" | "updated" | "deleted";
  snapshotPaths: string[];
}

interface FileSnapshot {
  exists: boolean;
  content?: Buffer;
  mode?: number;
}

interface ApplyCliResult {
  results: ValidatedPatchFile[];
  engine: string;
  stripCount: number;
}

const CONTROL_CHARS = /[\x00-\x1f]/;
const ABSOLUTE_PATH = /^\/|^[A-Za-z]:[\\/]/;
const PATH_TRAVERSAL = /(?:^|[\\/])\.\.(?:$|[\\/])/;
const PATCH_OUTPUT_LIMIT = 4000;

class PatchInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatchInputError";
  }
}

class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathValidationError";
  }
}

class PatchCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatchCliError";
  }
}

function resolveWorktree(context: {
  worktree: string;
  directory: string;
}): string {
  const fromContext = context.worktree || context.directory;
  if (fromContext && fromContext !== "/" && existsSync(fromContext)) {
    return fromContext;
  }
  return process.cwd();
}

function isDevNull(rawPath: string): boolean {
  return (
    rawPath === "/dev/null" ||
    rawPath.startsWith("/dev/null\t") ||
    rawPath.startsWith("/dev/null ")
  );
}

function validatePatchPathSyntax(filePath: string, label: string): void {
  if (!filePath || filePath.trim() === "") {
    throw new PathValidationError(`${label} is empty`);
  }
  if (CONTROL_CHARS.test(filePath)) {
    throw new PathValidationError(
      `${label} contains control characters: ${filePath}`,
    );
  }
  if (filePath.startsWith('"') || filePath.startsWith("'")) {
    throw new PathValidationError(
      `${label} uses quoted filenames, which are not portable across GNU and BSD patch: ${filePath}`,
    );
  }
  if (ABSOLUTE_PATH.test(filePath)) {
    throw new PathValidationError(`${label} is absolute: ${filePath}`);
  }
  if (PATH_TRAVERSAL.test(filePath)) {
    throw new PathValidationError(
      `${label} contains path traversal: ${filePath}`,
    );
  }
}

function parseHeaderPath(line: string, prefix: "--- " | "+++ "): string | null {
  const rawPath = line.slice(prefix.length);
  if (isDevNull(rawPath)) return null;

  const tabIndex = rawPath.indexOf("\t");
  const pathPart =
    tabIndex >= 0
      ? rawPath.slice(0, tabIndex)
      : (rawPath.match(/^\S+/)?.[0] ?? "");

  validatePatchPathSyntax(pathPart, `patch header path on ${prefix.trim()}`);
  return pathPart;
}

function extractPatchFiles(patchText: string): PatchHeaderFile[] {
  const lines = patchText.replace(/\r\n?/g, "\n").split("\n");
  const files: PatchHeaderFile[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const oldHeader = lines[i];
    const newHeader = lines[i + 1];
    if (!oldHeader.startsWith("--- ") || !newHeader.startsWith("+++ "))
      continue;

    const oldPath = parseHeaderPath(oldHeader, "--- ");
    const newPath = parseHeaderPath(newHeader, "+++ ");
    if (oldPath === null && newPath === null) {
      throw new PatchInputError(
        "Patch file header cannot use /dev/null for both old and new paths",
      );
    }
    files.push({ oldPath, newPath });
    i++;
  }

  if (files.length === 0) {
    throw new PatchInputError(
      "No unified-diff file headers found. This CLI-only tool expects standard ---/+++ patch headers.",
    );
  }

  return files;
}

function looksLikeGitPrefixedDiff(files: PatchHeaderFile[]): boolean {
  return files.some((file) => {
    if (file.oldPath === null) return file.newPath?.startsWith("b/") ?? false;
    if (file.newPath === null) return file.oldPath.startsWith("a/");
    return file.oldPath.startsWith("a/") && file.newPath.startsWith("b/");
  });
}

function preferredStripCounts(files: PatchHeaderFile[]): number[] {
  return looksLikeGitPrefixedDiff(files) ? [1, 0] : [0, 1];
}

function stripPathComponents(filePath: string, stripCount: number): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  if (parts.length <= stripCount) {
    throw new PathValidationError(
      `-p${stripCount} removes entire path: ${filePath}`,
    );
  }
  return parts.slice(stripCount).join("/");
}

function validateWorkspacePath(filePath: string, worktree: string): string {
  validatePatchPathSyntax(filePath, "resolved patch path");

  const worktreeReal = realpathSync(worktree);
  const resolved = path.resolve(worktreeReal, filePath);
  const normalizedWorktree = path.join(worktreeReal, path.sep);
  const normalizedResolved = path.join(path.resolve(resolved), path.sep);
  if (!normalizedResolved.startsWith(normalizedWorktree)) {
    throw new PathValidationError(
      `Path escapes workspace: ${filePath} resolves to ${resolved}`,
    );
  }

  let current = worktreeReal;
  const segments = filePath
    .split(/[\\/]+/)
    .filter((segment) => segment && segment !== ".");
  for (const segment of segments) {
    current = path.join(current, segment);
    if (!existsSync(current)) continue;

    const realPath = realpathSync(current);
    const normalizedReal = path.join(path.resolve(realPath), path.sep);
    if (!normalizedReal.startsWith(normalizedWorktree)) {
      throw new PathValidationError(
        `Symlink escapes workspace: ${filePath} resolves to ${realPath}`,
      );
    }
  }

  return resolved;
}

function validateFilesForStripCount(
  files: PatchHeaderFile[],
  stripCount: number,
  worktree: string,
): ValidatedPatchFile[] {
  return files.map((file) => {
    const oldPath =
      file.oldPath === null
        ? null
        : stripPathComponents(file.oldPath, stripCount);
    const newPath =
      file.newPath === null
        ? null
        : stripPathComponents(file.newPath, stripCount);
    const snapshotPaths = Array.from(
      new Set([oldPath, newPath].filter(Boolean) as string[]),
    );

    for (const snapshotPath of snapshotPaths) {
      validateWorkspacePath(snapshotPath, worktree);
    }

    const operation =
      oldPath === null ? "created" : newPath === null ? "deleted" : "updated";
    const displayPath =
      oldPath && newPath && oldPath !== newPath
        ? `${oldPath} -> ${newPath}`
        : (newPath ?? oldPath!);

    return { displayPath, operation, snapshotPaths };
  });
}

function readPatchVersion(command: string): string | null {
  for (const flag of ["--version", "-v"]) {
    try {
      const proc = Bun.spawnSync({
        cmd: [command, flag],
        stdout: "pipe",
        stderr: "pipe",
      });
      const output =
        `${proc.stdout.toString()}${proc.stderr.toString()}`.trim();
      if (proc.exitCode === 0 || output.length > 0) return output;
    } catch {
      return null;
    }
  }
  return null;
}

function detectPatchCli(): PatchCli | null {
  const candidates = [
    process.env.OPENCODE_PATCH,
    process.env.PATCH,
    "patch",
    "gpatch",
  ].filter((candidate): candidate is string => Boolean(candidate));
  const seen = new Set<string>();

  for (const command of candidates) {
    if (seen.has(command)) continue;
    seen.add(command);

    const version = readPatchVersion(command);
    if (version === null) continue;
    return {
      command,
      implementation: /GNU patch/i.test(version) ? "gnu" : "bsd",
    };
  }

  return null;
}

function rejectPathFor(worktree: string): string {
  return path.join(
    worktree,
    `.opencode-patch-${Date.now()}-${Math.random().toString(36).slice(2)}.rej`,
  );
}

function patchArgs(
  cli: PatchCli,
  stripCount: number,
  rejectPath: string,
  dryRun: boolean,
): string[] {
  const args = ["-p", String(stripCount), "-u", "-f", "-r", rejectPath];
  if (!dryRun) return args;
  return [...args, cli.implementation === "gnu" ? "--dry-run" : "-C"];
}

async function runPatchCli(
  cli: PatchCli,
  args: string[],
  patchText: string,
  worktree: string,
): Promise<PatchRunResult> {
  const proc = Bun.spawn({
    cmd: [cli.command, ...args],
    cwd: worktree,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = proc.stdout
    ? new Response(proc.stdout).text()
    : Promise.resolve("");
  const stderr = proc.stderr
    ? new Response(proc.stderr).text()
    : Promise.resolve("");

  try {
    proc.stdin.write(patchText);
    proc.stdin.end();
  } catch {
    // The process may exit before reading stdin on invalid arguments.
  }

  const [exitCode, stdoutText, stderrText] = await Promise.all([
    proc.exited,
    stdout,
    stderr,
  ]);

  return {
    command: cli.command,
    args,
    exitCode,
    stdout: stdoutText,
    stderr: stderrText,
  };
}

function cleanupRejectFile(rejectPath: string): void {
  try {
    if (existsSync(rejectPath)) unlinkSync(rejectPath);
  } catch {
    // Best effort cleanup.
  }
}

function takeSnapshots(
  files: ValidatedPatchFile[],
  worktree: string,
): Map<string, FileSnapshot> {
  const snapshots = new Map<string, FileSnapshot>();
  for (const file of files) {
    for (const snapshotPath of file.snapshotPaths) {
      const absPath = validateWorkspacePath(snapshotPath, worktree);
      if (snapshots.has(absPath)) continue;

      if (!existsSync(absPath)) {
        snapshots.set(absPath, { exists: false });
        continue;
      }

      const stat = statSync(absPath);
      snapshots.set(absPath, {
        exists: true,
        content: readFileSync(absPath),
        mode: stat.mode,
      });
    }
  }
  return snapshots;
}

function rollbackSnapshots(snapshots: Map<string, FileSnapshot>): void {
  for (const [absPath, snapshot] of snapshots) {
    try {
      if (!snapshot.exists) {
        if (existsSync(absPath)) unlinkSync(absPath);
        continue;
      }

      const dir = path.dirname(absPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const content = snapshot.content ?? Buffer.alloc(0);
      if (snapshot.mode === undefined) {
        writeFileSync(absPath, content);
      } else {
        writeFileSync(absPath, content, { mode: snapshot.mode });
      }
    } catch {
      // Best effort rollback.
    }
  }
}

function truncateOutput(output: string): string {
  if (output.length <= PATCH_OUTPUT_LIMIT) return output;
  return `${output.slice(0, PATCH_OUTPUT_LIMIT)}\n... output truncated ...`;
}

function formatPatchFailure(
  phase: "dry-run" | "apply",
  result: PatchRunResult,
): string {
  const output = truncateOutput(
    [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n"),
  );
  const command = [result.command, ...result.args].join(" ");
  return `${phase} failed using ${command} (exit ${result.exitCode})${
    output ? `:\n${output}` : ""
  }`;
}

async function applyWithCli(
  patchText: string,
  worktree: string,
): Promise<ApplyCliResult> {
  const cliPatchText = patchText.endsWith("\n") ? patchText : `${patchText}\n`;
  const files = extractPatchFiles(cliPatchText);
  const cli = detectPatchCli();
  if (!cli) {
    throw new PatchCliError(
      "Could not find a GNU patch or BSD patch CLI on PATH",
    );
  }

  const failures: string[] = [];
  for (const stripCount of preferredStripCounts(files)) {
    let validatedFiles: ValidatedPatchFile[];
    try {
      validatedFiles = validateFilesForStripCount(files, stripCount, worktree);
    } catch (e) {
      failures.push(
        `-p${stripCount}: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }

    const dryRunRejectPath = rejectPathFor(worktree);
    const dryRun = await runPatchCli(
      cli,
      patchArgs(cli, stripCount, dryRunRejectPath, true),
      cliPatchText,
      worktree,
    );
    cleanupRejectFile(dryRunRejectPath);
    if (dryRun.exitCode !== 0) {
      failures.push(
        `-p${stripCount}: ${formatPatchFailure("dry-run", dryRun)}`,
      );
      continue;
    }

    const snapshots = takeSnapshots(validatedFiles, worktree);
    const applyRejectPath = rejectPathFor(worktree);
    const apply = await runPatchCli(
      cli,
      patchArgs(cli, stripCount, applyRejectPath, false),
      cliPatchText,
      worktree,
    );
    cleanupRejectFile(applyRejectPath);
    if (apply.exitCode !== 0) {
      rollbackSnapshots(snapshots);
      throw new PatchCliError(
        `${formatPatchFailure("apply", apply)}. All tracked file changes have been rolled back.`,
      );
    }

    return {
      results: validatedFiles,
      engine: `${cli.implementation.toUpperCase()} patch CLI (${cli.command})`,
      stripCount,
    };
  }

  throw new PatchCliError(
    `Patch did not apply with any supported strip count:\n${failures.join("\n\n")}`,
  );
}

function formatResults(results: ValidatedPatchFile[]): string {
  return results
    .map((result) => {
      const icon =
        result.operation === "created"
          ? "+"
          : result.operation === "deleted"
            ? "-"
            : "~";
      return `${icon} ${result.displayPath}: ${result.operation}`;
    })
    .join("\n");
}

export const applyPatchTool = tool({
  description: `Apply a standard unified diff with GNU patch or BSD patch.

IMPORTANT: This tool is CLI-only. It does not apply hunks manually in TypeScript and does not support OpenCode custom patch format. Patch text is passed to GNU/BSD patch through stdin without using a shell, heredoc, or shell-string interpolation.

Supported formats:
- Standard unified diff (diff -u output)
- Git unified diff (diff --git with ---/+++ file headers)

Operations supported by the patch CLI: create files, update files, delete files.
The tool dry-runs first, then applies with the same strip count. If apply fails after dry-run, tracked target files are restored from snapshots.

Path validation rules:
- No path traversal (../) or absolute paths
- All paths must resolve within the workspace root
- Symlink escapes are detected and rejected

Example unified diff:
\`\`\`
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,3 @@
 const unchanged = true;
-const OLD = "value";
+const NEW = "value";
\`\`\``,

  args: {
    patchText: tool.schema
      .string()
      .describe("The full standard unified-diff patch text to apply"),
  },

  async execute(args, context) {
    const worktree = resolveWorktree(context);
    const patchText = String(args.patchText ?? "");

    try {
      const applied = await applyWithCli(patchText, worktree);
      const formatted = formatResults(applied.results);
      const summary = `${applied.results.length} file(s) changed via ${applied.engine} -p${applied.stripCount}:\n${formatted}`;
      context.metadata({
        title: `Applied patch to ${applied.results.length} file(s)`,
        metadata: {
          files: applied.results.map((result) => result.displayPath),
          engine: applied.engine,
          stripCount: applied.stripCount,
        },
      });
      return summary;
    } catch (e) {
      if (
        e instanceof PatchInputError ||
        e instanceof PathValidationError ||
        e instanceof PatchCliError
      ) {
        return `Error: ${e.message}`;
      }
      throw e;
    }
  },
});

export default applyPatchTool;
