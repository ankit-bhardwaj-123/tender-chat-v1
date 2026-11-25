# Changelog

## [Unreleased]

### Added

- 2026-11-25: Build plan for manual access/refresh-token auth and OOP layering (`basic-structor.md`).
- 2026-11-25: Claude setup: project rules in `CLAUDE.md` and permissions in `.claude/settings.json` (deny reading `.env`, deleting the DB volume, editing `../tender-chat`).
- 2026-11-25: `.env.example` listing the DB, JWT, token lifetime, Upstash Redis and app URL keys.
- 2026-11-25: Git repo initialised on `main`; first commit pushed to GitHub (`origin` = `ankit-bhardwaj-123/tender-chat-v1`).
- 2026-11-25: Claude workflow adapted from `../tender-chat` for OOP and manual token auth: `/spec-create`, `/plan-create`, `/execute-plan`, `/check-feature`, `/git-push` (`.claude/commands/`), the `feature-checker` agent (`.claude/agents/`), empty `specs/`, `plans/`, `reports/`, `skills/` folders, and a Workflow section in `CLAUDE.md`.

### Changed

- 2026-11-25: Local and production both use Neon (Postgres) and Upstash (Redis, keys prefixed `dev:`/`prod:`), deployed on Vercel, so the code is the same everywhere (`CLAUDE.md`, `basic-structor.md`, `.env.example` adds `REDIS_KEY_PREFIX`, `.claude/settings.json` drops the Docker allow rules and asks before `vercel`).
- 2026-11-25: `.gitignore` now allows `.env.example` and ignores `.claude/settings.local.json`.
- 2026-11-25: `basic-structor.md` folder layout uses the project root instead of `src/`, to match the `@/*` alias.

### Removed

- 2026-11-25: `docker/docker_compose.yml` (local Postgres and Adminer), replaced by Neon.
