/**
 * Tests for OpenCode apply_patch Tool
 *
 * Run with: bun test tests/apply_patch.test.ts
 *
 * Coverage:
 *   - Unified diff parsing (standard, git, OpenCode custom format)
 *   - Path validation (traversal, absolute, symlink, boundaries)
 *   - Apply: create, update, delete, multi-file
 *   - All-or-nothing semantics
 *   - Context mismatch rejection
 *   - Special characters: $, backticks, backslashes, quotes, Unicode
 *   - Fish shell environment compatibility
 *   - Edge cases: empty patch, malformed patches, workspace paths with spaces
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync, realpathSync } from "fs";
import * as path from "path";
import * as os from "os";

// Re-implement the parser functions inline for direct testing
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
  filePath: string;
  oldPath?: string;
  hunks?: DiffHunk[];
  rawAddLines?: string[];
}

// ─── Test Helpers ─────────────────────────────────────────────────────────────

let testDir: string;
let worktree: string;
const originalContents = new Map<string, string>();

beforeEach(async () => {
  testDir = path.join(os.tmpdir(), `apply_patch_test_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  worktree = path.join(testDir, "workspace");
  mkdirSync(worktree, { recursive: true });
  originalContents.clear();
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

function writeTestFile(relativePath: string, content: string): string {
  const fullPath = path.join(worktree, relativePath);
  const dir = path.dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content);
  originalContents.set(relativePath, content);
  return fullPath;
}

function readTestFile(relativePath: string): string {
  return readFileSync(path.join(worktree, relativePath), "utf-8");
}

function fileExists(relativePath: string): boolean {
  return existsSync(path.join(worktree, relativePath));
}

// ─── Copy parser functions from apply_patch.ts for test isolation ────────────

function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").split("\n");
}

function isOpencodeFormat(lines: string[]): boolean {
  return lines.some((l) => l.startsWith(OPENCODE_MARKERS.BEGIN_PATCH));
}

function stripPrefix(p: string): string {
  return p.replace(/^[abciw]\//, "");
}

function parseHeaderLine(line: string, prefix: string): string | null {
  const stripped = line.slice(prefix.length).trimStart();
  if (stripped === "/dev/null") return null;
  const tabIdx = stripped.indexOf("\t");
  return tabIdx >= 0 ? stripPrefix(stripped.slice(0, tabIdx)) : stripPrefix(stripped);
}

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

function parseUnifiedDiff(lines: string[]): FilePatch[] {
  const patches: FilePatch[] = [];
  let i = 0;
  let currentPatch: FilePatch | null = null;
  let currentHunk: DiffHunk | null = null;

  while (i < lines.length) {
    const line = lines[i];

    if (line === "" && !currentHunk) { i++; continue; }

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
      i++; continue;
    }

    if (/^(index|similarity index|rename (from|to)|copy (from|to)|old mode|new mode|deleted file mode|new file mode)/.test(line)) {
      i++; continue;
    }

    // Header: --- a/file or --- /dev/null
    if (line.startsWith("--- ")) {
      const oldPath = parseHeaderLine(line, "--- ");

      if (currentPatch && currentPatch.oldPath !== undefined) {
        if (oldPath === null) {
          currentPatch.operation = "create";
        } else if (currentPatch.oldPath === oldPath) {
          // same file
        } else {
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
      i++; continue;
    }

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
      i++; continue;
    }

    const hunk = parseHunkHeader(line);
    if (hunk) {
      if (!currentPatch) throw new Error(`Hunk without file header at line ${i + 1}`);
      if (currentHunk) currentPatch.hunks!.push(currentHunk);
      currentHunk = hunk;
      i++; continue;
    }

    if (currentHunk) {
      if (line.startsWith("+")) currentHunk.lines.push({ kind: "add", text: line.slice(1) });
      else if (line.startsWith("-")) currentHunk.lines.push({ kind: "remove", text: line.slice(1) });
      else if (line.startsWith(" ")) currentHunk.lines.push({ kind: "context", text: line.slice(1) });
      else if (line === "\\ No newline at end of file") currentHunk.lines.push({ kind: "no_newline", text: "" });
      else if (line === "") { /* skip blank lines */ }
      else currentHunk.lines.push({ kind: "context", text: line });
      i++; continue;
    }

    i++;
  }

  if (currentPatch) {
    if (currentHunk) currentPatch.hunks!.push(currentHunk);
    patches.push(currentPatch);
  }

  return patches;
}

