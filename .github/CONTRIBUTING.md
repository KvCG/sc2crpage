# SC2CR Contribution Guide

This project favors small, readable changes, minimal config, and a clean history.

## Branching & Release
- `main`: production (source of truth)
- `dev`: persistent sandbox
- `feature/*`: always branch from `main`

Flow:
1. Open a Draft PR from `feature/*` → `dev` for early integration.
2. For release, rebase `feature/*` onto latest `main`, then open PR → `main` and merge after green CI.
3. Immediately sync `main` → `dev`:
   - `git checkout dev && git fetch origin && git rebase origin/main && git push --force-with-lease origin dev`

## Deploys
- Client: Vercel auto-deploys by branch (main=prod, dev=permanent preview; other branches get previews).
- API: Render (prod from `main`) and Fly.io (dev from `dev`), triggered by `.github/workflows/Deploy.yml`.

## CI
- Unified workflow: `.github/workflows/Deploy.yml` runs checks (type/lint/tests), builds Docker, and deploys to environments.
   - Note: tests are planned; scripts/config may be added later to enforce.

## Authoring Rules
- Prioritize readability/maintainability; avoid bloat.
- Comment non-trivial logic (intent, not restating code).
- Follow patterns: Express routes → services → utils; client services/hooks/components.
- Error contract: `{ error, code, context }`. Logging: structured.
- Env via `process.env`; add new keys to `.env.example` and note in docs.
- Tests (Vitest planned): co-locate. Prefer MSW for client and axios mocking for server.

## Behavior
- Before coding: scan nearby files and align with patterns.
- Keep diffs minimal; reuse scripts/config.
- After coding: run build/tests; summarize risks; provide `main→dev` sync commands when releasing.
- Unknowns: say “I don’t know.”

## Deliverables per Task
- Code + tests + short doc/update note.
- Brief rationale aligned with SC2CR conventions.
- No extra workflow/config unless essential.