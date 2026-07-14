---
name: fullstack-development
description: "Full-stack JavaScript/TypeScript patterns: API + UI integration, SSR streaming, data flow, optimistic updates, cache invalidation, end-to-end type safety. Use for features spanning frontend and backend."
compatibility: opencode
metadata:
  domain: fullstack
  audience: senior-engineer
---

# Full-Stack Development

Guide for building end-to-end features that span frontend and backend in JavaScript/TypeScript applications.

## When to apply

- Building features that involve both API and UI work.
- Designing data flow from database to UI.
- Implementing SSR streaming patterns.
- Setting up optimistic updates with rollback.
- Configuring cache invalidation across server and client.

## Core principles

### 1. End-to-end type safety

Share types between API and UI for compile-time safety:

```typescript
// shared/types.ts
export type User = {
  id: string;
  name: string;
  email: string;
};

// API route — returns User
// UI component — receives User via props/load function
// TypeScript catches mismatches at build time
```

Options: tRPC (full e2e), shared TypeScript types, Zod schema sharing, GraphQL codegen.

### 2. Data fetching patterns

| Pattern | When to use | Framework support |
|---|---|---|
| Server Components fetch | Next.js App Router | React Server Components |
| Load functions | SvelteKit, Nuxt | `+page.server.ts`, `useAsyncData` |
| tRPC queries | Type-safe RPC | tRPC + React/Svelte/Vue |
| TanStack Query | Client-side fetching with caching | Any framework |
| SWR | Lightweight client-side fetching | React |

### 3. Mutations and optimistic updates

```typescript
// Next.js Server Actions with optimistic update
const [optimisticState, addOptimistic] = useOptimistic(
  items,
  (state, newItem) => [...state, newItem],
);

async function createItem(formData: FormData) {
  addOptimistic({ id: 'temp', ...data }); // Immediate UI update
  await createItemAction(formData);        // Server mutation
  // On error, optimistic state reverts automatically
}
```

### 4. SSR streaming

```typescript
// Next.js streaming with Suspense
import { Suspense } from 'react';

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<StatsSkeleton />}>
        <Stats /> {/* Streams in when ready */}
      </Suspense>
    </div>
  );
}
```

### 5. Cache invalidation

| Framework | Mechanism |
|---|---|
| Next.js | `revalidatePath()`, `revalidateTag()`, `fetch` with `tags` |
| SvelteKit | `invalidate()`, `invalidateAll()`, `depends()` |
| TanStack Query | `queryClient.invalidateQueries()` |
| tRPC | `utils.invalidate()` |

### 6. Loading and error states

Every async boundary must handle:
1. **Loading**: skeleton UI, spinner, or streaming fallback.
2. **Error**: error boundary with recovery action (retry, go back).
3. **Empty**: empty state with call to action (create first item).

### 7. Form patterns

- Prefer server actions / form actions over `fetch` + `useState`.
- `useFormStatus()` for pending states.
- `useActionState()` for form state management.
- Progressive enhancement: forms work without JavaScript.
- Validation on both client (UX) and server (security).

## Quality gates

- End-to-end type safety (shared types or tRPC).
- Every async boundary has loading, error, and empty states.
- Optimistic updates have error recovery.
- Cache invalidation is explicit and tested.
- Forms work with JavaScript disabled where possible.
