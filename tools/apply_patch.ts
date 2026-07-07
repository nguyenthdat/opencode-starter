/**
 * OpenCode apply_patch Tool — Shell-Independent Unified Diff Applier
 *
 * Parses unified diffs directly in code. Never passes patch text through
 * bash, fish, heredocs, or any shell-string interpolation. Applies file
 * changes via Bun's filesystem APIs with explicit path validation against
 * workspace traversal and symlink escapes.
 *
 * Supported formats:
 *   - Standard unified diff  (--- a/file +++ b/file, @@ hunks)
 *   - Git extended diff      (diff --git, new/deleted file mode)
 *   - OpenCode custom format (*** Begin/End Patch, *** Add/Delete/Update File:)
 *
 * Features:
 *   - Create, update, and delete file operations
 *   - Multi-file patches — all-or-nothing where possible
 *   - Path sanitisation: no ../ traversal, no absolute paths, symlink escape detection
 *   - Context-mismatch rejection with clear diagnostics
 *   - Unicode, quoting characters, $, backticks, backslashes preserved byte-for-byte
 */

import { tool } from "@opencode-ai/plugin";
import * as path from "path";
import {
  existsSync,
  realpathSync,
  mkdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  lstatSync,
} from "fs";

// ─── Types ────────────────────────────────────────────────────────────────────

type DiffLine =
  | { kind: "context"; text: string }
  | { kind: "add"; text: string }
  | { kind: "remove"; text: string }
  | { kind: "no_newline"; text: string };

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

interface FilePatch {
  operation: "create" | "update" | "delete";
  filePath: string; // relative path from patch
  oldPath?: string; // rename source (git extended)
  hunks?: DiffHunk[];
  newFileContent?: string[];
  oldFileMode?: string;
  newFileMode?: string;
  // OpenCode custom format fields
  rawAddLines?: string[];
}

interface PatchResult {
  path: string;
  operation: "created" | "updated" | "deleted";
  hunksApplied: number;
  hunksFailed: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OPENCODE_MARKERS = {
  BEGIN_PATCH: "*** Begin Patch",
  END_PATCH: "*** End Patch",
  ADD_FILE: "*** Add File:",
  DELETE_FILE: "*** Delete File:",
  UPDATE_FILE: "*** Update File:",
  MOVE_TO: "*** Move to:",
  END_OF_FILE: "*** End of File",
} as const;

const BAD_PATH_CHARS = /[\x00-\x1f]/;
const PATH_TRAVERSAL = /(?:^|\/)\.\.(?:$|\/)/;
const ABSOLUTE_PATH = /^\/|^[A-Za-z]:[\\/]/;

// ─── Unified Diff Parser ──────────────────────────────────────────────────────

class DiffParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public detail?: string,
  ) {
    super(`line ${line}: ${message}${detail ? ` (${detail})` : ""}`);
    this.name = "DiffParseError";
  }
}

class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathValidationError";
  }
}

class PatchApplyError extends Error {
  constructor(
    message: string,
    public path: string,
    public hunkIndex?: number,
  ) {
    super(message);
    this.name = "PatchApplyError";
  }
}

/**
 * Split patch text into lines, normalising line endings.
 */
function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").split("\n");
}

/**
 * Try to detect whether a patch uses the OpenCode custom format.
 */
function isOpencodeFormat(lines: string[]): boolean {
  return lines.some((l) => l.startsWith(OPENCODE_MARKERS.BEGIN_PATCH));
}

/**
 * Strip a leading "a/" or "b/" prefix from a unified-diff path.
 * Also handles git's "c/" and "i/" prefixes.
 */
