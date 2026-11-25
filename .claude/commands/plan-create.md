---
description: Turn a spec from .claude/specs into a short, simple build plan (plan mode), saved in .claude/plans
argument-hint: "Spec number or name, e.g. 01 or 01-auth"
allowed-tools: Read, Glob, Grep, AskUserQuestion, EnterPlanMode, ExitPlanMode, Write, Edit
---

You help the owner of **tender-chat-v1**. Follow `CLAUDE.md`, and read `basic-structor.md` for the build order and auth design.

User input: $ARGUMENTS

This command writes **one file**: `.claude/plans/<NN>-<slug>.md`. A plan says **how** we build the spec: which classes and files, in which order, and what each one does. It writes no code.

## Writing style (very important)

- Simple words and short sentences. Explain any technical word once in brackets.
- No ADRs, no requirement ids, no long essays.
- Pseudo-code means **plain-English steps**, 3–8 lines per file. It is not real code.
- Keep the plan under about 150 lines. If it would be longer, split the feature into two plans and tell the owner.

## Step 1: Pick the spec

1. List `.claude/specs/NN-*.md`. Use the one $ARGUMENTS points to; otherwise ask which one, and wait.
2. Read it. If its "Questions" still need answers, ask the owner now, or note them under "Risks".
3. If a plan with the same name exists, ask: replace it or update it?

## Step 2: Plan mode and research

Call `EnterPlanMode`. Read only what this feature touches:

- `CLAUDE.md`, `basic-structor.md` and earlier plans in `.claude/plans/`
- the code in this project (root folders: `app/`, `server/`, `controllers/`, `services/`, `repositories/`, `shared/`, `lib/`, `db/`)
- the same feature in `../tender-chat/` for behaviour (read only): its plan in `../tender-chat/.claude/plans/` and its code in `../tender-chat/src/`. Its frontend functions fit here; turn its backend services and repositories into a few classes.
- `node_modules/next/dist/docs/` for any Next.js 16 API you're unsure of, and the installed Drizzle RC's docs for queries and migrations

If something in the spec can't be built as written, don't change it quietly: put it under "Spec problems".

## Step 3: Write the plan

```
# Plan <NN>: <title>

Spec: .claude/specs/<NN>-<slug>.md · Status: draft, waiting for "go" · <YYYY-MM-DD>

## In short
3–5 lines: what we build and how it works.

## Spec problems
Anything that can't be built as written, with a suggestion. Or "None".

## Database
New tables or columns in plain words (e.g. "refresh_tokens: id, user, token hash, family, …")
and the migration name. Or "No changes".

## Classes
| Class | Layer (repository / service / controller / lib) | Constructor takes | Public methods |

## API routes
| Method | Path | Controller method | Sends | Gets back |
(All need a signed-in user except /api/auth/*; another user's id answers 404.)

## Screens
Each page or component: what it shows, plus its loading, empty, error and done states.

## Files
| File | New / Change | What it does |

## Build steps
In order: shared → database → repository → service → controller → route → container wiring → component → tests.
1. `<file>`: what to write, in plain-English steps:
   - …
   - …
   Check: how we know this step works.
2. …

## New packages
Name + version + why (each needs the owner's yes), or "None".

## Tests
Which test files and what each one checks. Services are tested with fake repositories passed in the constructor.

## Risks
What could go wrong, and questions still open.

## Done when
- [ ] Every "Done when" line from the spec works in the browser
- [ ] typecheck, lint and test pass (the scripts that exist in package.json)
- [ ] /check-feature <NN> report is ✅ or ⚠️ with only small items
```

Keep to the owner's rules (`CLAUDE.md`):

- backend: route → controller → service → repository, few classes (one per whole job, max 3 constructor deps), helpers as plain functions in `src/backend/lib/`, wired in `src/backend/container.ts`
- frontend: functions only (no classes except `ApiError`)
- errors are `AppError` subclasses, mapped to HTTP in one place
- plain written-out `interface` types
- `route.ts` exports only HTTP handlers, and zod bodies go in `shared/`
- the auth rules in `CLAUDE.md` (httpOnly cookies, hashed refresh tokens, rotation with reuse detection, 404 for other users' rows)
- schema changes only through generated migrations
- no validation the owner didn't ask for, and no new packages without a yes

## Step 4: Approval and save

1. Call `ExitPlanMode` with the plan.
2. When approved, save it to `.claude/plans/<NN>-<slug>.md`, and set the spec's Status line to `planned`.
3. Add a CHANGELOG line under `### Added`: `- <YYYY-MM-DD>: Plan <NN> <title> (.claude/plans/<NN>-<slug>.md)`.
4. If the owner asks for changes, update the plan and call `ExitPlanMode` again.

## Step 5: Stop

Tell the owner the plan path and the number of build steps. Ask whether to build it all at once (`/execute-plan <NN>`), one step at a time, or whether they want to write it themselves and have it checked with `/check-feature <NN>`. No code until they answer.