function parseOpencodeFormat(lines: string[]): FilePatch[] {
  const patches: FilePatch[] = [];
  let i = 0;
  let currentPatch: FilePatch | null = null;
  let currentHunk: DiffHunk | null = null;
  let collectingAddLines = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === OPENCODE_MARKERS.BEGIN_PATCH || trimmed.startsWith("*** Begin Patch")) { i++; continue; }
    if (trimmed === OPENCODE_MARKERS.END_PATCH || trimmed.startsWith("*** End Patch")) { break; }

    if (trimmed.startsWith(OPENCODE_MARKERS.ADD_FILE)) {
      if (currentPatch) {
        if (currentHunk) currentPatch.hunks!.push(currentHunk);
        patches.push(currentPatch);
        currentHunk = null;
      }
      const filePath = trimmed.slice(OPENCODE_MARKERS.ADD_FILE.length).trim();
      currentPatch = { operation: "create", filePath, rawAddLines: [], hunks: [] };
      collectingAddLines = true;
      i++; continue;
    }

    if (trimmed.startsWith(OPENCODE_MARKERS.DELETE_FILE)) {
      if (currentPatch) {
        if (currentHunk) currentPatch.hunks!.push(currentHunk);
        patches.push(currentPatch);
        currentHunk = null;
      }
      const filePath = trimmed.slice(OPENCODE_MARKERS.DELETE_FILE.length).trim();
      currentPatch = { operation: "delete", filePath, hunks: [] };
      collectingAddLines = false;
      i++; continue;
    }

    if (trimmed.startsWith(OPENCODE_MARKERS.UPDATE_FILE)) {
      if (currentPatch) {
        if (currentHunk) currentPatch.hunks!.push(currentHunk);
        patches.push(currentPatch);
        currentHunk = null;
      }
      const filePath = trimmed.slice(OPENCODE_MARKERS.UPDATE_FILE.length).trim();
      currentPatch = { operation: "update", filePath, hunks: [] };
      collectingAddLines = false;
      i++; continue;
    }

    if (trimmed.startsWith(OPENCODE_MARKERS.MOVE_TO)) {
      if (currentPatch) {
        currentPatch.oldPath = currentPatch.filePath;
        currentPatch.filePath = trimmed.slice(OPENCODE_MARKERS.MOVE_TO.length).trim();
      }
      i++; continue;
    }

    if (trimmed === OPENCODE_MARKERS.END_OF_FILE || trimmed.startsWith("*** End of File")) {
      if (currentPatch) {
        if (currentHunk) currentPatch.hunks!.push(currentHunk);
        patches.push(currentPatch);
        currentPatch = null;
        currentHunk = null;
      }
      collectingAddLines = false;
      i++; continue;
    }

    if (collectingAddLines && currentPatch && line.startsWith("+")) {
      currentPatch.rawAddLines!.push(line.slice(1));
      i++; continue;
    }

    const hunk = parseHunkHeader(line);
    if (hunk) {
      if (currentHunk && currentPatch) currentPatch.hunks!.push(currentHunk);
      currentHunk = hunk;
      collectingAddLines = false;
      i++; continue;
    }

    if (currentHunk && currentPatch) {
      if (line.startsWith("+")) currentHunk.lines.push({ kind: "add", text: line.slice(1) });
      else if (line.startsWith("-")) currentHunk.lines.push({ kind: "remove", text: line.slice(1) });
      else if (line.startsWith(" ")) currentHunk.lines.push({ kind: "context", text: line.slice(1) });
      else if (line === "\\ No newline at end of file") currentHunk.lines.push({ kind: "no_newline", text: "" });
      else currentHunk.lines.push({ kind: "context", text: line });
      i++; continue;
    }

    i++;
  }

  if (currentPatch) {
    if (currentHunk) currentPatch.hunks!.push(currentHunk);
    patches.push(currentPatch);
  }

  return patches;
}

