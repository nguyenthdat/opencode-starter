import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import { parse as parseYaml } from "yaml";

const ROOT = resolve(import.meta.dir, "..");
const TEAM_ID = "senior-rust-developer";
const TEAM_DIR = join(ROOT, "agents", TEAM_ID);
const TEAM_MANIFEST = join(ROOT, "harness", "teams", `${TEAM_ID}.jsonc`);
const SUBAGENT_MODEL = "deepseek/deepseek-v4-pro";

const ROLES = [
  "api-reviewer",
  "architect",
  "async-specialist",
  "audit-adjudicator",
  "audit-deduplicator",
  "audit-worker",
  "correctness-reviewer",
  "docs-maintainer",
  "implementer",
  "lead",
  "performance-engineer",
  "security-reviewer",
  "testing-engineer",
];

const SKILLS = [
  "rust-coding",
  "rust-design-patterns",
  "rust-review",
  "uniffi",
];

function parseFrontmatter(path) {
  const content = readFileSync(path, "utf8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`Missing frontmatter: ${path}`);
  return { content, data: parseYaml(match[1]) };
}

function markdownFiles(path) {
  const files = [];
  for (const entry of readdirSync(path)) {
    const candidate = join(path, entry);
    if (statSync(candidate).isDirectory()) files.push(...markdownFiles(candidate));
    else if (candidate.endsWith(".md")) files.push(candidate);
  }
  return files;
}

describe("Senior Rust Developer harness structure", () => {
  it("keeps every reusable role in one namespaced team", () => {
    const actual = readdirSync(TEAM_DIR)
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => basename(entry, ".md"))
      .sort();

    expect(actual).toEqual([...ROLES].sort());

    for (const role of ROLES) {
      const { data } = parseFrontmatter(join(TEAM_DIR, `${role}.md`));
      expect(data.mode).toBe(role === "lead" ? "primary" : "subagent");
    }
  });

  it("allows only the lead to delegate inside the team", () => {
    const lead = parseFrontmatter(join(TEAM_DIR, "lead.md")).data;
    expect(lead.permission.task[`${TEAM_ID}/*`]).toBe("allow");
    expect(lead.permission.task[`${TEAM_ID}/lead`]).toBe("deny");

    for (const role of ROLES.filter((role) => role !== "lead")) {
      const { data } = parseFrontmatter(join(TEAM_DIR, `${role}.md`));
      expect(data.permission.task).toBe("deny");
      if (role !== "implementer") expect(data.permission.bash).not.toBe("allow");
    }
  });

  it("keeps the complete workflow and roster in the lead", () => {
    const lead = readFileSync(join(TEAM_DIR, "lead.md"), "utf8");
    const instruction = readFileSync(
      join(ROOT, "instructions", "senior-rust-developer.md"),
      "utf8",
    );

    for (const role of ROLES) {
      expect(lead).toContain(`${TEAM_ID}/${role}`);
    }
    expect(instruction).toContain(`${TEAM_ID}/lead`);
    expect(instruction).toContain("lead.md` is the source of truth");
    expect(existsSync(join(ROOT, "skills", "harness-runtime", "SKILL.md"))).toBe(false);
    expect(existsSync(join(ROOT, "skills", "rust-orchestrator", "SKILL.md"))).toBe(false);
  });

  it("keeps skill metadata discoverable and collision-safe", () => {
    for (const skill of SKILLS) {
      const path = join(ROOT, "skills", skill, "SKILL.md");
      expect(existsSync(path)).toBe(true);
      const { data } = parseFrontmatter(path);
      expect(data.name).toBe(skill);
      expect(typeof data.description).toBe("string");
      expect(data.description.length).toBeGreaterThan(0);
      expect(data.description.length).toBeLessThanOrEqual(1024);
      for (const value of Object.values(data.metadata ?? {})) {
        expect(typeof value).toBe("string");
      }
    }
  });

  it("exposes plugin-ready component IDs through the team manifest", () => {
    const errors = [];
    const manifest = parseJsonc(readFileSync(TEAM_MANIFEST, "utf8"), errors, {
      allowTrailingComma: true,
    });
    const config = parseJsonc(
      readFileSync(join(ROOT, "opencode.jsonc"), "utf8"),
      errors,
      { allowTrailingComma: true },
    );

    expect(errors).toEqual([]);
    expect(manifest.version).toBe(1);
    expect(manifest.id).toBe(TEAM_ID);
    expect(manifest.entryAgent).toBe(`${TEAM_ID}/lead`);
    expect(manifest.components.agents.map(({ id }) => id).sort()).toEqual(
      ROLES.map((role) => `${TEAM_ID}/${role}`).sort(),
    );

    for (const agent of manifest.components.agents) {
      if (agent.id !== `${TEAM_ID}/lead`) expect(agent.model).toBe(SUBAGENT_MODEL);
    }

    expect(manifest.components.skills.map(({ id }) => id).sort()).toEqual(
      [...SKILLS].sort(),
    );
    for (const { id } of manifest.components.mcps) expect(config.mcp[id]).toBeDefined();
    for (const { id } of manifest.components.instructions) {
      expect(config.instructions).toContain(id);
    }
    expect(config.instructions).not.toContain(".opencode/instructions/*");
    expect(() =>
      JSON.parse(readFileSync(join(ROOT, "harness", "team.schema.json"), "utf8")),
    ).not.toThrow();
  });

  it("rejects stale pre-namespace identifiers in the maintained harness", () => {
    const paths = [
      ...markdownFiles(TEAM_DIR),
      join(ROOT, "instructions", "senior-rust-developer.md"),
      join(ROOT, "skills", "rust-coding", "SKILL.md"),
      join(ROOT, "skills", "rust-design-patterns", "SKILL.md"),
      join(ROOT, "skills", "rust-review", "SKILL.md"),
      join(ROOT, "README.md"),
    ];
    const stale = [
      "rust-devloper",
      "_workspace/rust-engineer",
      "senior-rust-developer/rust-architect",
      "senior-rust-developer/rust-implementer",
      "senior-rust-developer/rust-reviewer",
      "senior-rust-developer/rust-review-worker",
      "senior-rust-developer/rust-review-dedup-judge",
      "senior-rust-developer/rust-review-fp-judge",
      "`design-patterns`",
      "../design-patterns/",
      "harness-runtime",
      "rust-orchestrator",
    ];

    for (const path of paths) {
      const content = readFileSync(path, "utf8");
      for (const token of stale) expect(content).not.toContain(token);
    }
  });
});
