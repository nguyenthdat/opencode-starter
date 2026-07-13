// /// script
// /// run: bun test
// ///

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "bun:test";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  symlinkSync,
  readdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const OPENCODE_ROOT = existsSync(
  join(PROJECT_ROOT, "plugins", "dynamic-skills.js"),
)
  ? PROJECT_ROOT
  : join(PROJECT_ROOT, ".opencode");
const PROJECT_NODE_MODULES = join(OPENCODE_ROOT, "node_modules");
const PLUGIN_SRC = join(OPENCODE_ROOT, "plugins", "dynamic-skills.js");

let testBase;

function makeTestRoot(name) {
  const root = join(testBase, name);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, ".opencode"), { recursive: true });
  mkdirSync(root, { recursive: true });

  // Symlink node_modules
  const nm = join(root, "node_modules");
  if (!existsSync(nm)) {
    symlinkSync(PROJECT_NODE_MODULES, nm, "dir");
  }

  // Write config
  const configPath = join(root, ".opencode", "dynamic-skills.jsonc");
  // Copy plugin
  writeFileSync(join(root, "plugin.js"), readFileSync(PLUGIN_SRC, "utf-8"));

  return root;
}

function makeDirectOpenCodeRoot(name) {
  const parent = join(testBase, name);
  const root = join(parent, ".opencode");
  rmSync(parent, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  symlinkSync(PROJECT_NODE_MODULES, join(root, "node_modules"), "dir");
  writeFileSync(join(root, "plugin.js"), readFileSync(PLUGIN_SRC, "utf-8"));
  return root;
}

function writeConfig(root, cfg) {
  writeFileSync(
    join(root, ".opencode", "dynamic-skills.jsonc"),
    typeof cfg === "string" ? cfg : JSON.stringify(cfg),
  );
}

function writeSkill(dir, name, description, extraFrontmatter = "", body = "") {
  mkdirSync(dir, { recursive: true });
  const parts = ["---", `name: ${name}`, `description: "${description}"`];
  if (extraFrontmatter) parts.push(extraFrontmatter);
  parts.push("---");
  parts.push(body || `# ${name}\n\n${description}`);
  writeFileSync(join(dir, "SKILL.md"), parts.join("\n"));
}

function makeCtx(root) {
  return { directory: root, sessionID: "t", messageID: "t", agent: "t" };
}

async function loadPlugin(root) {
  const mod = await import(join(root, "plugin.js") + `?v=${Date.now()}`);
  return await mod.DynamicSkillsPlugin();
}

function parse(result) {
  return JSON.parse(result.output);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(() => {
  testBase = join(tmpdir(), `dskill-test-${Date.now()}`);
  mkdirSync(testBase, { recursive: true });
});

afterAll(() => {
  try {
    rmSync(testBase, { recursive: true, force: true });
  } catch {}
});

// ---------------------------------------------------------------------------
// Path Expansion
// ---------------------------------------------------------------------------

describe("path expansion", () => {
  it("resolves relative paths", async () => {
    const root = makeTestRoot("rel");
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });
    mkdirSync(join(root, ".opencode", "skills"), { recursive: true });

    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_list.execute(
      { debug: false },
      makeCtx(root),
    );
    expect(parse(r).count).toBe(0);
  });

  it("expands harness/*/skills glob", async () => {
    const root = makeTestRoot("glob");
    writeSkill(
      join(root, "harness", "team-a", "skills", "skill-a"),
      "skill-a",
      "A",
    );
    writeSkill(
      join(root, "harness", "team-b", "skills", "skill-b"),
      "skill-b",
      "B",
    );

    writeConfig(root, { searchPaths: ["harness/*/skills"], cacheTTL: 0 });
    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_list.execute(
      { debug: false },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.count).toBe(2);
    expect(d.skills.map((s) => s.name).sort()).toEqual(["skill-a", "skill-b"]);
  });

  it("supports a workspace that is itself the .opencode directory", async () => {
    const root = makeDirectOpenCodeRoot("direct-root");
    writeFileSync(
      join(root, "dynamic-skills.jsonc"),
      JSON.stringify({ searchPaths: ["skills"], cacheTTL: 0 }),
    );
    writeSkill(join(root, "skills", "skill-a"), "skill-a", "A");

    const hooks = await loadPlugin(root);
    const listed = await hooks.tool.skills_list.execute(
      { debug: false },
      makeCtx(root),
    );
    expect(parse(listed).skills.map((s) => s.name)).toEqual(["skill-a"]);

    const checked = await hooks.tool.skills_doctor.execute(
      { debug: true },
      makeCtx(root),
    );
    expect(parse(checked).status).toBe("healthy");
  });

  it("rejects absolute paths when allowAbsolutePaths is false", async () => {
    const root = makeTestRoot("abs");
    writeConfig(root, {
      searchPaths: ["/nonexistent/skills"],
      cacheTTL: 0,
      allowAbsolutePaths: false,
    });
    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_doctor.execute(
      { debug: true },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.status).toBe("issues_found");
  });
});