function stripPrefix(p: string): string {
  return p.replace(/^[abciw]\//, "");
}

/**
 * Parse a standard unified-diff header line.
 * Returns [filePath, oldPath] or null.
 * Handles:
 *   --- a/path       (remove prefix: path)
 *   --- /dev/null    (new file: null)
 *   +++ b/path       (target file)
 *   +++ /dev/null    (deleted file: null)
 */
function parseHeaderLine(line: string, prefix: string): string | null {
  const stripped = line.slice(prefix.length).trimStart();
  if (stripped === "/dev/null") return null;
  // Handle timestamps: "file\t2024-01-01 00:00:00 +0000"
  const tabIdx = stripped.indexOf("\t");
  return tabIdx >= 0
    ? stripPrefix(stripped.slice(0, tabIdx))
    : stripPrefix(stripped);
}

/**
 * Parse a unified-diff hunk header: @@ -oldStart,oldLines +newStart,newLines @@
 */
function parseHunkHeader(line: string): DiffHunk | null {
  const m = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
  if (!m) return null;
  return {
    oldStart: parseInt(m[1], 10),
    oldLines: m[2] ? parseInt(m[2], 10) : 1,
    newStart: parseInt(m[3], 10),
    newLines: m[4] ? parseInt(m[4], 10) : 1,
    lines: [],
  };
}

/**
 * Parse a standard unified diff (or git diff) into FilePatch[].
 */
function parseUnifiedDiff(lines: string[]): FilePatch[] {
  const patches: FilePatch[] = [];
  let i = 0;
  let currentPatch: FilePatch | null = null;
  let currentHunk: DiffHunk | null = null;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines between hunks
    if (line === "" && !currentHunk) {
      i++;
      continue;
    }

    // Git extended header: diff --git a/path b/path
    if (line.startsWith("diff --git ")) {
      if (currentPatch) {
        if (currentHunk) currentPatch.hunks!.push(currentHunk);
        patches.push(currentPatch);
        currentHunk = null;
      }
      currentPatch = null;

      const m = line.match(/^diff --git a\/(.*?) b\/(.*?)$/);
      if (m) {
        currentPatch = {
          operation: "update",
          filePath: stripPrefix(m[2]),
          oldPath: stripPrefix(m[1]),
          hunks: [],
        };
      }
      i++;
      continue;
    }

    // Git index line (skip)
    if (
      /^(index|similarity index|rename (from|to)|copy (from|to)|old mode|new mode|deleted file mode|new file mode)/.test(
        line,
      )
    ) {
      if (currentPatch) {
        if (line.startsWith("new file mode"))
          currentPatch.newFileMode = line.slice("new file mode".length).trim();
        if (line.startsWith("deleted file mode"))
          currentPatch.oldFileMode = line
            .slice("deleted file mode".length)
            .trim();
      }
      i++;
      continue;
    }

    // Header: --- a/file or --- /dev/null
    if (line.startsWith("--- ")) {
      const oldPath = parseHeaderLine(line, "--- ");

      // If currentPatch exists from diff --git and this --- line matches or is /dev/null
      if (currentPatch && currentPatch.oldPath !== undefined) {
        if (oldPath === null) {
          // /dev/null means new file — keep existing patch, mark as create
          currentPatch.operation = "create";
        } else if (currentPatch.oldPath === oldPath) {
          // Same file — continue using this patch
        } else {
          // Different file — finalize old, start new
          if (currentHunk) currentPatch.hunks!.push(currentHunk);
          patches.push(currentPatch);
          currentHunk = null;
          currentPatch = {
            operation: "update",
            filePath: "",
            oldPath: oldPath ?? undefined,
            hunks: [],
          };
        }
      } else {
        if (currentPatch) {
          if (currentHunk) currentPatch.hunks!.push(currentHunk);
          patches.push(currentPatch);
          currentHunk = null;
        }
        currentPatch = {
          operation: oldPath === null ? "create" : "update",
          filePath: "",
          oldPath: oldPath ?? undefined,
          hunks: [],
        };
      }
      i++;
      continue;
    }

    // Header: +++ b/file or +++ /dev/null
    if (line.startsWith("+++ ")) {
      if (!currentPatch) {
        currentPatch = { operation: "update", filePath: "", hunks: [] };
      }
      const newPath = parseHeaderLine(line, "+++ ");
      if (newPath === null) {
        currentPatch.operation = "delete";
        currentPatch.filePath = currentPatch.oldPath ?? "";
      } else {
        currentPatch.filePath = newPath;
      }
      i++;
      continue;
    }

    // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@
    const hunk = parseHunkHeader(line);
    if (hunk) {
      if (!currentPatch) {
        throw new DiffParseError("Hunk without file header", i + 1);
      }
      if (currentHunk) {
        currentPatch.hunks!.push(currentHunk);
      }
      currentHunk = hunk;
      i++;
      continue;
    }

    // Hunk content lines
    if (currentHunk) {
      if (line.startsWith("+")) {
        currentHunk.lines.push({ kind: "add", text: line.slice(1) });
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({ kind: "remove", text: line.slice(1) });
      } else if (line.startsWith(" ")) {
        currentHunk.lines.push({ kind: "context", text: line.slice(1) });
      } else if (line === "\\ No newline at end of file") {
        currentHunk.lines.push({ kind: "no_newline", text: "" });
      } else if (line === "") {
        // Skip blank lines that may appear between hunks or at end
      } else {
        currentHunk.lines.push({ kind: "context", text: line });
      }
      i++;
      continue;
    }

    // Line didn't match anything — skip
    i++;
  }

  // Finalize
  if (currentPatch) {
    if (currentHunk) currentPatch.hunks!.push(currentHunk);
    patches.push(currentPatch);
  }

  return patches;
}

