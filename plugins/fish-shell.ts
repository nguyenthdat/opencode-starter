import type { Plugin, Hooks, PluginInput } from "@opencode-ai/plugin";

const FISH_SEARCH_PATHS = [
  "/opt/homebrew/bin/fish",
  "/usr/local/bin/fish",
  "/usr/bin/fish",
  "/home/linuxbrew/.linuxbrew/bin/fish",
];

let cachedFishPath: string | null | undefined = undefined;

async function findFishPath(): Promise<string | null> {
  if (cachedFishPath !== undefined) return cachedFishPath;

  for (const path of FISH_SEARCH_PATHS) {
    const file = Bun.file(path);
    if (await file.exists()) {
      cachedFishPath = path;
      return path;
    }
  }

  const proc = Bun.spawnSync({
    cmd: ["which", "fish"],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode === 0) {
    const found = proc.stdout.toString().trim();
    if (found) {
      const statFile = Bun.file(found);
      if (await statFile.exists()) {
        cachedFishPath = found;
        return found;
      }
    }
  }

  cachedFishPath = null;
  return null;
}

function escapeForFish(command: string): string {
  return command.replace(/'/g, "'\\''");
}

function hasFishWrapper(command: string): boolean {
  return /^\s*fish\s+-/.test(command);
}

const BASH_TO_FISH_TRANSFORMS: Array<[RegExp, string]> = [
  [/^export\s+(\w+)=(.*)$/m, "set -gx $1 $2"],
  [/^(\w+)=(\S+)\s+(\S.*)$/m, "env $1=$2 $3"],
  [/^unset\s+(\w+)$/m, "set -e $1"],
  [/^local\s+(\w+)=(.*)$/m, "set -l $1 $2"],
  [/^function\s+(\w+)\s*\{/m, "function $1"],
  [/\}\s*$/, "end"],
];

function applyFishTransforms(command: string): string {
  let result = command;
  for (const [pattern, replacement] of BASH_TO_FISH_TRANSFORMS) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
    }
  }
  return result;
}

function buildFishToolDescription(fishPath: string): string {
  return `Executes a given command in a persistent shell session running Fish shell, with optional timeout, ensuring proper handling and security measures.

IMPORTANT: This tool uses Fish shell (${fishPath}) to execute commands. Use Fish shell syntax:

Fish Syntax Quick Reference:
- Set environment: set -gx NAME value (NOT export NAME=value)
- Local variable: set -l name value
- Inline env: env VAR=value command (NOT VAR=value command)
- Command chaining: cmd1; and cmd2 (or cmd1 && cmd2 is also accepted)
- Conditional OR: cmd1; or cmd2 (or cmd1 || cmd2 is also accepted)
- Command substitution: (command) instead of $(command)
- Loop: for item in list; command; end
- Multi-line: begin; cmd1; cmd2; end
- Source: source (preferred) or . (both work)

Quoting Rules:
- Single quotes for literal strings (no variable expansion)
- Double quotes for strings with \$variable or (command) expansion
- Escape single quotes inside single-quoted strings with \\'

File paths with spaces: quote with single quotes, e.g., /path/to/'My Documents'/file

Be aware: OS: ${process.platform}, Shell: ${fishPath}

All commands run in the current working directory by default. Use the workdir parameter if you need to run a command in a different directory. AVOID using cd patterns — use workdir instead.`;
}

const fishShellPlugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  const fishPath = await findFishPath();

  if (!fishPath) {
    console.warn(
      "[fish-shell-plugin] Fish shell not found on this system. " +
        "Install fish (brew install fish / apt install fish) or the bash tool will continue using the default shell.",
    );
    return {};
  }

  console.log(`[fish-shell-plugin] Fish shell found at: ${fishPath}`);

  const description = buildFishToolDescription(fishPath);

  return {
    "shell.env": async (_input, output) => {
      output.env.SHELL = fishPath;
      output.env.OP_ENV_SHELL_FISH = "1";
    },

    "tool.definition": async (input, output) => {
      if (input.toolID === "bash") {
        output.description = description;
      }
    },

    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return;

      const command = output.args?.command;
      if (!command || typeof command !== "string") return;

      const trimmed = command.trim();
      if (!trimmed || hasFishWrapper(trimmed)) return;

      const transformed = applyFishTransforms(trimmed);
      const escaped = escapeForFish(transformed);
      output.args.command = `fish -lc '${escaped}'`;
    },
  };
};

export default fishShellPlugin;