// ---------------------------------------------------------------------------
// Skill Discovery
// ---------------------------------------------------------------------------

describe("skill discovery", () => {
  it("discovers skills from .opencode/skills", async () => {
    const root = makeTestRoot("disc");
    writeSkill(join(root, ".opencode", "skills", "docx"), "docx", "Word docs");
    writeSkill(join(root, ".opencode", "skills", "pdf"), "pdf", "PDFs");

    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });
    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_list.execute(
      { debug: false },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.count).toBe(2);
    expect(d.skills.find((s) => s.name === "docx").source).toBe("local");
  });

  it("correctly classifies source types", async () => {
    const root = makeTestRoot("classify");
    writeSkill(
      join(root, ".opencode", "skills", "local-skill"),
      "local-skill",
      "Local",
    );
    writeSkill(
      join(root, "harness", "my-team", "skills", "team-skill"),
      "team-skill",
      "Team",
    );
    writeSkill(
      join(root, ".opencode", "vendor", "acme", "skills", "vendor-skill"),
      "vendor-skill",
      "Vendor",
    );

    writeConfig(root, {
      searchPaths: [
        ".opencode/skills",
        "harness/*/skills",
        ".opencode/vendor/*/skills",
      ],
      cacheTTL: 0,
    });
    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_list.execute(
      { debug: false },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.count).toBe(3);

    const byName = {};
    for (const s of d.skills) byName[s.name] = s;

    expect(byName["local-skill"].source).toBe("local");
    expect(byName["team-skill"].source).toBe("harness");
    expect(byName["team-skill"].team).toBe("my-team");
    expect(byName["vendor-skill"].source).toBe("vendor");
    expect(byName["vendor-skill"].team).toBe("acme");
  });

  it("uses directory name when frontmatter has no name", async () => {
    const root = makeTestRoot("noname");
    const dir = join(root, ".opencode", "skills", "unnamed-skill");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "# No Frontmatter\n\nBody.");

    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });
    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_list.execute(
      { debug: false },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.count).toBe(1);
    expect(d.skills[0].name).toBe("unnamed-skill");
  });

  it("discovers nested skills recursively", async () => {
    const root = makeTestRoot("nested");
    writeSkill(
      join(root, ".opencode", "skills", "parent", "children", "nested-skill"),
      "nested-skill",
      "Nested",
    );
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const result = parse(
      await hooks.tool.skills_list.execute({ debug: false }, makeCtx(root)),
    );
    expect(result.skills.map((skill) => skill.name)).toEqual(["nested-skill"]);
  });

  it("paginates list output", async () => {
    const root = makeTestRoot("paginate");
    for (const name of ["alpha", "bravo", "charlie"]) {
      writeSkill(join(root, ".opencode", "skills", name), name, name);
    }
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const result = parse(
      await hooks.tool.skills_list.execute(
        { limit: 2, offset: 1, include_paths: false },
        makeCtx(root),
      ),
    );
    expect(result.skills.map((skill) => skill.name)).toEqual([
      "bravo",
      "charlie",
    ]);
    expect(result.total).toBe(3);
    expect(result.has_more).toBe(false);
    expect(result.skills[0].path).toBeUndefined();
  });

  it("supports legacy frontmatter containing an unquoted colon", async () => {
    const root = makeTestRoot("legacy-frontmatter");
    const dir = join(root, ".opencode", "skills", "legacy");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "SKILL.md"),
      "---\nname: legacy\ndescription: Route: details\n---\n# Legacy",
    );
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const listed = parse(
      await hooks.tool.skills_list.execute({}, makeCtx(root)),
    );
    expect(listed.skills[0].description).toBe("Route: details");
    const checked = parse(
      await hooks.tool.skills_doctor.execute({ debug: true }, makeCtx(root)),
    );
    expect(checked.status).toBe("healthy");
    expect(
      checked.warnings.some((warning) =>
        warning.message.includes("compatibility mode"),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Conflict Resolution
// ---------------------------------------------------------------------------

describe("conflict resolution", () => {
  it("prefers local over harness over vendor", async () => {
    const root = makeTestRoot("conflict1");
    const n = "shared-skill";
    writeSkill(join(root, ".opencode", "skills", n), n, "from local");
    writeSkill(join(root, "harness", "team-a", "skills", n), n, "from harness");
    writeSkill(
      join(root, ".opencode", "vendor", "acme", "skills", n),
      n,
      "from vendor",
    );

    writeConfig(root, {
      searchPaths: [
        ".opencode/skills",
        "harness/*/skills",
        ".opencode/vendor/*/skills",
      ],
      cacheTTL: 0,
    });
    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_list.execute(
      { debug: false },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.count).toBe(1);
    expect(d.skills[0].source).toBe("local");
    expect(d.skills[0].description).toBe("from local");
  });

  it("harness wins over vendor when no local", async () => {
    const root = makeTestRoot("conflict2");
    const n = "hv-skill";
    writeSkill(
      join(root, "harness", "team-b", "skills", n),
      n,
      "harness version",
    );
    writeSkill(
      join(root, ".opencode", "vendor", "acme", "skills", n),
      n,
      "vendor version",
    );

    writeConfig(root, {
      searchPaths: ["harness/*/skills", ".opencode/vendor/*/skills"],
      cacheTTL: 0,
    });
    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_list.execute(
      { debug: false },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.count).toBe(1);
    expect(d.skills[0].source).toBe("harness");
  });
});

// ---------------------------------------------------------------------------
// Skills Find
// ---------------------------------------------------------------------------

describe("skills_find", () => {
  async function setup(root) {
    writeSkill(
      join(root, ".opencode", "skills", "rust-coding"),
      "rust-coding",
      "Rust coding",
      "tags: [rust, coding]",
    );
    writeSkill(
      join(root, ".opencode", "skills", "python-coding"),
      "python-coding",
      "Python coding",
      "tags: [python, coding]",
    );
    writeSkill(
      join(root, ".opencode", "skills", "security-review"),
      "security-review",
      "Security review",
      "tags: [security, review]",
    );
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });
    return loadPlugin(root);
  }

  it("filters by tag", async () => {
    const root = makeTestRoot("find-tag");
    const hooks = await setup(root);
    const r = await hooks.tool.skills_find.execute(
      { tag: "rust" },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.count).toBe(1);
    expect(d.skills[0].name).toBe("rust-coding");
  });

  it("filters by query against name", async () => {
    const root = makeTestRoot("find-name");
    const hooks = await setup(root);
    const r = await hooks.tool.skills_find.execute(
      { query: "security" },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.count).toBe(1);
    expect(d.skills[0].name).toBe("security-review");
  });

  it("filters by query against description", async () => {
    const root = makeTestRoot("find-desc");
    const hooks = await setup(root);
    const r = await hooks.tool.skills_find.execute(
      { query: "coding" },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Skills Load
// ---------------------------------------------------------------------------

describe("skills_load", () => {
  it("loads a skill by name", async () => {
    const root = makeTestRoot("load-name");
    writeSkill(
      join(root, ".opencode", "skills", "test-skill"),
      "test-skill",
      "A test",
      "",
      "# Full\nBody text.",
    );
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_load.execute(
      { name: "test-skill" },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.name).toBe("test-skill");
    expect(d.content).toContain("# Full");
    expect(d.content).toContain("Body text.");
  });

  it("loads a skill by explicit path", async () => {
    const root = makeTestRoot("load-path");
    writeSkill(
      join(root, "custom", "explicit-skill"),
      "explicit-skill",
      "By path",
      "",
      "# Explicit",
    );
    writeConfig(root, { searchPaths: ["custom"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_load.execute(
      { path: "custom/explicit-skill" },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.name).toBe("explicit-skill");
    expect(d.source).toBe("explicit");
    expect(d.content).toContain("# Explicit");
  });

  it("returns error for unknown skill name", async () => {
    const root = makeTestRoot("load-404");
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });
    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_load.execute(
      { name: "nope" },
      makeCtx(root),
    );
    expect(parse(r).error).toBeDefined();
  });

  it("returns error for path without SKILL.md", async () => {
    const root = makeTestRoot("load-nomd");
    mkdirSync(join(root, "empty"), { recursive: true });
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });
    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_load.execute(
      { path: "empty" },
      makeCtx(root),
    );
    expect(parse(r).error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Cache & Refresh
// ---------------------------------------------------------------------------

describe("cache and refresh", () => {
  it("caches results and refresh picks up new skills", async () => {
    const root = makeTestRoot("cache1");
    writeSkill(
      join(root, ".opencode", "skills", "first"),
      "first",
      "First skill",
    );
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 999 });

    const hooks = await loadPlugin(root);

    // First call — no cache
    const r1 = await hooks.tool.skills_list.execute(
      { debug: true },
      makeCtx(root),
    );
    const d1 = parse(r1);
    expect(d1.count).toBe(1);
    expect(d1.debug.some((l) => l.includes("cached"))).toBe(false);

    // Add a new skill while cache is active
    writeSkill(
      join(root, ".opencode", "skills", "second"),
      "second",
      "Second skill",
    );

    // Should still return 1 (cached)
    const r2 = await hooks.tool.skills_list.execute(
      { debug: true },
      makeCtx(root),
    );
    const d2 = parse(r2);
    expect(d2.count).toBe(1);
    expect(d2.debug.some((l) => l.includes("cached"))).toBe(true);

    // Refresh — should now see both
    const rr = await hooks.tool.skills_refresh.execute(
      { debug: false },
      makeCtx(root),
    );
    const dr = parse(rr);
    expect(dr.count).toBe(2);
  });

  it("refresh with debug shows scan details", async () => {
    const root = makeTestRoot("cache2");
    writeSkill(join(root, ".opencode", "skills", "s"), "s", "S");
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_refresh.execute(
      { debug: true },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.refreshed).toBe(true);
    expect(d.debug.some((l) => l.includes("Discovery Start"))).toBe(true);
  });

  it("isolates cache entries between workspaces", async () => {
    const rootA = makeTestRoot("cache-workspace-a");
    const rootB = makeTestRoot("cache-workspace-b");
    writeSkill(join(rootA, ".opencode", "skills", "alpha"), "alpha", "A");
    writeSkill(join(rootB, ".opencode", "skills", "bravo"), "bravo", "B");
    writeConfig(rootA, { searchPaths: [".opencode/skills"], cacheTTL: 999 });
    writeConfig(rootB, { searchPaths: [".opencode/skills"], cacheTTL: 999 });

    const hooks = await loadPlugin(rootA);
    const a = parse(await hooks.tool.skills_list.execute({}, makeCtx(rootA)));
    const b = parse(await hooks.tool.skills_list.execute({}, makeCtx(rootB)));
    expect(a.skills.map((skill) => skill.name)).toEqual(["alpha"]);
    expect(b.skills.map((skill) => skill.name)).toEqual(["bravo"]);
  });

  it("disables caching when cacheTTL is zero", async () => {
    const root = makeTestRoot("cache-zero");
    writeSkill(join(root, ".opencode", "skills", "first"), "first", "First");
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });
    const hooks = await loadPlugin(root);

    expect(
      parse(await hooks.tool.skills_list.execute({}, makeCtx(root))).count,
    ).toBe(1);
    writeSkill(join(root, ".opencode", "skills", "second"), "second", "Second");
    expect(
      parse(await hooks.tool.skills_list.execute({}, makeCtx(root))).count,
    ).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Skills Doctor
// ---------------------------------------------------------------------------

describe("skills_doctor", () => {
  it("reports healthy when skills are valid", async () => {
    const root = makeTestRoot("doc1");
    writeSkill(join(root, ".opencode", "skills", "ok"), "ok", "Valid");
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_doctor.execute(
      { debug: true },
      makeCtx(root),
    );
    expect(parse(r).status).toBe("healthy");
  });

  it("reports invalid search paths", async () => {
    const root = makeTestRoot("doc2");
    writeConfig(root, { searchPaths: ["nonexistent/path"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_doctor.execute(
      { debug: true },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.status).toBe("issues_found");
    expect(d.issues.length).toBeGreaterThan(0);
  });

  it("warns about missing frontmatter fields", async () => {
    const root = makeTestRoot("doc3");
    const dir = join(root, ".opencode", "skills", "bare");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "# No frontmatter\n\nContent.");
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_doctor.execute(
      { debug: true },
      makeCtx(root),
    );
    const d = parse(r);
    expect(
      d.warnings.some((w) => w.message.toLowerCase().includes("missing")),
    ).toBe(true);
  });

  it("reports non-object JSONC config", async () => {
    const root = makeTestRoot("doc-invalid-config");
    writeConfig(root, "null");
    const hooks = await loadPlugin(root);
    const result = parse(
      await hooks.tool.skills_doctor.execute({ debug: true }, makeCtx(root)),
    );
    expect(result.status).toBe("issues_found");
    expect(
      result.issues.some((issue) =>
        issue.message.includes("Config parse error"),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("handles empty skills directory", async () => {
    const root = makeTestRoot("edge1");
    mkdirSync(join(root, ".opencode", "skills"), { recursive: true });
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_list.execute(
      { debug: false },
      makeCtx(root),
    );
    const d = parse(r);
    expect(d.count).toBe(0);
    expect(d.skills).toEqual([]);
  });

  it("skips directories without SKILL.md", async () => {
    const root = makeTestRoot("edge2");
    const dir = join(root, ".opencode", "skills", "not-skill");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "README.md"), "nope");
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_list.execute(
      { debug: false },
      makeCtx(root),
    );
    expect(parse(r).count).toBe(0);
  });

  it("skips dot-directories", async () => {
    const root = makeTestRoot("edge3");
    const dir = join(root, ".opencode", "skills", ".hidden");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "---\nname: hidden\n---\n# Hidden");
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_list.execute(
      { debug: false },
      makeCtx(root),
    );
    expect(parse(r).count).toBe(0);
  });

  it("handles regular skill directories", async () => {
    const root = makeTestRoot("edge4");
    writeSkill(join(root, ".opencode", "skills", "real"), "real", "Real skill");
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const r = await hooks.tool.skills_list.execute(
      { debug: false },
      makeCtx(root),
    );
    expect(parse(r).count).toBe(1);
  });

  it("rejects explicit path traversal outside configured roots", async () => {
    const root = makeTestRoot("edge-path-traversal");
    writeSkill(join(testBase, "outside-skill"), "outside-skill", "Outside");
    mkdirSync(join(root, ".opencode", "skills"), { recursive: true });
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const result = parse(
      await hooks.tool.skills_load.execute(
        { path: "../outside-skill" },
        makeCtx(root),
      ),
    );
    expect(result.error).toContain("outside configured skill roots");
  });

  it("does not follow a SKILL.md symlink outside its configured root", async () => {
    const root = makeTestRoot("edge-file-symlink");
    const skillDir = join(root, ".opencode", "skills", "escape");
    const outside = join(testBase, "outside-SKILL.md");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(outside, "---\nname: escape\ndescription: outside\n---\n");
    symlinkSync(outside, join(skillDir, "SKILL.md"));
    writeConfig(root, { searchPaths: [".opencode/skills"], cacheTTL: 0 });

    const hooks = await loadPlugin(root);
    const result = parse(
      await hooks.tool.skills_list.execute({}, makeCtx(root)),
    );
    expect(result.count).toBe(0);
  });
});
