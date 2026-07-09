---
name: ui-component-design
description: "UI component design: component API, props/events contracts, composition patterns, design system tokens, responsive design, loading/error/empty states, Storybook, reusability. Use for UI component creation and review."
compatibility: opencode
metadata:
  domain: ui-components
  audience: senior-engineer
---

# UI Component Design

Guide for designing reusable, accessible, and maintainable UI components.

## When to apply

- Designing new UI components or component libraries.
- Reviewing existing components for API quality and reusability.
- Establishing design system patterns and component architecture.
- Writing Storybook stories for components.

## Core principles

### 1. Component API design

Every component must define:
- **Props**: configuration (data, variants, behavior flags).
- **Events/Callbacks**: notifications to parent (onChange, onSubmit, onClose).
- **Slots/Children**: composable content areas.

```typescript
// Component API example
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}
```

### 2. State coverage

Every component MUST handle all states:

| State | Description | Example |
|---|---|---|
| Default | Normal rendering | Button with text |
| Loading | Async operation in progress | Spinner, skeleton, disabled state |
| Error | Operation failed | Error message with retry action |
| Empty | No data to display | Empty state with CTA |
| Disabled | Interaction blocked | Grayed out, cursor not-allowed |
| Focus | Keyboard focus | Focus ring, outline |
| Active/Pressed | User interacting | Visual feedback on press |
| Hover | Mouse over | Visual affordance |

### 3. Composition over configuration

```tsx
// GOOD — composition
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer><Button>Action</Button></Card.Footer>
</Card>

// BAD — configuration
<Card
  title="Title"
  content="Content"
  footerAction="Action"
  onFooterAction={handleAction}
/>
```

### 4. Design tokens

Use CSS custom properties for consistent theming:

```css
:root {
  --color-primary: #2563eb;
  --color-text: #1e293b;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --radius-md: 0.5rem;
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
}
```

### 5. Responsive design

- Mobile-first: design for small screens first, add complexity at breakpoints.
- Use CSS logical properties: `padding-inline`, `margin-block`, `inset-inline`.
- Breakpoints: 320px (small phone), 768px (tablet), 1024px (desktop), 1440px (large).
- Avoid fixed widths. Use `max-width`, `min()`, `clamp()`.
- Test touch targets: minimum 44x44px. Adequate spacing between interactive elements.

### 6. Storybook

Every reusable component gets a Storybook story:

```typescript
export default {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export const Primary = { args: { variant: 'primary', children: 'Click me' } };
export const Loading = { args: { variant: 'primary', loading: true, children: 'Saving' } };
export const Disabled = { args: { variant: 'primary', disabled: true, children: 'Disabled' } };
```

### 7. Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Mega-component with 20+ props | Split into composable sub-components |
| Conditional rendering of whole component | Use variant props or composition |
| Inline styles | CSS modules, Tailwind, or design tokens |
| Hardcoded strings | i18n keys or children props |
| `any` props | Explicit prop types |
| Missing loading/empty/error states | Add all states |

## Reference materials

- `references/component-states-checklist.md` — checklist for every component state.
- `references/design-tokens-guide.md` — design token naming and organization.
- `references/storybook-best-practices.md` — story patterns and addon recommendations.
