import { spawn } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const ERROR_DETAIL_BYTES = 4096;

function isWithinPath(target, root) {
  const rel = relative(root, target);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  );
}

function boundedText(chunks, maxBytes = ERROR_DETAIL_BYTES) {
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (Buffer.byteLength(text) <= maxBytes) return text;
  return `${Buffer.from(text).subarray(0, maxBytes).toString("utf8")}\n...[truncated]`;
}

function stopProcessTree(child, signal) {
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

export function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

export function pushOption(args, name, value) {
  if (hasValue(value)) args.push(name, String(value));
}

export function pushFlag(args, name, enabled) {
  if (enabled === true) args.push(name);
}

export function validateJsonObject(value, name, maxBytes = 65_536) {
  if (!hasValue(value)) return undefined;
  if (Buffer.byteLength(value, "utf8") > maxBytes) {
    throw new Error(`${name} exceeds the ${maxBytes}-byte limit`);
  }

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`${name} must be valid JSON: ${error.message}`);
  }
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${name} must be a JSON object`);
  }
  return parsed;
}

export function assertHttpUrl(value, name = "url") {
  let url;
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

export function requireExactlyOne(args, names) {
  const supplied = names.filter((name) => hasValue(args[name]));
  if (supplied.length !== 1) {
    throw new Error(`Provide exactly one of: ${names.map((name) => `\`${name}\``).join(", ")}`);
  }
  return supplied[0];
}

export async function resolveReadableFile(inputPath, context) {
  const directory = context?.directory ?? context?.worktree ?? process.cwd();
  const requested = resolve(directory, inputPath);

  let target;
  try {
    target = await realpath(requested);
  } catch (error) {
    throw new Error(`Cannot resolve file ${requested}: ${error.message}`);
  }

  const info = await stat(target);
  if (!info.isFile()) throw new Error(`Expected a regular file: ${target}`);

  const roots = [];
  for (const root of [context?.directory, context?.worktree].filter(Boolean)) {
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
}) {
  const directory = context?.directory ?? context?.worktree ?? process.cwd();

  return new Promise((resolveResult, rejectResult) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: directory,
        env: process.env,
        detached: process.platform !== "win32",
        stdio: [stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      });
    } catch (error) {
      rejectResult(error);
      return;
    }

    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let terminationReason = null;
    let stdinError = null;
    let settled = false;
    let forceTimer = null;

    const cleanup = () => {
      clearTimeout(timeout);
      if (forceTimer) clearTimeout(forceTimer);
      context?.abort?.removeEventListener("abort", onAbort);
    };

    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectResult(error);
    };

    const terminate = (reason) => {
      if (terminationReason || settled) return;
      terminationReason = reason;
      stopProcessTree(child, "SIGTERM");
      forceTimer = setTimeout(() => stopProcessTree(child, "SIGKILL"), 1000);
      forceTimer.unref?.();
    };

    const collect = (bucket) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        terminate(`exceeded the ${maxOutputBytes}-byte output limit`);
        return;
      }
      bucket.push(chunk);
    };

    const onAbort = () => terminate("was cancelled");
    if (context?.abort?.aborted) onAbort();
    else context?.abort?.addEventListener("abort", onAbort, { once: true });

    const timeout = setTimeout(() => terminate(`timed out after ${timeoutMs} ms`), timeoutMs);
    timeout.unref?.();

    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        rejectOnce(new Error(installHint || `${command} was not found on PATH`));
        return;
      }
      rejectOnce(error);
    });
    child.on("close", (exitCode, signal) => {
      if (settled) return;
      cleanup();

      const stdoutText = boundedText(stdout, maxOutputBytes);
      const stderrText = boundedText(stderr, Math.min(maxOutputBytes, ERROR_DETAIL_BYTES));

      if (terminationReason) {
        rejectOnce(new Error(`${title} ${terminationReason}`));
        return;
      }
      if (stdinError) {
        rejectOnce(new Error(`${title} could not write stdin: ${stdinError.message}`));
        return;
      }
      if (exitCode !== 0) {
        const detail = stderrText || stdoutText || `terminated by ${signal || "unknown signal"}`;
        rejectOnce(new Error(`${title} failed with exit code ${exitCode}: ${detail}`));
        return;
      }

      settled = true;
      const metadata = {
        command,
        subcommand: args[0] ?? null,
        exitCode,
        signal,
        outputBytes,
      };
      if (stderrText) metadata.stderr = stderrText;
      resolveResult({ title, output: stdoutText, metadata });
    });

    if (stdin !== undefined) {
      child.stdin.on("error", (error) => {
        stdinError = error;
      });
      child.stdin.end(stdin);
    }
  });
}
