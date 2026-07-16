import type { Config, Plugin } from "@opencode-ai/plugin";
import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";

const COMPONENT_KINDS = ["agents", "skills", "mcps", "instructions"] as const;
const WILDCARD_RE = /[*?\[\]{}]/;

type ComponentKind = (typeof COMPONENT_KINDS)[number];
type PermissionAction = "allow" | "ask" | "deny";
type PermissionRules = Record<string, PermissionAction>;
type PermissionMap = Record<string, PermissionAction | PermissionRules>;

interface TeamComponent {
  id: string;
  enabled: boolean;
  required: boolean;
  model?: string;
}

interface TeamManifest {
  version: 1;
  id: string;
  enabled: boolean;
  description?: string;
  entryAgent: string;
  workspaceRoot: string;
  components: Record<ComponentKind, TeamComponent[]>;
}

interface LoadedManifest {
  file: string;
  manifest: TeamManifest;
}

interface EffectiveComponent extends TeamComponent {
  team: string;
  effectiveEnabled: boolean;
}

interface HarnessPlan {
  agents: EffectiveComponent[];
  skills: EffectiveComponent[];
  mcps: EffectiveComponent[];
  instructions: EffectiveComponent[];
  warnings: string[];
}

interface RuntimeAgentConfig {
  disable?: boolean;
  model?: string;
  permission?: PermissionAction | PermissionMap;
}

interface RuntimeMcpConfig {
  enabled?: boolean;
}

interface RuntimeConfig {
  default_agent?: string;
  agent?: Record<string, RuntimeAgentConfig | undefined>;
  mcp?: Record<string, RuntimeMcpConfig | undefined>;
  instructions?: string[];
  permission?: PermissionAction | PermissionMap;
}

interface PermissionOwner {
  permission?: PermissionAction | PermissionMap;
}

type JsonObject = Record<string, unknown>;

export interface HarnessTeamsPluginOptions {
  root: string;
  teamsDirectory?: string;
  schemaPath?: string;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsoncFile(path: string, source: string): unknown {
  const errors: ParseError[] = [];
  const value = parse(source, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length === 0) return value;

  const details = errors
    .map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`)
    .join(", ");
  throw new Error(`[harness-teams] Invalid JSONC in ${path}: ${details}`);
}

function schemaReference(root: JsonObject, reference: string): JsonObject {
  if (reference === "#") return root;
  if (!reference.startsWith("#/")) {
    throw new Error(`[harness-teams] Unsupported schema reference: ${reference}`);
  }

  let current: unknown = root;
  for (const rawToken of reference.slice(2).split("/")) {
    const token = rawToken.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!isObject(current) || !(token in current)) {
      throw new Error(`[harness-teams] Unresolved schema reference: ${reference}`);
    }
    current = current[token];
  }
  if (!isObject(current)) {
    throw new Error(`[harness-teams] Schema reference is not an object: ${reference}`);
  }
  return current;
}

function valueType(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function validateSchemaValue(
  value: unknown,
  schema: JsonObject,
  root: JsonObject,
  path: string,
  errors: string[],
): void {
  if (typeof schema.$ref === "string") {
    validateSchemaValue(value, schemaReference(root, schema.$ref), root, path, errors);
    return;
  }

  if ("const" in schema && !Object.is(value, schema.const)) {
    errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
    return;
  }

  if (typeof schema.type === "string") {
    const valid =
      (schema.type === "object" && isObject(value)) ||
      (schema.type === "array" && Array.isArray(value)) ||
      (schema.type === "integer" && Number.isInteger(value)) ||
      (schema.type === "number" && typeof value === "number" && Number.isFinite(value)) ||
      (schema.type === "string" && typeof value === "string") ||
      (schema.type === "boolean" && typeof value === "boolean") ||
      (schema.type === "null" && value === null);
    if (!valid) {
      errors.push(`${path} must be ${schema.type}, got ${valueType(value)}`);
      return;
    }
  }

  if (isObject(value)) {
    const properties = isObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required)
      ? schema.required.filter((item): item is string => typeof item === "string")
      : [];

    for (const key of required) {
      if (!(key in value)) errors.push(`${path}.${key} is required`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) errors.push(`${path}.${key} is not allowed`);
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (!(key in value) || !isObject(childSchema)) continue;
      validateSchemaValue(value[key], childSchema, root, `${path}.${key}`, errors);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push(`${path} must contain at least ${schema.minItems} items`);
    }
    if (isObject(schema.items)) {
      value.forEach((item, index) =>
        validateSchemaValue(item, schema.items as JsonObject, root, `${path}[${index}]`, errors),
      );
    }
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push(`${path} must contain at least ${schema.minLength} characters`);
    }
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path} must match ${schema.pattern}`);
    }
  }
}