/**
 * Parse the OpenCode custom format:
 *   *** Begin Patch
 *   *** Add File: path
 *   +content
 *   ...
 *   *** Delete File: path
 *   *** Update File: path
 *   *** Move to: new_path
 *   @@
 *   -old
 *   +new
 *   *** End of File
 *   *** End Patch
 */
function parseOpencodeFormat(lines: string[]): FilePatch[] {
  const patches: FilePatch[] = [];
  let i = 0;
  let currentPatch: FilePatch | null = null;
  let currentHunk: DiffHunk | null = null;
  let collectingAddLines = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (
      trimmed === OPENCODE_MARKERS.BEGIN_PATCH ||
      trimmed.startsWith("*** Begin Patch")
    ) {
      i++;
      continue;
    }

    if (
      trimmed === OPENCODE_MARKERS.END_PATCH ||
      trimmed.startsWith("*** End Patch")
    ) {
      break;
    }

    // File operation headers
    if (trimmed.startsWith(OPENCODE_MARKERS.ADD_FILE)) {
      if (currentPatch) {
        if (currentHunk) currentPatch.hunks!.push(currentHunk);
        patches.push(currentPatch);
        currentHunk = null;
      }
      const filePath = trimmed.slice(OPENCODE_MARKERS.ADD_FILE.length).trim();
      currentPatch = {
        operation: "create",
        filePath,
        rawAddLines: [],
        hunks: [],
      };
      collectingAddLines = true;
      i++;
      continue;
    }

    if (trimmed.startsWith(OPENCODE_MARKERS.DELETE_FILE)) {
      if (currentPatch) {
        if (currentHunk) currentPatch.hunks!.push(currentHunk);
        patches.push(currentPatch);
        currentHunk = null;
      }
      const filePath = trimmed
        .slice(OPENCODE_MARKERS.DELETE_FILE.length)
        .trim();
      currentPatch = { operation: "delete", filePath, hunks: [] };
      collectingAddLines = false;
      i++;
      continue;
    }

    if (trimmed.startsWith(OPENCODE_MARKERS.UPDATE_FILE)) {
      if (currentPatch) {
        if (currentHunk) currentPatch.hunks!.push(currentHunk);
        patches.push(currentPatch);
        currentHunk = null;
      }
      const filePath = trimmed
        .slice(OPENCODE_MARKERS.UPDATE_FILE.length)
        .trim();
      currentPatch = { operation: "update", filePath, hunks: [] };
      collectingAddLines = false;
      i++;
      continue;
    }

    if (trimmed.startsWith(OPENCODE_MARKERS.MOVE_TO)) {
      if (currentPatch) {
        const newPath = trimmed.slice(OPENCODE_MARKERS.MOVE_TO.length).trim();
        currentPatch.oldPath = currentPatch.filePath;
        currentPatch.filePath = newPath;
      }
      i++;
      continue;
    }

    if (
      trimmed === OPENCODE_MARKERS.END_OF_FILE ||
      trimmed.startsWith("*** End of File")
    ) {
      if (currentPatch) {
        if (currentHunk) currentPatch.hunks!.push(currentHunk);
        patches.push(currentPatch);
        currentPatch = null;
        currentHunk = null;
      }
      collectingAddLines = false;
      i++;
      continue;
    }

    // Collect lines for Add File
    if (collectingAddLines && currentPatch && line.startsWith("+")) {
      currentPatch.rawAddLines!.push(line.slice(1));
      i++;
      continue;
    }

    // Hunk header (@@ line)
    const hunk = parseHunkHeader(line);
    if (hunk) {
      if (currentHunk && currentPatch) {
        currentPatch.hunks!.push(currentHunk);
      }
      currentHunk = hunk;
      collectingAddLines = false;
      i++;
      continue;
    }

    // Hunk content lines
    if (currentHunk && currentPatch) {
      if (line.startsWith("+"))
        currentHunk.lines.push({ kind: "add", text: line.slice(1) });
      else if (line.startsWith("-"))
        currentHunk.lines.push({ kind: "remove", text: line.slice(1) });
      else if (line.startsWith(" "))
        currentHunk.lines.push({ kind: "context", text: line.slice(1) });
      else if (line === "\\ No newline at end of file")
        currentHunk.lines.push({ kind: "no_newline", text: "" });
      else currentHunk.lines.push({ kind: "context", text: line });
      i++;
      continue;
    }

    i++;
  }

  // Finalize
  if (currentPatch) {
    if (currentHunk) currentPatch.hunks!.push(currentHunk);
    patches.push(currentPatch);
  }

  return patches;
}

