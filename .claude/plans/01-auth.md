# Plan 01: Sign up and sign in (email, Google, GitHub) + sidebar

Spec: .claude/specs/01-auth.md · Status: draft, waiting for "go" · 2026-11-25

## In short
We build our own login: a password or a Google/GitHub sign-in gives two httpOnly cookies, a 15-minute access JWT and a 30-day refresh JWT. Every refresh swaps the refresh token for a new one in one transaction; reusing an old one kills its whole family (the chain of tokens from one sign-in). `proxy.ts` only checks the access JWT; the real check is `requireUser()` in the services. Backend is a few classes; frontend is plain functions. Signed in, the user sees a sidebar with a user menu (sign out, sign out of all devices). First step moves the starter code into `src/`.

## Spec problems
- **"30 days if the app is used"**: I read it as *sliding* (each refresh gives a fresh 30 days, so only 30 idle days sign you out). Say if you meant a hard 30-day cap.
- **GitHub hidden email**: with the `user:email` scope GitHub gives us the primary verified email even when it is hidden on the profile. Plan: refuse only when no verified email comes back at all.
- **"Sign out of all devices" is instant**, but another browser's access token would still work for up to 15 minutes. Fix: a `sessions_revoked_at` column on `users`; `requireUser()` (which loads the user anyway) rejects access tokens issued before it. No extra query.
- `basic-structor.md` says root folders and an opaque refresh string; `CLAUDE.md` and the spec say `src/` and a refresh JWT. We follow `CLAUDE.md` + spec.

