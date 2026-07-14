---
name: api-design
description: "API design patterns: REST, tRPC, validation schemas, error response format, HTTP status codes, pagination, versioning, OpenAPI, backward compatibility. Use for API contract design and review."
compatibility: opencode
metadata:
  domain: api-design
  audience: senior-engineer
---

# API Design

Guide for designing and reviewing API contracts in JavaScript/TypeScript applications.

## When to apply

- Designing new REST or tRPC APIs.
- Reviewing API contracts for correctness and consistency.
- Setting up validation, error handling, and pagination.
- Documenting APIs with OpenAPI.
- Planning API versioning strategy.

## Core principles

### 1. REST conventions

```
GET    /api/users          # List users (paginated)
GET    /api/users/:id      # Get user by ID
POST   /api/users          # Create user
PUT    /api/users/:id      # Replace user (full update)
PATCH  /api/users/:id      # Update user (partial update)
DELETE /api/users/:id      # Delete user
```

### 2. HTTP status codes

| Code | Meaning | When to use |
|---|---|---|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation error, malformed input |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource state conflict (duplicate) |
| 422 | Unprocessable Entity | Semantic validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

### 3. Consistent error format

```typescript
type ApiErrorResponse = {
  error: {
    code: string;          // Machine-readable error code
    message: string;       // Human-readable message
    details?: Record<string, string[]>; // Field-level validation errors
  };
};
```

### 4. Validation at every boundary

```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).default('user'),
});

// Hono
app.post('/api/users', zValidator('json', CreateUserSchema), async (c) => {
  const data = c.req.valid('json'); // typed and validated
  ...
});

// Express/Fastify
app.post('/api/users', async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: result.error.flatten().fieldErrors },
    });
  }
  ...
});
```

### 5. Pagination

Prefer cursor-based pagination:

```typescript
type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};
```

For simple cases, offset-based is acceptable:

```typescript
type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};
```

### 6. tRPC patterns

```typescript
const appRouter = router({
  user: router({
    list: publicProcedure
      .input(z.object({ page: z.number().min(1).default(1) }))
      .query(async ({ input }) => {
        const users = await db.user.findMany({ skip: (input.page - 1) * 10, take: 10 });
        return { data: users, nextCursor: users.length === 10 ? String(input.page + 1) : null };
      }),
    byId: publicProcedure.input(z.string().uuid()).query(async ({ input }) => {
      return db.user.findUnique({ where: { id: input } });
    }),
    create: publicProcedure.input(CreateUserSchema).mutation(async ({ input }) => {
      return db.user.create({ data: input });
    }),
  }),
});
```

### 7. Versioning

- URL-based: `/api/v1/users`, `/api/v2/users`.
- Header-based: `Accept: application/vnd.api+json;version=1`.
- Document the strategy in API docs.
- Deprecate before removing: `Deprecation: true` header or `Sunset` header.

### 8. Rate limiting headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000
Retry-After: 60
```

## Reference materials

- `references/rest-api-checklist.md` — comprehensive endpoint design checklist.
- `references/trpc-patterns.md` — tRPC patterns for complex applications.
