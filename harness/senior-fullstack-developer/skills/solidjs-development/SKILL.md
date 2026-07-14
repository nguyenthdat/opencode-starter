---
name: solidjs-development
description: "SolidJS development: signals, stores, createResource, createAsync, Suspense, ErrorBoundary, control flow components, fine-grained reactivity. Use for SolidJS component and app development."
compatibility: opencode
metadata:
  domain: solidjs
  audience: senior-engineer
---

# SolidJS Development

Guide for building production-grade SolidJS applications with fine-grained reactivity.

## When to apply

- Writing SolidJS components, signals, and stores.
- Reviewing SolidJS code for reactivity correctness.
- Implementing SolidStart features (server functions, routing).
- Migrating from React to SolidJS.

## Core principles

### 1. Fine-grained reactivity

SolidJS uses a fundamentally different model from React:

- Components execute ONCE. They are setup functions, not render functions.
- JSX is compiled to real DOM nodes, not virtual DOM.
- Reactivity is through signals, not re-renders.
- State changes update only the specific DOM binding, not the component tree.

```tsx
import { createSignal, createMemo, createEffect } from 'solid-js';

function Counter() {
  const [count, setCount] = createSignal(0);
  const doubled = createMemo(() => count() * 2);

  createEffect(() => {
    console.log('Count changed:', count());
  });

  return (
    <div>
      <p>Count: {count()} ({doubled()})</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
}
```

### 2. Signals as functions

- `createSignal` returns a getter/setter pair.
- The getter is a function: `count()` not `count`.
- Call getter inside JSX or tracking scope (createMemo, createEffect, createResource).

### 3. Control flow components

Use SolidJS control flow, not `.map()` in JSX:

```tsx
import { Show, For, Index, Switch, Match } from 'solid-js';

<Show when={user()} fallback={<Login />}>
  <Dashboard user={user()!} />
</Show>

<For each={users()}>{(user) =>
  <div>{user.name}</div>
}</For>

<Switch>
  <Match when={status() === 'loading'}><Spinner /></Match>
  <Match when={status() === 'error'}><Error /></Match>
  <Match when={status() === 'success'}><Content data={data()} /></Match>
</Switch>
```

### 4. Resources (async data)

```tsx
import { createResource, Suspense, ErrorBoundary } from 'solid-js';

function UserProfile({ userId }: { userId: string }) {
  const [user] = createResource(() => userId, fetchUser);

  return (
    <ErrorBoundary fallback={(err) => <ErrorDisplay error={err} />}>
      <Suspense fallback={<Skeleton />}>
        <Show when={user()}>
          {(u) => <div>{u().name}</div>}
        </Show>
      </Suspense>
    </ErrorBoundary>
  );
}
```

### 5. Stores

```tsx
import { createStore, produce } from 'solid-js/store';

const [state, setState] = createStore({
  users: [] as User[],
  loading: false,
});

// Immutable update with produce
setState(produce((s) => {
  s.users.push(newUser);
}));

// Or path-based update
setState('users', (users) => [...users, newUser]);
```

### 6. createAsync (SolidStart)

```tsx
import { createAsync } from '@solidjs/router';

function UserPage() {
  const user = createAsync(() => getUser(params.id));
  return <div>{user()?.name}</div>;
}
```

### 7. Key differences from React

| React | SolidJS |
|---|---|
| Components re-render on state change | Components run once; signals update DOM directly |
| `useState` / `useEffect` | `createSignal` / `createEffect` |
| Virtual DOM | Real DOM compilation |
| `.map()` in JSX | `<For>` component |
| `useMemo` | `createMemo` |
| `useEffect` with deps array | `createEffect` (auto-tracking) |

## Reference materials

- `references/solidjs-react-migration.md` — migration guide for React developers.
- `references/solidjs-signal-patterns.md` — advanced signal patterns and gotchas.
