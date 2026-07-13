import {
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
  realpathSync,
} from "node:fs";
import { join, resolve, basename, isAbsolute, normalize } from "node:path";
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
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  searchPaths: [".opencode/skills", "harness/*/skills"],
  cacheTTL: 300,
  allowAbsolutePaths: false,
  debug: false,
  maxSkillFileSize: 1_048_576, // 1 MiB
};

// Max bytes to read for frontmatter-only parsing during discovery.
// Frontmatter is typically < 2 KB; 64 KB is generous headroom.
const FRONTMATTER_READ_LIMIT = 65536;

// ---------------------------------------------------------------------------
// JSONC parser (handles comments + trailing commas)
// ---------------------------------------------------------------------------

function stripJsonc(raw) {
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
        if (next) {
          result += next;
          i++;
        }
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

function stripTrailingCommas(json) {
  // Remove trailing commas before ] or } — handles the most common JSONC extension
  return json.replace(/,(\s*[}\]])/g, "$1");
}

function parseJsonc(raw) {
  const stripped = stripJsonc(raw);
  const clean = stripTrailingCommas(stripped);
  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error(`Invalid JSONC: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function defaultConfigForRoot(root) {
  const directOpenCodeRoot =
    existsSync(join(root, "dynamic-skills.jsonc")) ||
    existsSync(join(root, "dynamic-skills.json")) ||
    existsSync(join(root, "plugins", "dynamic-skills.js"));

  return {
    ...DEFAULT_CONFIG,
    searchPaths: directOpenCodeRoot
      ? ["skills", "harness/*/skills", "vendor/*/skills"]
      : [...DEFAULT_CONFIG.searchPaths],
  };
}

function findConfigFile(root) {
  const candidates = [
    join(root, ".opencode", "dynamic-skills.jsonc"),
    join(root, ".opencode", "dynamic-skills.json"),
    join(root, "dynamic-skills.jsonc"),
    join(root, "dynamic-skills.json"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function loadConfig(context) {
  const root = context?.directory || process.cwd();
  const defaults = defaultConfigForRoot(root);
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
    config = defaults;
    return config;
  }

  const raw = readFileSync(candidate, "utf-8");
  let parsed;
  try {
    parsed = parseJsonc(raw);
  } catch (e) {
    // On parse failure, warn via console but don't crash — fall back to defaults
    configPath = null;
    config = { ...defaults, _parseError: e.message };
    return config;
  }

  configPath = candidate;
  config = {
    searchPaths: Array.isArray(parsed.searchPaths)
      ? parsed.searchPaths
      : defaults.searchPaths,
    cacheTTL:
      typeof parsed.cacheTTL === "number"
        ? parsed.cacheTTL
        : defaults.cacheTTL,
    allowAbsolutePaths:
      typeof parsed.allowAbsolutePaths === "boolean"
        ? parsed.allowAbsolutePaths
        : defaults.allowAbsolutePaths,
    debug:
      typeof parsed.debug === "boolean" ? parsed.debug : defaults.debug,
    maxSkillFileSize:
      typeof parsed.maxSkillFileSize === "number"
        ? parsed.maxSkillFileSize
        : defaults.maxSkillFileSize,
  };
  return config;
}

function shouldDebug(args, context) {
  if (args?.debug === true) return true;
  const cfg = loadConfig(context);
  return cfg.debug === true;
}

// ---------------------------------------------------------------------------
// Path expansion
// ---------------------------------------------------------------------------

function escapeRegex(str) {
  return str.replace(/[.+?^${}()|[\]\\*]/g, "\\$&");
}

function expandPath(pattern, root, allowAbsolute) {
  if (pattern.startsWith("~/")) {
    pattern = join(homedir(), pattern.slice(2));
  }

  if (isAbsolute(pattern)) {
    if (!allowAbsolute) return [];
    if (existsSync(pattern)) {
      try {
        return [realpathSync(pattern)];
      } catch {
        return [pattern];
      }
    }
    return [];
  }

  const resolved = resolve(root, pattern);

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

  // Split on literal *, escape each fragment, join with capture group
  const frags = globPart.split("*").map(escapeRegex);
  const regex = new RegExp("^" + frags.join("([^/]+)") + "$");

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
// Collect all configured roots (for path-traversal guard)
// ---------------------------------------------------------------------------

function collectConfigRoots(context) {
  const root = context?.directory || process.cwd();
  const cfg = loadConfig(context);
  const roots = new Set();
  roots.add(resolve(root)); // project root always allowed

  for (const pattern of cfg.searchPaths) {
    const paths = expandPath(pattern, root, cfg.allowAbsolutePaths);
    for (const p of paths) {
      try {
        roots.add(realpathSync(p));
      } catch {
        roots.add(resolve(p));
      }
    }
  }
  return Array.from(roots);
}

function isWithinRoots(target, roots) {
  let normalized;
  try {
    normalized = realpathSync(target);
  } catch {
    normalized = resolve(target);
  }
  normalized = normalize(normalized);

  for (const r of roots) {
    let nr;
    try {
      nr = realpathSync(r);
    } catch {
      nr = resolve(r);
    }
    nr = normalize(nr);
    if (normalized === nr || normalized.startsWith(nr + "/")) {
      return true;
    }
  }
  return false;
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

// ---------------------------------------------------------------------------
// YAML frontmatter parser (handles block scalars: >, >-, |, |-)
// ---------------------------------------------------------------------------

function parseSkillMeta(skillMdPath, sizeLimit = FRONTMATTER_READ_LIMIT) {
  try {
    const fd = readFileSync(skillMdPath, "utf-8");
    const content = fd.length > sizeLimit ? fd.slice(0, sizeLimit) : fd;

    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return { description: "" };

    const frontmatter = match[1];
    const lines = frontmatter.split("\n");
    const meta = {};

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      if (rawLine.trim() === "") continue;

      const indent = rawLine.search(/\S/);
      const kv = rawLine.match(/^(\w[\w-]*):\s*(.*)$/);

      if (!kv) continue;

      const key = kv[1];
      let rawValue = kv[2];

      // Block scalar indicators: >, >-, >+, |, |-, |+
      const blockMatch = rawValue.match(/^\s*(>[+-]?|\|[+-]?)\s*$/);
      if (blockMatch) {
        const style = blockMatch[1];
        const isLiteral = style[0] === "|"; // | = preserve newlines
        const chomp = style[1] || ""; // "" = clip, "-" = strip, "+" = keep
        const parts = [];

        // Collect continuation lines (indented more than the key line)
        for (let j = i + 1; j < lines.length; j++) {
          const contLine = lines[j];
          if (contLine.trim() === "") {
            if (!isLiteral) parts.push("\n\n");
            else parts.push("");
            continue;
          }
          const contIndent = contLine.search(/\S/);
          if (contIndent <= indent) break;
          parts.push(contLine.trim());
          i = j;
        }

        let joined = parts.join(isLiteral ? "\n" : " ");
        if (chomp === "-") joined = joined.replace(/\n+$/, "");
        else if (chomp === "") joined = joined.replace(/\n$/, "");

        meta[key] = joined;
        continue;
      }

      // Indented plain scalar: key:\n  value across indented lines
      if (rawValue.trim() === "") {
        const parts = [];
        for (let j = i + 1; j < lines.length; j++) {
          const contLine = lines[j];
          if (contLine.trim() === "") break;
          const contIndent = contLine.search(/\S/);
          if (contIndent <= indent) break;
          parts.push(contLine.trim());
          i = j;
        }
        if (parts.length > 0) {
          meta[key] = parts.join(" ");
          continue;
        }
        // Empty value — skip (handled below as "")
      }

      // Normal scalar value
      let value = rawValue.trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (value.startsWith("[") && value.endsWith("]")) {
        try {
          value = JSON.parse(value);
        } catch {
          const inner = value.slice(1, -1).trim();
          if (inner === "") {
            value = [];
          } else {
            value = inner.split(",").map((s) => {
              let t = s.trim();
              if (
                (t.startsWith('"') && t.endsWith('"')) ||
                (t.startsWith("'") && t.endsWith("'"))
              ) {
                t = t.slice(1, -1);
              }
              return t;
            });
          }
        }
      }

      meta[key] = value;
    }

    return meta;
  } catch {
    return { description: "" };
  }
}

// ---------------------------------------------------------------------------
// Source classification
// ---------------------------------------------------------------------------

function classifySource(searchPath) {
  if (
    searchPath.includes("/.opencode/skills") &&
    !searchPath.includes("/vendor/")
  ) {
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

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

function discoverSkills(context, debug) {
  const root = context?.directory || process.cwd();
  const cfg = loadConfig(context);
  const logs = [];

  if (debug) {
    logs.push("--- Discovery Start ---");
    logs.push(`config: ${configPath || "(defaults)"}`);
    logs.push(`searchPaths: ${JSON.stringify(cfg.searchPaths)}`);
  }

  const allSkills = new Map();
  const duplicateNames = new Map(); // name -> array of { source, path }
  let totalFound = 0;
  let totalConflicts = 0;

  for (const pattern of cfg.searchPaths) {
    const paths = expandPath(pattern, root, cfg.allowAbsolutePaths);

    if (debug) {
      if (paths.length === 0) {
        logs.push(`  SKIP ${pattern} → no matching directories`);
      } else {
        logs.push(
          `  SCAN ${pattern} → ${paths.length} director${paths.length === 1 ? "y" : "ies"}`,
        );
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

        // Track all occurrences for duplicate reporting
        if (!duplicateNames.has(name)) duplicateNames.set(name, []);
        duplicateNames.get(name).push({ source, path: skillDir, priority });

        const existing = allSkills.get(name);
        if (existing) {
          totalConflicts++;
          if (priority < existing.priority) {
            if (debug) {
              logs.push(
                `    CONFLICT: "${name}" → chose ${source}/${team || "?"} ` +
                  `(priority ${priority}) over ${existing.source}/${existing.team || "?"} ` +
                  `(priority ${existing.priority})`,
              );
            }
            allSkills.set(name, entry);
          } else if (debug) {
            logs.push(
              `    CONFLICT: "${name}" → kept ${existing.source}/${existing.team || "?"} ` +
                `(priority ${existing.priority}) over ${source}/${team || "?"} ` +
                `(priority ${priority})`,
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
        `${totalFound} found, ${totalConflicts} conflicts resolved ---`,
    );
  }

  return { skills: allSkills, logs, duplicateNames };
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

function getCachedSkills(context, debug) {
  const cfg = loadConfig(context);
  const ttl = (cfg.cacheTTL || 300) * 1000;
  const now = Date.now();

  if (cache && now - cacheTimestamp < ttl) {
    // Return a copy so caller can't mutate the cached logs
    const result = { ...cache };
    if (debug) {
      result.logs = [...(cache.logs || []), "(using cached results)"];
    }
    return result;
  }

  const result = discoverSkills(context, debug);
  cache = result;
  cacheTimestamp = now;
  // Return a fresh copy so caller sees the correct logs
  return { ...result, logs: debug ? [...(result.logs || [])] : result.logs };
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
    const cwd = context?.directory || process.cwd();
    const resolved = resolve(cwd, args.path);

    // Security: check that resolved path is within configured roots
    const roots = collectConfigRoots(context);
    if (!isWithinRoots(resolved, roots)) {
      return {
        error: `Path "${args.path}" resolves outside configured skill roots: ${resolved}`,
      };
    }

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
          .describe("Enable debug output showing discovery scan details."),
      },
      async execute(args, context) {
        const debug = shouldDebug(args, context);
        const { skills, logs } = getCachedSkills(context, debug);
        const result = Array.from(skills.values()).map(formatSkillEntry);

        const output = { skills: result, count: result.length };
        if (debug) output.debug = logs;

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
          .describe(
            "Free-text search against skill name, description, and tags.",
          ),
        team: schema
          .string()
          .optional()
          .describe("Filter by harness team name."),
        source: schema
          .string()
          .optional()
          .describe("Filter by source: local, harness, vendor, global."),
        tag: schema.string().optional().describe("Filter by tag."),
        debug: schema.boolean().optional().describe("Enable debug output."),
      },
      async execute(args, context) {
        const debug = shouldDebug(args, context);
        const { skills, logs } = getCachedSkills(context, debug);
        let results = Array.from(skills.values());

        if (args.team) results = results.filter((s) => s.team === args.team);
        if (args.source)
          results = results.filter((s) => s.source === args.source);
        if (args.tag) {
          results = results.filter(
            (s) =>
              s.tags &&
              s.tags.some((t) => t.toLowerCase() === args.tag.toLowerCase()),
          );
        }
        if (args.query) {
          const q = args.query.toLowerCase();
          results = results.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.description.toLowerCase().includes(q) ||
              (s.tags && s.tags.some((t) => t.toLowerCase().includes(q))) ||
              (s.team && s.team.toLowerCase().includes(q)),
          );
        }

        const output = {
          skills: results.map(formatSkillEntry),
          count: results.length,
        };
        if (debug) output.debug = logs;

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
          .describe(
            "Explicit path to a skill directory (must be within configured roots).",
          ),
        debug: schema.boolean().optional().describe("Enable debug output."),
      },
      async execute(args, context) {
        const debug = shouldDebug(args, context);
        const { skills, logs } = getCachedSkills(context, debug);

        const skill = resolveSkill(args, skills, context);
        if (skill.error) {
          return {
            title: "Skills Load Failed",
            output: JSON.stringify(skill, null, 2),
            metadata: { error: true },
          };
        }

        let content;
        try {
          const cfg = loadConfig(context);
          const st = statSync(skill.skillMd);
          if (st.size > cfg.maxSkillFileSize) {
            return {
              title: "Skills Load Failed",
              output: JSON.stringify(
                {
                  error: `SKILL.md too large (${st.size} bytes, max ${cfg.maxSkillFileSize})`,
                  path: skill.skillMd,
                },
                null,
                2,
              ),
              metadata: { error: true },
            };
          }
          content = readFileSync(skill.skillMd, "utf-8");
        } catch (e) {
          return {
            title: "Skills Load Failed",
            output: JSON.stringify(
              {
                error: `Cannot read skill file: ${e.message}`,
                path: skill.skillMd,
              },
              null,
              2,
            ),
            metadata: { error: true },
          };
        }

        if (debug) {
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
        if (debug) output.debug = logs;

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
        debug: schema.boolean().optional().describe("Enable debug output."),
      },
      async execute(args, context) {
        cache = null;
        cacheTimestamp = 0;
        config = null;
        configMtime = 0;
        const debug = shouldDebug(args, context);
        const { skills, logs } = getCachedSkills(context, debug);

        const names = Array.from(skills.values())
          .map((s) => s.name)
          .sort();

        const output = { refreshed: true, count: skills.size, skills: names };
        if (debug) output.debug = logs;

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
        "Diagnose skill configuration and validate all skill files. Checks for: missing config, unreadable files, missing SKILL.md, invalid search paths, duplicate skill names, and config parse errors. Always runs with verbose output.",
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

        // Report config parse error
        if (cfg._parseError) {
          issues.push({
            severity: "error",
            message: `Config parse error: ${cfg._parseError}. Using defaults.`,
          });
          fail++;
        }

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

          info.push(
            `"${pattern}" → ${paths.length} director${paths.length === 1 ? "y" : "ies"}`,
          );

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

              if (!existsSync(skillMd)) continue;

              try {
                readFileSync(skillMd, "utf-8"); // readability check
                const meta = parseSkillMeta(skillMd);

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

        // Check for duplicate names (before conflict resolution)
        const { skills: allSkills, duplicateNames } = discoverSkills(
          context,
          false,
        );
        info.push(`total skills after conflict resolution: ${allSkills.size}`);

        let totalDuplicates = 0;
        for (const [name, occurrences] of duplicateNames) {
          if (occurrences.length > 1) {
            totalDuplicates++;
            warnings.push({
              message: `Duplicate skill name "${name}" found in ${occurrences.length} locations`,
              occurrences: occurrences.map((o) => ({
                source: o.source,
                path: o.path,
                priority: o.priority,
                selected: allSkills.get(name)?.path === o.path,
              })),
            });
          }
        }
        if (totalDuplicates > 0) {
          info.push(
            `${totalDuplicates} duplicate skill name${totalDuplicates === 1 ? "" : "s"} found (resolved by priority)`,
          );
        }

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
