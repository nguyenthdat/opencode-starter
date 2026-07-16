import { createNativeDiagnosticsPlugin } from "@opencode-config/native-diagnostics";
import { resolve } from "node:path";

export default createNativeDiagnosticsPlugin({
  root: resolve(import.meta.dir, ".."),
});
