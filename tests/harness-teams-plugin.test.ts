import { afterEach, describe, expect, it } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  createHarnessTeamsPlugin,
  listHarnessTeams,
  setHarnessToggle,
} from "@opencode-config/harness-teams";

const ROOT = resolve(import.meta.dir, "..");
const TEAM_SCHEMA = readFileSync(join(ROOT, "harness", "team.schema.json"), "utf8");
const roots: string[] = [];

function testRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "harness-teams-"));
  roots.push(root);
  mkdirSync(join(root, "harness", "teams"), { recursive: true });
  writeFileSync(join(root, "harness", "team.schema.json"), TEAM_SCHEMA);
  return root;
}

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    id: "rust",
    enabled: true,
    entryAgent: "rust/lead",
    workspaceRoot: "_workspace/harness/rust",
    components: {
      agents: [
        { id: "rust/lead", enabled: true, required: true },
        {
          id: "rust/worker",
          enabled: false,
          required: false,
          model: "deepseek/deepseek-v4-pro",
        },
      ],
      skills: [
        { id: "rust-coding", enabled: false, required: false },
        { id: "rust-review", enabled: true, required: false },
      ],
      mcps: [{ id: "docs.rs", enabled: false, required: false }],
      instructions: [
        {
          id: ".opencode/instructions/rust.md",
          enabled: false,
          required: false,
        },
        {
          id: ".opencode/instructions/rust-review.md",
          enabled: true,
          required: false,
        },
      ],
    },
    ...overrides,
  };
}

function writeManifest(root: string, name: string, value: unknown): void {
  writeFileSync(
    join(root, "harness", "teams", `${name}.jsonc`),
    `// Team manifest\n${JSON.stringify(value, null, 2)}\n`,
  );
}

function pluginInput() {
  return {} as Parameters<ReturnType<typeof createHarnessTeamsPlugin>>[0];
}

function runtimeConfig(): any {
  return {
    default_agent: "build",
    agent: {
      build: { permission: { skill: "ask" } },
      "rust/lead": { description: "Lead" },
      "rust/worker": { description: "Worker" },
    },
    mcp: {
      "docs.rs": { type: "local", command: ["docs-rs"], enabled: true },
    },
    instructions: ["AGENTS.md", ".opencode/instructions/rust.md"],
    permission: {
      skill: { "*": "ask", legacy: "deny" },
    },
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("harness team plugin", () => {
  it("applies team component state without discarding existing config", async () => {
    const root = testRoot();
    writeManifest(root, "rust", manifest());
    const plugin = createHarnessTeamsPlugin({ root });
    const hooks = await plugin(pluginInput());
    const config = runtimeConfig();

    await hooks.config?.(config);

    expect(config.agent["rust/lead"].disable).toBe(false);
    expect(config.agent["rust/worker"].disable).toBe(true);
    expect(config.agent["rust/worker"].model).toBe("deepseek/deepseek-v4-pro");
    expect(config.mcp["docs.rs"].enabled).toBe(false);
    expect(config.instructions).toEqual([
      "AGENTS.md",
      ".opencode/instructions/rust-review.md",
    ]);
    expect(config.permission.skill).toEqual({
      "*": "ask",
      legacy: "deny",
      "rust-coding": "deny",
      "rust-review": "allow",
    });
    expect(config.agent.build.permission.skill).toEqual({
      "*": "ask",
      "rust-coding": "deny",
      "rust-review": "allow",
    });

    await expect(
      hooks["tool.execute.before"]!(
        { tool: "skills_load", sessionID: "s", callID: "c" },
        { args: { name: "rust-coding" } },
      ),
    ).rejects.toThrow("disabled by its team manifest");
    await expect(
      hooks["tool.execute.before"]!(
        { tool: "skills_load", sessionID: "s", callID: "c" },
        { args: { name: "rust-review" } },
      ),
    ).resolves.toBeUndefined();
  });

  it("uses the team switch as a gate for every component", async () => {
    const root = testRoot();
    writeManifest(root, "rust", manifest({ enabled: false }));
    const hooks = await createHarnessTeamsPlugin({ root })(pluginInput());
    const config = runtimeConfig();

    await hooks.config?.(config);

    expect(config.agent["rust/lead"].disable).toBe(true);
    expect(config.agent["rust/worker"].disable).toBe(true);
    expect(config.mcp["docs.rs"].enabled).toBe(false);
    expect(config.instructions).toEqual(["AGENTS.md"]);
    expect(config.permission.skill["rust-review"]).toBe("deny");
  });

  it("validates manifests against team.schema.json before mutation", async () => {
    const root = testRoot();
    writeManifest(root, "rust", { ...manifest(), unexpected: true });
    const hooks = await createHarnessTeamsPlugin({ root })(pluginInput());
    const config = runtimeConfig();

    await expect(hooks.config?.(config)).rejects.toThrow("does not match team.schema.json");
    expect(config.agent["rust/lead"].disable).toBeUndefined();
  });

  it("rejects duplicate component IDs across team manifests", async () => {
    const root = testRoot();
    writeManifest(root, "rust", manifest());
    writeManifest(
      root,
      "other",
      manifest({
        id: "other",
        entryAgent: "other/lead",
        components: {
          agents: [{ id: "other/lead", enabled: true, required: true }],
          skills: [{ id: "rust-coding", enabled: true, required: false }],
          mcps: [],
          instructions: [],
        },
      }),
    );
    const hooks = await createHarnessTeamsPlugin({ root })(pluginInput());

    await expect(hooks.config?.(runtimeConfig())).rejects.toThrow(
      'Duplicate skills component ID "rust-coding"',
    );
  });

  it("rejects instruction wildcards that can bypass a disabled component", async () => {
    const root = testRoot();
    writeManifest(root, "rust", manifest());
    const hooks = await createHarnessTeamsPlugin({ root })(pluginInput());
    const config = runtimeConfig();
    config.instructions = ["AGENTS.md", ".opencode/instructions/*"];

    await expect(hooks.config?.(config)).rejects.toThrow(
      "can re-include disabled instruction",
    );
  });

  it("updates JSONC switches atomically while preserving comments", async () => {
    const root = testRoot();
    writeManifest(root, "rust", manifest());

    await setHarnessToggle(rootOptions(root), { teamID: "rust", enabled: false });
    await setHarnessToggle(rootOptions(root), {
      teamID: "rust",
      componentKind: "skills",
      componentID: "rust-review",
      enabled: false,
    });

    const source = readFileSync(join(root, "harness", "teams", "rust.jsonc"), "utf8");
    const [team] = await listHarnessTeams(rootOptions(root));
    expect(source).toStartWith("// Team manifest\n");
    expect(team?.enabled).toBe(false);
    expect(team?.components.skills.find((component) => component.id === "rust-review")?.enabled).toBe(
      false,
    );
    expect(readdirSync(join(root, "harness", "teams")).every((file) => !file.endsWith(".tmp"))).toBe(
      true,
    );
  });
});

function rootOptions(root: string) {
  return { root };
}
