@AGENTS.md

# tender-chat-v1

A rebuild of `../tender-chat` (the tender quotation editor) by the owner, with **manual email/password auth (access + refresh tokens)**, a **class-based backend** and a **function-based frontend**. Build order and auth design: `basic-structor.md`. Product scope and decisions: `../tender-chat/PROJECT-PLAN.md`.

## Owner rules

- The owner is learning by building. Plan first for bigger features and wait for "go". Explain the why in the chat reply.
- Every change gets a CHANGELOG entry in the same turn: dated bullet under `## [Unreleased]`, grouped Added / Changed / Fixed / Removed, with the key files.
- Commit or push only when the owner asks.
- Don't add field validation or features the owner didn't ask for.
- Read `../tender-chat` for behaviour, but never edit it. Its frontend style (functions) fits here; its backend doesn't: our backend uses classes.

## Workflow (spec-driven, for every major feature)

1. `/spec-create <feature>` writes `.claude/specs/NN-<slug>.md`: what and why, in simple words.
2. `/plan-create NN` writes `.claude/plans/NN-<slug>.md`: classes, files, order, plain-English steps. Wait for "go".
3. Build it: the owner writes it by hand, step by step with Claude, or `/execute-plan NN`.
4. `/check-feature NN` runs the `feature-checker` agent: it writes missing tests, runs the checks, reviews code-style rules, auth security and edge cases, and saves a report in `.claude/reports/`. It never changes app code.
5. `/git-push` commits and pushes once the owner is happy.

- The agreed spec is the contract. If the plan turns out wrong while coding, stop, show the owner the change and why, and wait for a yes; then change the spec, then the plan, then the code.
- Small changes need no spec: a CHANGELOG entry only. Name the spec number in CHANGELOG entries for spec work.
- Write `.claude/skills/<feature>/SKILL.md` only when a feature is finished (the first will be `auth`). Update existing skills rather than adding new ones.
- The reference project's specs and plans (`../tender-chat/.claude/specs/`, `plans/`) show expected behaviour per feature. Its auth (Google, better-auth) and function-based backend don't apply here.

## Code style

**Backend: classes, but few of them.**

- Layers: `src/app/api/**/route.ts` → controller class → service class → repository class. A route only gets the controller from the container and calls one method; a service never sees `Request`/`Response`; a repository only runs queries.
- Make a class only for a real piece of work with its own dependencies: `Database`, repositories, services, controllers. One class covers one whole job (e.g. `AuthService` does signup, login, refresh and logout), not one class per small step.
- A constructor takes **at most 3** dependencies. If a class needs more, the split is wrong; rethink it.
- Small stateless helpers (env config, password hashing, JWT signing, cookies, reading the request body, rate-limit setup, error-to-response mapping) are plain exported functions in `src/backend/lib/`, not classes.
- One class per file, named after the file (`auth.service.ts` → `AuthService`).
- Repositories take `Database`; services take repositories (and at most one other service or a limiter). Wire them in one place, `src/backend/container.ts`, so tests can pass fakes.
- Errors are `AppError` subclasses (`NotFoundError`, `UnauthorizedError`, `ValidationError`, `ConflictError`, `TooManyRequestsError`), one file each in `src/backend/errors/`. `toErrorResponse()` is the one place that maps them to HTTP responses (`{ error: { message, code } }`); anything else becomes a 500.
- Types are plain `interface`s with named fields. No nested `Pick`/`Omit` tricks.
- `route.ts` may only export HTTP handlers and route segment config. Zod schemas shared by forms and routes go in `src/contracts/`.

**Frontend: functions only.**

- No classes in `src/frontend/` or `src/app/` pages: components are function components, and logic is plain functions and hooks (`apiRequest()`, `authApi.login()`, `fieldErrors()`). The one exception is `ApiError extends Error`, so `instanceof` works in `catch`.

## Auth rules (never break)

- Tokens live only in httpOnly cookies, never in `localStorage` or a response body the client keeps.
- Both tokens are JWTs signed with `jose`, each with its own secret: access 15 minutes, refresh 30 days. The refresh JWT carries a unique id (`jti`) and its family; only a SHA-256 hash is stored, in `refresh_tokens`, so it can be revoked.
- Refresh rotates the token in one transaction. Reusing an already-revoked token revokes its whole `familyId`.
- `src/proxy.ts` (Next 16's name for middleware) does an optimistic JWT check only, with no DB call. Real checks happen in services through `getCurrentUser()` / `requireUser()`.
- The access cookie uses path `/`; the refresh cookie uses path `/api/auth`, so only the auth routes ever see it.
- Every query is filtered by the signed-in user. Another user's row answers **404**, never 403.
- Login errors never reveal whether the email exists. Login and register are rate-limited.
- One email, one sign-in method (password, Google or GitHub). OAuth sign-in with an email that already has an account is refused, not linked.

## Run it

```sh
pnpm dev   # http://localhost:3000
```

No Docker. Local and production both use cloud services, so the code is the same everywhere:

- **Postgres: Neon.** Use separate Neon branches for dev and prod (for example `dev` and `main`). Use the pooled connection string with `?sslmode=require`.
- **Redis: Upstash** (REST API, `@upstash/redis` + `@upstash/ratelimit`), used for rate limiting. The free tier allows one database, so dev and prod share it: every key gets a prefix from `REDIS_KEY_PREFIX` (`dev:` or `prod:`).
- **Deploy: Vercel.** Set the same env keys in the Vercel project settings, with the prod Neon branch and `REDIS_KEY_PREFIX=prod:`. Run migrations from your machine, not in the Vercel build.

Secrets go in `.env` (git-ignored). `.env.example` lists the keys.

## Folders

App code lives in `src/`, and `@/*` points to `./src/*`. (Plan 01 step 1 moves the starter `app/`, `components/`, `lib/` and `db/` there and updates `tsconfig.json` and `components.json`.)

```
src/app/                Next pages and api/**/route.ts (fixed name)
src/proxy.ts            optimistic auth redirect (fixed name)
src/backend/lib/        plain helper functions: config, password, tokens, cookies, request, rate-limit
src/backend/database/   Database class (pg pool + Drizzle), schema, migrations
src/backend/errors/     AppError family + toErrorResponse()
src/backend/<area>/     <Area>Repository, <Area>Service, <Area>Controller classes (users/, auth/, oauth/)
src/backend/container.ts  builds every backend object once
src/contracts/          zod schemas shared by forms and routes
src/frontend/api/       apiRequest(), authApi functions, ApiError
src/frontend/<area>/    feature components (auth/, layout/, forms/)
src/frontend/ui/        shadcn parts
tests/                  unit/ and integration/ (project root, not src/)
```

Config files (`drizzle.config.ts`, `next.config.ts`, `eslint.config.mjs`) stay at the root.

## Gotchas

- Next.js 16: read `node_modules/next/dist/docs/` before using an API you're unsure of. `middleware.ts` is now `proxy.ts`, and `cookies()`/`headers()` are async.
- `drizzle-orm` is `1.0.0-rc.5` (release candidate); its API can differ from the stable 0.45 used in `../tender-chat`. Check its docs, not memory.
- Change the schema, then generate and run a migration. Never edit generated migration files by hand.
- PowerShell treats `[id]` in paths as a wildcard. Use Bash or `-LiteralPath`.
- shadcn adds components using the `components.json` aliases. Keep them pointing to `src/frontend/ui/` after the move, or new parts land in the wrong folder.
