# Bun-First JavaScript/TypeScript

Use Bun unless the user or existing project requires another runtime/package manager.

- Inspect `package.json` and lockfiles first. Treat `bun.lock`/`bun.lockb` as authoritative when present.
- Prefer `bun install`, `bun add [-d]`, `bun remove`, `bun update`, `bun run <script>`, and `bunx` over npm/npx equivalents.
- Prefer `bun <file>` and `bun test` when compatible.
- Do not create or modify `package-lock.json` unless preserving an npm workflow is explicitly required.
- Fall back to npm/npx only for demonstrated incompatibility, npm-only tooling, official requirements, or an explicit user request; state the reason briefly.
