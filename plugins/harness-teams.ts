import { createHarnessTeamsPlugin } from "@opencode-config/harness-teams";
import { resolve } from "node:path";

export default createHarnessTeamsPlugin({
  root: resolve(import.meta.dir, ".."),
});
