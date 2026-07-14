---
name: svelte-development
description: "Svelte 5 development: runes ($state, $derived, $effect, $props), snippets, stores, transitions, component patterns. Use for Svelte component and app development."
compatibility: opencode
metadata:
  domain: svelte
  audience: senior-engineer
---

# Svelte Development

Guide for building production-grade Svelte applications with Svelte 5 runes.

## When to apply

- Writing Svelte 5 components and runes.
- Reviewing Svelte code for reactivity patterns.
- Migrating from Svelte 4 to Svelte 5.
- Implementing SvelteKit features (load functions, form actions).

## Core principles

### 1. Svelte 5 runes

Runes are the reactivity primitive in Svelte 5. Use them exclusively in new code.

```svelte
<script>
  // $state — reactive variable
  let count = $state(0);

  // $derived — computed value
  let doubled = $derived(count * 2);

  // $effect — side effect (auto-subscribes to reactive deps)
  $effect(() => {
    console.log(`Count is ${count}`);
  });

  // $props — component props
  let { title, count = 0, onUpdate } = $props();

  // $bindable — two-way binding prop
  let { value = $bindable('') } = $props();
</script>
```

### 2. Legacy migration

| Svelte 4 | Svelte 5 |
|---|---|
| `let count = 0` | `let count = $state(0)` |
| `$: doubled = count * 2` | `let doubled = $derived(count * 2)` |
| `$: { console.log(count) }` | `$effect(() => { console.log(count) })` |
| `export let title` | `let { title } = $props()` |
| `export let value` + `bind:value` | `let { value = $bindable('') } = $props()` |
| `onMount(fn)` | `$effect(fn)` |
| `onDestroy(fn)` | `$effect(() => fn)` |
| `<slot />` | `{@render children?.()}` or `{#snippet}` |

### 3. Snippets

Snippets replace slots as the composition mechanism:

```svelte
<!-- Parent -->
<script>
  import Card from './Card.svelte';
</script>

<Card>
  {#snippet header()}
    <h2>My Title</h2>
  {/snippet}
  {#snippet body()}
    <p>Content here</p>
  {/snippet}
</Card>

<!-- Card.svelte -->
<script>
  let { header, body }: { header: Snippet; body: Snippet } = $props();
</script>

<div class="card">
  <header>{@render header()}</header>
  <main>{@render body()}</main>
</div>
```

### 4. Stores

Use stores for shared state across components:

```svelte
// stores/counter.svelte.ts
function createCounter() {
  let count = $state(0);
  return {
    get count() { return count; },
    increment: () => count++,
  };
}

export const counter = createCounter();
```

### 5. Control flow

```svelte
{#if condition}
  <p>True</p>
{:else if other}
  <p>Other</p>
{:else}
  <p>False</p>
{/if}

{#each items as item (item.id)}
  <p>{item.name}</p>
{/each}

{#await promise}
  <p>Loading...</p>
{:then value}
  <p>{value}</p>
{:catch error}
  <p>Error: {error.message}</p>
{/await}

{#snippet name(args)}
  <!-- reusable template -->
{/snippet}
```

### 6. Transitions

```svelte
<script>
  import { fade, fly, slide } from 'svelte/transition';
  let visible = $state(false);
</script>

{#if visible}
  <div transition:fly={{ y: 20, duration: 300 }}>Animated</div>
{/if}
```

### 7. Component lifecycle (rune equivalents)

- `$effect(() => { ... })` — runs when dependencies change (replaces `onMount` + reactive statements).
- `$effect(() => { return () => { cleanup() } })` — cleanup (replaces `onDestroy`).
- Use `untrack()` inside `$effect` to read values without subscribing.

## Reference materials

- `references/svelte-5-migration.md` — migration guide from Svelte 4.
- `references/svelte-runes-guide.md` — detailed runes patterns and edge cases.
- `references/svelte-component-patterns.md` — component design in Svelte 5.
