# tender-chat-v1: basic structure and build order

Goal: rebuild `../tender-chat` myself, with a **manual auth system (access + refresh tokens)** a **class-based backend** (few classes, max 3 constructor deps, helpers as functions) and a **function-based frontend**. Where this file and `CLAUDE.md` disagree, `CLAUDE.md` and the plans win.

Current state (2026-11-25): Next 16.4, Drizzle, `pg`. `db/schema.ts` is empty.

Infrastructure (no Docker; local and production use the same services, so the code never changes):

- **Postgres: Neon.** A `dev` branch for local work, `main` for production. Pooled URL with `?sslmode=require`.
- **Redis: Upstash** (free: 500K commands/month, 256 MB, one database). Dev and prod share it with key prefixes `dev:` / `prod:`.
- **Deploy: Vercel.** Same env keys in the Vercel project settings.

## Phase 0: Foundation

1. **Read the Next 16 docs first.** Two things changed from older tutorials:
   - `middleware.ts` is now **`proxy.ts`**.
   - `cookies()` is **async**.

   Read `node_modules/next/dist/docs/01-app/02-guides/authentication.md` and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
2. **Folder layout, class-based backend** (at the project root, no `src/`, because `@/*` points to `./*`):
   ```
   server/        db.ts, env.ts, errors.ts (AppError, NotFoundError...), http.ts, container.ts
   repositories/  UserRepository, RefreshTokenRepository, TenderRepository...
   services/      AuthService, TokenService, PasswordService, TenderService...
   controllers/   thin classes the route handlers call
   app/api/...    route.ts files that only parse the request -> controller -> response
   ```
   The rule: a route never touches the database, a service never touches `Request`/`Response`, and a repository only runs queries.
3. **`env.ts`:** validate `DATABASE_URL`, `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` at startup with `zod`. Generate each secret with `openssl rand -base64 64`.
4. **One `Database` singleton class** that wraps a `pg` Pool and Drizzle, so hot reload in dev doesn't open a new pool every time.

## Phase 1: Auth schema

5. Write these tables in `db/schema.ts`, then run `drizzle-kit generate` and `migrate`:
   - **`users`:** id (uuid), email (unique, lowercase), passwordHash, name, createdAt
   - **`refresh_tokens`:** id, userId, **tokenHash**, familyId, expiresAt, revokedAt, replacedById, userAgent, ip, createdAt

   Only ever store the **hash** of a refresh token (SHA-256 is fine), never the token itself.

## Phase 2: Auth core classes

6. **`PasswordService`:** `hash()` and `verify()` using `argon2`, or `bcryptjs` if argon2 won't build on Windows.
7. **`TokenService`:** use the `jose` library, because it also works inside `proxy.ts`.
   - `signAccess(userId)`: a JWT that lasts 15 min, with payload `{ sub, type: "access" }`
   - `verifyAccess(token)`
   - `createRefresh()`: a random 32-byte opaque string (not a JWT), plus its hash
8. **`AuthService`:**
   - `register`
   - `login`: verify the password, create a refresh row, return both tokens
   - `refresh`: see step 9
   - `logout`: revoke the token
   - `logoutAll`
9. **Refresh token rotation.** On every refresh:
   1. Look up the token by its hash. Reject it if it's missing, expired or revoked.
   2. **If it was already revoked, someone reused it:** revoke the whole `familyId`, which logs out every device in that chain.
   3. Otherwise revoke it, insert a new token in the same family, and issue a new access token.
   4. Do all of this in **one DB transaction**.
10. **`CookieService`:** set the two cookies.
    - **`access_token`:** `httpOnly`, `secure` in prod, `sameSite: "lax"`, `path: "/"`, maxAge 15 min
    - **`refresh_token`:** `httpOnly`, `secure`, `sameSite: "strict"`, **`path: "/api/auth"`** (so it's only sent to auth routes), maxAge 7-30 days

## Phase 3: Auth routes and pages

11. Add `app/api/auth/{register,login,refresh,logout}/route.ts`. Validate every body with zod, and return the same "invalid email or password" message whether the email or the password was wrong.
12. **Rate-limit login and register** with a `createLimiter()` function over `@upstash/ratelimit`, keyed by IP and email, with the `REDIS_KEY_PREFIX` prefix. An in-memory map doesn't work on Vercel, because each function instance has its own memory.
13. Build the `(auth)/login` and `(auth)/register` pages with forms that post to those routes.

## Phase 4: Protecting things

14. **`proxy.ts`** does an *optimistic* check only. It verifies the access JWT with `jose`, with no DB call.
    - If the token is valid, let the request through.
    - If it's expired and a refresh cookie exists, redirect to `/api/auth/refresh?next=<url>`. That route rotates the tokens and redirects back.
    - Otherwise, redirect to `/login`.
15. **Session check in the data layer:** a `getCurrentUser()` helper, wrapped in `cache()`, that reads the access cookie, verifies it, and loads the user. **Every** service method that touches data calls it. Proxy alone is not security (the Next docs say this explicitly).
16. **Client fetch wrapper:** an `apiRequest()` function (frontend has no classes). On a 401 it calls `/api/auth/refresh` once, then retries the original request. Use a shared promise so 5 parallel requests don't trigger 5 refreshes.

**Checkpoint:** before moving on, write tests for login, refresh, reusing an old refresh token (which must kill the family), logout and an expired access token.

## Phase 5: Build the actual app

Rebuild these features in the same order as the rounds in `../tender-chat/PROJECT-PLAN.md`, using the new auth:

17. **Companies:** CRUD, plus letterhead/seal upload
18. **Templates:** HTML upload, with placeholders parsed from `{{...}}`
19. **Tenders:** sidebar, list, search, create
20. **The editor screen:** form on the left, live A4 preview on the right
21. **PDF generation:** Chrome via Playwright, with the embedded fonts
22. **Invoices:** the same template table with a `kind` field, and bank details filled from the company

For each feature, follow the same rhythm: schema, then repository class, then service class (with an ownership check that returns **404, not 403**), then route, then UI, then tests. Read the reference's version of a feature (for example `../tender-chat/src/services/tender.service.ts`) to see the behaviour, then write your own.

## Packages to add

`jose`, `argon2` (or `bcryptjs`), `zod`, `@upstash/redis`, `@upstash/ratelimit`, `vitest`

Keep the `pg` Pool small (`max: 1-3`) with Neon's pooled URL, because serverless functions open many short connections.

## Fix early

This project uses `drizzle-orm 1.0.0-rc.5`, a release candidate, while the reference uses the stable `0.45`. Either pin the RC and accept that its APIs may differ, or switch to `0.45` so the reference code reads the same as yours.