## Database
- `users`: id (uuid), full_name, email (unique, stored lowercase), password_hash (empty for Google/GitHub), sign_in_method (`password` / `google` / `github`), provider_account_id (Google/GitHub user id, unique together with the method), sessions_revoked_at, created_at.
- `refresh_tokens`: id (= the JWT's `jti`), user_id (cascade delete), token_hash (SHA-256), family_id, expires_at, revoked_at, replaced_by_id, user_agent, ip, created_at. Indexes on user_id and family_id.
- Migration: `pnpm db:generate --name auth`, then `pnpm db:migrate` on the Neon `dev` branch.

## Classes
Backend only, and few of them: each class is one whole job, and a constructor takes at most 3 things.

| Class | Layer | Constructor takes | Public methods |
|---|---|---|---|
| Database | database | — (reads `config`) | `client`, `transaction(fn)` |
| AppError + 5 subclasses | errors | message, code | — |
| UserRepository | repository | Database | `findByEmail`, `findById`, `findByProvider`, `create`, `markSessionsRevoked` |
| RefreshTokenRepository | repository | Database | `create`, `findById`, `rotate(oldId, next)`, `revoke(id)`, `revokeFamily(familyId)`, `revokeAllForUser(userId)` |
| AuthService | service | UserRepository, RefreshTokenRepository, limits (`{ login, signup }`) | `signup`, `login`, `refresh`, `logout`, `logoutAll`, `startSession` |
| OAuthService | service | UserRepository, AuthService | `authorizeUrl(provider)`, `signIn(provider, code, verifier, device)` |
| AuthController | controller | AuthService | `signup`, `login`, `refresh`, `refreshAndRedirect`, `logout`, `logoutAll` |
| OAuthController | controller | OAuthService | `start`, `callback` |

**Plain helper functions (no classes)**, in `src/backend/lib/` unless named:
- `config.ts`: `config` object, env checked once with zod (throws at start if a key is missing).
- `password.ts`: `hashPassword`, `verifyPassword` (bcryptjs).
- `tokens.ts`: `signAccess`, `verifyAccess`, `signRefresh`, `verifyRefresh`, `sha256` (jose).
- `cookies.ts`: `setSessionCookies`, `clearSessionCookies`, `readAccessCookie`, `readRefreshCookie`, OAuth state cookie helpers.
- `request.ts`: `readJson(request, schema)`, `readDevice(request)` (ip + user agent).
- `rate-limit.ts`: `createLimiter(name, max, window)` gives `{ hit, check, reset }` over Upstash, keys prefixed.
- `errors/error-response.ts`: `toErrorResponse(error)`.
- `auth/current-user.ts`: `getCurrentUser()`, `requireUser()` (React `cache()`).
- `oauth/google.ts`, `oauth/github.ts`: provider objects with `authorizeUrl(state, verifier)` and `fetchProfile(code, verifier)`.

**Frontend (functions only)**: `apiRequest()` + `ApiError` (the only class: an `Error` subclass so `instanceof` works), `authApi.{signup, login, logout, logoutAll}`, `fieldErrors(zodError)`.

## API routes
| Method | Path | Controller method | Sends | Gets back |
|---|---|---|---|---|
| POST | /api/auth/signup | AuthController.signup | fullName, email, password, confirmPassword | `{ user }` 201 + cookies |
| POST | /api/auth/login | AuthController.login | email, password | `{ user }` + cookies |
| POST | /api/auth/refresh | AuthController.refresh | — (refresh cookie) | 204 + new cookies, or 401 |
| GET | /api/auth/refresh?next= | AuthController.refreshAndRedirect | — | redirect to `next`, or `/login?reason=expired` |
| POST | /api/auth/logout | AuthController.logout | — | 204, cookies cleared |
| POST | /api/auth/logout-all | AuthController.logoutAll | — | 204, cookies cleared |
| GET | /api/auth/oauth/[provider]/start | OAuthController.start | — | redirect to Google/GitHub |
| GET | /api/auth/oauth/[provider]/callback | OAuthController.callback | code, state | redirect to `/` or `/login?error=…` |
(All need a signed-in user except /api/auth/*; another user's id answers 404. No data routes yet.)

## Screens
- **/login**: email, password, Sign in, Continue with Google, Continue with GitHub, link to sign-up. Loading: buttons disabled, "Signing in…". Error: wrong details / too many tries under the form; `?error=` shows the OAuth messages; `?reason=expired` shows "Please sign in again". Done: go to `next` or `/`.
- **/signup**: full name, email, password, confirm. Field errors under each field; "email exists" and "too many accounts" under the form; network/500 is a red toast. Done: `/`.
- **(app) frame**: sidebar (app name on top, empty tender area, user icon at bottom) + main area. Loading: sidebar skeleton. Error: `error.tsx` with Try again.
- **UserMenu**: full name, email, Sign out, Sign out of all devices. While busy the item is disabled; failure is a red toast; done goes to `/login`.
- **Home /**: "Welcome, <full name>".

## Files
| File | New / Change | What it does |
|---|---|---|
| `tsconfig.json`, `components.json`, `app/ components/ lib/ db/` → `src/` | Change | move starter code; `@/*` → `./src/*`; shadcn aliases → `src/frontend/ui` |
| `package.json`, `drizzle.config.ts`, `vitest.config.ts`, `.env.example` | Change/New | scripts `typecheck`, `test`, `db:generate`, `db:migrate`; OAuth env keys |
| `src/contracts/auth.contracts.ts` | New | `signupSchema`, `loginSchema` |
| `src/backend/lib/*.ts` | New | the helper functions above |
| `src/backend/database/database.ts`, `schema.ts` | New | Database class, the two tables |
| `src/backend/errors/*.ts` | New | AppError, 5 subclasses, `toErrorResponse` |
| `src/backend/users/user.repository.ts` | New | UserRepository |
| `src/backend/auth/` | New | RefreshTokenRepository, AuthService, AuthController, current-user |
| `src/backend/oauth/` | New | OAuthService, OAuthController, google, github |
| `src/backend/container.ts` | New | builds every object once |
| `src/app/api/auth/**/route.ts` (8 handlers) | New | one controller call each |
| `src/proxy.ts` | New | optimistic redirect |
| `src/app/(auth)/login`, `signup`, `(app)/layout.tsx`, `page.tsx`, `error.tsx` | New | pages |
| `src/frontend/api/api-request.ts`, `auth-api.ts`, `forms/field-errors.ts` | New | fetch with refresh, auth calls, form errors |
| `src/frontend/auth/`, `layout/` | New | LoginForm, SignupForm, OAuthButtons, AppSidebar, UserMenu |
| `tests/unit/**`, `tests/integration/**` | New | see Tests |

## Build steps
1. **Move to `src/`**: move the four folders, fix `tsconfig` paths and `components.json`. Check: `pnpm dev` shows the starter page.
2. **Packages + scripts + configs**: install (after your yes), add scripts, `drizzle.config.ts`, `vitest.config.ts`, env keys. Check: `pnpm typecheck`.
3. **Contracts**: signup (name, email lowercased + trimmed, password ≥ 8, confirm must match), login (email, password). Check: typecheck.
4. **Config, Database, errors**: `config` throws at start if a key is missing; Database keeps one pool (max 3) across hot reloads; `toErrorResponse` maps errors to `{ error: { message, code } }`, else 500. Check: unit test for `toErrorResponse`.
5. **Schema + migration**: the two tables above; generate and migrate (I'll ask before migrating). Check: tables exist in Neon dev.
6. **Helper functions** (`lib/`): password (bcryptjs); tokens (jose HS256, two secrets, a `type` claim so one token can't pass as the other, refresh carries `jti` + `fam`); rate-limit (Upstash sliding window, prefixed keys); cookies (access path `/`, lax; refresh path `/api/auth`, strict; secure in prod); request. Check: unit tests for tokens.
7. **Repositories**: UserRepository, RefreshTokenRepository.
   - Select only needed columns; `rotate` revokes the old row only if not yet revoked, then inserts the new one, in one transaction, and says whether it won.
8. **AuthService** (one class for the whole email login + session job):
   - `startSession(userId, device)` (OAuth uses it too): new family id + jti → sign refresh, save its hash with device info → sign access.
   - `signup`: IP limit (5/day) → email taken → Conflict → hash → create user → `startSession`.
   - `login`: email or IP over 5 wrong tries/15 min → TooManyRequests → find user, check password (same error for both cases) → wrong: `hit` both keys → right: `reset` email key → `startSession`.
   - `refresh`: verify JWT → load row by jti → hash must match and not expired → if revoked, or `rotate` loses, revoke the family and throw Unauthorized → else new pair.
   - `logout`: revoke this row. `logoutAll`: revoke all rows and set `sessions_revoked_at`.
9. **current-user.ts**: read access cookie → verify → load user → reject if the token is older than `sessions_revoked_at`. `requireUser()` throws Unauthorized.
10. **OAuth**: `google.ts`/`github.ts` build the consent URL with state + PKCE (a one-time code check) and turn the code into `{ accountId, email, fullName }` with `fetch` (no library). OAuthService: same provider account → sign in; email used by another method → Conflict; no verified GitHub email → its own error; else create user → `authService.startSession`.
11. **Controllers + routes + container**: one controller method per route row; controllers use the cookie/request helpers and `toErrorResponse`; the callback checks the state cookie and maps each error to a `/login?error=` code.
12. **proxy.ts**: public paths pass; valid access → pass; expired + refresh cookie → `/api/auth/refresh?next=`; else `/login?next=`.
13. **Frontend functions**: `apiRequest()` (same-origin cookies; one shared refresh promise on 401, then retry; refresh fails → `/login?reason=expired`), `authApi`, `fieldErrors`.
14. **shadcn parts**: input, label, card, dropdown-menu, avatar, skeleton, sonner.
15. **Auth pages + forms**: login, signup, OAuth buttons (plain links to the start route).
16. **App frame**: `(app)/layout.tsx` with Suspense → AppSidebar + UserMenu; home page; `error.tsx`; remove the starter `page.tsx`.
17. **Tests + checks**: write the tests below, run typecheck, lint, test.

## New packages
Each needs your yes: `jose` (JWTs, works in proxy), `bcryptjs` (password hash, pure JS, no Windows build problems), `zod` (body checks), `@upstash/redis` + `@upstash/ratelimit` (rate limits), `vitest` (tests), `sonner` (toast, comes with the shadcn part). Latest stable versions at install time.

## Tests
- `tests/unit/tokens.test.ts`: access ≠ refresh (wrong type/secret rejected), expired rejected, `sha256` is stable.
- `tests/unit/auth.service.test.ts` (fake repos + fake limits in the constructor): signup conflict, email lowercase, same login error for both cases, 6th wrong try → 429, 6th signup/day → 429, refresh rotates, reused token revokes the family, racing refresh loses, expired → 401, logoutAll.
- `tests/unit/oauth.service.test.ts` (fake repo, fake AuthService): new user, returning user, email taken by password account refused, GitHub no email refused.
- `tests/unit/current-user.test.ts`: token before `sessions_revoked_at` rejected.
- `tests/integration/auth.test.ts` (Neon dev branch, real routes): signup → me, refresh, logout, logout-all, signed-out call → 401.

## Risks
- Drizzle `1.0.0-rc.5` API may differ from tutorials: check its `.d.ts` while writing step 7.
- Integration tests write to Neon dev; they clean up their own users (emails like `test+…@example.com`).
- Google/GitHub need OAuth apps with callback `http://localhost:3000/api/auth/oauth/<provider>/callback` (you create them; I'll list the steps).
- Testing "renews itself" needs `ACCESS_TOKEN_TTL_SECONDS=60` locally.

## Done when
- [ ] Every "Done when" line from the spec works in the browser
- [ ] typecheck, lint and test pass
- [ ] /check-feature 01 report is ✅ or ⚠️ with only small items
