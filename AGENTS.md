# AGENTS.md — sc2crpage

SC2CR: StarCraft II community rankings, replays, and tournaments (Costa Rica).
React 18 + Vite + Mantine client · Node/Express + TypeScript server · Supabase (community
players) + SC2Pulse + Challonge + Google Drive (replays). Docs hub: `docs/README.md`
(`npm run docs`, port 3001).

## Detailed patterns (read before touching these areas)

- `.github/instructions/copilot-instructions.md` — structure, conventions, invariants
- `.github/instructions/server.instructions.md` — caching, services, middleware, logging
- `.github/instructions/client.instructions.md` — API config, data fetching, UX rules
- `.github/instructions/testing.instructions.md` — test structure, mocking, invariants
- `.github/instructions/analytics.instructions.md` — analytics middleware & constraints

(These files were written for Copilot but are plain markdown; treat them as canonical.
Known stale spots: `rankingHelper.ts` is in `src/client/utils/`, not `services/`;
`communityDataService` reads Supabase, not CSV.)

## Commands

One-shot verification (safe to run and read the exit code):

- `npm test` (client, then server — sequential) · `npm run test:client` / `npm run test:server`
- `npm run type-check` · `npm run lint` · `npm run coverage` · `npm run build`

Long-running (watch processes — a startup log is NOT a passing check; Ctrl-C to end):

- `npm run dev` (Vite FE :5173 + nodemon BE :3000) · `npm run fedev` (FE only)
- `npm start` (prod server from `dist/`) · `npm run test:watch` · `npm run docs`

## Invariants (full detail in the instruction files)

- Minimum-games filtering lives ONLY in `pulseService.getRanking()`;
  `src/server/__tests__/integration/filterConsistency.test.ts` enforces it — never skip it.
- Vite plugins only in `plugins/`; cross-cutting runtime code only in `src/shared/`.

## Env & gotchas

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required at server startup
  (`src/server/db/supabaseClient.ts` throws without them) — they are MISSING from
  `.env.example`; copy them from a working `.env`.
- Rate-limit env var is `SC2PULSE_RPS` (default 10), not the `PULSE_RPS` in `.env.example`.

## Workflow

Trunk-based: PRs target `dev`; `dev`→main only via the Release workflow
(`.github/workflows/release.yml`), which merges, tests, tags, and deploys.
Render hosts prod, Fly.io hosts dev. Note: `Deploy.yml`'s checks job currently passes
`|| true` on everything — CI does not gate deploys (verified 2026-08-31).
