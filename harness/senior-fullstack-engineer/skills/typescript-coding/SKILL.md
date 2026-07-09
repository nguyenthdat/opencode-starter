---
name: typescript-coding
description: "Comprehensive TypeScript best practices: strict tsconfig, type safety, discriminated unions, runtime validation, error handling, async patterns, module design, and anti-patterns. Use when writing, reviewing, or refactoring TypeScript (.ts, .tsx) code."
compatibility: opencode
metadata:
  domain: typescript
  audience: senior-engineer
---

# TypeScript Best Practices

Comprehensive guide for writing high-quality, type-safe, production-grade TypeScript code.

## When to apply

- Writing new TypeScript code or refactoring existing code.
- Reviewing TypeScript for type safety and correctness.
- Configuring `tsconfig.json` for a project.
- Deciding module structure and public API design.
- Debugging type errors or runtime issues caused by unsafe types.

## Core principles

### 1. Strict TypeScript

Enable strict mode in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Why: `strict: true` catches null/undefined errors, implicit any, and incorrect `this` usage at compile time.

### 2. No unnecessary `any`

- Never use `any` for new code unless there is a documented, justified reason.
- Prefer `unknown` for values from external sources (API responses, user input, parsed data).
- When typing is complex, use generics or overloads instead of `any`.
- If a library lacks types, write a minimal `.d.ts` declaration file.

Why: `any` disables all type checking for that value, making bugs invisible to the compiler.

### 3. Discriminated unions for state modeling

```typescript
// GOOD
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// BAD — loose booleans
{ isLoading: boolean; isError: boolean; data?: T; error?: Error }
```

Why: Discriminated unions make invalid states unrepresentable and enable exhaustive switch checks.

### 4. Runtime validation for external inputs

Every input that crosses a trust boundary MUST be validated:

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

type User = z.infer<typeof UserSchema>;
```

Accept: Zod, Valibot, TypeBox, ArkType.
Never: manual type assertions on untrusted data.

Why: TypeScript types are erased at runtime. Without runtime validation, malformed data silently corrupts your application state.

### 5. Explicit return types on public API

Every exported function, class method, and API handler must have an explicit return type:

```typescript
// GOOD
export function getUser(id: string): Promise<User | null> { ... }

// BAD
export function getUser(id: string) { ... }
```

Why: Explicit return types document the contract, catch unintentional return type changes, and improve IDE autocompletion.

### 6. Error handling

- Use typed error classes: `class ValidationError extends Error { ... }`.
- Never `catch` and ignore. At minimum, log the error.
- Async functions: always handle promise rejections. Use `try/catch` or `.catch()`.
- REST handlers: return structured error responses, never raw stack traces.
- Use `Result` pattern for operations that can fail:

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
```

### 7. Async patterns

- Prefer `async/await` over raw promises for readability.
- Always `await` promises. Never fire-and-forget without error handling.
- Use `Promise.all` for parallel operations, `Promise.allSettled` when partial failures are acceptable.
- Abort long-running operations with `AbortController`.
- Handle cancellation gracefully.

### 8. Module design

- Small modules with a single responsibility. Target under 300 lines.
- Prefer named exports over default exports. Default exports break tree-shaking and refactoring.
- Use barrel (`index.ts`) files only for intentional public API re-exports.
- Keep internal implementation details out of public exports.

### 9. Anti-patterns

| Anti-pattern | Why it's bad | Fix |
|---|---|---|
| `as` type assertions on untrusted data | Bypasses type checking, hides bugs | Runtime validation (Zod) |
| `any` escape hatch | Disables all type checking | `unknown` + type narrowing |
| `!` non-null assertion | Pretends null doesn't exist, causes runtime errors | Proper null check or optional chaining |
| `enum` for string constants | Non-standard JS, bloated output | `as const` + `type` |
| Classes for data-only objects | Boilerplate, harder to serialize | Plain objects with interfaces/types |
| Mixing sync and async in the same function | Confusing control flow | Separate sync and async paths |
| Over-abstraction | Complex generics, unnecessary layers | Solve the problem, not the hypothetical |
| Deeply nested optional chaining | Hard to debug which part failed | Validate at boundary, narrow types |
| `@ts-ignore` or `@ts-expect-error` in production | Suppresses real errors | Fix the type error instead |
| Using `Function` type | No type safety for callables | Explicit function signature types |

## Reference materials

- `references/typescript-strictness-checklist.md` — detailed tsconfig checklist for production projects.
- `references/discriminated-unions-guide.md` — patterns for state machines, API responses, domain modeling.
- `references/runtime-validation-guide.md` — Zod, Valibot, TypeBox comparison and patterns.
