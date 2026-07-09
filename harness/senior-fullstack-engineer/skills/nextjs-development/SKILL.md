---
name: nextjs-development
description: "Next.js development: App Router, React Server Components, Server Actions, ISR, middleware, route handlers, image optimization, metadata API, caching. Use for Next.js app development."
compatibility: opencode
metadata:
  domain: nextjs
  audience: senior-engineer
---

# Next.js Development

Guide for building production-grade Next.js applications with the App Router.

## When to apply

- Building Next.js applications with App Router.
- Implementing data fetching, routing, or rendering strategies.
- Reviewing Next.js code for patterns and performance.
- Setting up middleware, ISR, or API route handlers.

## Core principles

### 1. App Router structure

```
app/
├── layout.tsx           # Root layout (required)
├── page.tsx             # Home page
├── loading.tsx          # Loading UI (Suspense boundary)
├── error.tsx            # Error boundary
├── not-found.tsx        # 404 page
├── global-error.tsx     # Root error boundary
├── api/
│   └── users/
│       └── route.ts     # API route handler
├── dashboard/
│   ├── layout.tsx       # Dashboard layout
│   ├── page.tsx         # /dashboard
│   ├── [id]/
│   │   └── page.tsx     # /dashboard/:id
│   └── loading.tsx
```

### 2. Server Components (default)

```tsx
// app/users/page.tsx — Server Component (no 'use client')
export default async function UsersPage() {
  const users = await db.user.findMany();
  return (
    <ul>
      {users.map(u => <li key={u.id}>{u.name}</li>)}
    </ul>
  );
}
```

Server Components can:
- Be async functions.
- Access databases, file systems, and backend services directly.
- Pass data as props to Client Components.

### 3. Server Actions

```tsx
// app/actions.ts
'use server';
import { revalidatePath } from 'next/cache';

export async function createUser(formData: FormData) {
  const name = formData.get('name');
  await db.user.create({ data: { name } });
  revalidatePath('/users');
}

// app/users/page.tsx
import { createUser } from './actions';

export default function UsersPage() {
  return (
    <form action={createUser}>
      <input name="name" required />
      <SubmitButton /> {/* uses useFormStatus() */}
    </form>
  );
}
```

### 4. Data fetching with caching

```tsx
// Cached (default) — revalidates with revalidate option
const data = await fetch('https://api.example.com', {
  next: { revalidate: 3600 }, // ISR: revalidate every hour
});

// Static — never revalidates
const data = await fetch('https://api.example.com', {
  cache: 'force-cache',
});

// Dynamic — always fresh
const data = await fetch('https://api.example.com', {
  cache: 'no-store',
});

// On-demand revalidation
revalidatePath('/posts');
revalidateTag('posts');
```

### 5. Route handlers

```tsx
// app/api/users/route.ts
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = searchParams.get('page') ?? '1';
  const users = await db.user.findMany({ skip: (Number(page) - 1) * 10, take: 10 });
  return Response.json({ data: users });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const validated = CreateUserSchema.parse(body);
  const user = await db.user.create({ data: validated });
  return Response.json({ data: user }, { status: 201 });
}
```

### 6. Middleware

```tsx
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token');
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: '/dashboard/:path*',
};
```

### 7. Image optimization

```tsx
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={630}
  priority           // Above-fold image (LCP)
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

### 8. Metadata API

```tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.slug);
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { images: [post.coverImage] },
  };
}
```

## Reference materials

- `references/nextjs-caching-guide.md` — caching strategies and revalidation.
- `references/server-actions-patterns.md` — form patterns, optimistic updates, error handling.
