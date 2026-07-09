# Bun-first JavaScript/TypeScript Rule

Always prefer Bun for JavaScript/TypeScript workflows.

## Package manager priority

Use:

- `bun install` instead of `npm install`
- `bun add <pkg>` instead of `npm install <pkg>`
- `bun add -d <pkg>` instead of `npm install -D <pkg>`
- `bun remove <pkg>` instead of `npm uninstall <pkg>`
- `bun update` instead of `npm update`
- `bun run <script>` instead of `npm run <script>`
- `bunx <tool>` instead of `npx <tool>`

## Runtime priority

Use:

- `bun <file>` instead of `node <file>` when compatible
- `bun test` instead of `npm test` or third-party runners when the project supports it
- `bun run dev`, `bun run build`, `bun run lint`, `bun run typecheck` for scripts defined in `package.json`

## Lockfile and dependency rules

Prefer `bun.lock` / `bun.lockb` as the source of truth.

Do not create or modify:

- `package-lock.json`
- `npm-shrinkwrap.json`

Unless the existing project explicitly relies on npm and migration is out of scope.

## When npm/npx is allowed

Only use `npm` or `npx` when one of these is true:

1. The project already has npm-only tooling and no Bun-compatible path.
2. The command fails under Bun because of a real compatibility issue.
3. Official documentation for the task requires npm/npx and there is no equivalent Bun command.
4. The user explicitly asks to use npm/npx.

When falling back to npm/npx, explain the reason briefly.

## Before running commands

Check the project context first:

- If `bun.lock` or `bun.lockb` exists, use Bun.
- If only `package-lock.json` exists, still prefer Bun unless the task is specifically about preserving npm behavior.
- If both lockfiles exist, prefer Bun and avoid touching `package-lock.json`.

## Command examples

Prefer:

```bash
bun install
bun add zod
bun add -d typescript @types/node
bun run build
bun run test
bunx shadcn@latest init
bunx tsc --noEmit