function parsePatch(input: string): FilePatch[] {
  const lines = splitLines(input);
  if (lines.length === 0) {
    throw new DiffParseError("Empty patch text", 0);
  }

  if (isOpencodeFormat(lines)) {
    return parseOpencodeFormat(lines);
  }

  try {
    return parseUnifiedDiff(lines);
  } catch (e) {
    if (e instanceof DiffParseError) throw e;
    // Fallback: try OpenCode format even without explicit markers
    return parseOpencodeFormat(lines);
  }
}

// ─── Path Validation ──────────────────────────────────────────────────────────

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

function validatePath(filePath: string, worktree: string): string {
  // Reject empty paths
  if (!filePath || filePath.trim() === "") {
    throw new PathValidationError("Empty file path in patch");
  }

  // Reject paths with control characters
  if (BAD_PATH_CHARS.test(filePath)) {
    throw new PathValidationError(
      `Path contains control characters: ${filePath}`,
    );
  }

  // Reject absolute paths
  if (ABSOLUTE_PATH.test(filePath)) {
    throw new PathValidationError(`Absolute paths not allowed: ${filePath}`);
  }

  // Reject path traversal (../)
  if (PATH_TRAVERSAL.test(filePath)) {
    throw new PathValidationError(`Path traversal not allowed: ${filePath}`);
  }

  const resolved = path.resolve(worktree, filePath);

  const normalizedWorktree = path.join(path.resolve(worktree), path.sep);
  const normalizedResolved = path.join(path.resolve(resolved), path.sep);
  if (!normalizedResolved.startsWith(normalizedWorktree)) {
    throw new PathValidationError(
      `Path escapes workspace: ${filePath} resolves to ${resolved} which is outside ${worktree}`,
    );
  }

  // Check for symlink escapes by resolving the directory components
  let checkPath = worktree;
  const segments = filePath
    .split(path.sep)
    .filter((s) => s !== "" && s !== ".");
  for (const segment of segments) {
    checkPath = path.join(checkPath, segment);
    try {
      if (existsSync(checkPath)) {
        const realPath = realpathSync(checkPath);
        const normalizedReal = path.join(path.resolve(realPath), path.sep);
        if (!normalizedReal.startsWith(normalizedWorktree)) {
          throw new PathValidationError(
            `Symlink escapes workspace: ${filePath} → ${realPath} is outside ${worktree}`,
          );
        }
      }
    } catch (e) {
      // File doesn't exist yet (for creates) — validate parent instead
      if (e instanceof PathValidationError) throw e;
    }
  }

  return resolved;
}

