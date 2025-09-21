# SC2CR Codebase Guide for AI Agents

## Overview
- Full-stack SC2 stats/replays/tournaments app
- Stack: React/TS (client) + Node/Express (server)
- Deploys: Vercel (client) + Render prod API + Fly.io dev API

## Architecture & Flow
- Client (`src/client`): API calls in `services/api.ts`, config in `services/config.ts` with host-based switch to `src/client/config/{prod,dev,local}.config.json`.
- Server (`src/server`): routes mounted via `routes/apiRoutes.ts` combining `pulse`, `challonge`, `utility`, `google`, `replayAnalyzer`.
- Utils: SC2Pulse data shaping in `utils/formatData.ts` and helpers in `utils/pulseApiHelper.ts`; in-memory cache `utils/cache.ts` (LRU, TTL 30s).
- Flow: Client → `/api/*` → service fetch/transform → formatted payload → client.

## Dev, Build, Run
- Dev: `npm run dev` (Vite FE + nodemon BE, concurrent)
- Build: `npm run build` (client + server via `scripts/build.cjs`)
- Start (built): `npm start` → `dist/webserver/server.cjs`
- Local Docker: `npm run buildImg` → `npm run localPod` (publishes on `127.0.0.1:3000`)

## Data (ladderCR.csv)
- Runtime path: `dist/data/ladderCR.csv` (server reads `../data/ladderCR.csv` from `__dirname`).
- If missing and Firebase configured, `middleware/fbFileManagement.ts` downloads from bucket (`ranked_players/ladderCR.csv`). Otherwise, manually place the file after build.

## Server Patterns
- Caching: `utils/cache.ts` stores a single snapshot (`snapShot`) with TTL 30s; `services/pulseApi.ts#getTop` shares an in-flight promise to prevent stampedes.
- SC2Pulse access: `services/pulseApi.ts` (axios + https agent) implements `searchPlayer`, `getTop`, and helpers (race extraction, last played in CR time, online heuristic).
- Middleware/SPA: `server.ts` serves static `dist` assets, mounts `/api`, and falls back to `index.html`; dev-only WebSocket on port 4000 for reloads.

## Client Patterns
- Config switch: `services/config.ts` chooses API base by host; prod → Render, dev → Fly.io, local → `http://localhost:3000/`.
- Data fetching: custom hooks in `hooks/`, UI pages under `pages/`, components colocated under `components/`.

## CI/CD (Deploy.yml)
- Unified workflow: checks → docker buildx (push to Docker Hub + Fly registry) → deploys.
- Prod: on `main`, Render deploy webhook (`RENDER_DEPLOY_HOOK_URL`).
- Dev: on `dev`, Fly deploy from prebuilt image tag (`registry.fly.io/${FLY_APP_NAME_DEV}:dev`).
- Tags: `latest` (main), `dev` (dev), `pr-#` (PRs), or sanitized branch name; SHA tag also pushed.

## Env Vars (server)
- Firebase: `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string) for bucket download.
- Challonge: `CHALLONGE_API_KEY`, `CURRENT_TOURNAMENT`.
- Google: `GOOGLE_SERVICE_ACCOUNT_KEY`.
- Replay analyzer: `REPLAY_ANALYZER_URL`.
- Tunables: `MMR_RANGE_FOR_PREMIER_MATCH`, `MMR_RANGE_FOR_CLOSE_MATCH`, `PORT`.

## Conventions
- Naming: Components PascalCase; hooks/utils camelCase.
- Branches: `main` (prod), `dev` (sandbox), `feature/*` from `main`.
- Commits: `feat|fix|docs(scope): msg`.
- Errors: prefer `{ error, code, context? }` without leaking raw errors.

## Testing
- Vitest is referenced in docs, but no configs/scripts exist in repo yet. Align tests/scripts before enforcing in CI.

## Unknowns / Gaps
- Confirm client deploys (Vercel) and branch→preview mapping.
- Define authoritative source/automation for `ladderCR.csv` in CI/CD.
- Standardize error contract across routes and add tests.
- Finalize test runner setup (Vitest configs, scripts) to match `.github/TESTING.md`.
- Any rate limits/retries for SC2Pulse to externalize via env?