---
name: js-ts-documentation
description: "JS/TS documentation: JSDoc, TSDoc, TypeDoc, README, API reference, architecture decision records (ADRs), changelog (Keep a Changelog), inline code documentation. Use for documentation creation and review."
compatibility: opencode
metadata:
  domain: documentation
  audience: senior-engineer
---

# JavaScript/TypeScript Documentation

Guide for writing and maintaining high-quality documentation for JS/TS projects.

## When to apply

- Writing JSDoc/TSDoc comments for public API.
- Creating or updating README files.
- Generating API reference documentation.
- Writing architecture decision records (ADRs).
- Maintaining changelogs.

## Core principles

### 1. JSDoc/TSDoc for public API

```typescript
/**
 * Fetches a user by their unique identifier.
 *
 * @param id - The user's UUID.
 * @returns The user object, or `null` if not found.
 * @throws {ValidationError} If the id is not a valid UUID.
 *
 * @example
 * ```ts
 * const user = await getUserById('550e8400-e29b-41d4-a716-446655440000');
 * console.log(user?.name);
 * ```
 */
export async function getUserById(id: string): Promise<User | null> {
  if (!isUUID(id)) throw new ValidationError('Invalid user ID');
  return db.user.findUnique({ where: { id } });
}
```

Every public export must have:
- `@param` for each parameter.
- `@returns` for return value.
- `@throws` for thrown errors.
- `@example` for at least one usage example.

### 2. TypeScript types documentation

```typescript
/**
 * Represents the result of an API operation.
 *
 * @typeParam T - The type of the successful data payload.
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

/**
 * Configuration options for creating a new API client.
 */
export interface ClientConfig {
  /** Base URL of the API (e.g., 'https://api.example.com'). */
  apiUrl: string;
  /** API key for authentication. */
  apiKey: string;
  /** Request timeout in milliseconds. Defaults to 30000 (30 seconds). */
  timeout?: number;
}
```

### 3. README structure

```markdown
# Project Name

Brief description (1-2 sentences).

## Quick Start

```bash
bun install
bun run dev
```

## Features
- Feature 1
- Feature 2

## API Reference
[Link to full API docs](https://docs.example.com)

## Configuration
| Variable | Description | Default |
|---|---|---|
| `API_URL` | API base URL | `http://localhost:3000` |

## Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License
MIT
```

### 4. Architecture Decision Records (ADRs)

```markdown
# ADR-001: Use Hono for API Framework

**Date:** 2026-07-09
**Status:** Accepted

## Context
We need to choose an API framework for the backend service. Options considered: Hono, Express, Fastify.

## Decision
Use Hono because:
- Runtime-agnostic (Bun, Node, Deno, Edge).
- Standard Web API based.
- Lightweight and fast.
- First-class TypeScript support.

## Consequences
- Team needs to learn Hono patterns.
- Middleware ecosystem smaller than Express.
- Migration path from Express is straightforward due to similar API.
```

Store ADRs in `docs/adr/` or `docs/decisions/`.

### 5. Changelog (Keep a Changelog format)

```markdown
# Changelog

## [1.1.0] - 2026-07-09

### Added
- `getUserPosts()` function to fetch user's posts.
- Support for cursor-based pagination.

### Changed
- `createUser()` now returns the created user with `id`.

### Deprecated
- `getUsers()` in favor of `listUsers()`.

### Fixed
- Error when `email` field contains special characters.

## [1.0.0] - 2026-06-01

### Added
- Initial release with user CRUD operations.
```

### 6. API documentation generation

```bash
# TypeDoc — generate HTML docs from TSDoc comments
bunx typedoc --out docs/api src/index.ts

# documentation.js — generate Markdown
bunx documentation build src/** -f md -o docs/api.md
```

### 7. Storybook for component documentation

```typescript
// Button.stories.ts
export default {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],  // Auto-generate docs page
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};
```

### 8. Documentation quality checklist

- [ ] All public exports have JSDoc/TSDoc comments.
- [ ] README includes quick start that works after `bun install`.
- [ ] API reference covers all endpoints/routes.
- [ ] ADRs exist for major architecture decisions.
- [ ] Changelog follows Keep a Changelog format.
- [ ] No broken links in documentation.
- [ ] Code examples in documentation are tested or marked as untested.

## Reference materials

- `references/jsdoc-tsdoc-guide.md` — comprehensive JSDoc/TSDoc tag reference.
- `references/adr-template.md` — architecture decision record template.
