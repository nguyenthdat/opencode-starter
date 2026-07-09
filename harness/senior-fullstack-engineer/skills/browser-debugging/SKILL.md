---
name: browser-debugging
description: "Browser debugging: Chrome DevTools, Performance panel, Network panel, Memory profiling, Console, Sources breakpoints, React/Svelte/Vue DevTools, Lighthouse audits. Use for browser-based debugging and profiling."
compatibility: opencode
metadata:
  domain: debugging
  audience: senior-engineer
---

# Browser Debugging

Guide for debugging and profiling JavaScript/TypeScript applications in the browser.

## When to apply

- Debugging runtime errors, rendering issues, or unexpected behavior.
- Profiling performance bottlenecks in the browser.
- Analyzing network requests and API calls.
- Debugging memory leaks and excessive memory usage.
- Using framework-specific DevTools extensions.

## Core principles

### 1. Chrome DevTools panels

| Panel | Use for |
|---|---|
| Elements | Inspect DOM, CSS, computed styles, accessibility tree |
| Console | Log output, run JS expressions, filter by level |
| Sources | Set breakpoints, step through code, watch variables |
| Network | Inspect requests, response times, waterfall, headers |
| Performance | Record and analyze runtime performance (CPU, rendering) |
| Memory | Heap snapshots, allocation timeline, detached DOM nodes |
| Application | Storage (localStorage, cookies, IndexedDB), Service Workers |
| Lighthouse | Automated audits (performance, accessibility, SEO, best practices) |

### 2. Console debugging

```typescript
// Structured logging
console.group('User fetch');
console.log('Request URL:', url);
console.log('Response:', data);
console.timeEnd('fetchUser');
console.groupEnd();

// Conditional breakpoints equivalent
if (userId === 'problematic-id') {
  debugger; // Execution pauses here in DevTools
}

// Trace
console.trace('Called from');
```

### 3. Performance profiling

1. Open Performance panel.
2. Click record, perform the slow action, stop recording.
3. Analyze flame chart:
   - Long tasks (red triangles) — identify and split.
   - Recalculate style / Layout — minimize style changes.
   - Parse HTML / Evaluate Script — defer or code split.

### 4. Network debugging

- Filter by: XHR/Fetch, JS, CSS, Img, Font.
- Check waterfall: identify blocking resources, slow responses.
- Right-click → "Block request URL" to test error handling.
- Throttling: simulate Slow 3G, Fast 3G, or offline.

### 5. Memory debugging

1. Take heap snapshot before and after an action.
2. Compare snapshots: look for growing objects.
3. Detached DOM nodes: elements removed from DOM but still referenced in JS.
4. Common leaks: unmounted components, event listeners, setInterval, growing caches.

### 6. Framework DevTools

| Extension | Use for |
|---|---|
| React Developer Tools | Inspect component tree, props, state, hooks, re-render highlighting |
| Svelte DevTools | Inspect stores, component tree |
| Vue DevTools | Inspect component tree, Pinia stores, Vue Router, timeline |
| Solid Devtools | Inspect signals, stores, component graph |

### 7. Device emulation

```bash
# Responsive mode
# Toggle device toolbar (Ctrl+Shift+M)
# Test at: 320, 375, 414, 768, 1024, 1280, 1440
# Emulate: CPU throttling (4x/6x slowdown), network throttling
```

### 8. Quick debugging workflows

```bash
# Check all console errors
1. Open DevTools → Console
2. Check "Preserve log"
3. Reproduce the issue
4. Click error links to jump to source

# Find why component re-renders
1. React DevTools → Profiler → Record
2. Interact, stop recording
3. Check "Why did this render?"

# Debug network error
1. Network tab → filter to the failing request
2. Check Headers, Preview, Response tabs
3. Copy as cURL for reproduction
```

## Reference materials

- `references/devtools-shortcuts.md` — keyboard shortcuts for Chrome DevTools.
- `references/performance-profiling-guide.md` — detailed performance profiling workflow.