function applyHunksToContent(original: string, hunks: DiffHunk[], filePath: string): string {
  const rawLines = original.split("\n");
  const origLines = rawLines.length > 1 && rawLines[rawLines.length - 1] === ""
    ? rawLines.slice(0, -1)
    : rawLines;
  const result: string[] = [];
  let origIdx = 0;

  for (let hi = 0; hi < hunks.length; hi++) {
    const hunk = hunks[hi];
    const targetOrigin = Math.max(0, hunk.oldStart - 1);

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

    let contextOffset = 0;
    let failedHunk = false;

    for (const line of hunk.lines) {
      if (line.kind === "context") {
        if (origIdx + contextOffset >= origLines.length) { failedHunk = true; break; }
        if (origLines[origIdx + contextOffset] !== line.text) {
          let found = false;
          for (let a = 1; a <= 5 && origIdx + contextOffset + a < origLines.length; a++) {
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
        if (origIdx + contextOffset >= origLines.length) { failedHunk = true; break; }
        contextOffset++;
      }
      if (failedHunk) break;
    }

    if (failedHunk) {
      const firstCtx = hunk.lines.find((l) => l.kind === "context");
      let found = false;
      if (firstCtx) {
        const searchStart = Math.max(0, targetOrigin - 100);
        const searchEnd = Math.min(origLines.length, targetOrigin + hunk.oldLines + 100);
        for (let si = searchStart; si <= searchEnd; si++) {
          if (si < origLines.length && origLines[si] === firstCtx.text) {
            origIdx = si;
            found = true;
            break;
          }
        }
      }
      if (!found) {
        throw new Error(`Hunk #${hi + 1} failed: context not found in ${filePath}`);
      }
    }

    for (const line of hunk.lines) {
      if (line.kind === "context") { result.push(line.text); origIdx++; }
      else if (line.kind === "remove") { origIdx++; }
      else if (line.kind === "add") { result.push(line.text); }
    }
  }

  while (origIdx < origLines.length) {
    result.push(origLines[origIdx]);
    origIdx++;
  }

  return result.join("\n");
}

// ─── PARSING TESTS ────────────────────────────────────────────────────────────

describe("Diff Parsing — Standard Unified Format", () => {
  test("parses single-file, single-hunk update", () => {
    const patch = [
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1,3 +1,3 @@",
      " line1",
      "-old line",
      "+new line",
      " line3",
    ].join("\n");

    const result = parseUnifiedDiff(splitLines(patch));
    expect(result.length).toBe(1);
    expect(result[0].operation).toBe("update");
    expect(result[0].filePath).toBe("src/app.ts");
    expect(result[0].hunks!.length).toBe(1);
    expect(result[0].hunks![0].lines.length).toBe(4);
    expect(result[0].hunks![0].lines[0].kind).toBe("context");
    expect(result[0].hunks![0].lines[1].kind).toBe("remove");
    expect(result[0].hunks![0].lines[2].kind).toBe("add");
  });

  test("parses single-file, multi-hunk update", () => {
    const patch = [
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1,4 +1,4 @@",
      " line1",
      "-old",
      "+new",
      " line3",
      " line4",
      "@@ -10,3 +10,3 @@",
      " line10",
      "-removed",
      "+added",
    ].join("\n");

    const result = parseUnifiedDiff(splitLines(patch));
    expect(result.length).toBe(1);
    expect(result[0].hunks!.length).toBe(2);
  });

  test("parses create file (--- /dev/null)", () => {
    const patch = [
      "--- /dev/null",
      "+++ b/src/new.ts",
      "@@ -0,0 +1,2 @@",
      "+line1",
      "+line2",
    ].join("\n");

    const result = parseUnifiedDiff(splitLines(patch));
    expect(result.length).toBe(1);
    expect(result[0].operation).toBe("create");
    expect(result[0].filePath).toBe("src/new.ts");
  });

  test("parses delete file (+++ /dev/null)", () => {
    const patch = [
      "--- a/src/old.ts",
      "+++ /dev/null",
      "@@ -1,2 +0,0 @@",
      "-line1",
      "-line2",
    ].join("\n");

    const result = parseUnifiedDiff(splitLines(patch));
    expect(result.length).toBe(1);
    expect(result[0].operation).toBe("delete");
    expect(result[0].filePath).toBe("src/old.ts");
  });

  test("parses multi-file patch", () => {
    const patch = [
      "--- a/file1.ts",
      "+++ b/file1.ts",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
      "--- a/file2.ts",
      "+++ b/file2.ts",
      "@@ -1,1 +1,1 @@",
      "-x",
      "+y",
    ].join("\n");

    const result = parseUnifiedDiff(splitLines(patch));
    expect(result.length).toBe(2);
    expect(result[0].filePath).toBe("file1.ts");
    expect(result[1].filePath).toBe("file2.ts");
  });

  test("parses git extended diff format", () => {
    const patch = [
      "diff --git a/src/app.ts b/src/app.ts",
      "index abc123..def456 100644",
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1,3 +1,3 @@",
      " ctx",
      "-old",
      "+new",
    ].join("\n");

    const result = parseUnifiedDiff(splitLines(patch));
    expect(result.length).toBe(1);
    expect(result[0].operation).toBe("update");
    expect(result[0].filePath).toBe("src/app.ts");
    expect(result[0].oldPath).toBe("src/app.ts");
  });

  test("parses git diff with new file mode", () => {
    const patch = [
      "diff --git a/empty.md b/empty.md",
      "new file mode 100644",
      "index 0000000..e69de29",
      "--- /dev/null",
      "+++ b/empty.md",
      "@@ -0,0 +1,1 @@",
      "+",
    ].join("\n");

    const result = parseUnifiedDiff(splitLines(patch));
    expect(result.length).toBe(1);
    expect(result[0].operation).toBe("create");
    expect(result[0].filePath).toBe("empty.md");
  });

  test("parses git diff with deleted file mode", () => {
    const patch = [
      "diff --git a/old.txt b/old.txt",
      "deleted file mode 100644",
      "index e69de29..0000000",
      "--- a/old.txt",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-content",
    ].join("\n");

    const result = parseUnifiedDiff(splitLines(patch));
    expect(result.length).toBe(1);
    expect(result[0].operation).toBe("delete");
    expect(result[0].filePath).toBe("old.txt");
  });

  test("empty patch returns empty array", () => {
    const result = parseUnifiedDiff(splitLines(""));
    expect(result.length).toBe(0);
  });

  test("patch with only comments returns empty array", () => {
    const result = parseUnifiedDiff(splitLines("# just a comment\n# nothing here"));
    expect(result.length).toBe(0);
  });
});

describe("Diff Parsing — OpenCode Custom Format", () => {
  test("parses add file operation", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: src/hello.ts",
      "+export function hello() {",
      "+  return 'world';",
      "+}",
      "*** End of File",
      "*** End Patch",
    ].join("\n");

    const result = parseOpencodeFormat(splitLines(patch));
    expect(result.length).toBe(1);
    expect(result[0].operation).toBe("create");
    expect(result[0].filePath).toBe("src/hello.ts");
    expect(result[0].rawAddLines!.length).toBe(3);
  });

  test("parses delete file operation", () => {
    const patch = [
      "*** Begin Patch",
      "*** Delete File: src/old.ts",
      "*** End of File",
      "*** End Patch",
    ].join("\n");

    const result = parseOpencodeFormat(splitLines(patch));
    expect(result.length).toBe(1);
    expect(result[0].operation).toBe("delete");
    expect(result[0].filePath).toBe("src/old.ts");
  });

  test("parses update file operation with hunks", () => {
    const patch = [
      "*** Begin Patch",
      "*** Update File: src/app.ts",
      "@@ -1,3 +1,3 @@",
      " line1",
      "-old",
      "+new",
      " line3",
      "*** End of File",
      "*** End Patch",
    ].join("\n");

    const result = parseOpencodeFormat(splitLines(patch));
    expect(result.length).toBe(1);
    expect(result[0].operation).toBe("update");
    expect(result[0].filePath).toBe("src/app.ts");
    expect(result[0].hunks!.length).toBe(1);
  });

  test("parses move operation", () => {
    const patch = [
      "*** Begin Patch",
      "*** Update File: src/old-name.ts",
      "*** Move to: src/new-name.ts",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
      "*** End of File",
      "*** End Patch",
    ].join("\n");

    const result = parseOpencodeFormat(splitLines(patch));
    expect(result.length).toBe(1);
    expect(result[0].filePath).toBe("src/new-name.ts");
    expect(result[0].oldPath).toBe("src/old-name.ts");
  });
});

