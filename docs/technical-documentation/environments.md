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

## Logging & Observability (Server)

- Logger: pino (pretty stream in development)
  - `LOG_LEVEL` (default `info`)
  - Redacts `authorization` and cookies
- HTTP logging: pino-http
  - Logs 2xx/3xx at `info`, 4xx/5xx at `error`
  - `/api/health`: minimal `info` log by default; when `LOG_LEVEL=debug`, logs extra fields `{ route, ua, ip, id }`
  - All other routes logged; request ID is included and echoed as `x-request-id`
- Request store (pull-based only): last ~200 requests in-memory
  - Fields per request: `durationMs`, `pulseCalls`, `pulseErrs`, `cacheHits`, `cacheMisses`
  - No background logs; data is retrieved via debug endpoint
- Metrics (lightweight, in-memory counters)
  - `http_total`, `http_5xx_total`, `pulse_req_total`, `pulse_err_total{kind}`, `cache_hit_total`, `cache_miss_total`
  - Pulse latency tracked in fixed bins; estimated `p95`/`p99`
- Pulse client
  - `PULSE_TIMEOUT_MS` (default `8000`)
  - Axios interceptors increment counters; errors classified as `timeout|http4xx|http5xx|network|other`

### Request ID Propagation (Client → Server)

- Client supports URL params to set a request ID used for all API calls:
  - Accepted keys: `rid`, `reqid`, `requestId`
  - Value is sent as `x-request-id` header via an axios request interceptor
  - No storage: the value is taken only from the current URL; change the URL to change the ID
- Usage examples:
  - Open the app with `?rid=my-debug-id` to tag all subsequent API requests
  - The server echoes the ID in `x-request-id`, includes it in logs, and exposes request snapshots at `/api/debug?type=req&id=my-debug-id`

Server correlation vs request ID:
- The server generates a correlation ID (`x-correlation-id`) for every request and prefers the client `x-request-id` when present.
- Fallback behavior: `const requestId = extractRequestId(req, res) || corr` (from server code), ensuring every request has at least a correlation ID for tracing.

### Debug Endpoint

- `GET /api/debug?type=buildInfo` → server build metadata
- `GET /api/debug?type=metrics` → metrics JSON including `pulse_p95_ms`, `pulse_p99_ms`
- `GET /api/debug?type=req&id=<requestId>` → returns the last stored entry for that request or 404

### Recommended Env Defaults

```
LOG_LEVEL=info
PULSE_TIMEOUT_MS=8000
ENABLE_REQ_OBS=true
```

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
