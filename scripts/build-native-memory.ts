import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const release = process.argv.includes("--release");
const profile = release ? "release" : "debug";
const cargoArgs = ["build", "-p", "opencode-native-memory"];
if (release) cargoArgs.push("--release");

const build = Bun.spawn({
  cmd: ["cargo", ...cargoArgs],
  cwd: root,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
const exitCode = await build.exited;
if (exitCode !== 0) process.exit(exitCode);

const libraryName =
  process.platform === "darwin"
    ? "libzvec_c_api.dylib"
    : process.platform === "win32"
      ? "zvec_c_api.dll"
      : "libzvec_c_api.so";
const buildRoot = join(root, "target", profile, "build");
const sources = readdirSync(buildRoot)
  .filter((entry) => entry.startsWith("zvec-rust-sys-"))
  .map((entry) =>
    join(buildRoot, entry, "out", "zvec-prebuilt", libraryName),
  )
  .filter(existsSync)
  .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
const source = sources[0];
if (!source) {
  throw new Error(
    `Cannot find ${libraryName} under ${buildRoot}; zvec-rust-sys did not produce a bundled runtime`,
  );
}

const binary = join(
  root,
  "target",
  profile,
  process.platform === "win32"
    ? "opencode-native-memory.exe"
    : "opencode-native-memory",
);
if (!existsSync(binary)) {
  throw new Error(`Native memory binary was not produced: ${binary}`);
}
const destinationDirectory =
  process.platform === "win32"
    ? dirname(binary)
    : join(dirname(binary), "native-memory-libs");
mkdirSync(destinationDirectory, { recursive: true });
const destination = join(destinationDirectory, basename(source));
copyFileSync(source, destination);
console.log(`Packaged zvec runtime: ${destination}`);
