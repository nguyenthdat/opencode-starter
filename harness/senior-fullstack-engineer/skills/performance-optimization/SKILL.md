---
name: performance-optimization
description: "Performance optimization: bundle analysis, Core Web Vitals (LCP, INP, CLS), code splitting, lazy loading, caching, image optimization, font optimization, SSR/streaming, memory profiling. Use for JS/TS performance work."
compatibility: opencode
metadata:
  domain: performance
  audience: senior-engineer
---

# Performance Optimization

Guide for profiling and optimizing JavaScript/TypeScript application performance.

## When to apply

- Analyzing bundle size and composition.
- Improving Core Web Vitals (LCP, INP, CLS).
- Optimizing rendering performance and reducing jank.
- Setting up caching and CDN strategies.
- Profiling memory usage and fixing leaks.

## Core principles

### 1. Core Web Vitals targets

| Metric | Good | Needs Improvement | Poor |
|---|---|---|---|
| LCP | ≤ 2.5s | 2.5s – 4.0s | > 4.0s |
| INP | ≤ 200ms | 200ms – 500ms | > 500ms |
| CLS | ≤ 0.1 | 0.1 – 0.25 | > 0.25 |

### 2. Bundle analysis

```bash
bunx vite-bundle-visualizer
# or
bunx source-map-explorer dist/**/*.js
```

Check for:
- Duplicate dependencies (multiple versions of same package).
- Large dependencies that can be replaced with smaller alternatives.
- Unused code (dead code elimination not working).
- Polyfills when not needed (modern browsers target).

### 3. Code splitting

```typescript
// Route-based (Next.js, SvelteKit — automatic)
// Component-based lazy loading
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Conditional loading
if (featureEnabled) {
  const module = await import('./feature');
  module.init();
}
```

### 4. Image optimization

```html
<!-- Modern formats with fallback -->
<picture>
  <source srcset="hero.avif" type="image/avif" />
  <source srcset="hero.webp" type="image/webp" />
  <img src="hero.jpg" alt="Hero" width="1200" height="630" loading="lazy" />
</picture>
```

- Use framework image components (next/image, @sveltejs/enhanced-img).
- `loading="lazy"` for below-fold images.
- `fetchpriority="high"` for LCP images.
- Responsive sizes: `sizes="(max-width: 768px) 100vw, 50vw"`.

### 5. Font optimization

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter.woff2') format('woff2');
  font-display: swap;       /* Show fallback font until loaded */
  font-weight: 400 700;     /* Range for variable fonts */
}
```

- Subset fonts to include only needed characters.
- Prefer `woff2` format.
- Self-host fonts (avoid third-party font providers when possible).
- Preload critical fonts: `<link rel="preload" href="/fonts/inter.woff2" as="font" crossorigin>`.

### 6. Caching strategy

```
Cache-Control: public, max-age=31536000, immutable  # Static assets (hashed filenames)
Cache-Control: public, max-age=0, must-revalidate    # HTML pages
Cache-Control: public, max-age=3600, s-maxage=3600   # API responses with CDN
```

### 7. Rendering optimization

- Avoid layout thrashing: batch DOM reads and writes.
- Use `requestAnimationFrame` for animations.
- Use `will-change` sparingly (only for elements that will animate).
- Avoid forced synchronous layouts (reading layout properties after DOM mutations).
- Use web workers for heavy computation off the main thread.

### 8. Memory profiling

```bash
# Chrome DevTools → Memory tab → Heap snapshot
# Look for: detached DOM nodes, large arrays, closure leaks

# Common memory leak patterns:
# 1. Unmounted component subscriptions
# 2. Growing caches without eviction
# 3. Event listeners not cleaned up
```

## Reference materials

- `references/bundle-optimization-guide.md` — dependency analysis and replacement strategies.
- `references/core-web-vitals-guide.md` — detailed CWV optimization techniques.
