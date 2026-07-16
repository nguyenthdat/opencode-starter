import { expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createNativeMemoryPlugin } from "@opencode-config/native-memory";

const root = resolve(import.meta.dir, "..");

test("native plugin completes store/search/get/recall/forget", async () => {
  const testRoot = mkdtempSync(join(tmpdir(), "opencode-native-memory-"));
  const project = join(testRoot, "project");
  const data = join(testRoot, "data");
  mkdirSync(project, { recursive: true });

  const previousData = process.env.OPENCODE_MEMORY_DATA_DIR;
  const previousCache = process.env.OPENCODE_MEMORY_MODEL_CACHE;
  process.env.OPENCODE_MEMORY_DATA_DIR = data;
  process.env.OPENCODE_MEMORY_MODEL_CACHE = join(
    homedir(),
    ".cache/opencode/native-memory/models",
  );

  const approvals: unknown[] = [];
  const context = {
    sessionID: "memory-e2e-session",
    messageID: "message-1",
    agent: "build",
    directory: project,
    worktree: project,
    abort: new AbortController().signal,
    metadata() {},
    async ask(request: unknown) {
      approvals.push(request);
    },
  };
  const plugin = createNativeMemoryPlugin({ root, warmup: false });
  const hooks = await plugin({
    client: {},
    directory: project,
    worktree: project,
  } as never);

  try {
    const store = hooks.tool?.native_memory_store;
    const search = hooks.tool?.native_memory_search;
    const get = hooks.tool?.native_memory_get;
    const forget = hooks.tool?.native_memory_forget;
    const status = hooks.tool?.native_memory_status;
    if (!store || !search || !get || !forget || !status) {
      throw new Error("Native memory tools were not registered");
    }

    const stored = parseResult(
      await store.execute(
        {
          content:
            "The OpenCode native memory backend uses Rust with zvec and a local multilingual E5 embedding model.",
          title: "Native memory architecture",
          kind: "decision",
          importance: 0.95,
          tags: ["rust", "zvec", "opencode"],
        },
        context as never,
      ),
    ) as { id: string; inserted: boolean };
    expect(stored.id).toMatch(/^mem_[0-9a-f]{32}$/);
    expect(stored.inserted).toBe(true);

    const found = parseResult(
      await search.execute(
        {
          query: "Which language and vector database power project memory?",
          limit: 5,
          kinds: [],
          min_score: 0,
        },
        context as never,
      ),
    ) as { memories: Array<{ id: string }> };
    expect(found.memories[0]?.id).toBe(stored.id);

    const fetched = parseResult(
      await get.execute({ ids: [stored.id] }, context as never),
    ) as Array<{ id: string; content: string }>;
    expect(fetched[0]?.id).toBe(stored.id);
    expect(fetched[0]?.content).toContain("multilingual E5");

    await hooks["chat.message"]?.(
      { sessionID: context.sessionID },
      {
        message: {} as never,
        parts: [
          {
            id: "part-1",
            sessionID: context.sessionID,
            messageID: context.messageID,
            type: "text",
            text: "What powers our project memory architecture?",
          },
        ],
      },
    );
    const system = { system: [] as string[] };
    await hooks["experimental.chat.system.transform"]?.(
      { sessionID: context.sessionID, model: {} as never },
      system,
    );
    expect(system.system.join("\n")).toContain("<project-memory");
    expect(system.system.join("\n")).toContain("Native memory architecture");

    const state = parseResult(
      await status.execute({}, context as never),
    ) as {
      backend: string;
      document_count: number;
      project_root: string;
    };
    expect(state.backend).toBe("zvec");
    expect(state.document_count).toBe(1);
    expect(state.project_root).toBe(realpathSync(project));

    const forgotten = parseResult(
      await forget.execute({ ids: [stored.id] }, context as never),
    ) as { deleted: number };
    expect(forgotten.deleted).toBe(1);
    expect(approvals).toHaveLength(1);
  } finally {
    await hooks.dispose?.();
    restoreEnv("OPENCODE_MEMORY_DATA_DIR", previousData);
    restoreEnv("OPENCODE_MEMORY_MODEL_CACHE", previousCache);
    rmSync(testRoot, { recursive: true, force: true });
  }
});

function parseResult(result: unknown): unknown {
  if (typeof result === "string") return JSON.parse(result);
  if (
    result &&
    typeof result === "object" &&
    "output" in result &&
    typeof result.output === "string"
  ) {
    return JSON.parse(result.output);
  }
  throw new Error("Expected a native memory tool result");
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
