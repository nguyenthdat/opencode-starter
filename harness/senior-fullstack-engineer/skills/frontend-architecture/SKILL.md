---
name: frontend-architecture
description: "Frontend architecture patterns: component trees, routing, SSR/CSR strategy, bundle splitting, hydration, data flow, framework selection, island architecture. Use for frontend architecture decisions in JS/TS projects."
compatibility: opencode
metadata:
  domain: frontend
  audience: senior-engineer
---

# Frontend Architecture

Guide for designing frontend application architecture. Cover component decomposition, routing, rendering strategy, data flow, and performance considerations.

## When to apply

- Designing a new frontend application or major feature.
- Reviewing frontend architecture for performance or maintainability issues.
- Choosing between SSR, CSR, SSG, or hybrid rendering.
- Planning component hierarchy and data flow.
- Deciding on bundle splitting strategy.

## Core principles

### 1. Rendering strategy selection

| Strategy | Best for | Framework support |
|---|---|---|
| CSR (Client-Side Rendering) | Apps behind auth, dashboards, SPAs | React, Vue, Svelte, SolidJS + Vite |
| SSR (Server-Side Rendering) | Content sites, SEO-critical, fast FCP | Next.js, SvelteKit, Nuxt, SolidStart |
| SSG (Static Site Generation) | Blogs, docs, marketing pages | Next.js, Astro, SvelteKit, Nuxt |
| ISR (Incremental Static Regeneration) | Content sites with frequent updates | Next.js, SvelteKit |
| Islands Architecture | Mostly static with interactive widgets | Astro, Fresh |
| Partial Prerendering | Hybrid static + dynamic in same route | Next.js (experimental) |

Decision factors: SEO requirements, time-to-interactive targets, content update frequency, auth requirements.

### 2. Component tree design

- Root layout → page → section → component hierarchy.
- Pages own route-level state and data fetching.
- Sections are composable containers (no data fetching).
- Components are reusable, presentational, and framework-specific.
- Shared components in a `components/` directory at the appropriate level.

### 3. SSR/CSR boundary

- Mark the boundary explicitly in the architecture document.
- Server components: data fetching, non-interactive rendering.
- Client components: interactivity, browser APIs, event handlers.
- Avoid deep `'use client'` propagation — keep client boundaries at leaf components.

### 4. Data flow

- Server → client: props from server components/load functions.
- Client state: stores, context, signals (depends on framework).
- Client → server: server actions / form actions / API routes.
- URL state: search params for filter/sort/pagination.

### 5. Bundle splitting

- Route-based splitting (default in Next.js, SvelteKit, Nuxt).
- Component-based lazy loading for below-fold content.
- Vendor chunk splitting for large dependencies.
- Target: no single chunk over 100KB gzipped.

### 6. Hydration strategy

- Full hydration: standard for most SSR apps.
- Partial hydration: only hydrate interactive islands (Astro, Fresh).
- Progressive hydration: hydrate in order of priority.
- Resumability: no hydration needed (Qwik).
- Avoid: shipping interactive JS for static content.

### 7. Core Web Vitals targets

| Metric | Target | Strategy |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | Optimize hero image, server render critical HTML |
| INP (Interaction to Next Paint) | < 200ms | Code split, avoid long tasks, use web workers |
| CLS (Cumulative Layout Shift) | < 0.1 | Explicit image dimensions, font loading strategy |

## Framework selection guidance

- **React + Vite**: SPA for internal tools, dashboards. Broad ecosystem.
- **Next.js**: SSR/SSG/ISR for content sites, e-commerce, SEO-critical apps.
- **Svelte + SvelteKit**: Performance-critical, smaller bundles, simpler DX.
- **Vue + Vite**: SPA for moderate complexity. Nuxt for SSR needs.
- **SolidJS**: Maximum performance, fine-grained reactivity.
- **Astro**: Content sites, blogs, docs with minimal interactivity.

## Reference materials

- `references/ssr-csr-decision-guide.md` — detailed rendering strategy comparison.
- `references/bundle-splitting-patterns.md` — code splitting strategies per framework.
- `references/component-tree-examples.md` — component hierarchy examples.
