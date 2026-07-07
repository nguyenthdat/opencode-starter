/**
 * Tests for the CLI-only apply_patch tool.
 *
 * Run with: bun test tests/apply_patch.test.ts
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import * as os from "os";
import * as path from "path";
import { applyPatchTool } from "../tools/apply_patch.ts";

let testDir: string;
let worktree: string;

beforeEach(() => {
  testDir = mkdtempSync(path.join(os.tmpdir(), "apply-patch-test-"));
  worktree = path.join(testDir, "workspace");
  mkdirSync(worktree, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

async function apply(patchText: string): Promise<string> {
  return await applyPatchTool.execute(
    { patchText },
    { worktree, directory: worktree, metadata: () => {} } as any,
  );
}

describe("apply_patch CLI wrapper", () => {
  test("applies git-prefixed update with patch CLI", async () => {
    writeFileSync(path.join(worktree, "file.txt"), "old\n");

    const result = await apply(
      [
        "--- a/file.txt",
        "+++ b/file.txt",
        "@@ -1 +1 @@",
        "-old",
        "+new",
      ].join("\n"),
    );

    expect(result).toContain("patch CLI");
    expect(result).toContain("-p1");
    expect(readFileSync(path.join(worktree, "file.txt"), "utf-8")).toBe("new\n");
  });

  test("applies p0 update when paths are not git-prefixed", async () => {
    writeFileSync(path.join(worktree, "file.txt"), "old\n");

    const result = await apply(
      [
        "--- file.txt",
        "+++ file.txt",
        "@@ -1 +1 @@",
        "-old",
        "+new",
      ].join("\n"),
    );

    expect(result).toContain("-p0");
    expect(readFileSync(path.join(worktree, "file.txt"), "utf-8")).toBe("new\n");
  });

  test("creates and deletes files through patch CLI", async () => {
    writeFileSync(path.join(worktree, "old.txt"), "bye\n");

    const result = await apply(
      [
        "--- /dev/null",
        "+++ b/new.txt",
        "@@ -0,0 +1 @@",
        "+hi",
        "--- a/old.txt",
        "+++ /dev/null",
        "@@ -1 +0,0 @@",
        "-bye",
      ].join("\n"),
    );

    expect(result).toContain("2 file(s) changed");
    expect(readFileSync(path.join(worktree, "new.txt"), "utf-8")).toBe("hi\n");
    expect(existsSync(path.join(worktree, "old.txt"))).toBe(false);
  });

  test("rejects path traversal before invoking patch", async () => {
    const result = await apply(
      [
        "--- /dev/null",
        "+++ b/../evil.txt",
        "@@ -0,0 +1 @@",
        "+bad",
      ].join("\n"),
    );

    expect(result).toStartWith("Error:");
    expect(result).toContain("path traversal");
    expect(existsSync(path.join(testDir, "evil.txt"))).toBe(false);
  });

  test("can use BSD patch when explicitly configured", async () => {
    if (!existsSync("/usr/bin/patch")) return;

    writeFileSync(path.join(worktree, "file.txt"), "old\n");
    const originalPatch = process.env.OPENCODE_PATCH;
    process.env.OPENCODE_PATCH = "/usr/bin/patch";

    try {
      const result = await apply(
        [
          "--- a/file.txt",
          "+++ b/file.txt",
          "@@ -1 +1 @@",
          "-old",
          "+new",
        ].join("\n"),
      );

      expect(result).toContain("BSD patch CLI");
      expect(readFileSync(path.join(worktree, "file.txt"), "utf-8")).toBe("new\n");
    } finally {
      if (originalPatch === undefined) {
        delete process.env.OPENCODE_PATCH;
      } else {
        process.env.OPENCODE_PATCH = originalPatch;
      }
    }
  });
});