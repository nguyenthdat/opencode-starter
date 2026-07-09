import { readFileSync, existsSync, readdirSync, statSync, realpathSync } from "node:fs";
import { join, resolve, dirname, basename, relative, isAbsolute, normalize } from "node:path";
import { homedir } from "node:os";
import { tool } from "@opencode-ai/plugin";

const schema = tool.schema;

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------
let cache = null;
let cacheTimestamp = 0;
let configPath = null;
let config = null;
let configMtime = 0;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  searchPaths: [".opencode/skills", "harness/*/skills"],
  cacheTTL: 300,
  allowAbsolutePaths: false,
  debug: false,
  maxSkillFileSize: 1_048_576, // 1 MiB
};

function findConfigFile(root) {
  const candidates = [
    join(root, ".opencode", "dynamic-skills.jsonc"),
    join(root, ".opencode", "dynamic-skills.json"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function stripJsonComments(raw) {
  let result = "";
  let inString = false;
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  let stringDelim = null;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (inSingleLineComment) {
      if (ch === "\n") {
        inSingleLineComment = false;
        result += ch;
      }
      continue;
    }

    if (inMultiLineComment) {
      if (ch === "*" && next === "/") {
        inMultiLineComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      result += ch;
      if (ch === "\\") {
        if (next) { result += next; i++; }
      } else if (ch === stringDelim) {
        inString = false;
        stringDelim = null;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      inSingleLineComment = true;
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      inMultiLineComment = true;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringDelim = ch;
    }

    result += ch;
  }

  return result;
}

function loadConfig(context) {
  const root = context?.directory || process.cwd();
  const candidate = findConfigFile(root);

  if (candidate) {
    try {
      const st = statSync(candidate);
      if (candidate === configPath && st.mtimeMs === configMtime) {
        return config;
      }
      configMtime = st.mtimeMs;
    } catch {
      // file disappeared, fall through
    }
  }

  if (!candidate) {
    configPath = null;
    config = { ...DEFAULT_CONFIG };
    return config;
  }

  const raw = readFileSync(candidate, "utf-8");
  const stripped = stripJsonComments(raw);
  const parsed = JSON.parse(stripped);

  configPath = candidate;
  config = {
    searchPaths: parsed.searchPaths || DEFAULT_CONFIG.searchPaths,
    cacheTTL: parsed.cacheTTL ?? DEFAULT_CONFIG.cacheTTL,
    allowAbsolutePaths: parsed.allowAbsolutePaths ?? DEFAULT_CONFIG.allowAbsolutePaths,
    debug: parsed.debug ?? DEFAULT_CONFIG.debug,
    maxSkillFileSize: parsed.maxSkillFileSize ?? DEFAULT_CONFIG.maxSkillFileSize,
  };
  return config;
}

// ---------------------------------------------------------------------------
// Path expansion
// ---------------------------------------------------------------------------

function expandPath(pattern, root, allowAbsolute) {
  // Home directory
  if (pattern.startsWith("~/")) {
    pattern = join(homedir(), pattern.slice(2));
  }

  // Absolute paths
  if (isAbsolute(pattern)) {
    if (!allowAbsolute) return [];
    if (existsSync(pattern)) {
      const r = realpathSync(pattern);
      return [r];
    }
    return [];
  }

  // Resolve relative path
  const resolved = resolve(root, pattern);

  // Glob expansion for single-level wildcards like harness/*/skills
  if (pattern.includes("*")) {
    return expandGlob(pattern, root);
  }

  if (existsSync(resolved)) {
    try {
      return [realpathSync(resolved)];
    } catch {
      return [resolved];
    }
  }
  return [];
}

function expandGlob(pattern, root) {
  const parts = pattern.split("/");
  const globIdx = parts.findIndex((p) => p.includes("*"));

  if (globIdx === -1) {
    const p = resolve(root, pattern);
    return existsSync(p) ? [p] : [];
  }

  const baseParts = parts.slice(0, globIdx);
  const base = resolve(root, ...baseParts);

  if (!existsSync(base)) return [];

  const globPart = parts[globIdx];
  const suffix = parts.slice(globIdx + 1).join("/");
  const regex = new RegExp(
    "^" + globPart.replace(/\*/g, "([^/]+)") + "$"
  );

  const results = [];
  let entries;
  try {
    entries = readdirSync(base, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!regex.test(entry.name)) continue;

    const candidate = join(base, entry.name, suffix);
    if (existsSync(candidate)) {
      try {
        results.push(realpathSync(candidate));
      } catch {
        results.push(candidate);
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Skill discovery
// ---------------------------------------------------------------------------

function findSkillDirs(searchPath) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(searchPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    const skillMd = join(searchPath, entry.name, "SKILL.md");
    if (existsSync(skillMd)) {
      results.push(join(searchPath, entry.name));
    }
  }
  return results;
}

function parseSkillMeta(skillMdPath) {
  try {
    const content = readFileSync(skillMdPath, "utf-8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return { description: "" };

    const frontmatter = match[1];
    const meta = {};
    let currentKey = null;
    let currentIndent = 0;

    for (const rawLine of frontmatter.split("\n")) {
      const line = rawLine.trimEnd();
      if (line.trim() === "") continue;

      const indent = line.search(/\S/);
      const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
      
      if (kv) {
        const key = kv[1];
        let value = kv[2].trim();

        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        if (value.startsWith("[") && value.endsWith("]")) {
          try {
            value = JSON.parse(value);
          } catch {
            // YAML flow array: [rust, coding, "quoted value"]
            const inner = value.slice(1, -1).trim();
            if (inner === "") {
              value = [];
            } else {
              value = inner.split(",").map((s) => {
                let t = s.trim();
                if ((t.startsWith('"') && t.endsWith('"')) ||
                    (t.startsWith("'") && t.endsWith("'"))) {
                  t = t.slice(1, -1);
                }
                return t;
              });
            }
          }
        }

        if (indent === 0) {
          meta[key] = value;
          currentKey = key;
          currentIndent = indent;
        } else if (currentKey && indent > currentIndent) {
          // nested key under parent
          if (typeof meta[currentKey] !== "object" || Array.isArray(meta[currentKey])) {
            meta[currentKey] = {};
          }
          meta[currentKey][key] = value;
        }
      }
    }

    return meta;
  } catch {
    return { description: "" };
  }
}

function classifySource(searchPath) {
  if (searchPath.includes("/.opencode/skills") && !searchPath.includes("/vendor/")) {
    return { source: "local", priority: 0 };
  }
  if (searchPath.includes("/harness/")) {
    const m = searchPath.match(/\/harness\/([^/]+)\//);
    return { source: "harness", priority: 10, team: m ? m[1] : null };
  }
  if (searchPath.includes("/vendor/")) {
    const m = searchPath.match(/\/vendor\/([^/]+)\//);
    return { source: "vendor", priority: 20, team: m ? m[1] : null };
  }
  return { source: "global", priority: 30 };
}

function discoverSkills(context, debug) {
  const root = context?.directory || process.cwd();
  const cfg = loadConfig(context);
  const logs = [];

  if (debug) {
    logs.push(`--- Discovery Start ---`);
    logs.push(`config: ${configPath || "(defaults)"}`);
    logs.push(`searchPaths: ${JSON.stringify(cfg.searchPaths)}`);
  }

  const allSkills = new Map();
  let totalFound = 0;
  let totalConflicts = 0;

  for (const pattern of cfg.searchPaths) {
    const paths = expandPath(pattern, root, cfg.allowAbsolutePaths);

    if (debug) {
      if (paths.length === 0) {
        logs.push(`  SKIP ${pattern} → no matching directories`);
      } else {
        logs.push(`  SCAN ${pattern} → ${paths.length} director${paths.length === 1 ? "y" : "ies"}`);
      }
    }

    for (const searchPath of paths) {
      const skillDirs = findSkillDirs(searchPath);

      for (const skillDir of skillDirs) {
        totalFound++;
        const skillMd = join(skillDir, "SKILL.md");
        const meta = parseSkillMeta(skillMd);
        const name = meta.name || basename(skillDir);
        const { source, priority, team } = classifySource(searchPath);

        const entry = {
          name,
          description: meta.description || "",
          tags: Array.isArray(meta.tags) ? meta.tags : [],
          path: skillDir,
          skillMd,
          source,
          team: team || null,
          priority,
        };

        const existing = allSkills.get(name);
        if (existing) {
          totalConflicts++;
          if (priority < existing.priority) {
            if (debug) {
              logs.push(
                `    CONFLICT: "${name}" → chose ${source}/${team || "?"} ` +
                `(priority ${priority}) over ${existing.source}/${existing.team || "?"} ` +
                `(priority ${existing.priority})`
              );
            }
            allSkills.set(name, entry);
          } else if (debug) {
            logs.push(
              `    CONFLICT: "${name}" → kept ${existing.source}/${existing.team || "?"} ` +
              `(priority ${existing.priority}) over ${source}/${team || "?"} ` +
              `(priority ${priority})`
            );
          }
        } else {
          allSkills.set(name, entry);
          if (debug) {
            logs.push(`    FOUND: "${name}" [${source}] ${skillDir}`);
          }
        }
      }
    }
  }

  if (debug) {
    logs.push(
      `--- Discovery Complete: ${allSkills.size} skills, ` +
      `${totalFound} found, ${totalConflicts} conflicts resolved ---`
    );
  }

  return { skills: allSkills, logs };
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

function getCachedSkills(context, debug) {
  const cfg = loadConfig(context);
  const ttl = (cfg.cacheTTL || 300) * 1000;
  const now = Date.now();

  if (cache && now - cacheTimestamp < ttl) {
    if (debug) cache.logs.push("(using cached results)");
    return cache;
  }

  const result = discoverSkills(context, debug);
  cache = result;
  cacheTimestamp = now;
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSkillEntry(s) {
  return {
    name: s.name,
    description: s.description,
    tags: s.tags,
    source: s.source,
    team: s.team,
    path: s.path,
  };
}

function resolveSkill(args, skills, context) {
  if (args.path) {
    const resolved = resolve(context?.directory || process.cwd(), args.path);
    const skillMd = join(resolved, "SKILL.md");
    if (!existsSync(skillMd)) {
      return { error: `No SKILL.md found at ${resolved}` };
    }
    return {
      name: basename(resolved),
      path: resolved,
      skillMd,
      source: "explicit",
      team: null,
    };
  }

  if (args.name) {
    const skill = skills.get(args.name);
    if (!skill) {
      return {
        error: `Skill "${args.name}" not found. Use skills_find to search.`,
      };
    }
    return skill;
  }

  return { error: "Either name or path is required" };
}

// ---------------------------------------------------------------------------
// Path traversal guard
// ---------------------------------------------------------------------------

function isWithinRoots(target, roots) {
  const normalized = normalize(resolve(target));
  for (const r of roots) {
    const nr = normalize(resolve(r));
    if (normalized.startsWith(nr + "/") || normalized === nr) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const DynamicSkillsPlugin = async () => ({
  tool: {
    // -----------------------------------------------------------------------
    // skills:list
    // -----------------------------------------------------------------------
    skills_list: tool({
      description:
        "List all discovered skills with metadata. Returns skill name, description, tags, source (local/harness/vendor/global), team, and path. Use this to see what skills are available before loading one.",
      args: {
        debug: schema
          .boolean()
          .optional()
          .default(false)
          .describe("Enable debug output showing discovery scan details."),
      },
      async execute(args, context) {
        const { skills, logs } = getCachedSkills(context, args.debug);
        const result = Array.from(skills.values()).map(formatSkillEntry);

        const output = {
          skills: result,
          count: result.length,
        };
        if (args.debug) output.debug = logs;

        return {
          title: `Skills List (${result.length})`,
          output: JSON.stringify(output, null, 2),
          metadata: { count: result.length },
        };
      },
    }),

    // -----------------------------------------------------------------------
    // skills:find
    // -----------------------------------------------------------------------
    skills_find: tool({
      description:
        "Find skills by name, tag, team, source, or free-text query. Returns matching skills with metadata. Use this to locate a specific skill before loading it.",
      args: {
        query: schema
          .string()
          .optional()
          .describe("Free-text search against skill name, description, and tags."),
        team: schema.string().optional().describe("Filter by harness team name."),
        source: schema
          .string()
          .optional()
          .describe("Filter by source: local, harness, vendor, global."),
        tag: schema.string().optional().describe("Filter by tag."),
        debug: schema
          .boolean()
          .optional()
          .default(false)
          .describe("Enable debug output."),
      },
      async execute(args, context) {
        const { skills, logs } = getCachedSkills(context, args.debug);
        let results = Array.from(skills.values());

        if (args.team) {
          results = results.filter((s) => s.team === args.team);
        }
        if (args.source) {
          results = results.filter((s) => s.source === args.source);
        }
        if (args.tag) {
          results = results.filter(
            (s) => s.tags && s.tags.some((t) => t.toLowerCase() === args.tag.toLowerCase())
          );
        }
        if (args.query) {
          const q = args.query.toLowerCase();
          results = results.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.description.toLowerCase().includes(q) ||
              (s.tags && s.tags.some((t) => t.toLowerCase().includes(q))) ||
              (s.team && s.team.toLowerCase().includes(q))
          );
        }

        const output = {
          skills: results.map(formatSkillEntry),
          count: results.length,
        };
        if (args.debug) output.debug = logs;

        return {
          title: `Skills Find (${results.length} match${results.length === 1 ? "" : "es"})`,
          output: JSON.stringify(output, null, 2),
          metadata: { count: results.length },
        };
      },
    }),

    // -----------------------------------------------------------------------
    // skills:load
    // -----------------------------------------------------------------------
    skills_load: tool({
      description:
        "Load a specific skill's complete SKILL.md content on demand. Use this when an agent or subagent needs a skill's full instructions. The skill is NOT loaded into context until this is called explicitly. Use 'name' for lookup by skill name, or 'path' to load from an explicit directory bypassing discovery.",
      args: {
        name: schema.string().optional().describe("Name of the skill to load."),
        path: schema
          .string()
          .optional()
          .describe("Explicit path to a skill directory (bypasses name-based discovery)."),
        debug: schema
          .boolean()
          .optional()
          .default(false)
          .describe("Enable debug output."),
      },
      async execute(args, context) {
        const { skills, logs } = getCachedSkills(context, args.debug);
        const root = context?.directory || process.cwd();

        const skill = resolveSkill(args, skills, context);
        if (skill.error) {
          return {
            title: "Skills Load Failed",
            output: JSON.stringify(skill, null, 2),
            metadata: { error: true },
          };
        }

        // Read skill content
        let content;
        try {
          const cfg = loadConfig(context);
          const st = statSync(skill.skillMd);
          if (st.size > cfg.maxSkillFileSize) {
            return {
              title: "Skills Load Failed",
              output: JSON.stringify({
                error: `SKILL.md too large (${st.size} bytes, max ${cfg.maxSkillFileSize})`,
                path: skill.skillMd,
              }, null, 2),
              metadata: { error: true },
            };
          }
          content = readFileSync(skill.skillMd, "utf-8");
        } catch (e) {
          return {
            title: "Skills Load Failed",
            output: JSON.stringify({
              error: `Cannot read skill file: ${e.message}`,
              path: skill.skillMd,
            }, null, 2),
            metadata: { error: true },
          };
        }

        if (args.debug) {
          logs.push(`Loaded: ${skill.name} from ${skill.skillMd}`);
          logs.push(`Source: ${skill.source}, Team: ${skill.team || "N/A"}`);
        }

        const output = {
          name: skill.name,
          source: skill.source,
          team: skill.team,
          path: skill.path,
          content,
        };
        if (args.debug) output.debug = logs;

        return {
          title: `Skill: ${skill.name}`,
          output: JSON.stringify(output, null, 2),
          metadata: {
            name: skill.name,
            source: skill.source,
            size: content.length,
          },
        };
      },
    }),

    // -----------------------------------------------------------------------
    // skills:refresh
    // -----------------------------------------------------------------------
    skills_refresh: tool({
      description:
        "Force a full re-scan of all configured skill search paths. Clears the cache and re-discovers all skills. Use this after adding, removing, or modifying skill files to ensure the agent sees the latest skills.",
      args: {
        debug: schema
          .boolean()
          .optional()
          .default(false)
          .describe("Enable debug output."),
      },
      async execute(args, context) {
        cache = null;
        cacheTimestamp = 0;
        config = null;
        configMtime = 0;
        const { skills, logs } = getCachedSkills(context, args.debug);

        const names = Array.from(skills.values()).map((s) => s.name).sort();

        const output = {
          refreshed: true,
          count: skills.size,
          skills: names,
        };
        if (args.debug) output.debug = logs;

        return {
          title: `Skills Refresh (${skills.size} skills)`,
          output: JSON.stringify(output, null, 2),
          metadata: { count: skills.size },
        };
      },
    }),

    // -----------------------------------------------------------------------
    // skills:doctor
    // -----------------------------------------------------------------------
    skills_doctor: tool({
      description:
        "Diagnose skill configuration and validate all skill files. Checks for: missing config, unreadable files, missing SKILL.md, invalid search paths, and duplicate skill names. Always runs with verbose output.",
      args: {
        debug: schema
          .boolean()
          .optional()
          .default(true)
          .describe("Enable verbose debug (always true for doctor)."),
      },
      async execute(args, context) {
        const root = context?.directory || process.cwd();
        const cfg = loadConfig(context);
        const issues = [];
        const warnings = [];
        const info = [];
        let ok = 0;
        let fail = 0;

        info.push(`project root: ${root}`);
        info.push(`config file: ${configPath || "(using defaults)"}`);

        // Validate each search path
        for (const pattern of cfg.searchPaths) {
          const paths = expandPath(pattern, root, cfg.allowAbsolutePaths);

          if (paths.length === 0) {
            issues.push({
              severity: "error",
              message: `Search path "${pattern}" resolves to no directories`,
            });
            fail++;
            continue;
          }

          info.push(`"${pattern}" → ${paths.length} director${paths.length === 1 ? "y" : "ies"}`);

          for (const searchPath of paths) {
            let entries;
            try {
              entries = readdirSync(searchPath, { withFileTypes: true });
            } catch (e) {
              issues.push({
                severity: "error",
                path: searchPath,
                message: `Cannot read directory: ${e.message}`,
              });
              fail++;
              continue;
            }

            for (const entry of entries) {
              if (!entry.isDirectory()) continue;
              if (entry.name.startsWith(".")) continue;

              const skillDir = join(searchPath, entry.name);
              const skillMd = join(skillDir, "SKILL.md");

              if (!existsSync(skillMd)) {
                // Not a skill directory — skip silently
                continue;
              }

              try {
                const content = readFileSync(skillMd, "utf-8");
                const meta = parseSkillMeta(skillMd);
                const name = meta.name || entry.name;

                if (!meta.name) {
                  warnings.push({
                    path: skillDir,
                    message: `SKILL.md missing "name" in frontmatter, using directory name "${entry.name}"`,
                  });
                }

                if (!meta.description) {
                  warnings.push({
                    path: skillDir,
                    message: `SKILL.md missing "description" in frontmatter`,
                  });
                }

                // Check for path traversal in content
                if (content.includes("../") && content.includes("SKILL.md")) {
                  warnings.push({
                    path: skillDir,
                    message: "SKILL.md may contain relative path references",
                  });
                }

                ok++;
              } catch (e) {
                issues.push({
                  severity: "error",
                  path: skillMd,
                  message: `Unreadable SKILL.md: ${e.message}`,
                });
                fail++;
              }
            }
          }
        }

        // Check for duplicate names
        const { skills: allSkills } = discoverSkills(context, false);
        info.push(`total unique skills after conflict resolution: ${allSkills.size}`);

        const status = issues.length === 0 ? "healthy" : "issues_found";

        const output = {
          status,
          summary: `${ok} valid skill${ok === 1 ? "" : "s"}, ${fail} error${fail === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`,
          issues,
          warnings,
          info,
        };

        return {
          title: `Skills Doctor: ${status}`,
          output: JSON.stringify(output, null, 2),
          metadata: { status, ok, fail, warnings: warnings.length },
        };
      },
    }),
  },
});

export default DynamicSkillsPlugin;
