---
name: state-management
description: "State management patterns: server vs client state, TanStack Query, stores, context, signals, caching, optimistic updates, immutability, URL state. Use for state architecture design and review."
compatibility: opencode
metadata:
  domain: state-management
  audience: senior-engineer
---

# State Management

Guide for designing and reviewing state management architecture in JS/TS applications.

## When to apply

- Designing state architecture for new applications or features.
- Reviewing state management for anti-patterns and performance.
- Choosing between server state libraries, client stores, and context.
- Refactoring messy state management into a clean architecture.

## Core principles

### 1. State classification

| State Type | Examples | Tools |
|---|---|---|
| Server state | Users list, posts, session data | TanStack Query, SWR, tRPC |
| Client state | UI theme, sidebar open, form drafts | Zustand, signals, context |
| Form state | Validation, submission status | React Hook Form, native form actions |
| URL state | Filters, sort, pagination, search query | URL search params |
| Derived state | Computed from other state | useMemo, createMemo, $derived |

### 2. Server state (TanStack Query)

Use TanStack Query for ALL server data:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(r => r.json()),
    staleTime: 5 * 60 * 1000, // 5 min before refetch
  });
}

function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUser) => fetch('/api/users', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
```

Never manage server state with `useState` + `useEffect`. This is the most common state management anti-pattern.

### 3. Client state

```typescript
// Zustand — lightweight client state
import { create } from 'zustand';

const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
```

Decision flow:
1. Is it server data? → TanStack Query
2. Is it URL state? → URL search params
3. Is it form state? → form actions / React Hook Form
4. Is it global client state? → Zustand / Pinia / Svelte stores / Solid signals
5. Is it local state? → useState / $state / ref

### 4. Context boundaries

```typescript
// Split read and write contexts to prevent unnecessary re-renders
const ThemeValueContext = createContext('light');
const ThemeActionContext = createContext<() => void>(() => {});

// Components that only need the value don't re-render on action dispatch
```

### 5. Immutability

```typescript
// GOOD — immutable update
setUsers(prev => [...prev, newUser]);
setUser(prev => ({ ...prev, name: 'New' }));

// BAD — mutation
users.push(newUser);
user.name = 'New';
```

### 6. URL state

Keep filter, sort, and pagination in URL search params:

```typescript
// Next.js
import { useSearchParams } from 'next/navigation';
const searchParams = useSearchParams();
const page = searchParams.get('page') ?? '1';

// SvelteKit
export function load({ url }) {
  const page = url.searchParams.get('page') ?? '1';
}
```

### 7. Anti-patterns

| Anti-pattern | Fix |
|---|---|
| `useState` + `useEffect` for data fetching | TanStack Query |
| One giant store | Feature-based slices |
| Deeply nested context | Flatten context or use external store |
| Mutating state directly | Immutable updates |
| Duplicating server state in client | Single source of truth |
| Prop drilling > 3 levels | Context, store, or composition |
