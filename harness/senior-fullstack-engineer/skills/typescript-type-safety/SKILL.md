---
name: typescript-type-safety
description: "TypeScript type safety: strict tsconfig, generics, discriminated unions, type narrowing, template literal types, conditional types, mapped types, satisfies operator, const assertions. Use for advanced TypeScript type design."
compatibility: opencode
metadata:
  domain: typescript
  audience: senior-engineer
---

# TypeScript Type Safety

Guide for advanced TypeScript type design and strict type safety enforcement.

## When to apply

- Designing complex TypeScript types and generics.
- Debugging difficult type errors.
- Setting up strict TypeScript configurations.
- Reviewing type safety of existing code.
- Modeling domain state with discriminated unions.

## Core principles

### 1. Strict tsconfig

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 2. `unknown` over `any`

```typescript
// GOOD — type-safe handling of unknown
function parseJSON(raw: string): unknown {
  return JSON.parse(raw);
}

function handleResponse(data: unknown) {
  if (UserSchema.safeParse(data).success) {
    // data is typed as User
  }
}

// BAD
function parseJSON(raw: string): any { ... } // loses all type safety
```

### 3. Discriminated unions

```typescript
type ApiState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

function renderState<T>(state: ApiState<T>) {
  switch (state.status) {
    case 'idle': return <Idle />;
    case 'loading': return <Spinner />;
    case 'success': return <Data data={state.data} />;    // state.data is T
    case 'error': return <Error error={state.error} />;    // state.error is Error
  }
  // Exhaustive — TypeScript ensures all cases handled
}
```

### 4. Template literal types

```typescript
type EventName = `on${Capitalize<string>}`;
type CSSUnit = `${number}${'px' | 'rem' | 'em' | '%'}`;
type Route = `/api/${'users' | 'posts' | 'comments'}/${string}`;
```

### 5. `satisfies` operator

```typescript
// Validates type without widening
const config = {
  api: 'https://api.example.com',
  timeout: 5000,
  retries: 3,
} satisfies AppConfig;

// config.api is 'https://api.example.com' (literal), not string
```

### 6. `const` assertions

```typescript
// Without as const
const COLORS = ['red', 'green', 'blue']; // type: string[]

// With as const
const COLORS = ['red', 'green', 'blue'] as const; // type: readonly ['red', 'green', 'blue']
type Color = typeof COLORS[number]; // 'red' | 'green' | 'blue'
```

### 7. Branded types (opaque types)

```typescript
declare const brand: unique symbol;
type Brand<T, B> = T & { [brand]: B };

type UserId = Brand<string, 'UserId'>;
type PostId = Brand<string, 'PostId'>;

function getUser(id: UserId) { ... }
function getPost(id: PostId) { ... }

getUser('abc' as UserId);  // OK
getUser('abc' as PostId);  // Type error
```

### 8. Type narrowing

```typescript
// Type predicate
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'email' in obj;
}

// Assertion function
function assertIsUser(obj: unknown): asserts obj is User {
  if (!isUser(obj)) throw new Error('Not a user');
}
```

### 9. Generic constraints

```typescript
// Constrain to objects with id
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}

// Conditional types
type IsString<T> = T extends string ? true : false;
type Result1 = IsString<'hello'>; // true
type Result2 = IsString<42>;      // false
```

## Reference materials

- `references/discriminated-unions-guide.md` — patterns for state machines and API responses.
- `references/generics-cookbook.md` — common generic patterns and recipes.
- `references/type-narrowing-patterns.md` — exhaustive type narrowing techniques.
