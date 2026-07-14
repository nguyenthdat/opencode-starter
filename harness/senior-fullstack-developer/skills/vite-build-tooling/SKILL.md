---
name: vite-build-tooling
description: "Vite build tooling: Vite config, plugins, tree-shaking, code splitting, environment variables, TypeScript path aliases, CSS processing, asset optimization. Use for Vite and build configuration."
compatibility: opencode
metadata:
  domain: vite
  audience: senior-engineer
---

# Vite Build Tooling

Guide for configuring and optimizing Vite-based builds for JavaScript/TypeScript projects.

## When to apply

- Setting up or modifying `vite.config.ts`.
- Configuring TypeScript path aliases and resolve settings.
- Optimizing bundle size and code splitting.
- Adding Vite plugins for frameworks or processing.
- Configuring environment variables.
- Setting up production builds and CI pipelines.

## Core principles

### 1. Vite config basics

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
```

### 2. Framework-specific plugins

| Framework | Plugin |
|---|---|
| React | `@vitejs/plugin-react` |
| Svelte | `@sveltejs/vite-plugin-svelte` |
| Vue | `@vitejs/plugin-vue` |
| SolidJS | `vite-plugin-solid` |

### 3. Environment variables

```bash
# .env
VITE_API_URL=https://api.example.com  # exposed to client (VITE_ prefix)
SECRET_KEY=abc123                     # server-only, NOT exposed
```

```typescript
// Access in code
const apiUrl = import.meta.env.VITE_API_URL;
```

Types for env:
```typescript
// env.d.ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}
```

### 4. Tree-shaking and code splitting

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('node_modules')) {
          // Split large dependencies into separate chunks
          if (id.includes('react-dom')) return 'react-dom';
          if (id.includes('d3')) return 'd3';
          return 'vendor';
        }
      },
    },
  },
},
```

### 5. TypeScript path aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@lib/*": ["./src/lib/*"]
    }
  }
}
```

```typescript
// vite.config.ts — must also resolve aliases
import tsconfigPaths from 'vite-tsconfig-paths';
```

### 6. CSS processing

```typescript
// Supports: CSS Modules, PostCSS, Sass, Less, Tailwind CSS
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  css: {
    modules: { localsConvention: 'camelCase' },
    postcss: './postcss.config.js',
  },
});
```

### 7. Asset optimization

```typescript
build: {
  assetsInlineLimit: 4096,  // inline assets < 4KB as base64
  cssCodeSplit: true,       // split CSS per chunk
  minify: 'esbuild',        // or 'terser' for better compression
},
```

### 8. Bundle analysis

```bash
# Visualize bundle
bunx vite-bundle-visualizer

# Or use rollup-plugin-visualizer in config
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [visualizer({ open: true })],
```

### 9. Production-only optimizations

```typescript
export default defineConfig(({ mode }) => ({
  build: {
    minify: mode === 'production',
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks: mode === 'production' ? chunkStrategy : undefined,
      },
    },
  },
}));
```

## Reference materials

- `references/vite-config-examples.md` — full Vite configs for React, Svelte, Vue, SolidJS.
- `references/advanced-chunking.md` — code splitting strategies for large apps.
