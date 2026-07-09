---
name: lint-and-format
description: "ESLint, Biome, Prettier, oxlint configuration: flat config, TypeScript rules, import sorting, security rules, formatting. Use for lint and format tooling setup in JS/TS projects."
compatibility: opencode
metadata:
  domain: tooling
  audience: senior-engineer
---

# Lint and Format

Guide for configuring linting and formatting tooling for JavaScript/TypeScript projects.

## When to apply

- Setting up ESLint flat config, Biome, or Prettier.
- Reviewing and fixing lint violations.
- Adding TypeScript-specific lint rules.
- Configuring import sorting and code style rules.

## Core principles

### 1. Tool selection

| Tool | Purpose | Run with |
|---|---|---|
| Biome | Lint + format (all-in-one) | `bunx biome check .` |
| ESLint | JavaScript/TypeScript linting | `bunx eslint .` |
| Prettier | Code formatting | `bunx prettier --check .` |
| oxlint | Fast Rust-based linter (ESLint-compatible) | `bunx oxlint .` |

Recommendation: start with Biome for new projects (fast, all-in-one). Use ESLint + Prettier for projects with existing config.

### 2. Biome configuration

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": { "useExhaustiveDependencies": "warn" },
      "suspicious": { "noExplicitAny": "warn", "noConsoleLog": "warn" },
      "style": { "useConst": "error", "useTemplate": "error" }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
```

### 3. ESLint flat config

```javascript
// eslint.config.js
import tseslint from 'typescript-eslint';
import js from '@eslint/js';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  { ignores: ['dist/', 'build/', '.next/', '.svelte-kit/'] },
);
```

### 4. Essential TypeScript ESLint rules

| Rule | Severity | Why |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | error | Prevents `any` escape hatch |
| `@typescript-eslint/no-floating-promises` | error | Catches unhandled async operations |
| `@typescript-eslint/await-thenable` | error | Catches unnecessary awaits |
| `@typescript-eslint/no-misused-promises` | error | Prevents promise misuse in conditionals |
| `@typescript-eslint/explicit-function-return-type` | error | Ensures explicit public API types |
| `@typescript-eslint/strict-boolean-expressions` | warn | Prevents truthy/falsy bugs |
| `@typescript-eslint/no-unnecessary-type-assertion` | error | Catches redundant assertions |
| `@typescript-eslint/switch-exhaustiveness-check` | error | Exhaustive discriminated union checks |

### 5. Package.json scripts

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format .",
    "format:fix": "biome format --write ."
  }
}
```

Or with ESLint + Prettier:

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint --fix .",
    "format": "prettier --check .",
    "format:fix": "prettier --write ."
  }
}
```

### 6. Pre-commit hooks

```json
// .husky/pre-commit or lefthook.yml
{
  "pre-commit": {
    "commands": {
      "lint": { "run": "bun run lint" },
      "format": { "run": "bun run format" }
    }
  }
}
```

## Reference materials

- `references/biome-migration.md` — migrating from ESLint+Prettier to Biome.
- `references/eslint-flat-config-guide.md` — ESLint flat config migration and patterns.
