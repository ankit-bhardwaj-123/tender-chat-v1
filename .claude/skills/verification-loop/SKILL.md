---
name: verification-loop
description: Manual pre-PR quality gate for tender-chat-v1. Runs build, type check, lint, tests, a secret/auth-rule scan and a diff review, then prints a PASS/FAIL report. Use only when the owner asks to "verify", "run the checks", "is it ready for a PR/push", or after a feature or refactor is finished, before /git-push.
---

# Verification loop (tender-chat-v1)

A quick, read-only gate. It never edits code, installs packages, runs migrations or touches git state.
For the deep review (writing tests, code-style rules, token security) use `/check-feature` instead; this skill only runs the checks.

Run it only when asked. It does not run on a timer or after every change.

## Rules

- Package manager is **pnpm** (`packageManager` in `package.json`). Single app, no workspaces (`pnpm-workspace.yaml` only sets `allowBuilds`).
- Always call scripts as `pnpm run <script>`. **Gotcha:** bare `pnpm test` exits 0 silently when no `test` script exists (pnpm 12). `pnpm run test` fails properly.
- Every command below works the same in PowerShell and Git Bash. Keep regexes in single quotes and don't add pipes, `sed`, `2>/dev/null` or `set -o pipefail`.
- `git grep` exits **1 when nothing matches**. For the scans, exit 1 means clean, not failure.
- Never read `.env*` (denied in `.claude/settings.json`). If the build needs env values that are missing, report it; don't go looking for them.
- Integration tests use Neon and Upstash. Never run them against the dev or prod branch (see `.claude/agents/feature-checker.md`).

## Phase 0: Which scripts exist?

```sh
pnpm run
```

Today the only scripts are `dev`, `build`, `start` and `lint`. Plan 01 step 2 (`.claude/plans/01-auth.md:78`) adds `typecheck` and `test` (vitest). Use a script once it is listed; until then, use the fallback below or mark the phase SKIPPED.

## Phase 1: Build

```sh
pnpm run build
```

`next build` (Turbopack) also runs TypeScript. FAIL means stop: report the error and don't run the later phases.
If it fails on something outside the code (for example a Next.js security-advisory stop), report the message as it is and leave the next step to the owner. `next upgrade` is in the `ask` list.

## Phase 2: Type check

```sh
pnpm run typecheck        # once the script exists
pnpm exec tsc --noEmit    # fallback until then
```

`tsconfig.json` is `strict`. Report the error count and the first errors as `path:line`.

## Phase 3: Lint

```sh
pnpm run lint
```

ESLint 9 flat config (`eslint.config.mjs`: next core-web-vitals + typescript). No output and exit 0 means PASS.

## Phase 4: Tests

```sh
pnpm run test             # only if listed in Phase 0
```

- No `test` script or no test files yet: **SKIPPED (no tests yet)**, not FAIL.
- Report total, passed and failed. There's no coverage threshold in this repo, so don't enforce one.
- `pnpm run test:integration`: only if the script exists **and** the owner confirms a separate Neon test branch is set up. Otherwise SKIPPED.

## Phase 5: Security scan

Run all of these from the repo root. `--untracked` includes new files that aren't git-ignored, and `.gitignore` keeps `node_modules`, `.next` and `.env*` out.

```sh
# 1. No env file is tracked (only .env.example may be). Any output = FAIL.
git ls-files -- '.env*' ':(exclude).env.example'

# 2. Secret-shaped strings: DB URLs with passwords, sk- keys, JWTs, private keys. Any hit = FAIL.
git grep -n -I --untracked -E 'postgres(ql)?://[^:/@ ]+:[^@ ]+@|sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}[.]eyJ|-----BEGIN [A-Z ]*PRIVATE KEY' -- . ':(exclude)pnpm-lock.yaml'

# 3. Hard-coded secrets/tokens/passwords (ignores $VAR references). Check each hit; a real value = FAIL.
git grep -n -I --untracked -i -E '(secret|token|password|api_?key)[a-z_]*[[:space:]]*[:=][[:space:]]*[^$[:space:]]?[A-Za-z0-9+/=_-]{20,}' -- . ':(exclude)pnpm-lock.yaml' ':(exclude)*.md'

# 4. Auth rule: tokens only in httpOnly cookies. Any web-storage use that touches a token = FAIL.
git grep -n -I --untracked -E 'localStorage|sessionStorage' -- src app components lib

# 5. console.log in UI code only (pages without api/, frontend components). WARN, never FAIL.
git grep -n -I --untracked -E 'console[.]log' -- src/app src/frontend app components ':(exclude)src/app/api' ':(exclude)app/api'
```

Server code (`src/app/api`, `src/backend/`) may log. Only flag a log there if it prints a token, password or cookie.
The root paths (`app`, `components`, `lib`) cover the code until the Plan 01 step 1 move; paths that don't exist simply match nothing.

## Phase 6: Diff review

```sh
git status --short
git diff HEAD --stat
git diff HEAD --name-only
```

`git diff HEAD` doesn't list untracked files, so read `??` lines from `git status`. (The repo has one commit, so `HEAD~1` doesn't exist.) For each changed file check:

- **CHANGELOG.md is in the list** with a dated entry under `## [Unreleased]` (owner rule). If it's missing, the verdict is NOT READY.
- No unintended files (`.env*`, `.next/`, `*.tsbuildinfo`, generated migrations edited by hand).
- Layering: a `route.ts` exports only HTTP handlers and route config; no `Request`/`Response` in services; queries only in repositories.
- Another user's row answers 404, never 403; login errors don't reveal whether the email exists.
- Missing error handling (`AppError` subclasses in `src/backend/errors/`, mapped by `toErrorResponse()`) and obvious edge cases.

## Report

```
VERIFICATION REPORT (tender-chat-v1, YYYY-MM-DD)
==================
Build:     [PASS/FAIL]
Types:     [PASS/FAIL] (X errors)            via typecheck | tsc fallback
Lint:      [PASS/FAIL] (X problems)
Tests:     [PASS/FAIL/SKIPPED] (X/Y passed)  reason if skipped
Security:  [PASS/FAIL] (X issues, Y console.log warnings)
Diff:      [X files changed, Y untracked]  CHANGELOG entry: yes/no

Overall:   [READY/NOT READY] for PR / push

Issues to fix:
1. path:line: what is wrong, why it matters, how to fix
```

READY needs Build, Types, Lint and Security to pass, Tests to pass or be SKIPPED, and a CHANGELOG entry. WARNs don't block.
Explain each issue in plain words (the owner is learning) and ask before fixing anything.

## Gotchas

- `.github/workflow/ci.yml` sits in `workflow/` (singular), so GitHub doesn't run it; it would need `.github/workflows/`. It also calls `format:check`, `typecheck`, `test` and `test:integration`, which don't exist yet. Don't treat CI as proof that the checks pass.
- `pnpm run build` writes `.next/`, which is git-ignored. Next 16 keeps the dev output in `.next/dev`, so building while `pnpm dev` runs is OK.
