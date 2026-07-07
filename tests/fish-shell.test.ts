/**
 * Tests for Fish Shell Plugin
 *
 * These tests validate the Fish shell integration for the OpenCode bash tool.
 * Run with: bun test tests/fish-shell.test.ts
 */

import { describe, test, expect, beforeAll } from "bun:test";

const FISH_SEARCH_PATHS = [
  "/opt/homebrew/bin/fish",
  "/usr/local/bin/fish",
  "/usr/bin/fish",
  "/home/linuxbrew/.linuxbrew/bin/fish",
];

let fishPath: string | null = null;

beforeAll(async () => {
  for (const path of FISH_SEARCH_PATHS) {
    const file = Bun.file(path);
    if (await file.exists()) {
      fishPath = path;
      break;
    }
  }
  if (!fishPath) {
    const proc = Bun.spawnSync({ cmd: ["which", "fish"], stdout: "pipe", stderr: "pipe" });
    if (proc.exitCode === 0) {
      fishPath = proc.stdout.toString().trim() || null;
    }
  }
});

function escapeForFish(command: string): string {
  return command.replace(/'/g, "'\\''");
}

function hasFishWrapper(command: string): boolean {
  return /^\s*fish\s+-/.test(command);
}

const BASH_TO_FISH_TRANSFORMS: Array<[RegExp, string]> = [
  [/^export\s+(\w+)=(.*)$/m, "set -gx $1 $2"],
  [/^(\w+)=(\S+)\s+(\S.*)$/m, "env $1=$2 $3"],
  [/^unset\s+(\w+)$/m, "set -e $1"],
  [/^local\s+(\w+)=(.*)$/m, "set -l $1 $2"],
];

function applyFishTransforms(command: string): string {
  let result = command;
  for (const [pattern, replacement] of BASH_TO_FISH_TRANSFORMS) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
    }
  }
  return result;
}

function wrapWithFish(command: string): string {
  const trimmed = command.trim();
  if (!trimmed || hasFishWrapper(trimmed)) return trimmed;
  const transformed = applyFishTransforms(trimmed);
  const escaped = escapeForFish(transformed);
  return `fish -lc '${escaped}'`;
}

describe("Fish Shell Detection", () => {
  test("fish binary is discoverable", () => {
    if (fishPath) {
      expect(fishPath).toBeString();
      expect(fishPath).toMatch(/fish$/);
      console.log(`✓ Fish found at: ${fishPath}`);
    } else {
      console.warn("⚠ Fish not found — some tests will be skipped");
    }
  });
});

describe("Fish Command Escaping", () => {
  test("simple command without special characters", () => {
    const result = wrapWithFish("echo hello");
    expect(result).toBe("fish -lc 'echo hello'");
  });

  test("command with double quotes", () => {
    const result = wrapWithFish('echo "hello world"');
    expect(result).toBe(`fish -lc 'echo "hello world"'`);
  });

  test("command with single quotes is properly escaped", () => {
    const result = wrapWithFish("echo 'hello'");
    expect(result).toBe("fish -lc 'echo '\\''hello'\\'''");
  });

  test("command with spaces in path", () => {
    const result = wrapWithFish("ls '/path/to/My Documents'");
    expect(result).toBe("fish -lc 'ls '\\''/path/to/My Documents'\\'''");
  });

  test("empty command is not wrapped", () => {
    const result = wrapWithFish("");
    expect(result).toBe("");
  });

  test("whitespace-only command is not wrapped", () => {
    const result = wrapWithFish("   ");
    expect(result).toBe("");
  });

  test("already-wrapped command is not double-wrapped", () => {
    const result = wrapWithFish("fish -lc 'echo hello'");
    expect(result).toBe("fish -lc 'echo hello'");
  });

  test("command with fish -c flag is not double-wrapped", () => {
    const result = wrapWithFish("fish -c 'set -x FOO bar'");
    expect(result).toBe("fish -c 'set -x FOO bar'");
  });
});

