import { describe, expect, it } from "bun:test";
import NativeDiagnosticsPlugin from "../plugins/native-diagnostics.ts";

describe("native diagnostics plugin", () => {
  it("loads the Rust cdylib through Bun FFI", async () => {
    const hooks = await NativeDiagnosticsPlugin({} as never);
    const diagnosticTool = hooks.tool?.native_diagnostics;
    if (!diagnosticTool) throw new Error("native_diagnostics was not registered");
    const result = await diagnosticTool.execute(
      { payload: "hello" },
      {} as never,
    );

    expect(typeof result).toBe("object");
    if (typeof result === "string") throw new Error("Expected structured result");
    const output = JSON.parse(result.output);
    expect(output.ok).toBe(true);
    expect(output.abiVersion).toBe(1);
    expect(output.checksum).toBe("0xa430d84680aabd0b");

    await hooks.dispose?.();
  });
});