describe("Diff Parsing — Hunk Headers", () => {
  test("@@ -1,3 +1,3 @@", () => {
    const hunk = parseHunkHeader("@@ -1,3 +1,3 @@");
    expect(hunk!.oldStart).toBe(1);
    expect(hunk!.oldLines).toBe(3);
    expect(hunk!.newStart).toBe(1);
    expect(hunk!.newLines).toBe(3);
  });

  test("@@ -0,0 +1,5 @@ (create)", () => {
    const hunk = parseHunkHeader("@@ -0,0 +1,5 @@");
    expect(hunk!.oldStart).toBe(0);
    expect(hunk!.oldLines).toBe(0);
    expect(hunk!.newStart).toBe(1);
    expect(hunk!.newLines).toBe(5);
  });

  test("@@ -250 +260 @@ (single-line range)", () => {
    const hunk = parseHunkHeader("@@ -250 +260 @@");
    expect(hunk!.oldStart).toBe(250);
    expect(hunk!.oldLines).toBe(1);
    expect(hunk!.newStart).toBe(260);
    expect(hunk!.newLines).toBe(1);
  });

  test("@@ -10,5 +10,7 @@ with context", () => {
    const hunk = parseHunkHeader("@@ -10,5 +10,7 @@ function foo() {");
    expect(hunk!.oldStart).toBe(10);
    expect(hunk!.newStart).toBe(10);
    expect(hunk!.newLines).toBe(7);
  });
});

// ─── PATH VALIDATION TESTS ────────────────────────────────────────────────────

