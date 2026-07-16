import { spawn } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const ERROR_DETAIL_BYTES = 4096;

export interface ExternalDirectoryRequest {
  permission: string;
  patterns: string[];
  always: string[];
  metadata: Record<string, unknown>;
}

export interface CliContext {
  directory?: string;
  worktree?: string;
  abort?: AbortSignal;
  ask?: (request: ExternalDirectoryRequest) => Promise<void>;
}

export interface CliResult {
  title: string;
  output: string;
  metadata: {
    command: string;
    subcommand: string | null;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    outputBytes: number;
    stderr?: string;
  };
}

export interface RunCliOptions {
  command: string;
  args: string[];
  context?: CliContext;
  stdin?: string | Uint8Array;
  timeoutMs?: number;
  maxOutputBytes?: number;
  installHint?: string;
  title?: string;
}

function isWithinPath(target: string, root: string): boolean {
  const rel = relative(root, target);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  );
}

function boundedText(
  chunks: Buffer[],
  maxBytes = ERROR_DETAIL_BYTES,
  trim = false,
): string {
  const buffer = Buffer.concat(chunks);
  const truncated = buffer.byteLength > maxBytes;
  let text = buffer.subarray(0, maxBytes).toString("utf8");
  if (truncated) text += "\n...[truncated]";
  return trim ? text.trim() : text;
}

function stopProcessTree(
  child: ReturnType<typeof spawn>,
  signal: NodeJS.Signals,
): void {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to killing the direct child.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // Process already exited.
  }
}

export function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

export function pushOption(
  args: string[],
  name: string,
  value: unknown,
): void {
  if (hasValue(value)) args.push(name, String(value));
}

export function pushFlag(
  args: string[],
  name: string,
  enabled: unknown,
): void {
  if (enabled === true) args.push(name);
}

export function validateJsonObject(
  value: string | undefined,
  name: string,
  maxBytes = 65_536,
): Record<string, unknown> | undefined {
  if (!hasValue(value)) return undefined;
  if (Buffer.byteLength(value!, "utf8") > maxBytes) {
    throw new Error(`${name} exceeds the ${maxBytes}-byte limit`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value!);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${name} must be valid JSON: ${detail}`);
  }
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${name} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

export function assertHttpUrl(value: string, name = "url"): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must use http:// or https://`);
  }
  return url.toString();
}

export function requireExactlyOne(
  args: Record<string, unknown>,
  names: readonly string[],
): string {
  const supplied = names.filter((name) => hasValue(args[name]));
  if (supplied.length !== 1) {
    throw new Error(
      `Provide exactly one of: ${names.map((name) => `\`${name}\``).join(", ")}`,
    );
  }
  return supplied[0]!;
}

export async function resolveReadableFile(
  inputPath: string,
  context?: CliContext,
): Promise<string> {
  const directory = context?.directory ?? context?.worktree ?? process.cwd();
  const requested = resolve(directory, inputPath);

  let target: string;
  try {
    target = await realpath(requested);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot resolve file ${requested}: ${detail}`);
  }

  const info = await stat(target);
  if (!info.isFile()) throw new Error(`Expected a regular file: ${target}`);

  const roots: string[] = [];
  for (const root of [context?.directory, context?.worktree]) {
    if (!root) continue;
    try {
      roots.push(await realpath(root));
    } catch {
      roots.push(resolve(root));
    }
  }

  if (!roots.some((root) => isWithinPath(target, root))) {
    if (typeof context?.ask !== "function") {
      throw new Error(`External file access requires approval: ${target}`);
    }
    await context.ask({
      permission: "external_directory",
      patterns: [target],
      always: [target],
      metadata: { path: target, operation: "read" },
    });
  }

  return target;
}

export function runCli({
  command,
  args,
  context,
  stdin,
  timeoutMs = 300_000,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  installHint,
  title = `${command} ${args[0] ?? ""}`.trim(),
}: RunCliOptions): Promise<CliResult> {
  const directory = context?.directory ?? context?.worktree ?? process.cwd();

  return new Promise((resolveResult, rejectResult) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, {
        cwd: directory,
        env: process.env,
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      rejectResult(error);
      return;
    }

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let terminationReason: string | undefined;
    let stdinError: Error | undefined;
    let settled = false;
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const cleanup = (): void => {
      if (timeout) clearTimeout(timeout);
      if (forceTimer) clearTimeout(forceTimer);
      context?.abort?.removeEventListener("abort", onAbort);
    };

    const rejectOnce = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectResult(error);
    };

    const terminate = (reason: string): void => {
      if (terminationReason || settled) return;
      terminationReason = reason;
      stopProcessTree(child, "SIGTERM");
      forceTimer = setTimeout(() => stopProcessTree(child, "SIGKILL"), 1000);
      forceTimer.unref?.();
    };

    const collect = (bucket: Buffer[]) => (chunk: Buffer): void => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        terminate(`exceeded the ${maxOutputBytes}-byte output limit`);
        return;
      }
      bucket.push(chunk);
    };

    const onAbort = (): void => terminate("was cancelled");
    if (context?.abort?.aborted) onAbort();
    else context?.abort?.addEventListener("abort", onAbort, { once: true });

    timeout = setTimeout(
      () => terminate(`timed out after ${timeoutMs} ms`),
      timeoutMs,
    );
    timeout.unref?.();

    child.stdout?.on("data", collect(stdout));
    child.stderr?.on("data", collect(stderr));
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        rejectOnce(new Error(installHint || `${command} was not found on PATH`));
        return;
      }
      rejectOnce(error);
    });
    child.on("close", (exitCode, signal) => {
      if (settled) return;

      const stdoutText = boundedText(stdout, maxOutputBytes);
      const stderrText = boundedText(
        stderr,
        Math.min(maxOutputBytes, ERROR_DETAIL_BYTES),
        true,
      );

      if (terminationReason) {
        rejectOnce(new Error(`${title} ${terminationReason}`));
        return;
      }
      if (stdinError) {
        rejectOnce(
          new Error(`${title} could not write stdin: ${stdinError.message}`),
        );
        return;
      }
      if (exitCode !== 0) {
        const detail =
          stderrText ||
          stdoutText.trim() ||
          `terminated by ${signal || "unknown signal"}`;
        rejectOnce(
          new Error(`${title} failed with exit code ${exitCode}: ${detail}`),
        );
        return;
      }

      settled = true;
      cleanup();
      const metadata: CliResult["metadata"] = {
        command,
        subcommand: args[0] ?? null,
        exitCode,
        signal,
        outputBytes,
      };
      if (stderrText) metadata.stderr = stderrText;
      resolveResult({ title, output: stdoutText, metadata });
    });

    child.stdin?.on("error", (error: Error) => {
      stdinError = error;
    });
    child.stdin?.end(stdin);
  });
}
