---
name: sveltekit-development
description: "SvelteKit development: routing, load functions, form actions, hooks, adapters, server-only modules, SSR/CSR control, progressive enhancement. Use for SvelteKit app development."
compatibility: opencode
metadata:
  domain: sveltekit
  audience: senior-engineer
---

# SvelteKit Development

Guide for building production-grade SvelteKit applications.

## When to apply

- Building SvelteKit applications with file-based routing.
- Implementing load functions and form actions.
- Configuring adapters for deployment.
- Writing hooks for auth, logging, or middleware.
- Reviewing SvelteKit code for patterns and performance.

## Core principles

### 1. File-based routing

```
src/routes/
├── +layout.svelte       # Root layout
├── +page.svelte         # Home page
├── +error.svelte        # Error boundary
├── +page.server.ts      # Server load + actions for home
├── dashboard/
│   ├── +layout.svelte
│   ├── +layout.server.ts
│   ├── +page.svelte     # /dashboard
│   └── [id]/
│       ├── +page.svelte # /dashboard/:id
│       └── +page.server.ts
├── api/
│   └── users/
│       └── +server.ts   # API endpoint (GET/POST/PUT/DELETE)
```

### 2. Load functions

```typescript
// +page.server.ts — server-only (database, secrets, file system)
export async function load({ params, locals }) {
  const user = await db.user.findUnique({ where: { id: params.id } });
  if (!user) throw error(404, 'User not found');
  return { user };
}

// +page.ts — universal load (runs on server AND client)
export async function load({ fetch, params }) {
  const res = await fetch(`/api/posts/${params.slug}`);
  return { post: await res.json() };
}
```

### 3. Form actions

```svelte
<!-- +page.svelte -->
<script>
  let { form } = $props();
</script>

<form method="POST" use:enhance>
  <input name="title" required />
  {#if form?.errors?.title}
    <span class="error">{form.errors.title}</span>
  {/if}
  <button type="submit">Create</button>
</form>
```

```typescript
// +page.server.ts
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const result = CreatePostSchema.safeParse(Object.fromEntries(data));
    if (!result.success) {
      return fail(400, { errors: result.error.flatten().fieldErrors });
    }
    await db.post.create({ data: result.data });
    throw redirect(303, '/posts');
  },
};
```

### 4. Hooks

```typescript
// src/hooks.server.ts
export async function handle({ event, resolve }) {
  const token = event.cookies.get('token');
  if (token) {
    event.locals.user = await validateToken(token);
  }
  return resolve(event);
}

export function handleError({ error }) {
  console.error('Server error:', error);
  return { message: 'Internal error' };
}
```

### 5. Adapters

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-auto'; // auto-detect platform
// import adapter from '@sveltejs/adapter-node';   // Node.js
// import adapter from '@sveltejs/adapter-static';  // static export
// import adapter from '@sveltejs/adapter-vercel';  // Vercel

export default {
  kit: { adapter: adapter() },
};
```

### 6. SSR/CSR control

```typescript
// Per-page granularity
export const ssr = false;   // client-side rendering only
export const csr = false;   // server-side rendering only

// Prerendering
export const prerender = true;  // SSG at build time
```

### 7. Server-only safety

- Server-only modules: `$env/static/private`, `$env/dynamic/private`.
- `+page.server.ts` / `+server.ts` — never imported in client code.
- `$lib/server/` — convention for server-only library code.

## Quality gates

- Server-only code never imported in client modules.
- Form actions use `fail()` for validation errors.
- Progressive enhancement: forms work without JS.
- Adapter configured and `bun run build` succeeds.
