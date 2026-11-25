---
description: Execute a complete coding plan from .claude/plans automatically in one continuous run.
argument-hint: "Plan file name, e.g. 01-auth"
allowed-tools: Read, Glob, Grep, Bash, Write, Edit
---

You build features for tender-chat-v1. Always follow `CLAUDE.md`, `AGENTS.md`, and the owner's rules in them. Read `basic-structor.md` for the auth design.

User input: $ARGUMENTS

This command executes a saved **plan** from `.claude/plans/` from start to finish without pausing for permission. The approved plan is the owner's "go". Follow the plan's files, build steps and their order strictly. Do not invent new features or skip steps.

## Step 1: Pick the plan and read context

1. List `.claude/plans/[0-9][0-9]-*.md`.
2. If $ARGUMENTS matches one of them, use it. Otherwise ask which one, and wait.
3. Read the plan completely, paying close attention to "Classes", "Files" and "Build steps".

## Step 2: Execute all steps in order

For each step:

1. Create or edit the exact files named in that step.
2. Follow the plain-English steps written under it.
3. Keep to the rules: route → controller → service → repository, one class per file, dependencies through the constructor, wired in `server/container.ts`, errors as `AppError` subclasses.
4. Move straight to the next step until every step is done.

Stop and ask the owner only if:

- a step needs a new package (each needs a yes)
- a step needs running a database migration (ask before running it)
- the plan turns out wrong while coding. Show the owner the change and why, and wait for a yes; then update the spec, then the plan, then the code.

## Step 3: Verify

Run the check scripts that exist in `package.json` (for example `pnpm lint`, `pnpm typecheck`, `pnpm test`). If a script doesn't exist yet, say so in the report rather than adding it.

If there are TypeScript, lint or test errors caused by this work, fix them before reporting.

## Step 4: Report

1. Add one CHANGELOG entry under `## [Unreleased]` naming the plan number and the key files.
2. Tell the owner:
   - that all steps in the plan were executed (or which were not, and why)
   - the files created or changed
   - the result of each check
   - "Please review the changes in your editor and test it in the browser. Then run `/check-feature <NN>` for the full test, security and edge-case review."
