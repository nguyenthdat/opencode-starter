import {
  closeSync,
  readFileSync,
  readSync,
  existsSync,
  openSync,
  readdirSync,
  statSync,
  realpathSync,
} from "node:fs";
import {
  join,
  resolve,
  basename,
  isAbsolute,
  normalize,
  relative,
} from "node:path";
import { homedir } from "node:os";
import { tool } from "@opencode-ai/plugin";
import { parse as parseJsoncText, printParseErrorCode } from "jsonc-parser";
import { parse as parseYaml } from "yaml";

const schema = tool.schema;

// ---------------------------------------------------------------------------
// Workspace-scoped state
// ---------------------------------------------------------------------------
const workspaceStates = new Map();

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
const MAX_DISCOVERY_DEPTH = 12;
const MAX_DISCOVERY_DIRECTORIES = 20_000;
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CONFIG_SCHEMA = schema
  .object({
    searchPaths: schema.array(schema.string().min(1)).min(1).max(64).optional(),
    cacheTTL: schema.number().finite().min(0).max(86_400).optional(),
    allowAbsolutePaths: schema.boolean().optional(),
    debug: schema.boolean().optional(),
    maxSkillFileSize: schema
      .number()
      .int()
      .positive()
      .max(4 * 1024 * 1024)
      .optional(),
  })
  .strict();

function workspaceRoot(context) {
  const root = resolve(context?.directory || process.cwd());
  try {
    return realpathSync(root);
  } catch {
    return root;
  }
}

function workspaceState(context) {
  const root = workspaceRoot(context);
  if (!workspaceStates.has(root)) {
    workspaceStates.set(root, {
      root,
      cache: null,
      cacheTimestamp: 0,
      configPath: null,
      configSignature: null,
      config: null,
    });
  }
  return workspaceStates.get(root);
}

// ---------------------------------------------------------------------------
// JSONC parser
// ---------------------------------------------------------------------------

