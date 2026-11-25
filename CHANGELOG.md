# Changelog

## [Unreleased]

### Added

- 2026-11-25: Build plan for manual access/refresh-token auth and OOP layering (`basic-structor.md`).
- 2026-11-25: Claude setup: project rules in `CLAUDE.md` and permissions in `.claude/settings.json` (deny reading `.env`, deleting the DB volume, editing `../tender-chat`).
- 2026-11-25: `.env.example` listing the DB, JWT, token lifetime, Upstash Redis and app URL keys.
- 2026-11-25: Git repo initialised on `main`; first commit pushed to GitHub (`origin` = `ankit-bhardwaj-123/tender-chat-v1`).
- 2026-11-25: Claude workflow adapted from `../tender-chat` for OOP and manual token auth: `/spec-create`, `/plan-create`, `/execute-plan`, `/check-feature`, `/git-push` (`.claude/commands/`), the `feature-checker` agent (`.claude/agents/`), empty `specs/`, `plans/`, `reports/`, `skills/` folders, and a Workflow section in `CLAUDE.md`.

- 2026-11-25: Spec 01 Sign up and sign in (email, Google, GitHub) + sidebar, with sign out of all devices, JWT access and refresh tokens, sign-up limit of 5 accounts a day, and OAuth refused for an email already registered (.claude/specs/01-auth.md; auth rules in `CLAUDE.md` updated to match)
- 2026-11-25: Spec 01 decisions recorded (hidden GitHub email refused, OAuth users set a password in a later spec, empty sidebar, numbers confirmed); status set to planned (.claude/specs/01-auth.md)
- 2026-11-25: Plan 01 Sign up and sign in (email, Google, GitHub) + sidebar: `src/` layout with named folders, class list, routes, 19 build steps split backend/frontend (.claude/plans/01-auth.md)
- 2026-11-25: `verification-loop` skill: manual pre-PR gate (build, type check, lint, tests, secret/token-storage scan, diff + CHANGELOG review) with pnpm and PowerShell-safe `git grep` commands (`.claude/skills/verification-loop/SKILL.md`)
- 2026-11-25: Plan 01 Sign up and sign in (email, Google, GitHub) + sidebar, rewritten: 19 build steps, sliding 30-day login, `sessions_revoked_at` so "sign out of all devices" is instant, OAuth without a library; spec status set to planned (.claude/plans/01-auth.md, .claude/specs/01-auth.md)
- 2026-11-25: `backend-patterns` skill: Plan 01's class layers, Next 16 route handlers, Drizzle 1.0 RC queries and transactions, Upstash rate limiting, AppError mapping and the cookie-JWT flow (`.claude/skills/backend-patterns/SKILL.md`)
- 2026-11-25: `frontend-patterns` skill: Server/Client split under Cache Components, `loading.tsx`/`error.tsx` (`retry`), `ApiClient` cookie fetches with 401 refresh, controlled forms on `src/contracts` zod schemas, shadcn base-nova (Base UI) + Tailwind v4 (`.claude/skills/frontend-patterns/SKILL.md`)
- 2026-11-25: `postgres-patterns` skill: Drizzle 1.0 RC column types (uuid, timestamptz, numeric money), FK/composite/partial/GIN indexes, upsert, cursor pagination, drizzle-kit generate/migrate on Neon `dev` only, read-only diagnostics (`.claude/skills/postgres-patterns/SKILL.md`)

### Changed

- 2026-11-25: Plan 01 step 3 (spec 01): `signupSchema` and `loginSchema` with `SignupInput`/`LoginInput` interfaces; email trimmed + lowercased, password ≥ 8, confirm must match, empty name/email/password refused (`src/contracts/auth.contracts.ts`)
- 2026-11-25: CI can pass: Prettier added with `format`/`format:check` (code only; docs, lockfile, migrations and shadcn `ui/` ignored; `endOfLine: auto` for Windows), `test` runs `tests/unit` and new `test:integration` runs `tests/integration`; the integration job now writes this app's env keys (fresh JWT secrets, `REDIS_KEY_PREFIX=ci:`) instead of the reference project's file-store and Chrome steps; `@types/node` 20 → 24 to match Node 24 and vitest 5 (`package.json`, `.prettierrc.json`, `.prettierignore`, `.github/workflows/ci.yml`, `src/app/globals.css`, `src/frontend/lib/utils.ts`)

- 2026-11-25: Plan 01 step 2 (spec 01): added `jose`, `bcryptjs`, `zod`, `@upstash/redis`, `@upstash/ratelimit`, and `vitest` (dev); scripts `typecheck`, `test`, `db:generate`, `db:migrate`; new `drizzle.config.ts` (migrations in `src/backend/database/migrations`) and `vitest.config.ts` (`@` alias, `tests/**/*.test.ts`); OAuth keys in `.env.example` (`package.json`, `pnpm-lock.yaml`)

- 2026-11-25: Plan 01 step 1 (spec 01): starter code moved into `src/` with `git mv` (`app/` → `src/app/`, `components/ui/` → `src/frontend/ui/`, `lib/utils.ts` → `src/frontend/lib/utils.ts`, `db/schema.ts` → `src/backend/database/schema.ts`); `@/*` now points to `./src/*` and shadcn aliases point to `src/frontend/` (`tsconfig.json`, `components.json`)

- 2026-11-25: Code-style rule: backend uses only a few classes (Database, repositories, services, controllers; one class per whole job, max 3 constructor deps) with stateless helpers as plain functions in `src/backend/lib/`; frontend is functions only (`apiRequest()`, `authApi`, `fieldErrors()`; only `ApiError` is a class). Plan 01 cut to 7 backend classes and 17 steps (`CLAUDE.md`, `.claude/plans/01-auth.md`, `backend-patterns`, `frontend-patterns`, `verification-loop` skills, `feature-checker` agent, `execute-plan`/`plan-create`/`spec-create` commands, `basic-structor.md`)

- 2026-11-25: `CLAUDE.md` now describes Plan 01's `src/` layout (`@/*` → `./src/*`, `src/backend/<area>/` classes, `src/backend/container.ts`, `src/backend/errors/` + `ErrorResponder`, `src/contracts/` zod schemas, `src/frontend/`), `CurrentUser`, the refresh cookie path and function components; `verification-loop` scans cover the `src/` paths (`CLAUDE.md`, `.claude/skills/verification-loop/SKILL.md`)

- 2026-11-25: Local and production both use Neon (Postgres) and Upstash (Redis, keys prefixed `dev:`/`prod:`), deployed on Vercel, so the code is the same everywhere (`CLAUDE.md`, `basic-structor.md`, `.env.example` adds `REDIS_KEY_PREFIX`, `.claude/settings.json` drops the Docker allow rules and asks before `vercel`).
- 2026-11-25: `.gitignore` now allows `.env.example` and ignores `.claude/settings.local.json`.
- 2026-11-25: `basic-structor.md` folder layout uses the project root instead of `src/`, to match the `@/*` alias.

### Removed

- 2026-11-25: Plan 01 deleted, to be rewritten in a new session with the new skills; spec 01 status back to draft, its answers kept (`.claude/plans/01-auth.md`, `.claude/specs/01-auth.md`).
- 2026-11-25: `docker/docker_compose.yml` (local Postgres and Adminer), replaced by Neon.
