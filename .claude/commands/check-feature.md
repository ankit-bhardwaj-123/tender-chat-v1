---
description: After a major feature is written, run the feature-checker agent (tests, quality, security, edge cases) and show its summary report
argument-hint: "Plan name (e.g. 01-auth), or file paths / a folder; empty = ask"
---

User input: $ARGUMENTS

Run the full check of a finished feature with the **feature-checker** subagent, then show its report to the owner.

## Step 1: Pick the scope

1. If $ARGUMENTS names a plan (number, slug or full name), find the match in `.claude/plans/[0-9][0-9]-*.md` and its spec in `.claude/specs/`.
2. If $ARGUMENTS gives file paths or a folder, use those.
3. If $ARGUMENTS is empty, list the plans in `.claude/plans/` and the newest `CHANGELOG.md` entry, then ask the owner which feature to check. Wait for the answer.

## Step 2: Launch the agent

Call the Agent tool with `subagent_type: "feature-checker"` and a prompt that holds:

- the feature name and the plan/spec paths (or the file list)
- today's date (YYYY-MM-DD), for the report file name
- anything the owner said about this feature (known issues, the parts they care about most, whether they wrote it by hand)

Run one agent only, and wait for it to finish. Don't do the agent's checks yourself in parallel.

## Step 3: Show the result

1. Show the owner the agent's report: the verdict, the checks table, bugs, security, edge cases and next steps. Keep its wording, and give the path of the saved report (`.claude/reports/...`).
2. If the agent wrote or changed test files, add one CHANGELOG entry under `## [Unreleased]` → `### Added` naming the feature and the test files.
3. Don't fix any app code from this command. Ask the owner which findings to fix, and fix them only after a yes (plan first for bigger fixes). The owner is learning by building, so offer to explain a fix instead of making it.
