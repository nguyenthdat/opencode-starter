---
name: web-security
description: "Web security: OWASP Top 10, XSS prevention, CSRF protection, CSP headers, authentication audit, input validation, dependency scanning, secrets detection, CORS, rate limiting. Use for JS/TS security audits."
compatibility: opencode
metadata:
  domain: security
  audience: senior-engineer
---

# Web Security

Guide for auditing and securing JavaScript/TypeScript web applications against OWASP Top 10 and common vulnerabilities.

## When to apply

- Auditing code for security vulnerabilities.
- Reviewing authentication and authorization implementation.
- Configuring Content Security Policy headers.
- Scanning dependencies for known vulnerabilities.
- Setting up secure defaults for new projects.

## Core principles

### 1. XSS (Cross-Site Scripting) prevention

```typescript
// DANGEROUS — never do this
element.innerHTML = userInput;
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// SAFE — framework auto-escapes by default
<div>{userInput}</div>              // React, Svelte, Vue, SolidJS auto-escape
<p>{{ userInput }}</p>             // Vue auto-escapes

// SAFE — use DOMPurify when you must render HTML
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

### 2. CSRF (Cross-Site Request Forgery) protection

- Use SameSite cookies: `SameSite=Strict` or `SameSite=Lax`.
- State-changing operations require CSRF token.
- Next.js Server Actions include CSRF protection automatically.
- SvelteKit form actions use CSRF tokens by default.

### 3. Content Security Policy (CSP)

```typescript
// Next.js
const nextConfig = {
  headers: async () => [{
    source: '/(.*)',
    headers: [{
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'", // only for CSS-in-JS
        "img-src 'self' https: data:",
        "font-src 'self'",
        "connect-src 'self' https://api.example.com",
      ].join('; '),
    }],
  }],
};
```

Never use `unsafe-inline` for scripts. Never use `unsafe-eval` without justification.

### 4. Authentication

```typescript
// JWT validation
import { jwtVerify } from 'jose';

async function validateToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
      issuer: 'my-app',
      audience: 'my-app',
    });
    return payload;
  } catch {
    return null; // Token invalid or expired
  }
}
```

- Hash passwords with `Bun.password.hash()` (Bun) or `argon2` (Node). Never use MD5/SHA1.
- Short-lived access tokens (15 min). Long-lived refresh tokens with rotation.
- Rate limit auth endpoints. Lock accounts after N failed attempts.

### 5. Dependency scanning

```bash
bun audit
# or
npm audit
```

- Run on every CI build. Fail on HIGH/CRITICAL vulnerabilities.
- Review new dependencies before adding. Check: maintenance, download count, vulnerability history.
- Use `overrides` or `resolutions` for transitive dependency fixes.

### 6. Secrets detection

- NEVER hardcode API keys, tokens, or passwords in source code.
- Use environment variables. Validate them at startup.
- Add `.env` to `.gitignore`.
- Scan codebase with `bunx secretlint` or `git-secrets`.

### 7. CORS

```typescript
// Correct CORS for credentials
app.use(cors({
  origin: 'https://example.com',    // explicit origin, not '*'
  credentials: true,                 // allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

Never use `Access-Control-Allow-Origin: *` with `credentials: true`.

### 8. Rate limiting

```typescript
// Hono rate limiter
import { rateLimiter } from '@hono/rate-limiter';

app.use('/api/*', rateLimiter({
  windowMs: 60 * 1000,   // 1 minute
  max: 100,               // 100 requests per minute
}));
```

Apply rate limiting to: auth endpoints, API routes, form submissions, password reset.

### 9. HTTP security headers

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Reference materials

- `references/owasp-checklist.md` — OWASP Top 10 checklist for JS/TS apps.
- `references/authentication-patterns.md` — JWT, session, OAuth2 implementation patterns.
- `references/dependency-audit-guide.md` — supply chain security best practices.
