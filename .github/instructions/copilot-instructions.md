# SC2CR Codebase Guide for AI Agents

SC2CR is a community stats, replays, and tournament tracking app for StarCraft II players in Costa Rica. It surfaces live ladder rankings, replay analysis, match history, and tournament brackets — pulling data from SC2Pulse, Challonge, and Google Drive — through a React frontend backed by a Node/Express API.

## Stack

- **Client**: React 18 + Vite + Mantine UI + React Router v6 — `src/client/`
- **Server**: Node/Express + TypeScript — `src/server/`
- **Deploys**: Vercel (client) · Render prod API · Fly.io dev API
- **Docs hub**: `docs/README.md`

---

## Project Structure

```
src/
  client/       React/Vite app
    components/ Feature-organized UI components (PascalCase)
    hooks/      useFetch, usePost — data-fetching layer
    pages/      Top-level route views
    services/   api.ts, config.ts, rankingHelper.ts
  server/       Express/TypeScript API
    routes/     apiRoutes.ts → analyticsRoutes, challongeRoutes, googleRoutes,
                              pulseRoutes, replayAnalyzerRoutes, utilityRoutes
    services/   pulseService, analyticsService, snapshotService,
                communityDataService, dataDerivations, challongeApi,
                googleApi, driveFileStorage, replayAnalyzerApi
    middleware/ analyticsMiddleware.ts
    utils/      cache, cacheKeys, rankingFilters, requestIdentity, gitInfo…
    logging/    logger.ts (Pino)
    metrics/    lite.ts
  shared/       Types and utilities used by both sides
plugins/        Vite build-time plugins (clientBuildInfo.ts)
scripts/        Node build scripts (build.cjs, build-dev.cjs)
docs/           Docsify docs (serve: npm run docs)
mockData/       Fixture JSON for tests
```

---

## Commands

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite FE + nodemon BE concurrently |
| `npm run build` | Full build (client + server) |
| `npm start` | Run production build |
| `npm test` | Client + server tests in parallel |
| `npm run test:server` / `test:client` | One side only |
| `npm run coverage` | Coverage report |
| `npm run lint` | ESLint (`eslint.config.js`) |
| `npm run type-check` | TS check (no emit) |
| `npm run docs` | Serve docs on port 3001 |

---

## Data (`ladderCR.csv`)

Server reads from `dist/data/ladderCR.csv`. Auto-downloads from Google Drive when `GOOGLE_SERVICE_ACCOUNT_KEY` is set; otherwise place manually after build.

See `docs/reference/environment-variables.md` for all env vars.

---

## Critical Invariants

### Minimum Games Filter
`pulseService.getRanking()` is the **only** place minimum games filtering is enforced. Threshold: `RANKING_MIN_GAMES` env var (default 10) via `getRankingMinGamesThreshold()` in `utils/rankingFilters.ts`. **Never** re-implement this in `AnalyticsService`, route handlers, or client code. Enforced by `__tests__/integration/filterConsistency.test.ts`.

### Separation of Concerns
- Vite plugins → `plugins/` only; `vite.config.ts` only assembles plugins
- Cross-cutting runtime utilities → `src/shared/` only
- Server-only helpers → `src/server/utils/`
- Do not mix build-time tooling with runtime app logic

### Do not over-engineer
- Avoid unnecessary abstractions, patterns, or libraries
- Favor straightforward, pragmatic solutions


---

## Conventions

- Components: PascalCase · Hooks/utils: camelCase · Errors: `{ error, code, context? }`
- Code style enforced by `eslint.config.js` — run `npm run lint` before committing
- See `docs/development-process/contributing.md` and `docs/development-process/branching-strategy.md`
- Trunk-based: `dev` is the integration branch; all PRs target `dev`
- Readability is a first-class criterion — clarity over brevity, explicit naming, single-responsibility functions, no magic values, comments explain *why*
