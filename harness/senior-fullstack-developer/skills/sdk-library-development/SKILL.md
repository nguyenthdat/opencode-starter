---
name: sdk-library-development
description: "SDK and library development: API design, tree-shaking, ESM/CJS dual publishing, semver, package.json exports, TypeScript declaration files, bundle optimization, changelog, testing. Use for creating JS/TS libraries and SDKs."
compatibility: opencode
metadata:
  domain: library-development
  audience: senior-engineer
---

# SDK and Library Development

Guide for building and publishing production-grade JavaScript/TypeScript libraries and SDKs.

## When to apply

- Creating a new npm package, library, or SDK.
- Setting up library build and publish pipeline.
- Designing public API for a library.
- Configuring ESM/CJS dual exports.
- Reviewing library for tree-shaking and bundle compatibility.

## Core principles

### 1. Package structure

```
my-lib/
├── src/
│   ├── index.ts         # Public API entry point
│   ├── core.ts
│   └── utils.ts
├── tests/
│   └── index.test.ts
├── package.json
├── tsconfig.json
├── bun.lockb
├── README.md
├── CHANGELOG.md
└── LICENSE
```

### 2. package.json exports

```json
{
  "name": "my-lib",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./utils": {
      "types": "./dist/utils.d.ts",
      "import": "./dist/utils.js",
      "require": "./dist/utils.cjs"
    }
  },
  "files": ["dist/", "README.md", "LICENSE"],
  "sideEffects": false
}
```

`"sideEffects": false` enables aggressive tree-shaking. Set to `["*.css"]` if exporting CSS.

### 3. Build configuration

```typescript
// tsconfig.json — build config
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "tests", "dist"]
}
```

```json
// Scripts
{
  "scripts": {
    "build": "bun run build:types && bun run build:js",
    "build:types": "tsc --emitDeclarationOnly",
    "build:js": "bun build ./src/index.ts --outdir ./dist --target node --format esm",
    "prepublishOnly": "bun run build && bun test"
  }
}
```

### 4. Public API design

```typescript
// src/index.ts — explicit public API
export { createClient } from './client.js';
export { ValidationError, NetworkError } from './errors.js';
export type { Client, ClientConfig } from './types.js';

// Internal modules not exported — consumers can't access them
```

Rules:
- Single `index.ts` as public API surface. Re-export only what consumers need.
- Export types with `export type`. Use separate entry points for optional features.
- Small API surface. Every public export is a commitment.
- Document every public function, class, type with JSDoc/TSDoc.

### 5. Semantic versioning (semver)

| Change | Version bump |
|---|---|
| Bug fix (no API change) | PATCH (1.0.0 → 1.0.1) |
| New feature (backward compatible) | MINOR (1.0.0 → 1.1.0) |
| Breaking change | MAJOR (1.0.0 → 2.0.0) |

Breaking changes: removing exports, changing function signatures, changing behavior, dropping Node/Bun version support.

### 6. Testing

```typescript
// Test public API only
import { createClient } from 'my-lib';

it('creates a client', () => {
  const client = createClient({ apiKey: 'test' });
  expect(client).toBeDefined();
});

// Test error handling
it('throws on missing apiKey', () => {
  expect(() => createClient({ apiKey: '' })).toThrow(ValidationError);
});
```

### 7. Publishing checklist

- [ ] `bun run build` succeeds.
- [ ] `bun test` passes.
- [ ] `exports` field covers all public entry points.
- [ ] `files` field includes only `dist/` + docs.
- [ ] `sideEffects` correctly set.
- [ ] CHANGELOG.md updated.
- [ ] Version bumped according to semver.
- [ ] `bun publish --dry-run` shows correct output.

```bash
bun publish
```

### 8. Tree-shaking compatibility

```typescript
// GOOD — named exports (tree-shakeable)
export function foo() { ... }
export function bar() { ... }

// BAD — default export with methods (not tree-shakeable)
export default { foo() { ... }, bar() { ... } };

// GOOD — separate entry points for optional features
import { foo } from 'my-lib';       // imports only foo
import { bar } from 'my-lib/bar';   // imports only bar
```

## Reference materials

- `references/library-build-guide.md` — build config examples (tsup, unbuild, Bun build).
- `references/semver-checklist.md` — semver decision guide for libraries.