function parseJsonc(raw) {
  const errors = [];
  const parsed = parseJsoncText(raw, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length > 0) {
    const details = errors
      .map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`)
      .join(", ");
    throw new Error(`Invalid JSONC: ${details}`);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function defaultConfigForRoot(root) {
  const directOpenCodeRoot = basename(resolve(root)) === ".opencode";

  return {
    ...DEFAULT_CONFIG,
    searchPaths: directOpenCodeRoot
      ? ["skills", "harness/*/skills", "vendor/*/skills"]
      : [...DEFAULT_CONFIG.searchPaths],
  };
}

function findConfigFile(root) {
  const directOpenCodeRoot = basename(resolve(root)) === ".opencode";
  const direct = [
    join(root, "dynamic-skills.jsonc"),
    join(root, "dynamic-skills.json"),
  ];
  const nested = [
    join(root, ".opencode", "dynamic-skills.jsonc"),
    join(root, ".opencode", "dynamic-skills.json"),
  ];
  const candidates = directOpenCodeRoot
    ? [...direct, ...nested]
    : [...nested, ...direct];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function loadConfig(context) {
  const state = workspaceState(context);
  const root = state.root;
  const defaults = defaultConfigForRoot(root);
  const candidate = findConfigFile(root);

  if (!candidate) {
    if (state.configSignature !== "defaults") state.cache = null;
    state.configPath = null;
    state.configSignature = "defaults";
    state.config = defaults;
    return state.config;
  }

  let signature;
  try {
    const st = statSync(candidate);
    signature = `${candidate}:${st.mtimeMs}:${st.size}`;
    if (signature === state.configSignature && state.config) return state.config;

    const parsed = parseJsonc(readFileSync(candidate, "utf-8"));
    const validated = CONFIG_SCHEMA.safeParse(parsed);
    if (!validated.success) {
      throw new Error(validated.error.issues.map((issue) => issue.message).join("; "));
    }

    state.configPath = candidate;
    state.configSignature = signature;
    state.config = { ...defaults, ...validated.data };
    state.cache = null;
    state.cacheTimestamp = 0;
    return state.config;
  } catch (e) {
    if (signature !== state.configSignature) state.cache = null;
    state.configPath = candidate;
    state.configSignature = signature || `${candidate}:error`;
    state.config = { ...defaults, _parseError: e.message };
    return state.config;
  }
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
  if (typeof pattern !== "string" || pattern.length === 0) return [];
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
    return expandGlob(pattern, root).filter(
      (candidate) => allowAbsolute || isWithinRoots(candidate, [root]),
    );
  }

  if (existsSync(resolved)) {
    try {
      const canonical = realpathSync(resolved);
      return allowAbsolute || isWithinRoots(canonical, [root]) ? [canonical] : [];
    } catch {
      return [];
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
    entries = readdirSync(base, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
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
  return results.sort();
}

// ---------------------------------------------------------------------------
// Collect all configured roots (for path-traversal guard)
// ---------------------------------------------------------------------------

function collectConfigRoots(context) {
  const root = workspaceRoot(context);
  const cfg = loadConfig(context);
  const roots = new Set();

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
    const rel = relative(nr, normalized);
    if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
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
  const queue = [{ directory: searchPath, depth: 0 }];
  const visited = new Set();
  let scanned = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    let canonical;
    try {
      canonical = realpathSync(current.directory);
    } catch {
      continue;
    }
    if (visited.has(canonical)) continue;
    visited.add(canonical);

    scanned++;
    if (scanned > MAX_DISCOVERY_DIRECTORIES) break;

    const skillMd = join(canonical, "SKILL.md");
    if (existsSync(skillMd)) results.push(canonical);
    if (current.depth >= MAX_DISCOVERY_DEPTH) continue;

    let entries;
    try {
      entries = readdirSync(canonical, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      queue.push({
        directory: join(canonical, entry.name),
        depth: current.depth + 1,
      });
    }
  }
  return results.sort();
}

// ---------------------------------------------------------------------------
// YAML frontmatter parser
// ---------------------------------------------------------------------------

function readPrefix(path, sizeLimit) {
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(sizeLimit);
    const bytesRead = readSync(fd, buffer, 0, sizeLimit, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

function parseSkillMeta(skillMdPath, sizeLimit = FRONTMATTER_READ_LIMIT) {
  try {
    const content = readPrefix(skillMdPath, sizeLimit);
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return { description: "" };
    const parsed = parseYaml(match[1], { maxAliasCount: 0 });
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return { description: "", _error: "Frontmatter must be a YAML object" };
    }
    return {
      name: typeof parsed.name === "string" ? parsed.name : undefined,
      description:
        typeof parsed.description === "string" ? parsed.description : "",
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((tag) => typeof tag === "string")
        : [],
    };
  } catch (error) {
    return { description: "", _error: error.message };
  }
}

// ---------------------------------------------------------------------------
// Source classification
// ---------------------------------------------------------------------------

function classifySource(pattern, searchPath) {
  if (
    !isAbsolute(pattern) &&
    !pattern.startsWith("~/") &&
    !pattern.includes("vendor/") &&
    !pattern.includes("harness/")
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
  const state = workspaceState(context);
  const root = state.root;
  const cfg = loadConfig(context);
  const logs = [];

  if (debug) {
    logs.push("--- Discovery Start ---");
    logs.push(`config: ${state.configPath || "(defaults)"}`);
    logs.push(`searchPaths: ${JSON.stringify(cfg.searchPaths)}`);
  }

  const allSkills = new Map();
  const duplicateNames = new Map(); // name -> array of { source, path }
  const seenSkillPaths = new Set();
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
        let canonicalSkillDir;
        let skillMd;
        try {
          canonicalSkillDir = realpathSync(skillDir);
          skillMd = realpathSync(join(canonicalSkillDir, "SKILL.md"));
          if (
            seenSkillPaths.has(skillMd) ||
            !isWithinRoots(skillMd, [searchPath]) ||
            !statSync(skillMd).isFile()
          ) {
            continue;
          }
        } catch {
          continue;
        }
        seenSkillPaths.add(skillMd);
        totalFound++;
        const meta = parseSkillMeta(skillMd);
        if (meta._error) {
          if (debug) logs.push(`    SKIP: ${skillMd}: ${meta._error}`);
          continue;
        }
        const folderName = basename(canonicalSkillDir);
        const name =
          typeof meta.name === "string" && SKILL_NAME_RE.test(meta.name)
            ? meta.name
            : folderName;
        const { source, priority, team } = classifySource(pattern, searchPath);

        const entry = {
          name,
          description: meta.description || "",
          tags: Array.isArray(meta.tags) ? meta.tags : [],
          path: canonicalSkillDir,
          skillMd,
          source,
          team: team || null,
          priority,
        };

        // Track all occurrences for duplicate reporting
        if (!duplicateNames.has(name)) duplicateNames.set(name, []);
        duplicateNames
          .get(name)
          .push({ source, path: canonicalSkillDir, priority });

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
            logs.push(`    FOUND: "${name}" [${source}] ${canonicalSkillDir}`);
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
  const state = workspaceState(context);
  const cfg = loadConfig(context);
  const ttl = cfg.cacheTTL * 1000;
  const now = Date.now();

  if (ttl > 0 && state.cache && now - state.cacheTimestamp < ttl) {
    // Return a copy so caller can't mutate the cached logs
    const result = { ...state.cache };
    if (debug) {
      result.logs = [...(state.cache.logs || []), "(using cached results)"];
    }
    return result;
  }

  const result = discoverSkills(context, debug);
  if (ttl > 0) {
    state.cache = result;
    state.cacheTimestamp = now;
  }
  // Return a fresh copy so caller sees the correct logs
  return { ...result, logs: debug ? [...(result.logs || [])] : result.logs };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSkillEntry(s, includePath = false) {
  const entry = {
    name: s.name,
    description: s.description,
    tags: s.tags,
    source: s.source,
    team: s.team,
  };
  if (includePath) entry.path = s.path;
  return entry;
}

function resolveSkill(args, skills, context) {
  if (args.path) {
    const cwd = workspaceRoot(context);
    let resolved;
    let skillMd;
    try {
      resolved = realpathSync(resolve(cwd, args.path));
      skillMd = realpathSync(join(resolved, "SKILL.md"));
    } catch (error) {
      return { error: `Cannot resolve skill path "${args.path}": ${error.message}` };
    }

    const roots = collectConfigRoots(context);
    if (!isWithinRoots(resolved, roots) || !isWithinRoots(skillMd, roots)) {
      return {
        error: `Path "${args.path}" resolves outside configured skill roots: ${resolved}`,
      };
    }

    if (!statSync(skillMd).isFile()) {
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
        limit: schema.number().int().positive().max(200).default(100),
        offset: schema.number().int().min(0).default(0),
        include_paths: schema
          .boolean()
          .default(false)
          .describe("Include absolute skill paths in results."),
      },
      async execute(args, context) {
        const debug = shouldDebug(args, context);
        const { skills, logs } = getCachedSkills(context, debug);
        const limit = args.limit ?? 100;
        const offset = args.offset ?? 0;
        const all = Array.from(skills.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        const result = all
          .slice(offset, offset + limit)
          .map((skill) => formatSkillEntry(skill, args.include_paths ?? false));

        const output = {
          skills: result,
          count: result.length,
          total: all.length,
          offset,
          has_more: offset + result.length < all.length,
        };
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
        limit: schema.number().int().positive().max(200).default(50),
        offset: schema.number().int().min(0).default(0),
        include_paths: schema.boolean().default(false),
      },
      async execute(args, context) {
        const debug = shouldDebug(args, context);
        const { skills, logs } = getCachedSkills(context, debug);
        const limit = args.limit ?? 50;
        const offset = args.offset ?? 0;
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

        results.sort((a, b) => a.name.localeCompare(b.name));
        const total = results.length;
        const page = results
          .slice(offset, offset + limit)
          .map((skill) => formatSkillEntry(skill, args.include_paths ?? false));
        const output = {
          skills: page,
          count: page.length,
          total,
          offset,
          has_more: offset + page.length < total,
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
        const state = workspaceState(context);
        state.cache = null;
        state.cacheTimestamp = 0;
        state.config = null;
        state.configSignature = null;
        const debug = shouldDebug(args, context);
        const { skills, logs } = getCachedSkills(context, debug);

        const names = Array.from(skills.values())
          .map((s) => s.name)
          .sort();

        const output = {
          refreshed: true,
          count: skills.size,
          skills: names.slice(0, 100),
          truncated: names.length > 100,
        };
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
        const state = workspaceState(context);
        const root = state.root;
        const cfg = loadConfig(context);
        const issues = [];
        const warnings = [];
        const info = [];
        let ok = 0;
        let fail = 0;

        info.push(`project root: ${root}`);
        info.push(`config file: ${state.configPath || "(using defaults)"}`);

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
            let skillDirs;
            try {
              skillDirs = findSkillDirs(searchPath);
            } catch (e) {
              issues.push({
                severity: "error",
                path: searchPath,
                message: `Cannot read directory: ${e.message}`,
              });
              fail++;
              continue;
            }

            for (const skillDir of skillDirs) {
              let skillMd;

              try {
                skillMd = realpathSync(join(skillDir, "SKILL.md"));
                if (!isWithinRoots(skillMd, [searchPath]) || !statSync(skillMd).isFile()) {
                  throw new Error("SKILL.md resolves outside its configured root");
                }
                const meta = parseSkillMeta(skillMd);
                if (meta._error) throw new Error(meta._error);

                if (!meta.name) {
                  warnings.push({
                    path: skillDir,
                    message: `SKILL.md missing "name" in frontmatter, using directory name "${basename(skillDir)}"`,
                  });
                }

                if (meta.name && !SKILL_NAME_RE.test(meta.name)) {
                  issues.push({
                    severity: "error",
                    path: skillDir,
                    message: `Invalid skill name "${meta.name}"`,
                  });
                  fail++;
                  continue;
                }

                if (meta.name && meta.name !== basename(skillDir)) {
                  issues.push({
                    severity: "error",
                    path: skillDir,
                    message: `Skill name "${meta.name}" does not match folder "${basename(skillDir)}"`,
                  });
                  fail++;
                  continue;
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
