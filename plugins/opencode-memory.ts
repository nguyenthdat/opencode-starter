import { createNativeMemoryPlugin } from "@opencode-config/native-memory";
import { resolve } from "node:path";

export default createNativeMemoryPlugin({
  root: resolve(import.meta.dir, ".."),
});
