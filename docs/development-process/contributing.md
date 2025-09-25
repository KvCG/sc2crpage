# SC2CR Contribution Guide

This project favors small, readable changes, minimal config, and a clean history.

## Branching & Release
See [branching-strategy.md](branching-strategy.md) for detailed workflow.

Key points:
- `dev`: primary development branch (trunk)
- `main`: production branch
- Feature branches branch from and merge back to `dev`
- Selective promotion from `dev` to `main` for releases

## Deploys
- Client: Vercel auto-deploys by branch (main=prod, dev=permanent preview; other branches get previews).
- API: Render (prod from `main`) and Fly.io (dev from `dev`), triggered by `.github/workflows/Deploy.yml`.

## CI
- Unified workflow: `.github/workflows/Deploy.yml` runs checks (type/lint/tests), builds Docker, and deploys to environments.
   - Note: tests are planned; scripts/config may be added later to enforce.

## Authoring Rules
- Comment non-trivial logic (intent, not restating code).
- Follow patterns: Express routes → services → utils; client services/hooks/components.
- Error contract: `{ error, code, context }`. Logging: structured.
- Env via `process.env`; add new keys to `.env.example` and note in docs.
- Tests (Vitest planned): co-locate. Prefer MSW for client and axios mocking for server.

## Code Readability & Best Practices

All code must be easy to read, easy to maintain, and consistent with existing project patterns. Readability is a non‑negotiable acceptance criterion for every PR, alongside correctness and tests.

- Prefer clarity over brevity:
   - No overly clever or compressed one‑liners.
   - Avoid nested ternaries or over‑optimized expressions that obscure intent.
- Favor explicitness:
   - Use descriptive variable and function names.
   - Maintain consistent indentation/formatting (respect ESLint/Prettier).
   - Write small, focused functions that do one thing well.
   - Avoid magic numbers/strings; use constants or config.
- Commenting:
   - Write comments that explain why code exists, not what obvious code does.
   - Document trade‑offs and non‑obvious decisions.
- Tests reflect readability:
   - Descriptive test names; clear, direct assertions.
   - Keep mocking minimal and focused; avoid unnecessary indirection.
- Performance vs readability:
   - Readability trumps micro‑optimizations unless performance is a known bottleneck and measured.
- PR review policy:
   - Reviewers must evaluate readability as a first‑class criterion. Changes that reduce clarity should be revised before merging.

Avoid:
- Overly clever chaining or compressed syntax.
- Cryptic abbreviations in naming.
- Mixing multiple responsibilities in a single function/file.
- "Write‑once, read‑never" code.

## Commit Convention
We use Conventional Commits for clarity and automation readiness.

Format:
```
<type>(<optional-scope>): <short summary>

[optional body]

[optional footer]
```

Types:
- `feat`: new feature
- `fix`: bug fix
- `chore`: tooling, deps, scripts (no src behavior change)
- `docs`: documentation only
- `refactor`: code change that neither fixes a bug nor adds a feature
- `perf`: performance improvements
- `test`: add or update tests
- `style`: formatting, missing semi-colons, etc. (no code change)
- `revert`: revert a previous commit

Scopes (suggested): `api`, `client`, `server`, `ranking`, `replays`, `tournament`, `docs`, `build`, `ci`.

Backlog ID: include `[BL-###]` in the subject when applicable.

Examples:
```
feat(api): add player MMR history endpoint [BL-012]
fix(client): handle null MMR in ranking table [BL-013]
docs: update branching strategy to curated releases
chore(ci): run lint + typecheck on PR
refactor(server): extract cache layer from pulse service
```

Breaking changes:
- Indicate with `!` after type, or add a `BREAKING CHANGE:` footer.
```
feat(api)!: change ranking endpoint response shape

BREAKING CHANGE: `rank` renamed to `mmrRank`, update clients
```

## Behavior
- Before coding: scan nearby files and align with patterns.
- Keep diffs minimal; reuse scripts/config.
- After coding: run build/tests; summarize risks.
- Unknowns: say "I don't know."

## Deliverables per Task
- Code + tests + short doc/update note.
- Brief rationale aligned with SC2CR conventions.
- No extra workflow/config unless essential.