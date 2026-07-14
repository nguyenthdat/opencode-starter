---
name: backend-node-bun
description: "Backend development with Node.js and Bun: Hono, Elysia, Express/Fastify, REST APIs, tRPC, WebSocket, SSE, authentication, database integration, background jobs. Use for backend service development."
compatibility: opencode
metadata:
  domain: backend
  audience: senior-engineer
---

# Backend Development with Node.js and Bun

Guide for building production-grade backend services with Node.js and Bun runtimes.

## When to apply

- Creating REST or tRPC APIs.
- Building WebSocket or SSE endpoints.
- Implementing authentication and authorization.
- Integrating with databases (SQL, NoSQL).
- Setting up background job processing.
- Reviewing backend architecture and security.

## Core principles

### 1. Framework selection

| Framework | Runtime | Best for | When to use |
|---|---|---|---|
| Hono | Bun, Node, Deno, Edge | APIs, middleware-heavy apps | New projects, multi-runtime needs |
| Elysia | Bun | High-performance APIs | Bun-native projects, max performance |
| Express | Node, Bun | Legacy, large ecosystem | Existing Express projects |
| Fastify | Node, Bun | High-throughput APIs | Node projects needing speed |

For new projects: prefer Hono (Bun/Node/Edge compatible) or Elysia (Bun-native).

### 2. API design

```typescript
// REST endpoint example (Hono)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

app.get('/api/users/:id', async (c) => {
  const id = c.req.param('id');
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  return c.json({ data: user });
});

app.post('/api/users', zValidator('json', CreateUserSchema), async (c) => {
  const data = c.req.valid('json');
  const user = await db.user.create({ data });
  return c.json({ data: user }, 201);
});
```

### 3. tRPC

Use tRPC when both client and server are TypeScript:

```typescript
const appRouter = router({
  user: router({
    byId: publicProcedure.input(z.string().uuid()).query(async ({ input }) => {
      return db.user.findUnique({ where: { id: input } });
    }),
    create: publicProcedure.input(CreateUserSchema).mutation(async ({ input }) => {
      return db.user.create({ data: input });
    }),
  }),
});
```

### 4. Validation

- Every input boundary MUST validate: headers, query params, path params, body.
- Use Zod or Valibot schemas. Co-locate schemas with route handlers.
- Return field-level validation errors with path indicators.
- Never trust client-side validation alone.

### 5. Authentication

- JWT: for stateless APIs. Use short-lived access tokens + refresh tokens.
- Sessions: for server-rendered apps. Use secure, httpOnly, SameSite cookies.
- Password hashing: `Bun.password.hash()` (Bun) or `argon2` (Node).
- Rate limiting: apply to all auth endpoints. Use `@hono/rate-limiter` or similar.
- CSRF: SameSite=Strict/Lax cookies, CSRF tokens for state-changing operations.

### 6. Database integration

- ORM/Query builder: Drizzle ORM (type-safe, lightweight), Prisma (full-featured), Kysely (query builder).
- Connection pooling: configure properly for production load.
- Migrations: versioned, repeatable. Run as part of deployment.
- Never use raw string interpolation for SQL. Always parameterized queries.

### 7. Error handling

```typescript
// Structured error response
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
};

// HTTP status codes
// 200 OK, 201 Created, 204 No Content
// 400 Bad Request (validation), 401 Unauthorized, 403 Forbidden, 404 Not Found
// 409 Conflict, 422 Unprocessable Entity, 429 Too Many Requests
// 500 Internal Server Error
```

### 8. Logging

- Use structured logging: `pino` or `winston`.
- Include correlation ID per request.
- Log: request method + path, status code, duration, correlation ID.
- Never log: passwords, tokens, PII.

### 9. WebSocket / SSE

- WebSocket: for bidirectional real-time (chat, collaboration).
- SSE: for server-to-client streaming (notifications, progress).
- Handle reconnection with exponential backoff.
- Authenticate on connection. Validate every message.
- Backpressure: handle slow consumers.

## Reference materials

- `references/rest-api-checklist.md` — endpoint design checklist.
- `references/auth-patterns.md` — JWT, session, OAuth2 patterns.
- `references/database-patterns.md` — Drizzle, Prisma, Kysely patterns.