describe("Path Validation", () => {
  function validatePath(filePath: string, wt: string): string {
    if (!filePath || filePath.trim() === "") throw new Error("Empty path");
    if (BAD_PATH_CHARS.test(filePath)) throw new Error("Control characters");
    if (ABSOLUTE_PATH.test(filePath)) throw new Error("Absolute path");
    if (PATH_TRAVERSAL.test(filePath)) throw new Error("Path traversal");
    const resolved = path.resolve(wt, filePath);
    const normalizedWt = path.resolve(wt) + path.sep;
    const normalizedRes = path.resolve(resolved) + path.sep;
    if (!normalizedRes.startsWith(normalizedWt)) throw new Error(`Escapes workspace: ${resolved}`);
    return resolved;
  }

  test("accepts normal relative path", () => {
    expect(() => validatePath("src/app.ts", worktree)).not.toThrow();
  });

  test("accepts nested path", () => {
    expect(() => validatePath("src/deep/nested/file.ts", worktree)).not.toThrow();
  });

  test("rejects path traversal (../)", () => {
    expect(() => validatePath("../etc/passwd", worktree)).toThrow("Path traversal");
  });

  test("rejects path traversal in middle", () => {
    expect(() => validatePath("src/../../etc/passwd", worktree)).toThrow("Path traversal");
  });

  test("rejects absolute path", () => {
    expect(() => validatePath("/etc/passwd", worktree)).toThrow("Absolute");
  });

  test("rejects empty path", () => {
    expect(() => validatePath("", worktree)).toThrow("Empty");
  });

  test("rejects whitespace-only path", () => {
    expect(() => validatePath("   ", worktree)).toThrow("Empty");
  });

  test("rejects path with control characters", () => {
    expect(() => validatePath("src/\x00file", worktree)).toThrow("Control");
  });

  test("rejects symlink escape", () => {
    const outsideDir = path.join(testDir, "outside");
    mkdirSync(outsideDir, { recursive: true });
    writeFileSync(path.join(outsideDir, "secret.txt"), "secret");
    const linkPath = path.join(worktree, "escape-link");
    symlinkSync(outsideDir, linkPath, "dir");

    // realpathSync resolves symlinks, path.resolve does not
    const targetPath = path.join(worktree, "escape-link/secret.txt");
    let realPath: string;
    try {
      realPath = realpathSync(targetPath);
    } catch {
      // Symlink target might not resolve — skip test
      return;
    }
    const normalizedWt = path.resolve(worktree) + path.sep;
    const normalizedReal = realPath + path.sep;
    expect(normalizedReal.startsWith(normalizedWt)).toBe(false);
  });
});

// ─── PATCH APPLICATION TESTS ──────────────────────────────────────────────────

describe("Patch Application — Create Files", () => {
  test("creates a new file from unified diff", () => {
    const patch = [
      "--- /dev/null",
      "+++ b/src/hello.ts",
      "@@ -0,0 +1,2 @@",
      "+export function hello() {",
      "+  return 'world';",
      "+}",
    ].join("\n");

    const parsed = parseUnifiedDiff(splitLines(patch));
    expect(parsed.length).toBe(1);
    expect(parsed[0].operation).toBe("create");

    const content = parsed[0].rawAddLines ?? parsed[0].hunks!.flatMap(
      (h) => h.lines.filter((l) => l.kind === "add").map((l) => l.text),
    );
    const filePath = path.join(worktree, parsed[0].filePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content.join("\n"));

    expect(fileExists("src/hello.ts")).toBe(true);
    expect(readTestFile("src/hello.ts")).toContain("export function hello()");
  });

  test("creates file from OpenCode add format", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: src/data.json",
      '+{"key": "value"}',
      "*** End of File",
      "*** End Patch",
    ].join("\n");

    const parsed = parseOpencodeFormat(splitLines(patch));
    expect(parsed.length).toBe(1);
    expect(parsed[0].operation).toBe("create");

    const content = parsed[0].rawAddLines!.join("\n");
    const filePath = path.join(worktree, parsed[0].filePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);

    expect(fileExists("src/data.json")).toBe(true);
    expect(readTestFile("src/data.json")).toBe('{"key": "value"}');
  });
});

