---
name: javascript-coding
description: "Modern JavaScript patterns: ESM, async/await, platform APIs, optional chaining, nullish coalescing, iterators, destructuring, modules. Use when writing or reviewing modern JavaScript (.js, .mjs, .cjs) code."
compatibility: opencode
metadata:
  domain: javascript
  audience: senior-engineer
---

# Modern JavaScript Best Practices

Guide for writing modern, idiomatic JavaScript using current ECMAScript features and platform APIs.

## When to apply

- Writing JavaScript code (`.js`, `.mjs`) or mixed JS/TS codebases.
- Reviewing JavaScript for modern patterns and anti-patterns.
- Migrating older JS code to modern standards.
- Writing Node.js or Bun scripts where TypeScript is not used.

## Core principles

### 1. ESM everywhere

```javascript
// GOOD — ESM
import { readFile } from 'node:fs/promises';
export async function loadConfig(path) { ... }

// AVOID — CJS unless the project explicitly requires it
const fs = require('fs');
module.exports = { loadConfig };
```

Prefer `.mjs` or `"type": "module"` in `package.json`. Use `import.meta.url` instead of `__dirname`.

### 2. Async/await

- Always use `async/await` over raw promises or callbacks.
- Top-level `await` in ESM modules.
- Never mix `.then()` and `await` in the same function.
- Use `Promise.all` for independent parallel operations.
- Always handle promise rejections.

### 3. Platform APIs over libraries

Prefer built-in APIs:

| Instead of | Use |
|---|---|
| `axios`, `node-fetch` | `fetch()` (Node 18+, Bun) |
| `moment`, `dayjs` | `Intl.DateTimeFormat`, `Temporal` (stage 3) |
| `lodash` methods | Native equivalents: `Array.map/filter/reduce`, `Object.entries/fromEntries` |
| `uuid` | `crypto.randomUUID()` |
| `dotenv` | Bun built-in `.env` support, `--env-file` flag |

### 4. Optional chaining and nullish coalescing

```javascript
// GOOD
const city = user?.address?.city ?? 'Unknown';

// AVOID
const city = user && user.address && user.address.city ? user.address.city : 'Unknown';
```

### 5. Destructuring and spread

```javascript
// Object destructuring
const { name, email, ...rest } = user;

// Array destructuring
const [first, second, ...remaining] = items;

// Function parameter destructuring
function render({ title, content, author = 'Anonymous' }) { ... }
```

### 6. Iteration patterns

```javascript
// Prefer for...of over indexed for loops
for (const item of items) { ... }

// Use map/filter/reduce for transformations
const names = users.map(u => u.name);

// for...of with async
for await (const chunk of readableStream) { ... }
```

### 7. Template literals

```javascript
// GOOD
const url = `/api/users/${userId}/posts?page=${page}`;

// AVOID
const url = '/api/users/' + userId + '/posts?page=' + page;
```

### 8. Modern data structures

- `Map` for key-value with non-string keys.
- `Set` for unique value collections.
- `WeakMap` / `WeakSet` for memory-sensitive caches.

### 9. Error handling

- Use `Error` subclasses for typed errors.
- `try/catch` in async functions. Always catch and handle.
- Don't swallow errors silently.
- Structured error objects with `code`, `message`, `details`.

### 10. Modules and encapsulation

- Single responsibility per module.
- Named exports preferred over default exports.
- Use `node:` prefix for Node built-ins.
- Private class fields with `#` when encapsulation is needed.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| `var` declarations | `const` (preferred) or `let` |
| Callback pyramids | `async/await` |
| `==` loose equality | `===` strict equality |
| Mutating function arguments | Return new values; use spread |
| `eval()` or `new Function()` | Never use; find alternatives |
| `with` statement | Never use |
| `for...in` for arrays | `for...of` or `.forEach()` |
| Comparing to `null`/`undefined` with `==` | Use `??` or explicit `=== null`/`=== undefined` |
