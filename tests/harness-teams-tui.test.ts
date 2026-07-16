import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { listHarnessTeams } from "@opencode-config/harness-teams";
import { createHarnessTeamsTuiPlugin } from "@opencode-config/harness-teams/tui";

const ROOT = resolve(import.meta.dir, "..");
const TEAM_SCHEMA = readFileSync(join(ROOT, "harness", "team.schema.json"), "utf8");
const roots: string[] = [];

function testRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "harness-tui-"));
  roots.push(root);
  mkdirSync(join(root, "harness", "teams"), { recursive: true });
  writeFileSync(join(root, "harness", "team.schema.json"), TEAM_SCHEMA);
  writeFileSync(
    join(root, "harness", "teams", "rust.jsonc"),
    `// Keep this comment
{
  "version": 1,
  "id": "rust",
  "enabled": true,
  "entryAgent": "rust/lead",
  "workspaceRoot": "_workspace/harness/rust",
  "components": {
    "agents": [{ "id": "rust/lead", "enabled": true, "required": true }],
    "skills": [],
    "mcps": [],
    "instructions": []
  }
}
`,
  );
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("harness teams TUI plugin", () => {
  it("registers the package TUI target in tui.json", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "tui.json"), "utf8"));
    const packageJson = JSON.parse(
      readFileSync(join(ROOT, "packages", "harness-teams", "package.json"), "utf8"),
    );

    expect(config.plugin).toContain("./packages/harness-teams");
    expect(packageJson.exports["./tui"]).toBe("./src/tui.ts");
  });

  it("registers /harness in the palette and reloads after a confirmed toggle", async () => {
    const root = testRoot();
    let layer: any;
    let view: any;
    let disposed = 0;
    let releaseDispose: (() => void) | undefined;
    const disposeCalled = new Promise<void>((resolve) => {
      releaseDispose = resolve;
    });

    const api: any = {
      keymap: {
        registerLayer(value: unknown) {
          layer = value;
          return () => undefined;
        },
      },
      route: { current: { name: "home" } },
      state: { session: { status: () => ({ type: "idle" }) } },
      ui: {
        DialogSelect(props: unknown) {
          return { type: "select", props };
        },
        DialogConfirm(props: unknown) {
          return { type: "confirm", props };
        },
        dialog: {
          replace(render: () => unknown) {
            view = render();
          },
          clear() {
            view = undefined;
          },
        },
        toast() {},
      },
      client: {
        instance: {
          async dispose() {
            disposed += 1;
            releaseDispose?.();
            return { data: true };
          },
        },
      },
    };

    const plugin = createHarnessTeamsTuiPlugin({ root });
    await plugin.tui(api, undefined, {} as never);
    const command = layer.commands[0];
    expect(command.name).toBe("harness.open");
    expect(command.namespace).toBe("palette");
    expect(command.slashName).toBe("harness");

    await command.run();
    const teamOption = view.props.options[0];
    view.props.onSelect(teamOption);
    const teamSwitch = view.props.options.find((option: any) => option.value.type === "team");
    view.props.onSelect(teamSwitch);
    const confirm = view;
    confirm.props.onConfirm();
    await disposeCalled;

    const [team] = await listHarnessTeams({ root });
    expect(team?.enabled).toBe(false);
    expect(disposed).toBe(1);
    expect(readFileSync(join(root, "harness", "teams", "rust.jsonc"), "utf8")).toContain(
      "// Keep this comment",
    );
  });
});
