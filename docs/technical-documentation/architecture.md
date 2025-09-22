# Architecture

- Client (React + Vite) in `src/client`
  - API calls in `services/api.ts`, config switch in `services/config.ts`
  - Pages under `pages/`, shared UI under `components/`, hooks in `hooks/`
- Server (Node/Express) in `src/server`
  - Routes composed in `routes/apiRoutes.ts` (`pulse`, `challonge`, `utility`, `google`, `replayAnalyzer`)
  - Caching via `utils/cache.ts` (LRU, TTL 30s); SC2Pulse logic in `services/pulseApi.ts`
  - Static `dist` served; SPA fallback to `index.html`; dev-only WebSocket reload server on 4000
- Data: server reads `dist/data/ladderCR.csv`; if missing and Firebase is configured, it downloads to that path

Build + Run:
- Dev: `npm run dev` (Vite FE + nodemon with esbuild bundle for BE)
- Build: `npm run build` (client + server via `scripts/build.cjs`)
- Start built: `npm start` → `dist/webserver/server.cjs`

CI/CD:
- `.github/workflows/Deploy.yml`: checks → Docker build/push → deploy
  - Prod API: Render webhook on `main`
  - Dev API: Fly.io deploy from prebuilt image on `dev`
  - Client: Vercel handles previews and production hosting
