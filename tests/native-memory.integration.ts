import { expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createNativeMemoryPlugin } from "@opencode-config/native-memory";

const root = resolve(import.meta.dir, "..");

test("native plugin completes scoped lifecycle and subagent sharing", async () => {
  const testRoot = mkdtempSync(join(tmpdir(), "opencode-native-memory-"));
  const project = join(testRoot, "project");
  const data = join(testRoot, "data");
  const anchorPath = join(project, "src", "memory-anchor.txt");
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(anchorPath, "anchor-v1\n");

  const previousData = process.env.OPENCODE_MEMORY_DATA_DIR;
  const previousCache = process.env.OPENCODE_MEMORY_MODEL_CACHE;
  process.env.OPENCODE_MEMORY_DATA_DIR = data;
  process.env.OPENCODE_MEMORY_MODEL_CACHE = join(
    homedir(),
    ".cache/opencode/native-memory/models",
  );

  const approvals: unknown[] = [];
  const parentSessionID = "memory-parent-session";
  const childSessionID = "memory-child-session";
  const otherSessionID = "memory-other-session";
  const baseContext = {
    sessionID: parentSessionID,
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
  const sessions = new Map<string, { id: string; parentID?: string }>([
    [parentSessionID, { id: parentSessionID }],
    [childSessionID, { id: childSessionID, parentID: parentSessionID }],
    [otherSessionID, { id: otherSessionID }],
  ]);
  const curatedSummary = `Compaction summary.
<durable-memory-candidates>
[{"title":"Curated memory policy","content":"Compaction stores only strict durable memory candidates, never the full summary.","kind":"decision","importance":0.55,"tags":["compaction","curation"],"code_paths":[]}]
</durable-memory-candidates>`;
  const opencode = {
    session: {
      async get(input: { path: { id: string } }) {
        return { data: sessions.get(input.path.id) };
      },
      async messages() {
        return {
          data: [
            {
              info: { role: "assistant", summary: true },
              parts: [{ type: "text", ignored: false, text: curatedSummary }],
            },
          ],
        };
      },
    },
  };
  const plugin = createNativeMemoryPlugin({ root, warmup: false });
  const hooks = await plugin({
    client: opencode,
    directory: project,
    worktree: project,
  } as never);

  try {
    const store = requireTool(hooks.tool, "native_memory_store");
    const search = requireTool(hooks.tool, "native_memory_search");
    const get = requireTool(hooks.tool, "native_memory_get");
    const list = requireTool(hooks.tool, "native_memory_list");
    const update = requireTool(hooks.tool, "native_memory_update");
    const remove = requireTool(hooks.tool, "native_memory_delete");
    const feedback = requireTool(hooks.tool, "native_memory_feedback");
    const promote = requireTool(hooks.tool, "native_memory_promote");
    const optimize = requireTool(hooks.tool, "native_memory_optimize");
    const doctor = requireTool(hooks.tool, "native_memory_doctor");
    const purge = requireTool(hooks.tool, "native_memory_purge");
    const status = requireTool(hooks.tool, "native_memory_status");

    const architectureContent =
      "The OpenCode native memory backend uses Rust with zvec and a local multilingual E5 embedding model.";
    const stored = parseResult(
      await store.execute(
        {
          content: architectureContent,
          title: "Native memory architecture",
          kind: "decision",
          importance: 0.95,
          tags: ["rust", "zvec", "opencode"],
          scope: "project",
          code_paths: [],
          revive: false,
        },
        baseContext as never,
      ),
    ) as { id: string; inserted: boolean };
    expect(stored.id).toMatch(/^mem_[0-9a-f]{32}$/);
    expect(stored.inserted).toBe(true);

    const found = parseResult(
      await search.execute(
        searchArgs("Which language and vector database power project memory?"),
        baseContext as never,
      ),
    ) as {
      retrieval_id: string;
      abstained: boolean;
      memories: Array<{ id: string }>;
    };
    expect(found.abstained).toBe(false);
    expect(found.memories[0]?.id).toBe(stored.id);
    expect(found.retrieval_id).toMatch(/^ret_[0-9a-f]{24}$/);
    await feedback.execute(
      {
        retrieval_id: found.retrieval_id,
        event: "used",
        memory_ids: [stored.id],
      },
      baseContext as never,
    );

    const familyContent =
      "The parent and its OpenCode subagents share session-family memory context.";
    const family = parseResult(
      await store.execute(
        {
          content: familyContent,
          title: "Subagent shared context",
          kind: "pattern",
          importance: 0.8,
          tags: ["subagent", "session-family"],
          scope: "session",
          code_paths: [],
          revive: false,
        },
        baseContext as never,
      ),
    ) as { id: string };
    const childContext = { ...baseContext, sessionID: childSessionID, agent: "explore" };
    const childFound = parseResult(
      await search.execute(
        {
          ...searchArgs("How do parent and subagents share session-family context?"),
          scopes: ["session"],
        },
        childContext as never,
      ),
    ) as { memories: Array<{ id: string }> };
    expect(childFound.memories.some((memory) => memory.id === family.id)).toBe(true);

    const otherContext = { ...baseContext, sessionID: otherSessionID };
    const isolated = parseResult(
      await search.execute(
        {
          ...searchArgs("How do parent and subagents share session-family context?"),
          scopes: ["session"],
        },
        otherContext as never,
      ),
    ) as { abstained: boolean; memories: Array<{ id: string }> };
    expect(isolated.abstained).toBe(true);
    expect(isolated.memories).toHaveLength(0);
    const hiddenFromOtherRoot = parseResult(
      await get.execute({ ids: [family.id] }, otherContext as never),
    ) as Array<{ id: string }>;
    expect(hiddenFromOtherRoot).toHaveLength(0);
    const otherRootList = parseResult(
      await list.execute(
        {
          kinds: [],
          scopes: ["session"],
          include_expired: false,
          include_stale: false,
          offset: 0,
          limit: 50,
        },
        otherContext as never,
      ),
    ) as { memories: Array<{ id: string }> };
    expect(otherRootList.memories.some((memory) => memory.id === family.id)).toBe(false);

    const anchored = parseResult(
      await store.execute(
        {
          content:
            "The memory anchor fixture currently contains anchor-v1 and invalidates when changed.",
          title: "Code-aware memory anchor",
          kind: "fact",
          importance: 0.8,
          tags: ["anchor", "invalidation"],
          scope: "project",
          code_paths: ["src/memory-anchor.txt"],
          revive: false,
        },
        baseContext as never,
      ),
    ) as { id: string };
    writeFileSync(anchorPath, "anchor-v2\n");
    const stale = parseResult(
      await get.execute({ ids: [anchored.id] }, baseContext as never),
    ) as Array<{ stale: boolean; code_anchors: Array<{ path: string }> }>;
    expect(stale[0]?.stale).toBe(true);
    expect(stale[0]?.code_anchors[0]?.path).toBe("src/memory-anchor.txt");
    const activeOnly = parseResult(
      await search.execute(
        searchArgs("What does the anchor-v1 fixture contain?"),
        baseContext as never,
      ),
    ) as { memories: Array<{ id: string }> };
    expect(activeOnly.memories.some((memory) => memory.id === anchored.id)).toBe(false);

    const beforeUpdate = parseResult(
      await get.execute({ ids: [stored.id] }, baseContext as never),
    ) as Array<{ updated_at_ms: number; feedback: { injected: number; used: number } }>;
    expect(beforeUpdate[0]?.feedback.injected).toBeGreaterThanOrEqual(1);
    expect(beforeUpdate[0]?.feedback.used).toBeGreaterThanOrEqual(1);
    await update.execute(
      {
        id: stored.id,
        expected_updated_at_ms: beforeUpdate[0]?.updated_at_ms,
        title: "Native memory architecture v2",
        clear_expiry: false,
      },
      baseContext as never,
    );
    const updated = parseResult(
      await get.execute({ ids: [stored.id] }, baseContext as never),
    ) as Array<{ id: string; title: string }>;
    expect(updated[0]?.title).toBe("Native memory architecture v2");

    const originalIdentityContent =
      "Identity-sensitive memory originally uses the alpha storage policy.";
    const identity = parseResult(
      await store.execute(
        {
          content: originalIdentityContent,
          title: "Identity update fixture",
          kind: "decision",
          importance: 0.7,
          tags: ["identity"],
          scope: "project",
          code_paths: [],
          revive: false,
        },
        baseContext as never,
      ),
    ) as { id: string };
    const identityBefore = parseResult(
      await get.execute({ ids: [identity.id] }, baseContext as never),
    ) as Array<{ updated_at_ms: number }>;
    const rekeyed = parseResult(
      await update.execute(
        {
          id: identity.id,
          expected_updated_at_ms: identityBefore[0]?.updated_at_ms,
          content: "Identity-sensitive memory now uses the beta storage policy.",
          clear_expiry: false,
        },
        baseContext as never,
      ),
    ) as { id: string; previous_id: string };
    expect(rekeyed.previous_id).toBe(identity.id);
    expect(rekeyed.id).not.toBe(identity.id);
    const superseded = parseResult(
      await get.execute({ ids: [identity.id] }, baseContext as never),
    ) as unknown[];
    expect(superseded).toHaveLength(0);
    await expect(
      store.execute(
        {
          content: originalIdentityContent,
          title: "Attempted identity rollback",
          kind: "decision",
          importance: 0.7,
          tags: ["identity"],
          scope: "project",
          code_paths: [],
          revive: false,
        },
        baseContext as never,
      ),
    ).rejects.toThrow("tombstoned");

    const promoted = parseResult(
      await promote.execute({ id: stored.id }, baseContext as never),
    ) as { path: string };
    expect(promoted.path).toBe(`.opencode/memory/${stored.id}.md`);
    expect(existsSync(join(project, promoted.path))).toBe(true);
    const repositoryMemories = parseResult(
      await list.execute(
        {
          kinds: [],
          scopes: ["repository"],
          include_expired: false,
          include_stale: false,
          offset: 0,
          limit: 50,
        },
        baseContext as never,
      ),
    ) as { memories: Array<{ title: string; scope: string }> };
    expect(repositoryMemories.memories).toContainEqual(
      expect.objectContaining({
        title: "Native memory architecture v2",
        scope: "repository",
      }),
    );

    await hooks.event?.({
      event: {
        type: "session.compacted",
        properties: { sessionID: parentSessionID },
      },
    } as never);
    const curated = parseResult(
      await search.execute(
        searchArgs("How are compaction durable candidates curated?"),
        baseContext as never,
      ),
    ) as { memories: Array<{ title: string }> };
    expect(curated.memories.some((memory) => memory.title === "Curated memory policy")).toBe(
      true,
    );

    await remove.execute(
      { ids: [stored.id], tombstone: true, reason: "obsolete" },
      baseContext as never,
    );
    await expect(
      store.execute(
        {
          content: architectureContent,
          title: "Attempted relearn",
          kind: "decision",
          importance: 0.8,
          tags: ["rust"],
          scope: "project",
          code_paths: [],
          revive: false,
        },
        baseContext as never,
      ),
    ).rejects.toThrow("tombstoned");

    const optimized = parseResult(
      await optimize.execute({}, baseContext as never),
    ) as { optimized: boolean };
    expect(optimized.optimized).toBe(true);
    const diagnosed = parseResult(
      await doctor.execute({ deep: true }, baseContext as never),
    ) as { stale_count: number; state_path: string };
    expect(diagnosed.stale_count).toBeGreaterThanOrEqual(1);
    expect(diagnosed.state_path).toEndWith("state.json");

    const state = parseResult(
      await status.execute({}, baseContext as never),
    ) as {
      backend: string;
      document_count: number;
      project_root: string;
      state_schema_version: number;
      project_id: string;
    };
    expect(state.backend).toBe("zvec");
    expect(state.document_count).toBeGreaterThanOrEqual(3);
    expect(state.project_root).toBe(realpathSync(project));
    expect(state.state_schema_version).toBe(1);

    const purged = parseResult(
      await purge.execute(
        { project_id: state.project_id, keep_tombstones: true },
        baseContext as never,
      ),
    ) as { deleted: number; tombstones_retained: number };
    expect(purged.deleted).toBeGreaterThanOrEqual(3);
    expect(purged.tombstones_retained).toBeGreaterThanOrEqual(1);
    const empty = parseResult(
      await status.execute({}, baseContext as never),
    ) as { document_count: number };
    expect(empty.document_count).toBe(0);
    expect(approvals).toHaveLength(3);
  } finally {
    await hooks.dispose?.();
    restoreEnv("OPENCODE_MEMORY_DATA_DIR", previousData);
    restoreEnv("OPENCODE_MEMORY_MODEL_CACHE", previousCache);
    rmSync(testRoot, { recursive: true, force: true });
  }
}, 30_000);

function searchArgs(query: string) {
  return {
    query,
    limit: 20,
    budget_chars: 6_000,
    kinds: [],
    scopes: [],
    min_score: 0.42,
    include_stale: false,
  };
}

function requireTool(
  tools:
    | Record<
        string,
        { execute: (args: any, context: any) => Promise<unknown> }
      >
    | undefined,
  name: string,
) {
  const found = tools?.[name];
  if (!found) throw new Error(`Native memory tool was not registered: ${name}`);
  return found;
}

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
