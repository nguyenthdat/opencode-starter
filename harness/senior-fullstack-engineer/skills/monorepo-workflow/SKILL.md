---
name: monorepo-workflow
description: "Monorepo workflow: Turborepo, npm/yarn/pnpm/bun workspaces, shared configs (tsconfig, eslint, prettier), internal packages, versioning (changesets), CI/CD for monorepos. Use for monorepo management."
compatibility: opencode
metadata:
  domain: monorepo
  audience: senior-engineer
---

# Monorepo Workflow

Guide for managing JavaScript/TypeScript monorepos with workspaces and build orchestration.

## When to apply

- Setting up a new monorepo or converting a multi-repo setup.
- Configuring Turborepo for build orchestration.
- Managing internal package dependencies and versioning.
- Sharing TypeScript config, ESLint config, and formatting rules.
- Optimizing CI/CD for monorepo builds.

## Core principles

### 1. Workspace configuration

```json
// package.json (root)
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "tooling/*"
  ]
}
```

```
my-monorepo/
├── apps/
│   ├── web/           # Next.js app
│   └── api/           # Hono backend
├── packages/
│   ├── ui/            # Shared UI components
│   ├── utils/         # Shared utilities
│   └── config/        # Shared config (eslint, tsconfig)
├── tooling/
│   ├── eslint/        # Shared ESLint config package
│   └── typescript/    # Shared tsconfig base
├── package.json       # Root workspace config
├── turbo.json         # Turborepo config
└── bun.lockb
```

### 2. Turborepo

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["build"] }
  }
}
```

```json
// package.json scripts
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test"
  }
}
```

### 3. Shared TypeScript config

```json
// tooling/typescript/base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}

// tooling/typescript/react.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

```json
// apps/web/tsconfig.json
{
  "extends": "@repo/typescript/react.json",
  "compilerOptions": { "paths": { "@/*": ["./src/*"] } },
  "include": ["src", "*.ts", "*.tsx"]
}
```

### 4. Internal package references

```json
// apps/web/package.json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/utils": "workspace:*"
  }
}
```

```typescript
// apps/web/src/page.tsx
import { Button } from '@repo/ui';
import { formatDate } from '@repo/utils';
```

### 5. Versioning with Changesets

```bash
bun add -d @changesets/cli
bunx changeset init
```

```bash
# Create a changeset (documents what changed)
bunx changeset

# Version packages (bumps versions based on changesets)
bunx changeset version

# Publish packages
bunx changeset publish
```

### 6. CI/CD for monorepos

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bun run build      # turbo runs builds in dependency order
      - run: bun run lint
      - run: bun run typecheck
      - run: bun test

      # Cache turbo output
      - uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ github.sha }}
          restore-keys: turbo-
```

### 7. Dependency management

```bash
# Add dependency to specific workspace
bun add zod --filter @repo/utils

# Add dev dependency to root
bun add -d turbo --filter .

# Install all workspace dependencies
bun install

# Check for dependency issues
bunx manypkg check
```

## Reference materials

- `references/turborepo-patterns.md` — Turborepo pipeline patterns and optimization.
- `references/workspace-conventions.md` — naming, versioning, and dependency conventions.
