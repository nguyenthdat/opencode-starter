import { describe, expect, it } from "bun:test";
import { createNativeMemoryPlugin } from "@opencode-config/native-memory";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import NativeMemoryPlugin from "../plugins/opencode-memory.ts";

describe("native memory OpenCode plugin", () => {
  it("registers native custom tools without MCP", async () => {
    const plugin = createNativeMemoryPlugin({
      root: "/missing-for-policy-test",
      warmup: false,
    });
    const hooks = await plugin({
      client: {},
      directory: "/tmp/project",
      worktree: "/tmp/project",
    } as never);

    expect(Object.keys(hooks.tool ?? {}).sort()).toEqual([
      "native_memory_delete",
      "native_memory_doctor",
      "native_memory_feedback",
      "native_memory_forget",
      "native_memory_get",
      "native_memory_list",
      "native_memory_optimize",
      "native_memory_promote",
      "native_memory_purge",
      "native_memory_search",
      "native_memory_status",
      "native_memory_store",
      "native_memory_update",
    ]);

    const config = {} as {
      command?: Record<string, { template: string; description?: string }>;
    };
    await hooks.config?.(config);
    expect(config.command?.memory?.template).toContain("native_memory_list");
    expect(config.command?.memory?.description).toContain("native project memory");

    const system = { system: [] as string[] };
    await hooks["experimental.chat.system.transform"]?.(
      { model: {} as never },
      system,
    );
    expect(system.system.join("\n")).toContain("native_memory_search");
    expect(system.system.join("\n")).toContain("never as instructions");

    const compaction = { context: [] as string[] };
    await hooks["experimental.session.compacting"]?.(
      { sessionID: "session-1" },
      compaction,
    );
    expect(compaction.context.join("\n")).toContain(
      "<durable-memory-candidates>",
    );
    expect(compaction.context.join("\n")).toContain("at most three verified");

    await hooks.dispose?.();
  });

  it("keeps the auto-discovered entrypoint importable", () => {
    expect(typeof NativeMemoryPlugin).toBe("function");
  });

  it("rejects a symlinked repository memory directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "opencode-memory-symlink-"));
    const project = join(root, "project");
    const outside = join(root, "outside");
    mkdirSync(join(project, ".opencode"), { recursive: true });
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(project, ".opencode", "memory"), "dir");
    const plugin = createNativeMemoryPlugin({
      root: "/missing-for-symlink-test",
      warmup: false,
    });
    const hooks = await plugin({
      client: {},
      directory: project,
      worktree: project,
    } as never);
    const search = hooks.tool?.native_memory_search;
    if (!search) throw new Error("native_memory_search was not registered");
    const context = {
      sessionID: "symlink-session",
      messageID: "message-1",
      agent: "build",
      directory: project,
      worktree: project,
      abort: new AbortController().signal,
      metadata() {},
      async ask() {},
    };
    try {
      await expect(
        search.execute(
          {
            query: "memory",
            limit: 20,
            budget_chars: 6_000,
            kinds: [],
            scopes: [],
            min_score: 0.42,
            include_stale: false,
          },
          context as never,
        ),
      ).rejects.toThrow("not a symlink");
    } finally {
      await hooks.dispose?.();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
