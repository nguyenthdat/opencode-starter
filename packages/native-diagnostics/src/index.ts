import { type Plugin, tool } from "@opencode-ai/plugin";
import { dlopen, FFIType, suffix } from "bun:ffi";
import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_ABI_VERSION = 1;
const symbols = {
  opencode_native_abi_version: {
    args: [],
    returns: FFIType.u32,
  },
  opencode_native_fnv1a64: {
    args: [FFIType.ptr, "usize"],
    returns: FFIType.u64,
  },
} as const;

type NativeLibrary = ReturnType<typeof openLibrary>;

export interface NativeDiagnosticsOptions {
  root: string;
}

function libraryFilename(): string {
  const prefix = process.platform === "win32" ? "" : "lib";
  return `${prefix}opencode_native_diagnostics.${suffix}`;
}

export function resolveNativeLibrary(root: string): string {
  const override = process.env.OPENCODE_NATIVE_DIAGNOSTICS_LIB;
  const candidates = override
    ? [resolve(override)]
    : [
        resolve(root, "target", "debug", libraryFilename()),
        resolve(root, "target", "release", libraryFilename()),
      ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return realpathSync(candidate);
  }

  throw new Error(
    `Native diagnostics library was not found. Run \`bun run native:build\`. Checked: ${candidates.join(", ")}`,
  );
}

function openLibrary(path: string) {
  return dlopen(path, symbols);
}

export function createNativeDiagnosticsPlugin(
  options: NativeDiagnosticsOptions,
): Plugin {
  let library: NativeLibrary | undefined;
  let libraryPath: string | undefined;

  const getLibrary = (): NativeLibrary => {
    if (library) return library;
    libraryPath = resolveNativeLibrary(options.root);
    library = openLibrary(libraryPath);
    return library;
  };

  return async () => ({
    dispose: async () => {
      library?.close();
      library = undefined;
      libraryPath = undefined;
    },
    tool: {
      native_diagnostics: tool({
        description:
          "Verify the Bun-to-Rust FFI bridge and compute a native checksum for a bounded text payload.",
        args: {
          payload: tool.schema
            .string()
            .max(1_048_576)
            .default("opencode")
            .describe("UTF-8 text to checksum, up to 1 MiB."),
        },
        async execute(args) {
          const native = getLibrary();
          const abiVersion = native.symbols.opencode_native_abi_version();
          if (abiVersion !== EXPECTED_ABI_VERSION) {
            throw new Error(
              `Native diagnostics ABI mismatch: expected ${EXPECTED_ABI_VERSION}, received ${abiVersion}`,
            );
          }

          const encoded = new TextEncoder().encode(args.payload);
          const allocation =
            encoded.byteLength === 0 ? new Uint8Array(1) : encoded;
          const checksum = native.symbols.opencode_native_fnv1a64(
            allocation,
            encoded.byteLength,
          );
          const checksumHex = `0x${checksum.toString(16).padStart(16, "0")}`;

          return {
            title: "Native FFI diagnostics",
            output: JSON.stringify(
              {
                ok: true,
                abiVersion,
                checksum: checksumHex,
                inputBytes: encoded.byteLength,
                platform: process.platform,
                architecture: process.arch,
                library: libraryPath,
              },
              null,
              2,
            ),
            metadata: {
              abiVersion,
              checksum: checksumHex,
              inputBytes: encoded.byteLength,
            },
          };
        },
      }),
    },
  });
}
