---
description: Ask the owner about a new tender-chat-v1 feature, then write a short, simple feature spec
argument-hint: "Feature name, e.g. auth or companies"
allowed-tools: Read, Write, Edit, Glob, Grep, AskUserQuestion
---

You help the owner of **tender-chat-v1** (a rebuild of the tender quotation editor with manual access/refresh-token auth, a class-based backend and a function-based frontend). Follow `CLAUDE.md`, and read `basic-structor.md` for the build order.

User input: $ARGUMENTS

This command writes **one file**: `.claude/specs/<NN>-<slug>.md`. A spec says **what** the feature does and **why**, in simple words. No code, files, routes or database tables (those go in the plan).

## Writing style (very important)

- Simple everyday English and short sentences, like explaining to a teammate.
- When a technical word is needed, explain it once in brackets, e.g. "refresh token (the long-lived login cookie)".
- Use the owner's own words where you can.
- No requirement ids (FR-, NFR-, ADR-), no "THE SYSTEM SHALL" and no legal-sounding text.
- Keep the whole spec under about 80 lines. Short beats complete; unknowns go to "Questions".

## Step 1: Name it

- `title`: a short name, e.g. "Sign up and sign in with email".
- `slug`: lowercase-with-dashes, at most 30 characters, e.g. `auth`.
- `NN`: the next number after the highest `.claude/specs/NN-*.md` (start at `01`).

If $ARGUMENTS is empty or unclear, ask for the feature name first.

## Step 2: Look around (read only)

Read only what helps you ask good questions and write it correctly:

- `CLAUDE.md` and `basic-structor.md`
- earlier specs in `.claude/specs/`
- the same feature in the reference project, if it exists: `../tender-chat/.claude/specs/` and `../tender-chat/PROJECT-PLAN.md` (read only). It shows the expected behaviour. Its auth is Google sign-in, so don't copy auth behaviour from it.
- the screens or code this feature touches today

## Step 3: Ask the owner (one message, then wait)

Ask these as a numbered list. Where the reference spec already answers one, show its answer and ask "same as tender-chat?". The owner can answer briefly:

1. **What and why:** what should this feature do, and why do you need it now?
2. **User steps:** what does the user click, type or upload, step by step, and what do they see?
3. **Data:** what information comes in, and what gets saved or produced?
4. **Rules:** any limits (sizes, counts, who can see what, how long a login lasts)?
5. **Problems:** what can go wrong, and what message should the user see?
6. **Not now:** what should this feature NOT do yet?
7. **Done:** how will you check it works?

If something important is missing, ask one short follow-up round about only those gaps. Never invent answers; anything still unknown goes under "Questions".

## Step 4: Write the spec

```
# Spec <NN>: <title>

Status: draft · <YYYY-MM-DD>

## Goal
2–3 sentences: what it does, for whom, why now.

## What the user does
1. The user … → they see …
2. …

## What we save or produce
- …

## Rules
- …

## When something goes wrong
| What happens | What the user sees |

## Not in this feature
- …

## Questions
- … (or "None")

## Done when
- [ ] In the browser, <action> shows <result>
- [ ] …
```

## Step 5: Save and report

1. Save the spec to `.claude/specs/<NN>-<slug>.md`.
2. Add a CHANGELOG line under `## [Unreleased]` → `### Added`: `- <YYYY-MM-DD>: Spec <NN> <title> (.claude/specs/<NN>-<slug>.md)`.
3. Tell the owner the file path and any open questions, and say: "Read it and tell me what to change. When it looks right, run `/plan-create <NN>`."

Stop there. No plan and no code from this command.
