@AGENTS.md

# tender-chat-v1

A rebuild of `../tender-chat` (the tender quotation editor) by the owner, with **manual email/password auth (access + refresh tokens)** and **OOP (class-based) code**. Build order and auth design: `basic-structor.md`. Product scope and decisions: `../tender-chat/PROJECT-PLAN.md`.

## Owner rules

- The owner is learning by building. Plan first for bigger features and wait for "go". Explain the why in the chat reply.
- Every change gets a CHANGELOG entry in the same turn: dated bullet under `## [Unreleased]`, grouped Added / Changed / Fixed / Removed, with the key files.
- Commit or push only when the owner asks.
- Don't add field validation or features the owner didn't ask for.
- Read `../tender-chat` for behaviour, but never edit it. Don't copy its "function-based, no classes" rule: this project is OOP.

## Workflow (spec-driven, for every major feature)

1. `/spec-create <feature>` writes `.claude/specs/NN-<slug>.md`: what and why, in simple words.
2. `/plan-create NN` writes `.claude/plans/NN-<slug>.md`: classes, files, order, plain-English steps. Wait for "go".
3. Build it: the owner writes it by hand, step by step with Claude, or `/execute-plan NN`.
4. `/check-feature NN` runs the `feature-checker` agent: it writes missing tests, runs the checks, reviews OOP quality, auth security and edge cases, and saves a report in `.claude/reports/`. It never changes app code.
5. `/git-push` commits and pushes once the owner is happy.

- The agreed spec is the contract. If the plan turns out wrong while coding, stop, show the owner the change and why, and wait for a yes; then change the spec, then the plan, then the code.
- Small changes need no spec: a CHANGELOG entry only. Name the spec number in CHANGELOG entries for spec work.
- Write `.claude/skills/<feature>/SKILL.md` only when a feature is finished (the first will be `auth`). Update existing skills rather than adding new ones.
- The reference project's specs and plans (`../tender-chat/.claude/specs/`, `plans/`) show expected behaviour per feature. Its auth (Google, better-auth) and function-based style don't apply here.

## Code style (OOP)

- Backend layers: `app/api/**/route.ts` → controller class → service class → repository class. A route only parses the request and returns a response; a service never sees `Request`/`Response`; a repository only runs queries.
- One class per file, named after the file (`auth.service.ts` → `AuthService`).
- Dependencies come in through the constructor (repositories take the database; services take repositories). Wire them in one place, `server/container.ts`, so tests can pass fakes.
- Errors are `AppError` subclasses (`NotFoundError`, `UnauthorizedError`, `ValidationError`) in `server/errors.ts`; one helper maps them to HTTP responses.
- Types are plain `interface`s with named fields. No nested `Pick`/`Omit` tricks.
- `route.ts` may only export HTTP handlers and route segment config. Shared zod schemas go in `shared/`.

## Auth rules (never break)

- Tokens live only in httpOnly cookies, never in `localStorage` or a response body the client keeps.
- The access token is a 15-minute JWT signed with `jose`. The refresh token is an opaque random string. Only its SHA-256 hash is stored, in `refresh_tokens`.
- Refresh rotates the token in one transaction. Reusing an already-revoked token revokes its whole `familyId`.
- `proxy.ts` (Next 16's name for middleware) does an optimistic JWT check only, with no DB call. Real checks happen in services through `getCurrentUser()`.
- Every query is filtered by the signed-in user. Another user's row answers **404**, never 403.
- Login errors never reveal whether the email exists. Login and register are rate-limited.

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

No `src/`: `@/*` points to the project root. `app/` (pages, `api/**/route.ts`), `components/`, `lib/`, `db/` (Drizzle schema), and later `server/`, `repositories/`, `services/`, `controllers/`, `shared/`, `tests/`.

## Gotchas

- Next.js 16: read `node_modules/next/dist/docs/` before using an API you're unsure of. `middleware.ts` is now `proxy.ts`, and `cookies()`/`headers()` are async.
- `drizzle-orm` is `1.0.0-rc.5` (release candidate); its API can differ from the stable 0.45 used in `../tender-chat`. Check its docs, not memory.
- Change the schema, then generate and run a migration. Never edit generated migration files by hand.
- PowerShell treats `[id]` in paths as a wildcard. Use Bash or `-LiteralPath`.