function validateManifest(value: unknown, schema: JsonObject, file: string): TeamManifest {
  const errors: string[] = [];
  validateSchemaValue(value, schema, schema, "$", errors);
  if (errors.length > 0) {
    throw new Error(
      `[harness-teams] ${file} does not match team.schema.json:\n- ${errors.join("\n- ")}`,
    );
  }
  return value as TeamManifest;
}

async function loadManifests(options: HarnessTeamsPluginOptions): Promise<LoadedManifest[]> {
  const root = resolve(options.root);
  const teamsDirectory = resolve(root, options.teamsDirectory ?? "harness/teams");
  let entries: Dirent[];
  try {
    entries = await readdir(teamsDirectory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonc"))
    .map((entry) => resolve(teamsDirectory, entry.name))
    .sort();
  if (files.length === 0) return [];

  const schemaPath = resolve(root, options.schemaPath ?? "harness/team.schema.json");
  const parsedSchema = parseJsoncFile(schemaPath, await readFile(schemaPath, "utf8"));
  if (!isObject(parsedSchema)) {
    throw new Error(`[harness-teams] ${schemaPath} must contain a JSON Schema object`);
  }

  const manifests: LoadedManifest[] = [];
  for (const file of files) {
    const parsed = parseJsoncFile(file, await readFile(file, "utf8"));
    const manifest = validateManifest(parsed, parsedSchema, file);
    const expectedID = basename(file, ".jsonc");
    if (manifest.id !== expectedID) {
      throw new Error(
        `[harness-teams] Team ID "${manifest.id}" must match manifest filename "${expectedID}"`,
      );
    }
    manifests.push({ file, manifest });
  }
  return manifests;
}

function buildPlan(loaded: LoadedManifest[]): HarnessPlan {
  const plan: HarnessPlan = {
    agents: [],
    skills: [],
    mcps: [],
    instructions: [],
    warnings: [],
  };
  const teamIDs = new Set<string>();
  const componentIDs: Record<ComponentKind, Set<string>> = {
    agents: new Set(),
    skills: new Set(),
    mcps: new Set(),
    instructions: new Set(),
  };

  for (const { file, manifest } of loaded) {
    if (teamIDs.has(manifest.id)) {
      throw new Error(`[harness-teams] Duplicate team ID "${manifest.id}" in ${file}`);
    }
    teamIDs.add(manifest.id);

    const entryAgent = manifest.components.agents.find(
      (component) => component.id === manifest.entryAgent,
    );
    if (!entryAgent) {
      throw new Error(
        `[harness-teams] Team "${manifest.id}" entryAgent "${manifest.entryAgent}" is not listed in components.agents`,
      );
    }
    if (!entryAgent.required) {
      throw new Error(
        `[harness-teams] Team "${manifest.id}" entryAgent "${manifest.entryAgent}" must be required`,
      );
    }

    for (const kind of COMPONENT_KINDS) {
      for (const component of manifest.components[kind]) {
        if (componentIDs[kind].has(component.id)) {
          throw new Error(
            `[harness-teams] Duplicate ${kind} component ID "${component.id}"`,
          );
        }
        componentIDs[kind].add(component.id);
        if (kind !== "agents" && component.model !== undefined) {
          throw new Error(
            `[harness-teams] Only agent components may define model; found it on ${kind} "${component.id}"`,
          );
        }

        const effectiveEnabled = manifest.enabled && component.enabled;
        plan[kind].push({
          ...component,
          team: manifest.id,
          effectiveEnabled,
        });
        if (manifest.enabled && component.required && !component.enabled) {
          plan.warnings.push(
            `Team "${manifest.id}" has required ${kind} component "${component.id}" disabled`,
          );
        }
      }
    }
  }
  return plan;
}

function normalizeInstructionPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function wildcardCanInclude(pattern: string, target: string): boolean {
  const wildcardIndex = pattern.search(WILDCARD_RE);
  if (wildcardIndex === -1) return false;
  const fixedPrefix = normalizeInstructionPath(pattern.slice(0, wildcardIndex));
  return normalizeInstructionPath(target).startsWith(fixedPrefix);
}

function preflight(config: RuntimeConfig, plan: HarnessPlan): void {
  for (const component of plan.agents) {
    if (!config.agent?.[component.id]) {
      throw new Error(
        `[harness-teams] Agent "${component.id}" from team "${component.team}" is not registered`,
      );
    }
    if (config.default_agent === component.id && !component.effectiveEnabled) {
      throw new Error(
        `[harness-teams] Cannot disable default_agent "${component.id}"; choose another default agent first`,
      );
    }
  }
  for (const component of plan.mcps) {
    if (!config.mcp?.[component.id]) {
      throw new Error(
        `[harness-teams] MCP "${component.id}" from team "${component.team}" is not registered`,
      );
    }
  }

  for (const component of plan.instructions) {
    if (component.effectiveEnabled) continue;
    const wildcard = config.instructions?.find((pattern) =>
      wildcardCanInclude(pattern, component.id),
    );
    if (wildcard) {
      throw new Error(
        `[harness-teams] Instruction wildcard "${wildcard}" can re-include disabled instruction "${component.id}"; register team instructions explicitly`,
      );
    }
  }
}

function ensurePermissionMap(owner: PermissionOwner): PermissionMap {
  const permission: PermissionMap =
    typeof owner.permission === "string" ? { "*": owner.permission } : (owner.permission ?? {});
  owner.permission = permission;
  return permission;
}

function applySkillRules(owner: PermissionOwner, components: EffectiveComponent[]): void {
  const permission = ensurePermissionMap(owner);
  const existing = permission.skill;
  const rules: PermissionRules =
    typeof existing === "string" ? { "*": existing } : { ...(existing ?? {}) };

  for (const component of components) {
    delete rules[component.id];
    rules[component.id] = component.effectiveEnabled ? "allow" : "deny";
  }
  permission.skill = rules;
}

function applyPlan(config: RuntimeConfig, plan: HarnessPlan): void {
  for (const component of plan.agents) {
    const agent = config.agent?.[component.id];
    if (!agent) continue;
    agent.disable = !component.effectiveEnabled;
    if (component.model) agent.model = component.model;
  }

  if (plan.skills.length > 0) {
    applySkillRules(config, plan.skills);
    for (const agent of Object.values(config.agent ?? {})) {
      if (agent) applySkillRules(agent, plan.skills);
    }
  }

  for (const component of plan.mcps) {
    const mcp = config.mcp?.[component.id];
    if (mcp) mcp.enabled = component.effectiveEnabled;
  }

  if (plan.instructions.length > 0) {
    const instructions = new Set(config.instructions ?? []);
    for (const component of plan.instructions) {
      if (component.effectiveEnabled) instructions.add(component.id);
      else instructions.delete(component.id);
    }
    config.instructions = [...instructions];
  }
}

function requestedSkill(args: unknown): string | undefined {
  if (!isObject(args)) return undefined;
  if (typeof args.name === "string") return args.name;
  if (typeof args.path !== "string") return undefined;

  const normalized = args.path.replace(/[\\/]+$/, "");
  const leaf = basename(normalized);
  return leaf === "SKILL.md" ? basename(dirname(normalized)) : leaf;
}

export function createHarnessTeamsPlugin(options: HarnessTeamsPluginOptions): Plugin {
  const normalizedOptions = { ...options, root: resolve(options.root) };

  return async () => {
    let disabledSkills = new Set<string>();

    return {
      async config(input: Config): Promise<void> {
        const loaded = await loadManifests(normalizedOptions);
        const plan = buildPlan(loaded);
        const config = input as unknown as RuntimeConfig;

        preflight(config, plan);
        applyPlan(config, plan);
        disabledSkills = new Set(
          plan.skills
            .filter((component) => !component.effectiveEnabled)
            .map((component) => component.id),
        );
        for (const warning of plan.warnings) {
          console.warn(`[harness-teams] ${warning}`);
        }
      },

      async "tool.execute.before"(input, output): Promise<void> {
        if (input.tool !== "skill" && input.tool !== "skills_load") return;
        const skill = requestedSkill(output.args);
        if (!skill || !disabledSkills.has(skill)) return;
        throw new Error(
          `[harness-teams] Skill "${skill}" is disabled by its team manifest. Enable it and restart OpenCode.`,
        );
      },
    };
  };
}
