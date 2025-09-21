# Backlog

## NOW (P0)

- BL-001: Minimal CI stability and linting (ops)
  - Type: techdebt
  - Priority: P0
  - Why: Keep PR CI green with flat ESLint config and TS checks.
  - Acceptance Criteria:
    - CI runs lint, typecheck, build on PRs to dev/main.
    - eslint config uses flat ESM; no config errors.
    - Lint has 0 errors (warnings allowed).
    - Repo builds without interactive input.
  - Status: in-progress
  - Links: branch chore/simple-ci-and-docs

- BL-007: Fix dual deploy env mapping (ops)
  - Type: techdebt
  - Priority: P0
  - Why: Vercel now has dev/prod but both talk to the same Render instance; we need correct env separation to avoid cross-environment traffic.
  - Acceptance Criteria:
    - Vercel dev deploy points to Render dev (or isolated dev URL/env).
    - Vercel prod deploy points to Render prod instance.
    - Environment variables clearly scoped for dev vs prod in Vercel and Render.
    - Documented mapping in README/CONTRIBUTING.
  - Status: in-progress
  - Links: branch chore/simple-ci-and-docs

## NEXT (P1)

- BL-002: Server test suite expansion (server)
  - Type: techdebt
  - Priority: P1
  - Why: Cover routes/middleware/services, esp. SC2Pulse caching and error mapping.
  - Acceptance Criteria:
    - Vitest server suite covers pulseRoutes, pulseApi, error handlers.
    - v8 coverage ≥ 60% server-side.
    - Tests run non-interactively via npm scripts.
  - Status: planned
  - Links: branch test/server-suite

- BL-003: Client coverage scoping and scaffolding (client)
  - Type: techdebt
  - Priority: P1
  - Why: Avoid noise from non-client files and build a base for RTL/MSW tests.
  - Acceptance Criteria:
    - vitest.client.config.ts coverage.include limited to src/client/**
    - Pass with no tests enabled; sample test scaffold added.
  - Status: planned
  - Links: branch test/client-coverage-scope

## LATER (P2)

- BL-004: Repo docs and contribution model (docs)
  - Type: docs
  - Priority: P2
  - Why: Ensure consistent PR flow, branching, and CI expectations.
  - Acceptance Criteria:
    - CONTRIBUTING.md documents delivery model and CI scope.
    - CODEOWNERS added for key areas.
    - README references contributing.
  - Status: done
  - Links: branches docs/repo-docs, chore/simple-ci-and-docs

- BL-005: Simplify workflows to single CI (ops)
  - Type: techdebt
  - Priority: P2
  - Why: Reduce maintenance surface; rely on Vercel for deploys.
  - Acceptance Criteria:
    - Only .github/workflows/ci.yml exists.
    - Old Deploy.yml removed.
  - Status: done
  - Links: branch chore/simple-ci-and-docs

## NICE TO HAVE (P3)

- BL-006: Security and governance baseline (ops)
  - Type: techdebt
  - Priority: P3
  - Why: Enforce branch protections, required checks, secret scanning, and Dependabot.
  - Acceptance Criteria:
    - Branch protections on main/dev (required CI, review, linear history).
    - Dependabot alerts enabled and visible.
    - Secret scanning + push protection on.
    - Optional: CodeQL workflow.
  - Status: planned
  - Links: TODO

## DONE

- BL-004 moved to DONE (see above)
- BL-005 moved to DONE (see above)
