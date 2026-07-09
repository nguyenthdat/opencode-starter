---
name: accessibility-a11y
description: "Accessibility (a11y): WCAG 2.2 AA, semantic HTML, ARIA, keyboard navigation, screen readers, color contrast, focus management, axe-core, reduced motion. Use for accessibility audits and implementation."
compatibility: opencode
metadata:
  domain: accessibility
  audience: senior-engineer
---

# Accessibility (a11y)

Guide for auditing and implementing WCAG 2.2 AA accessibility in web applications.

## When to apply

- Auditing UI components and pages for accessibility violations.
- Implementing keyboard navigation and focus management.
- Reviewing semantic HTML and ARIA usage.
- Testing with screen readers and accessibility tools.
- Ensuring color contrast meets WCAG standards.

## Core principles

### 1. WCAG 2.2 AA quick reference

| Category | Critical requirements |
|---|---|
| Perceivable | Text contrast 4.5:1 (3:1 large). Non-text 3:1. Alt text for images. Captions/subtitles. |
| Operable | All functionality via keyboard. No keyboard traps. Visible focus indicators. Minimum 44x44px touch targets. |
| Understandable | Language declared. Consistent navigation. Descriptive labels. Error suggestions. |
| Robust | Valid HTML. Proper ARIA. Compatible with assistive technology. |

### 2. Semantic HTML first

```html
<!-- GOOD — semantic -->
<header>
  <nav><ul><li><a href="/">Home</a></li></ul></nav>
</header>
<main>
  <h1>Page Title</h1>
  <article>
    <h2>Section</h2>
    <p>Content</p>
  </article>
</main>
<footer>...</footer>

<!-- BAD — div soup -->
<div class="header">
  <div class="nav"><div class="link">Home</div></div>
</div>
<div class="content">
  <div class="title">Page Title</div>
</div>
```

### 3. ARIA: when needed

```html
<!-- ARIA for custom interactive elements -->
<div role="tablist" aria-label="Product tabs">
  <button role="tab" aria-selected="true" aria-controls="panel-1">Tab 1</button>
</div>
<div role="tabpanel" id="panel-1" tabindex="0">Content</div>

<!-- ARIA for dynamic content -->
<div aria-live="polite" aria-atomic="true">
  {notification}
</div>

<!-- ARIA for loading -->
<div aria-busy="true">
  <Spinner />
</div>
```

Rules for ARIA:
1. Use semantic HTML when possible. ARIA is a fallback.
2. Don't override semantic element roles.
3. All interactive ARIA controls must be keyboard operable.
4. `aria-label` and `aria-labelledby` for elements without visible labels.

### 4. Keyboard navigation

```css
/* Visible focus indicator */
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* NEVER do this */
*:focus { outline: none; }
```

```typescript
// Focus management for modals
function openModal() {
  modalRef.current?.showModal();
  firstInputRef.current?.focus(); // Move focus into modal
  // Trap focus: Tab cycles within modal
  // On close: return focus to trigger element
}

// Route change focus
// Move focus to heading or skip-to-content after navigation
```

### 5. Color contrast

| Element | Minimum | Enhanced |
|---|---|---|
| Normal text (< 18px) | 4.5:1 | 7:1 |
| Large text (≥ 18px bold or ≥ 24px) | 3:1 | 4.5:1 |
| UI components and icons | 3:1 | — |

Check with: axe DevTools, Lighthouse, or contrast-ratio.com. Don't rely on color alone to convey information.

### 6. Forms

```html
<label for="email">Email address</label>
<input
  id="email"
  type="email"
  name="email"
  required
  aria-describedby="email-hint email-error"
/>
<div id="email-hint">We'll never share your email.</div>
<div id="email-error" role="alert">Please enter a valid email.</div>
```

- Every input has an associated `<label>`.
- Error messages use `role="alert"` or `aria-live`.
- Required fields marked with `required` attribute + visual indicator.
- Form-level error summary at top of form.

### 7. Images

```html
<!-- Decorative -->
<img src="decorative.png" alt="" />

<!-- Informative -->
<img src="chart.png" alt="Q4 revenue increased 15% year-over-year" />

<!-- Complex (charts, diagrams) — provide long description -->
<img src="chart.png" alt="Q4 revenue chart" aria-describedby="chart-desc" />
<div id="chart-desc">Detailed description of the chart data...</div>
```

### 8. Testing tools

```bash
# axe-core CLI
bunx @axe-core/cli https://example.com

# Lighthouse
bunx lighthouse https://example.com --only-categories=accessibility

# Storybook a11y addon
# @storybook/addon-a11y — runs axe-core on every story
```

## Reference materials

- `references/wcag-checklist.md` — WCAG 2.2 AA compliance checklist.
- `references/aria-patterns.md` — common ARIA patterns (tabs, modals, menus, accordions).
- `references/screen-reader-testing.md` — testing with VoiceOver, NVDA, and JAWS.
