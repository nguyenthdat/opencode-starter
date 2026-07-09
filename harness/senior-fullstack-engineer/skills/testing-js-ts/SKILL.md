---
name: testing-js-ts
description: "Testing JavaScript/TypeScript: Vitest, Playwright, Testing Library, component testing, integration tests, e2e, test fixtures, mocking strategies, CI gates. Use for test strategy and implementation."
compatibility: opencode
metadata:
  domain: testing
  audience: senior-engineer
---

# Testing JavaScript/TypeScript

Guide for designing and implementing test strategies for JS/TS applications.

## When to apply

- Designing test strategy for new or existing projects.
- Writing unit, integration, component, or e2e tests.
- Reviewing test coverage and identifying gaps.
- Configuring CI test pipelines.

## Core principles

### 1. Test pyramid

```
    /\
   /E2E\        Playwright — critical user flows only
  /------\
 /Integ.  \     Supertest, framework-native — API + DB integration
/----------\
/  Component  \  Testing Library — components from user perspective
/--------------\
/    Unit        \  Vitest — pure logic, utilities, services
/----------------\
```

### 2. Vitest (unit + component tests)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom', // or 'node', 'happy-dom'
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    },
  },
});
```

### 3. Unit tests

```typescript
import { describe, it, expect } from 'vitest';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });

  it('throws for invalid currency', () => {
    expect(() => formatCurrency(100, 'INVALID')).toThrow('Unknown currency');
  });

  it('handles zero', () => {
    expect(formatCurrency(0, 'EUR')).toBe('€0.00');
  });
});
```

Test behavior, not implementation. Don't test private functions. Don't mock internals.

### 4. Component tests (Testing Library)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('submits form with valid data', async () => {
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

  expect(onSubmit).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password123' });
});
```

- Query by role/text/label (accessible queries), not by test ID.
- Test from user perspective: what the user sees and does.
- Use `userEvent` over `fireEvent` for realistic interactions.

### 5. Integration tests

```typescript
import { describe, it, expect } from 'vitest';

describe('POST /api/users', () => {
  it('creates a user and returns 201', async () => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email: 'test@example.com' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe('Test');
  });

  it('returns 422 for invalid email', async () => {
    const res = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', email: 'invalid' }),
    });
    expect(res.status).toBe(422);
  });
});
```

### 6. E2E (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('user can complete checkout flow', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-test="add-to-cart"]');
  await page.click('[data-test="checkout"]');
  await page.fill('[name="email"]', 'test@example.com');
  await page.click('[data-test="submit-order"]');
  await expect(page.locator('[data-test="order-confirmed"]')).toBeVisible();
});
```

- One e2e test per critical user flow. Not one per page.
- Use `data-test` attributes for stable selectors.
- Use Playwright's auto-waiting. Avoid manual `waitForTimeout`.

### 7. Mocking boundaries

```typescript
// Mock at module boundary (API client)
vi.mock('@/lib/api', () => ({
  getUser: vi.fn().mockResolvedValue({ id: '1', name: 'Test' }),
}));

// Don't mock internal modules — test them through public API
```

### 8. CI test pipeline

```yaml
# .github/workflows/test.yml
- name: Type check
  run: bun run typecheck
- name: Lint
  run: bun run lint
- name: Unit + integration tests
  run: bun test --coverage
- name: E2E tests
  run: bunx playwright test
```

## Reference materials

- `references/testing-patterns.md` — test patterns for async, forms, API, components.
- `references/playwright-guide.md` — Playwright setup, selectors, and CI integration.