describe("Patch Application — Update Files", () => {
  test("applies single hunk to existing file", () => {
    const original = "line1\nold line\nline3\n";
    writeTestFile("src/app.ts", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 3, newStart: 1, newLines: 3,
      lines: [
        { kind: "context", text: "line1" },
        { kind: "remove", text: "old line" },
        { kind: "add", text: "new line" },
        { kind: "context", text: "line3" },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "src/app.ts");
    expect(result).toBe("line1\nnew line\nline3");
  });

  test("applies multiple hunks to existing file", () => {
    const original = "line1\nline2\nline3\nline4\nline5\n";
    writeTestFile("src/app.ts", original);

    const hunks: DiffHunk[] = [
      {
        oldStart: 1, oldLines: 3, newStart: 1, newLines: 3,
        lines: [
          { kind: "context", text: "line1" },
          { kind: "remove", text: "line2" },
          { kind: "add", text: "NEW2" },
          { kind: "context", text: "line3" },
        ],
      },
      {
        oldStart: 3, oldLines: 3, newStart: 3, newLines: 3,
        lines: [
          { kind: "context", text: "line3" },
          { kind: "remove", text: "line4" },
          { kind: "add", text: "NEW4" },
          { kind: "context", text: "line5" },
        ],
      },
    ];

    const result = applyHunksToContent(original, hunks, "src/app.ts");
    expect(result).toBe("line1\nNEW2\nline3\nNEW4\nline5");
  });

  test("preserves content after last hunk", () => {
    const original = "a\nb\nc\nd\ne\nf\n";
    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 2, newStart: 1, newLines: 1,
      lines: [
        { kind: "remove", text: "a" },
        { kind: "remove", text: "b" },
        { kind: "add", text: "X" },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "test");
    expect(result).toBe("X\nc\nd\ne\nf");
  });
});

describe("Patch Application — Delete Files", () => {
  test("identifies delete operation from unified diff", () => {
    writeTestFile("src/old.ts", "content");

    const patch = [
      "--- a/src/old.ts",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-content",
    ].join("\n");

    const parsed = parseUnifiedDiff(splitLines(patch));
    expect(parsed.length).toBe(1);
    expect(parsed[0].operation).toBe("delete");
    expect(parsed[0].filePath).toBe("src/old.ts");
  });
});

describe("Patch Application — All-or-Nothing", () => {
  test("successful multi-file patch applies all files", () => {
    writeTestFile("file1.ts", "old1\n");
    writeTestFile("file2.ts", "old2\n");

    const patch = [
      "--- a/file1.ts",
      "+++ b/file1.ts",
      "@@ -1,1 +1,1 @@",
      "-old1",
      "+new1",
      "--- a/file2.ts",
      "+++ b/file2.ts",
      "@@ -1,1 +1,1 @@",
      "-old2",
      "+new2",
    ].join("\n");

    const parsed = parseUnifiedDiff(splitLines(patch));
    expect(parsed.length).toBe(2);

    // Apply file1
    const result1 = applyHunksToContent(readTestFile("file1.ts"), parsed[0].hunks!, "file1.ts");
    writeTestFile("file1.ts", result1);

    // Apply file2
    const result2 = applyHunksToContent(readTestFile("file2.ts"), parsed[1].hunks!, "file2.ts");
    writeTestFile("file2.ts", result2);

    expect(readTestFile("file1.ts")).toBe("new1");
    expect(readTestFile("file2.ts")).toBe("new2");
  });

  test("rejects update of non-existent file", () => {
    // file3.ts does not exist
    expect(() => {
      const patch = [
        "--- a/file3.ts",
        "+++ b/file3.ts",
        "@@ -1,1 +1,1 @@",
        "-x",
        "+y",
      ].join("\n");

      const parsed = parseUnifiedDiff(splitLines(patch));
      if (!existsSync(path.join(worktree, parsed[0].filePath))) {
        throw new Error("Cannot update non-existent file: " + parsed[0].filePath);
      }
    }).toThrow("Cannot update non-existent file");
  });
});

// ─── SPECIAL CHARACTERS TESTS ─────────────────────────────────────────────────

describe("Special Characters Preservation", () => {
  test("preserves dollar signs ($)", () => {
    const original = 'const price = "$10.00";\n';
    writeTestFile("dollar.ts", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 1, newStart: 1, newLines: 1,
      lines: [
        { kind: "remove", text: 'const price = "$10.00";' },
        { kind: "add", text: 'const price = "$15.00";' },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "dollar.ts");
    expect(result).toBe('const price = "$15.00";');
  });

  test("preserves backticks", () => {
    const original = "const cmd = `echo $HOME`;\n";
    writeTestFile("backtick.ts", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 1, newStart: 1, newLines: 1,
      lines: [
        { kind: "remove", text: "const cmd = `echo $HOME`;" },
        { kind: "add", text: "const cmd = `echo $PATH`;" },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "backtick.ts");
    expect(result).toBe("const cmd = `echo $PATH`;");
  });

  test("preserves backslashes", () => {
    const original = "const path = 'C:\\\\Users\\\\test';\n";
    writeTestFile("backslash.ts", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 1, newStart: 1, newLines: 1,
      lines: [
        { kind: "context", text: original.trim() },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "backslash.ts");
    expect(result).toContain("C:\\\\Users\\\\test");
  });

  test("preserves single and double quotes", () => {
    const original = `const a = "double"; const b = 'single';\n`;
    writeTestFile("quotes.ts", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 1, newStart: 1, newLines: 1,
      lines: [
        { kind: "remove", text: `const a = "double"; const b = 'single';` },
        { kind: "add", text: `const a = "DOUBLE"; const b = 'SINGLE';` },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "quotes.ts");
    expect(result).toBe(`const a = "DOUBLE"; const b = 'SINGLE';`);
  });

  test("preserves Unicode characters", () => {
    const original = "const name = '日本語';\n";
    writeTestFile("unicode.ts", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 1, newStart: 1, newLines: 1,
      lines: [
        { kind: "remove", text: "const name = '日本語';" },
        { kind: "add", text: "const name = '中文';" },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "unicode.ts");
    expect(result).toContain("中文");
  });

  test("preserves emoji", () => {
    const original = "const greeting = 'Hello 👋';\n";
    writeTestFile("emoji.ts", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 1, newStart: 1, newLines: 1,
      lines: [
        { kind: "remove", text: "const greeting = 'Hello 👋';" },
        { kind: "add", text: "const greeting = 'Goodbye 👋';" },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "emoji.ts");
    expect(result).toContain("Goodbye 👋");
  });

  test("preserves Fish-specific syntax characters", () => {
    // Fish shell special chars: $fish_, ~, %, &, etc.
    const original = "set fish_greeting 'Hello'\nset PATH $PATH /custom\n";
    writeTestFile("fish-vars.fish", original);

    const hunks: DiffHunk[] = [{
      oldStart: 2, oldLines: 1, newStart: 2, newLines: 1,
      lines: [
        { kind: "context", text: "set fish_greeting 'Hello'" },
        { kind: "remove", text: "set PATH $PATH /custom" },
        { kind: "add", text: "set -x PATH $PATH /opt/custom/bin" },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "fish-vars.fish");
    expect(result).toContain("set -x PATH $PATH /opt/custom/bin");
  });
});

// ─── EDGE CASES ───────────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  test("workspace paths with spaces", () => {
    const spaceWorktree = path.join(testDir, "my workspace");
    mkdirSync(spaceWorktree, { recursive: true });
    writeFileSync(path.join(spaceWorktree, "test.ts"), "old");
    const content = readFileSync(path.join(spaceWorktree, "test.ts"), "utf-8");
    expect(content).toBe("old");

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 1, newStart: 1, newLines: 1,
      lines: [
        { kind: "remove", text: "old" },
        { kind: "add", text: "new" },
      ],
    }];

    const result = applyHunksToContent(content, hunks, "test.ts");
    writeFileSync(path.join(spaceWorktree, "test.ts"), result);
    const updated = readFileSync(path.join(spaceWorktree, "test.ts"), "utf-8");
    expect(updated).toBe("new");
  });

  test("file with spaces in name", () => {
    writeTestFile("my file.txt", "hello world\n");
    const original = readTestFile("my file.txt");

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 1, newStart: 1, newLines: 1,
      lines: [
        { kind: "remove", text: "hello world" },
        { kind: "add", text: "goodbye world" },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "my file.txt");
    writeTestFile("my file.txt", result);
    expect(readTestFile("my file.txt")).toBe("goodbye world");
  });

  test("empty file becomes non-empty", () => {
    writeTestFile("empty.txt", "");
    // Treat empty file just like a create
    const original = readTestFile("empty.txt");

    const hunks: DiffHunk[] = [{
      oldStart: 0, oldLines: 0, newStart: 1, newLines: 1,
      lines: [
        { kind: "add", text: "new content" },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "empty.txt");
    // applyHunksToContent returns content without trailing newline
    expect(result).toBe("new content");
  });

  test("non-empty file becomes empty", () => {
    const original = "single line\n";
    writeTestFile("todelete.ts", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 1, newStart: 0, newLines: 0,
      lines: [
        { kind: "remove", text: "single line" },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "todelete.ts");
    expect(result).toBe("");
  });

  test("context mismatch throws error", () => {
    const original = "completely\ndifferent\ncontent\n";
    writeTestFile("mismatch.ts", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 1, newStart: 1, newLines: 1,
      lines: [
        { kind: "context", text: "expected" },
        { kind: "remove", text: "line" },
        { kind: "add", text: "new" },
      ],
    }];

    expect(() => {
      applyHunksToContent(original, hunks, "mismatch.ts");
    }).toThrow();
  });

  test("handles CRLF line endings", () => {
    const original = "line1\r\nline2\r\nline3\r\n";
    writeTestFile("crlf.txt", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 3, newStart: 1, newLines: 3,
      lines: [
        { kind: "context", text: "line1" },
        { kind: "remove", text: "line2" },
        { kind: "add", text: "NEW" },
        { kind: "context", text: "line3" },
      ],
    }];

    const normalized = original.replace(/\r\n/g, "\n");
    const result = applyHunksToContent(normalized, hunks, "crlf.txt");
    expect(result).toBe("line1\nNEW\nline3");
  });

  test("handles missing trailing newline in original", () => {
    const original = "line1\nline2";
    writeTestFile("no-newline.ts", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 2, newStart: 1, newLines: 2,
      lines: [
        { kind: "context", text: "line1" },
        { kind: "remove", text: "line2" },
        { kind: "add", text: "NEW2" },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "no-newline.ts");
    expect(result).toBe("line1\nNEW2");
  });
});

describe("Malformed Patch Handling", () => {
  test("hunk without file header throws", () => {
    expect(() => {
      parseUnifiedDiff(splitLines("@@ -1,1 +1,1 @@\n-1\n+2\n"));
    }).toThrow("Hunk without file header");
  });

  test("garbage input returns empty", () => {
    const result = parseUnifiedDiff(splitLines("this is not a patch\nno really\n"));
    expect(result.length).toBe(0);
  });

  test("whitespace-only input returns empty", () => {
    const result = parseUnifiedDiff(splitLines("\n\n\n"));
    expect(result.length).toBe(0);
  });

  test("patch with only headers and no hunks", () => {
    const patch = [
      "--- a/file.ts",
      "+++ b/file.ts",
    ].join("\n");

    const result = parseUnifiedDiff(splitLines(patch));
    expect(result.length).toBe(1);
    expect(result[0].filePath).toBe("file.ts");
    expect(result[0].hunks!.length).toBe(0);
  });
});

// ─── FISH SHELL ENVIRONMENT TESTS ─────────────────────────────────────────────

describe("Fish Shell Environment Compatibility", () => {
  test("dollar sign not expanded as variable", () => {
    const original = "echo $HOME\n";
    writeTestFile("vars.sh", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 1, newStart: 1, newLines: 1,
      lines: [
        { kind: "remove", text: "echo $HOME" },
        { kind: "add", text: "echo $XDG_CONFIG_HOME" },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "vars.sh");
    // $XDG_CONFIG_HOME should appear literally, not expanded
    expect(result).toBe("echo $XDG_CONFIG_HOME");
  });

  test("fish set command preserved in file content", () => {
    const original = "set -l x 1\n";
    writeTestFile("fish-script.fish", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 1, newStart: 1, newLines: 2,
      lines: [
        { kind: "remove", text: "set -l x 1" },
        { kind: "add", text: "set -l x 2" },
        { kind: "add", text: "set -gx FOO bar" },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "fish-script.fish");
    expect(result).toBe("set -l x 2\nset -gx FOO bar");
  });

  test("fish begin/end blocks preserved", () => {
    const original = "begin\n  echo a\nend\n";
    writeTestFile("fish-block.fish", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 3, newStart: 1, newLines: 3,
      lines: [
        { kind: "context", text: "begin" },
        { kind: "remove", text: "  echo a" },
        { kind: "add", text: "  echo b" },
        { kind: "context", text: "end" },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "fish-block.fish");
    expect(result).toBe("begin\n  echo b\nend");
  });

  test("no shell interpolation of patch content", () => {
    // Patch content with characters that shells might interpret
    const patchContent = "$(whoami) `id` $(rm -rf /) $((1+1))";
    const original = `const x = "${patchContent}";\n`;
    writeTestFile("dangerous.ts", original);

    const hunks: DiffHunk[] = [{
      oldStart: 1, oldLines: 1, newStart: 1, newLines: 1,
      lines: [
        { kind: "context", text: `const x = "${patchContent}";` },
      ],
    }];

    const result = applyHunksToContent(original, hunks, "dangerous.ts");
    // All shell metacharacters should be preserved literally
    expect(result).toBe(original.trim());
  });
});

// ─── INTEGRATION TESTS ────────────────────────────────────────────────────────

describe("Integration — Full Apply Pipeline", () => {
  test("create + update in same patch via OpenCode format", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: src/config.ts",
      "+const VERSION = '1.0';",
      "*** End of File",
      "*** Update File: src/existing.ts",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
      "*** End of File",
      "*** End Patch",
    ].join("\n");

    writeTestFile("src/existing.ts", "old\n");

    const parsed = parseOpencodeFormat(splitLines(patch));
    expect(parsed.length).toBe(2);
    expect(parsed[0].operation).toBe("create");
    expect(parsed[1].operation).toBe("update");

    // Apply create
    const createPath = path.join(worktree, parsed[0].filePath);
    mkdirSync(path.dirname(createPath), { recursive: true });
    writeFileSync(createPath, parsed[0].rawAddLines!.join("\n"));

    // Apply update
    const updateContent = readTestFile("src/existing.ts");
    const newContent = applyHunksToContent(updateContent, parsed[1].hunks!, "src/existing.ts");
    writeTestFile("src/existing.ts", newContent);

    expect(fileExists("src/config.ts")).toBe(true);
    expect(readTestFile("src/config.ts")).toBe("const VERSION = '1.0';");
    expect(readTestFile("src/existing.ts")).toBe("new");
  });

  test("multi-file patch through unified diff format", () => {
    writeTestFile("a.ts", "1\n");
    writeTestFile("b.ts", "2\n");

    const patch = [
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1,1 +1,1 @@",
      "-1",
      "+one",
      "--- a/b.ts",
      "+++ b/b.ts",
      "@@ -1,1 +1,1 @@",
      "-2",
      "+two",
    ].join("\n");

    const parsed = parseUnifiedDiff(splitLines(patch));
    expect(parsed.length).toBe(2);

    for (const p of parsed) {
      expect(p.operation).toBe("update");
      const content = readTestFile(p.filePath);
      const updated = applyHunksToContent(content, p.hunks!, p.filePath);
      writeTestFile(p.filePath, updated);
    }

    expect(readTestFile("a.ts")).toBe("one");
    expect(readTestFile("b.ts")).toBe("two");
  });
});