describe("Bash-to-Fish Transformations", () => {
  test("export VAR=value → set -gx VAR value", () => {
    const result = wrapWithFish("export FOO=bar");
    expect(result).toBe("fish -lc 'set -gx FOO bar'");
  });

  test("export with complex value", () => {
    const result = wrapWithFish('export PATH="/usr/bin:$PATH"');
    expect(result).toBe(`fish -lc 'set -gx PATH "/usr/bin:$PATH"'`);
  });

  test("unset VAR → set -e VAR", () => {
    const result = wrapWithFish("unset FOO");
    expect(result).toBe("fish -lc 'set -e FOO'");
  });

  test("local var=val → set -l var val", () => {
    const result = wrapWithFish("local x=42");
    expect(result).toBe("fish -lc 'set -l x 42'");
  });

  test("VAR=value command → env VAR=value command", () => {
    const result = wrapWithFish("NODE_ENV=production node server.js");
    expect(result).toBe("fish -lc 'env NODE_ENV=production node server.js'");
  });

  test("command with && (preserved, valid in fish)", () => {
    const result = wrapWithFish("echo a && echo b");
    expect(result).toBe("fish -lc 'echo a && echo b'");
  });

  test("pipe command (preserved)", () => {
    const result = wrapWithFish("cat file.txt | grep pattern");
    expect(result).toBe("fish -lc 'cat file.txt | grep pattern'");
  });

  test("multi-line command", () => {
    const result = wrapWithFish("echo hello\necho world");
    expect(result).toBe("fish -lc 'echo hello\necho world'");
  });
});

describe("Fish Shell Command Execution", () => {
  test("simple command executes via fish", () => {
    if (!fishPath) return;

    const proc = Bun.spawnSync({
      cmd: [fishPath, "-lc", "echo hello"],
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString().trim()).toBe("hello");
  });

  test("environment variable expansion in fish", () => {
    if (!fishPath) return;

    const proc = Bun.spawnSync({
      cmd: [fishPath, "-lc", "set -gx TEST_VAR world; echo hello $TEST_VAR"],
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString().trim()).toBe("hello world");
  });

  test("non-zero exit code is preserved", () => {
    if (!fishPath) return;

    const proc = Bun.spawnSync({
      cmd: [fishPath, "-lc", "exit 42"],
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(proc.exitCode).toBe(42);
  });

  test("stdout and stderr are captured separately", () => {
    if (!fishPath) return;

    const proc = Bun.spawnSync({
      cmd: [fishPath, "-lc", "echo stdout; echo stderr >&2"],
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(proc.stdout.toString().trim()).toBe("stdout");
    expect(proc.stderr.toString().trim()).toBe("stderr");
  });

  test("working directory change", () => {
    if (!fishPath) return;

    const proc = Bun.spawnSync({
      cmd: [fishPath, "-lc", "pwd"],
      cwd: "/tmp",
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(proc.exitCode).toBe(0);
    const cwd = proc.stdout.toString().trim();
    const expected = Bun.spawnSync({ cmd: ["realpath", "/tmp"], stdout: "pipe", stderr: "pipe" });
    expect(cwd).toBe(expected.stdout.toString().trim());
  });

  test("command with quotes and spaces in fish", () => {
    if (!fishPath) return;

    const proc = Bun.spawnSync({
      cmd: [fishPath, "-lc", "echo 'hello beautiful world'"],
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString().trim()).toBe("hello beautiful world");
  });

  test("fish-specific syntax: set command", () => {
    if (!fishPath) return;

    const proc = Bun.spawnSync({
      cmd: [fishPath, "-lc", "set -l greeting hello; echo $greeting"],
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString().trim()).toBe("hello");
  });

  test("fish-specific syntax: begin/end block", () => {
    if (!fishPath) return;

    const proc = Bun.spawnSync({
      cmd: [fishPath, "-lc", "begin; echo step1; echo step2; end"],
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(proc.exitCode).toBe(0);
    const lines = proc.stdout.toString().trim().split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe("step1");
    expect(lines[1]).toBe("step2");
  });
});

describe("Timeout Handling", () => {
  test("command with timeout via external kill", () => {
    if (!fishPath) return;

    const start = Date.now();
    const proc = Bun.spawnSync({
      cmd: [fishPath, "-lc", "sleep 5"],
      stdout: "pipe",
      stderr: "pipe",
      timeout: 1000,
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
    expect(proc.exitCode).not.toBe(0);
  });
});
