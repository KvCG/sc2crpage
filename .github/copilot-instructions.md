# SC2CR Codebase Guide for AI Agents

## Overview
- Full-stack SC2 stats/replays/tournaments app
- Stack: React/TS (client) + Node/Express (server)
- Deploy: Vercel (client) + Render (server)

## Architecture & Flow
- Client `src/client`: `services/api.ts` (HTTP), `hooks/useFetch.tsx`, pages in `pages/`, UI in `components/`.
- Server `src/server`: routes mounted via `routes/apiRoutes.ts`; SC2Pulse via `services/pulseApi.ts`; shaping in `utils/formatData.ts`; caching in `utils/cache.ts`.
- Flow: Client → `/api/*` → service fetch/transform → formatted payload → client.

## Dev, Build, Run
- Dev: `npm run dev` (Vite + nodemon; FE+BE concurrently)
- Build: `npm run build` (client + server via `scripts/build.cjs`)
- Start (built): `npm start` → `dist/webserver/server.cjs`
- Data: after build, place `dist/data/ladderCR.csv` (request from maintainers)
- Docker: build `npm run buildImg` | run `npm run localPod` | push `npm run pushImg`

## Testing
- Runner: Vitest (separate configs per side)
- Server: `npm run test:server` | coverage: `npm run test:coverage:server`
- Client: `npm run test:client` (jsdom; `passWithNoTests` true) | coverage: `npm run test:coverage:client`
- Both in parallel: `npm test` | watch: `npm run test:watch`

## Server Patterns
- Routing: `routes/{pulse,challonge,utility,google,replayAnalyzer}Routes.ts` mounted in `routes/apiRoutes.ts`.
- Middleware/headers: `server.ts` sets `x-correlation-id`, `x-response-start-ms`, `x-response-time-ms`; pulse routes add `x-sc2pulse-attribution`; client info via `utils/getClientInfo.ts`.
- Caching: `utils/cache.ts` LRU (TTL 30s). `pulseApi.getTop()` uses key `snapShot` + in-flight promise de-dup.
- SC2Pulse: `services/pulseHttpClient.ts` typed axios client (env base), ~4 rps limit, jittered retries on 429/5xx (max 3), standardized error mapping; used by `services/pulseApi.ts` (`getTop`, `searchPlayer`).
- Formatting/helpers: `utils/formatData.ts`, `utils/pulseApiHelper.ts`, user verification in `utils/userDataHelper.ts`.

## Client Patterns
- API base in `src/client/services/config.ts`; calls in `services/api.ts`.
- Data fetching: `hooks/useFetch.tsx`; pages in `pages/`; components colocated under `components/`.

## Conventions
- Naming: Components PascalCase; hooks/utils camelCase; tests `*.test.ts(x)`.
- Branches: `feature/...`, `server/...`, `client/...`; commits `feat|fix|docs(scope): msg`.
- Errors: return `{ error, code, context? }`; avoid leaking raw errors.
- Env: use `process.env.*`; document/validate.

## Notes & Files
- Test configs: `vitest.server.config.ts` (node), `vitest.client.config.ts` (jsdom + RTL + MSW). Server coverage scoped to `src/server/**`.
- Key server files: `src/server/services/{pulseApi.ts,pulseHttpClient.ts}`, `src/server/routes/apiRoutes.ts`, `src/server/utils/{cache.ts,formatData.ts}`.

## Unknowns / Gaps
- Env vars: confirm names/defaults (`SC2PULSE_BASE_URL`, limiter/retry settings, Firebase, Challonge).
- Ladder data: confirm source/automation to place `dist/data/ladderCR.csv` after build.
- Error contract: confirm canonical `{ error, code, context? }` across routes.
- Logging: confirm library/fields beyond headers (e.g., pino integration).
- Client coverage: confirm desired scope to avoid including non-client files when no client tests.