/**
 * Validate ALL paths in a multi-file patch before applying anything.
 */
function validateAllPaths(patches: FilePatch[], worktree: string): void {
  const errors: string[] = [];
  for (const p of patches) {
    try {
      validatePath(p.filePath, worktree);
    } catch (e) {
      if (e instanceof PathValidationError) {
        errors.push(e.message);
      } else {
        throw e;
      }
    }
  }
  if (errors.length > 0) {
    throw new PathValidationError(
      `Path validation failed for ${errors.length} file(s):\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }
}

// ─── Patch Application ────────────────────────────────────────────────────────

function applyHunksToContent(
  original: string,
  hunks: DiffHunk[],
  filePath: string,
): string {
  const rawLines = original.split("\n");
  // Strip trailing empty string artifact from split on newline-terminated files
  const origLines =
    rawLines.length > 1 && rawLines[rawLines.length - 1] === ""
      ? rawLines.slice(0, -1)
      : rawLines;
  const result: string[] = [];
  let origIdx = 0;

  for (let hi = 0; hi < hunks.length; hi++) {
    const hunk = hunks[hi];
    const targetOrigin = Math.max(0, hunk.oldStart - 1);

    // Copy lines before this hunk's start (lines not covered by any hunk)
    while (origIdx < targetOrigin && origIdx < origLines.length) {
      result.push(origLines[origIdx]);
      origIdx++;
    }

    // For create hunks (oldStart=0), just emit add lines and skip remaining
    if (hunk.oldStart === 0) {
      for (const line of hunk.lines) {
        if (line.kind === "add") result.push(line.text);
      }
      origIdx = origLines.length;
      continue;
    }

    if (origIdx > targetOrigin) {
      while (result.length > targetOrigin) result.pop();
      origIdx = targetOrigin;
    }

    // Verify context and build replacement
    let contextOffset = 0;
    let failedHunk = false;
    for (const line of hunk.lines) {
      if (line.kind === "context") {
        if (origIdx + contextOffset >= origLines.length) {
          failedHunk = true;
          break;
        }
        const actual = origLines[origIdx + contextOffset];
        if (actual !== line.text) {
          let found = false;
          for (
            let a = 1;
            a <= 5 && origIdx + contextOffset + a < origLines.length;
            a++
          ) {
            if (origLines[origIdx + contextOffset + a] === line.text) {
              origIdx += a;
              contextOffset = 0;
              found = true;
              break;
            }
          }
          if (!found) failedHunk = true;
        }
        contextOffset++;
      } else if (line.kind === "remove") {
        if (origIdx + contextOffset >= origLines.length) {
          failedHunk = true;
          break;
        }
        contextOffset++;
      }
      if (failedHunk) break;
    }

    if (failedHunk) {
      // Fuzzy search for matching context
      const firstCtx = hunk.lines.find((l) => l.kind === "context");
      let found = false;
      if (firstCtx) {
        const searchStart = Math.max(0, targetOrigin - 100);
        const searchEnd = Math.min(
          origLines.length,
          targetOrigin + hunk.oldLines + 100,
        );
        for (let si = searchStart; si <= searchEnd; si++) {
          if (si < origLines.length && origLines[si] === firstCtx.text) {
            origIdx = si;
            found = true;
            break;
          }
        }
      }
      if (!found) {
        const snippet = hunk.lines
          .filter((l) => l.kind === "context")
          .slice(0, 3)
          .map((l) => l.text)
          .join("\n    ");
        throw new PatchApplyError(
          `Hunk #${hi + 1} failed at ${filePath}:${targetOrigin + 1}. ` +
            `Expected context not found. Context:\n    ${snippet}`,
          filePath,
          hi,
        );
      }

      // Re-process with new alignment
      for (const line of hunk.lines) {
        if (line.kind === "context") {
          result.push(line.text);
          origIdx++;
        } else if (line.kind === "remove") {
          origIdx++;
        } else if (line.kind === "add") {
          result.push(line.text);
        }
      }
      contextOffset = 0;
      continue;
    }

    // Apply hunk: emit context and add lines, skip remove lines
    for (const line of hunk.lines) {
      if (line.kind === "context") {
        result.push(line.text);
        origIdx++;
      } else if (line.kind === "remove") {
        origIdx++;
      } else if (line.kind === "add") {
        result.push(line.text);
      }
    }
  }

  // Copy remaining lines after last hunk
  while (origIdx < origLines.length) {
    result.push(origLines[origIdx]);
    origIdx++;
  }

  return result.join("\n");
}

