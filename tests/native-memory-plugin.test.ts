import { describe, expect, it } from "bun:test";
import { createNativeMemoryPlugin } from "@opencode-config/native-memory";
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
      "native_memory_forget",
      "native_memory_get",
      "native_memory_search",
      "native_memory_status",
      "native_memory_store",
    ]);

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
      "Durable memory candidates",
    );

    await hooks.dispose?.();
  });

  it("keeps the auto-discovered entrypoint importable", () => {
    expect(typeof NativeMemoryPlugin).toBe("function");
  });
});
