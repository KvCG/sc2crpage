# Environments

- Client hosting: Vercel
  - Per-branch previews: every branch gets a unique preview URL
  - Permanent dev preview: the `dev` branch serves as the stable dev preview
  - All previews are considered "dev" because they talk to the dev API
- API backends:
  - Dev API: Fly.io (app uses prebuilt image from CI)
  - Prod API: Render (deployed from `main` via webhook)

Client → API mapping:
- Local: client on Vite (`npm run dev`), API at `http://localhost:3000/`
- Vercel previews (any branch, including `dev`): API base `https://sc2cr-dev.fly.dev`
- Production (main): API base `https://sc2cr-latest.onrender.com/`

Config files:
- `src/client/config/local.config.json`: `{ "API_URL": "http://localhost:3000/" }`
- `src/client/config/dev.config.json`: `{ "API_URL": "https://sc2cr-dev.fly.dev" }`
- `src/client/config/prod.config.json`: `{ "API_URL": "https://sc2cr-latest.onrender.com/" }`

## Build Metadata & Debug

- Labels: `app` is `client` on the frontend and `server` on the backend.
- Enabled in all environments; consistent shape and endpoints.
- Client:
  - Injects a readable HTML comment near `<head>` with pretty JSON in all envs.
  - Use `GET /api/debug?type=buildInfo` to retrieve server build info JSON in any environment.
  - Local enrichment: reads git for `commit`, `branch`, `commitMessage` when available.
- Server:
  - `GET /api/debug?type=buildInfo` returns pretty JSON in all envs.
  - Local enrichment: reads git for `commit`, `branch`, `commitMessage` when available.

Fields: `app`, `env` (`local|dev|prod`), `commit`, `commitMessage?`, `branch?`, `pr?`, `buildNum?`.

Sourcing rules:
- Local: best-effort git (`git rev-parse`, `git log`) for enrichment; falls back to `commit: 'local'` when unavailable.
- CI/dev/prod: use CI vars only (no git calls):
  - `commit`: `VERCEL_GIT_COMMIT_SHA` | `RENDER_GIT_COMMIT` | `GITHUB_SHA` (short 7 chars).
  - `branch`: `VERCEL_GIT_COMMIT_REF` | `GITHUB_REF_NAME` | parsed from `GITHUB_REF` if `refs/heads/<name>`.
  - `commitMessage`: `VERCEL_GIT_COMMIT_MESSAGE` only.
  - `pr`: `VERCEL_GIT_PULL_REQUEST` or parsed from `GITHUB_REF` if `refs/pull/<id>/merge`.
  - `buildNum`: `GITHUB_RUN_NUMBER` when present.
  - Missing values are omitted.

Implementation notes:
- Frontend plugin lives at `plugins/clientBuildInfo.ts` and is loaded from `vite.config.ts`.
- Server build-info utility is `src/server/utils/buildInfo.ts`; local git helpers in `src/server/utils/gitInfo.ts`.