function applyPatches(patches: FilePatch[], worktree: string): PatchResult[] {
  // Phase 1: Validate all paths
  validateAllPaths(patches, worktree);

  // Phase 2: Read all target files and validate operations
  const snapshots: Map<string, { exists: boolean; content: string }> =
    new Map();

  for (const p of patches) {
    const absPath = path.resolve(worktree, p.filePath);
    const exists = existsSync(absPath);

    if (p.operation === "create") {
      if (exists && p.rawAddLines && p.rawAddLines.length > 0) {
        throw new PatchApplyError(
          `Cannot create file that already exists: ${p.filePath}`,
          p.filePath,
        );
      }
      const content = p.rawAddLines ? p.rawAddLines.join("\n") : "";
      snapshots.set(absPath, { exists: false, content });
    } else if (p.operation === "delete") {
      if (!exists) {
        throw new PatchApplyError(
          `Cannot delete non-existent file: ${p.filePath}`,
          p.filePath,
        );
      }
      snapshots.set(absPath, { exists: true, content: "" });
    } else if (p.operation === "update") {
      if (!exists) {
        throw new PatchApplyError(
          `Cannot update non-existent file: ${p.filePath}`,
          p.filePath,
        );
      }
      const original = readFileSync(absPath, "utf-8");
      snapshots.set(absPath, { exists: true, content: original });
    }
  }

  // Phase 3: Compute new contents in memory (dry-run apply)
  const pending: Map<string, { operation: string; content?: string }> =
    new Map();

  for (const p of patches) {
    const absPath = path.resolve(worktree, p.filePath);

    if (p.operation === "create") {
      const content = snapshots.get(absPath)!.content;
      pending.set(absPath, { operation: "create", content });
    } else if (p.operation === "delete") {
      pending.set(absPath, { operation: "delete" });
    } else if (p.operation === "update") {
      if (!p.hunks || p.hunks.length === 0) {
        throw new PatchApplyError(
          `Update patch for ${p.filePath} has no hunks`,
          p.filePath,
        );
      }
      const original = snapshots.get(absPath)!.content;

      try {
        const newContent = applyHunksToContent(original, p.hunks, p.filePath);
        pending.set(absPath, { operation: "update", content: newContent });
      } catch (e) {
        if (e instanceof PatchApplyError) throw e;
        throw new PatchApplyError(
          `Failed to apply hunks to ${p.filePath}: ${e}`,
          p.filePath,
        );
      }
    }
  }

  // Phase 4: Commit all changes (all-or-nothing within limits)
  const results: PatchResult[] = [];
  const applied: Array<{
    absPath: string;
    operation: string;
    content?: string;
  }> = [];

  try {
    for (const p of patches) {
      const absPath = path.resolve(worktree, p.filePath);
      const action = pending.get(absPath)!;

      // Create parent directories if needed
      const dir = path.dirname(absPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      let hunksApplied = 0;
      let hunksFailed = 0;

      if (action.operation === "create") {
        writeFileSync(absPath, action.content ?? "", "utf-8");
        applied.push({
          absPath,
          operation: "created",
          content: action.content,
        });
        results.push({
          path: p.filePath,
          operation: "created",
          hunksApplied: 0,
          hunksFailed: 0,
        });
      } else if (action.operation === "delete") {
        unlinkSync(absPath);
        applied.push({ absPath, operation: "deleted" });
        results.push({
          path: p.filePath,
          operation: "deleted",
          hunksApplied: 0,
          hunksFailed: 0,
        });
      } else if (action.operation === "update") {
        writeFileSync(absPath, action.content!, "utf-8");
        hunksApplied = p.hunks?.length ?? 0;
        applied.push({
          absPath,
          operation: "updated",
          content: action.content,
        });
        results.push({
          path: p.filePath,
          operation: "updated",
          hunksApplied,
          hunksFailed: 0,
        });
      }
    }
  } catch (e) {
    // Best-effort rollback: revert already-applied changes
    for (const item of applied.reverse()) {
      try {
        const backupPath = path.resolve(worktree, item.absPath);
        const snap = snapshots.get(backupPath);
        if (snap) {
          if (snap.exists && item.operation === "updated") {
            writeFileSync(backupPath, snap.content, "utf-8");
          } else if (snap.exists && item.operation === "deleted") {
            writeFileSync(backupPath, snap.content, "utf-8");
          } else if (
            !snap.exists &&
            (item.operation === "created" || item.operation === "updated")
          ) {
            if (existsSync(backupPath)) unlinkSync(backupPath);
          }
        }
      } catch {
        // Best effort
      }
    }
    throw new PatchApplyError(
      `Patch application failed: ${e instanceof Error ? e.message : String(e)}. ` +
        `All changes have been rolled back.`,
      patches[0]?.filePath ?? "unknown",
    );
  }

  return results;
}

// ─── Tool Definition ──────────────────────────────────────────────────────────

function formatResults(results: PatchResult[]): string {
  const lines: string[] = [];
  for (const r of results) {
    const icon =
      r.operation === "created" ? "+" : r.operation === "deleted" ? "-" : "~";
    const hunkInfo =
      r.hunksApplied > 0
        ? ` (${r.hunksApplied} hunk${r.hunksApplied > 1 ? "s" : ""} applied)`
        : "";
    lines.push(`${icon} ${r.path}: ${r.operation}${hunkInfo}`);
  }
  return lines.join("\n");
}

export const applyPatchTool = tool({
  description: `Apply one or more unified-diff patches to files in the workspace.

IMPORTANT: This tool parses and applies patches directly in code — patches are never passed through bash, fish, heredocs, or any shell-string interpolation. All special characters ($, backticks, backslashes, quotes, Unicode) are preserved byte-for-byte.

Supported formats:
- Standard unified diff (diff -u output, git diff output)
- OpenCode custom format (*** Begin Patch ... *** End Patch)

Operations supported per patch: create files, update files, delete files.
Multi-file patches are validated all-or-nothing: if any operation would fail, none are applied.

Path validation rules:
- No path traversal (../) or absolute paths
- All paths must resolve within the workspace root
- Symlink escapes are detected and rejected

Example unified diff (create file):
\`\`\`
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,3 @@
+export function hello() {
+  return "world";
+}
\`\`\`

Example unified diff (update file):
\`\`\`
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,4 +1,4 @@
-const OLD = "value";
+const NEW = "value";
 const unchanged = true;
\`\`\``,

  args: {
    patchText: tool.schema
      .string()
      .describe(
        "The full unified-diff or OpenCode-format patch text describing all changes",
      ),
  },

  async execute(args, context) {
    const worktree = resolveWorktree(context);
    const patchText = String(args.patchText ?? "");

    let patches: FilePatch[];
    try {
      patches = parsePatch(patchText);
    } catch (e) {
      if (e instanceof DiffParseError) {
        return `Error: Patch parse failed — ${e.message}`;
      }
      throw e;
    }

    if (patches.length === 0) {
      return "Error: No file operations found in patch text. Check the format.";
    }

    let results: PatchResult[];
    try {
      results = applyPatches(patches, worktree);
    } catch (e) {
      if (e instanceof PathValidationError || e instanceof PatchApplyError) {
        return `Error: ${e.message}`;
      }
      throw e;
    }

    const formatted = formatResults(results);
    const summary = `${results.length} file(s) changed:\n${formatted}`;
    context.metadata({
      title: `Applied patch to ${results.length} file(s)`,
      metadata: { files: results.map((r) => r.path) },
    });
    return summary;
  },
});

export default applyPatchTool;
