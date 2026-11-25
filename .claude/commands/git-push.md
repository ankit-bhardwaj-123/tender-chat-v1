---
description: Commit local work, pull the current branch from GitHub, resolve conflicts safely, then push
argument-hint: "Optional commit message"
allowed-tools: Read, Edit, Grep, Glob, AskUserQuestion, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git remote:*), Bash(git rev-parse:*), Bash(git add:*), Bash(git commit:*), Bash(git fetch:*), Bash(git pull:*), Bash(git merge:*), Bash(git push:*), Bash(git ls-files:*), Bash(git show:*), Bash(git checkout --ours:*), Bash(git checkout --theirs:*), Bash(pnpm typecheck), Bash(pnpm lint)
---

You push the owner's work on tender-chat-v1 to GitHub on the branch they are on now. Running this command is the owner asking you to commit and push.

User input: $ARGUMENTS

## Safety rules (never break these)

- The owner's local code must never be lost. Never run `git reset --hard`, `git clean`, `git checkout -- .`, `git restore .`, `git stash drop`, `git rebase`, `git push --force` / `--force-with-lease`, or delete a branch.
- Never switch branch and never push to a branch other than the current one.
- Never commit `.env*` (except `.env.example`), `.claude/settings.local.json`, `*.pem`, keys or tokens (Neon URLs, Upstash tokens, JWT secrets). If one is staged, unstage it with `git restore --staged <file>` and tell the owner.
- If anything is unclear (a conflict you cannot resolve with confidence, a failed command you do not understand), ask the owner. If they say stop, abort the merge with `git merge --abort`. That puts the branch back to the owner's own commit, with all their code kept, and nothing is pushed.

## Step 1: Check where we are

1. `git rev-parse --abbrev-ref HEAD`: the current branch. If it is `HEAD` (detached), stop and tell the owner.
2. `git remote -v`: there must be an `origin`. If there is none, stop and ask for the GitHub URL (then `git remote add origin <url>` after their yes).
3. `git status --short` and `git diff --stat`: show the owner a short list of what changed.
4. If there are no commits yet, this is the first commit: skip the pull in Step 4 and push with `-u` in Step 6.
5. If there are no local changes and no unpushed commits (`git log @{u}..HEAD --oneline` is empty), only run Step 4 (pull) and report.

## Step 2: Ask for the commit message

If $ARGUMENTS has a message, show it and use it. If not, suggest one short message based on the diff (and the newest CHANGELOG `[Unreleased]` entries), then ask the owner to accept it or type their own. Wait for the answer. Never commit without a message the owner accepted.

## Step 3: Commit local work first

Commit first so that the pull can never overwrite uncommitted code.

1. `git add -A`, then `git status --short` and check the staged list against the safety rules.
2. Commit with the owner's message, followed by a blank line and:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
3. If the commit fails (for example a hook), show the error and ask the owner. Do not use `--no-verify` unless they say so.

## Step 4: Pull from GitHub

1. `git fetch origin`.
2. If the branch has no upstream on GitHub yet (`git rev-parse --abbrev-ref @{u}` fails) and `origin/<branch>` does not exist, skip to Step 6 (first push).
3. `git pull --no-rebase origin <branch>`.
4. If it says "Already up to date" or merges cleanly, go to Step 6.

## Step 5: Resolve conflicts

1. `git diff --name-only --diff-filter=U`: list the conflicted files and show them to the owner.
2. For each file, read the conflict blocks (`<<<<<<<` ours = the owner's local code, `>>>>>>>` theirs = GitHub) and see what each side changed (`git log --oneline -5 origin/<branch> -- <file>` helps).
3. Resolve a block yourself only when the intent is clear:
   - both sides added different things that can both stay → keep both;
   - one side only re-formatted or moved code the other changed → keep the real change;
   - `CHANGELOG.md` → keep every entry from both sides, newest first;
   - `pnpm-lock.yaml` → keep `package.json` merged by hand, then tell the owner to run `pnpm install` to rebuild the lockfile (do not guess lockfile content);
   - generated migration files → never edit by hand; ask the owner.
4. When both sides changed the same lines in different ways, or you are not sure, show the owner both versions in a short form and ask: keep mine, keep GitHub's, keep both, or stop. Do what they say. On "stop", run `git merge --abort` and end without pushing.
5. After each file is clean (no `<<<<<<<`, `=======`, `>>>>>>>` left), `git add <file>`.
6. When all are resolved, run `pnpm typecheck` (if the script exists) and `pnpm lint`. If they fail because of the merge, fix it if the fix is clear, otherwise show the error and ask whether to fix, push anyway, or stop.
7. `git commit --no-edit` to finish the merge.

## Step 6: Push

1. `git push origin <branch>` (with `-u` if the branch had no upstream).
2. If GitHub rejects it because the remote moved again, go back to Step 4 once. If it is rejected a second time, or for another reason (auth, protected branch), show the error and stop. Never force push.

## Step 7: Report

Print only:

```
Branch:    <branch>
Commit:    <short hash> <message>
Pulled:    <n commits from GitHub, or up to date>
Conflicts: <files and how each was resolved, or none>
Pushed:    yes / no (<why>)
```

If `pnpm-lock.yaml` was in conflict, remind the owner to run `pnpm install` and push the new lockfile. If Vercel is connected to this branch, remind the owner that the push starts a deploy.
