---
name: react-development
description: "React 19 development: Server Components, hooks (use, useOptimistic, useFormStatus, useActionState), Suspense, error boundaries, composition patterns. Use for React component and application development."
compatibility: opencode
metadata:
  domain: react
  audience: senior-engineer
---

# React Development

Guide for building production-grade React applications with React 19 and modern patterns.

## When to apply

- Writing React components, hooks, or context providers.
- Reviewing React code for performance and correctness.
- Implementing data fetching, forms, or state management in React.
- Migrating from older React versions to React 19.

## Core principles

### 1. Components and composition

```typescript
// Server Component (default in Next.js App Router)
async function UserList() {
  const users = await db.user.findMany();
  return <ul>{users.map(u => <UserItem key={u.id} user={u} />)}</ul>;
}

// Client Component (add 'use client' for interactivity)
'use client';
function UserForm() {
  const [name, setName] = useState('');
  return <input value={name} onChange={e => setName(e.target.value)} />;
}
```

Server Components are the default. Add `'use client'` only when you need:
- `useState`, `useEffect`, `useReducer`
- Event handlers (`onClick`, `onChange`)
- Browser APIs (`localStorage`, `window`)
- Custom hooks that use any of the above

### 2. React 19 hooks

| Hook | Purpose |
|---|---|
| `use()` | Read context or promise in render. Suspends on promise. |
| `useOptimistic(state, updateFn)` | Optimistic UI updates with automatic rollback |
| `useFormStatus()` | Pending state of parent form |
| `useActionState(action, initialState)` | Form state management with server actions |

```typescript
// use() for context and promises
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise);
  const theme = use(ThemeContext);
  return <div className={theme}>{user.name}</div>;
}
```

### 3. Suspense and error boundaries

```typescript
<Suspense fallback={<LoadingSkeleton />}>
  <AsyncComponent />
</Suspense>

<ErrorBoundary fallback={<ErrorFallback onRetry={reset} />}>
  <Suspense fallback={<LoadingSkeleton />}>
    <AsyncComponent />
  </Suspense>
</ErrorBoundary>
```

- Every async component must be wrapped in Suspense.
- Every Suspense boundary should have an ErrorBoundary parent.
- Use nested Suspense boundaries for granular loading states.

### 4. State management

Decision flow:
1. Local state: `useState` or `useReducer`.
2. Lifted state: move to closest common ancestor.
3. URL state: `useSearchParams` for filter/sort/pagination.
4. Context: truly global state (theme, auth, locale).
5. External store: Zustand for complex client state, TanStack Query for server state.

### 5. Server actions

```typescript
// actions.ts
'use server';
export async function createPost(formData: FormData) {
  const schema = CreatePostSchema.parse(Object.fromEntries(formData));
  await db.post.create({ data: schema });
  revalidatePath('/posts');
}

// Component
function CreatePostForm() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <SubmitButton />
    </form>
  );
}
```

### 6. Performance

- `useMemo` / `useCallback`: only when profiling shows benefit. Not by default.
- `React.memo`: for pure components with expensive renders.
- Avoid: creating new objects/arrays/functions in render that break memoization.
- Lazy load: `React.lazy()` for route-level code splitting.

### 7. Anti-patterns

| Anti-pattern | Fix |
|---|---|
| `useEffect` for data fetching | Server Components, TanStack Query, or SWR |
| `useEffect` for derived state | Compute inline, use `useMemo` |
| Prop drilling > 3 levels | Composition, Context, or external store |
| `useRef` + manual DOM manipulation | Controlled components, `ref` callbacks |
| `dangerouslySetInnerHTML` without sanitization | DOMPurify.sanitize() |

## Reference materials

- `references/react-19-migration.md` — migrating from React 18 to 19.
- `references/server-components-guide.md` — RSC patterns and boundaries.
- `references/react-hooks-cheatsheet.md` — hook usage guide with examples.
