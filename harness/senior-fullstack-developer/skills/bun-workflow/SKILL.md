---
name: bun-workflow
description: "Bun-first JavaScript/TypeScript workflow: bun install, bun add, bun remove, bun run, bun test, bunx, bun build, Bun runtime APIs. Use for package management, script execution, testing, and Bun-native features."
compatibility: opencode
metadata:
  domain: bun
  audience: senior-engineer
---

# Bun Workflow

Comprehensive guide for Bun-first JavaScript/TypeScript development. Prefer Bun for all package management, script execution, testing, and runtime operations.

## When to apply

- Installing, adding, removing, or updating dependencies.
- Running scripts defined in `package.json`.
- Running tests.
- Running one-off tools (equivalent to `npx`).
- Working with Bun runtime APIs.
- Building or bundling with Bun.

## Core rules

### Package management

```bash
# Install dependencies
bun install

# Add a dependency
bun add zod

# Add a dev dependency
bun add -d typescript @types/node

# Remove a dependency
bun remove zod

# Update dependencies
bun update
```

Never use `npm install`, `npm add`, or `npm remove` unless the project explicitly requires npm.

### Script execution

```bash
# Run a script from package.json
bun run dev
bun run build
bun run lint
bun run typecheck
```

### Testing

```bash
# Run tests
bun test
bun test --watch
bun test --coverage
```

### One-off tools

```bash
# Equivalent to npx
bunx create-react-app my-app
bunx tsc --noEmit
bunx eslint .
bunx prettier --check .
```

### Bun runtime

```bash
# Run a TypeScript file directly (no transpilation needed)
bun run index.ts

# Run a script
bun script.ts
```

## Bun-native APIs

Use Bun-native APIs when running on Bun for better performance:

| Instead of | Use |
|---|---|
| `fs.readFile` | `Bun.file(path).text()` |
| `fs.writeFile` | `Bun.write(path, content)` |
| `node-fetch` | `fetch()` (built-in) |
| `bcrypt` / `argon2` | `Bun.password.hash()` / `Bun.password.verify()` |
| `better-sqlite3` | `Bun.sql` (built-in SQLite) |
| `dotenv` | Bun auto-loads `.env` |
| `node:path` | `Bun.path` (extended path utilities) |
| `rimraf` | `Bun.rm(path, { recursive: true })` |

## Lockfile

- Prefer `bun.lock` / `bun.lockb` as source of truth.
- Do not create or modify `package-lock.json` or `npm-shrinkwrap.json`.
- If both lockfiles exist, prefer `bun.lockb`.

## When to fall back

Only use npm/npx when:
1. The project already has npm-only tooling and no Bun-compatible path.
2. The command fails under Bun due to a compatibility issue.
3. Official documentation for the task requires npm/npx.
4. The user explicitly asks to use npm/npx.

When falling back, explain why briefly.

## Common workflows

### Starting a new project

```bash
bun init                  # creates package.json, tsconfig.json
bun add zod               # runtime dependency
bun add -d typescript @types/node  # dev dependencies
bun run index.ts          # run directly
```

### Adding to an existing npm project

```bash
bun install               # reads package.json, creates bun.lockb
bun add express           # adds to both package.json and bun.lockb
```

### CI/CD

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test --coverage
bun run build
```

## Reference materials

- `references/bun-common-commands.md` — comprehensive command reference.
- `references/bun-vs-node-migration.md` — migration guide from Node.js to Bun.
