# Debugging & Observability

This guide covers both **development debugging** (VS Code, sourcemaps, breakpoints) and **production observability** (logging, metrics, tracing) for the SC2CR API.

## Development Debugging Setup

### Quick Start
1. Set breakpoints in TypeScript source files (e.g., `src/server/routes/analyticsRoutes.ts`)
2. Press `F5` or select **"Debug Server"** from VS Code debug dropdown  
3. Breakpoints activate and debugging works normally

### Architecture
Following SC2CR **separation of concerns**:
- **Production Build**: `scripts/build.cjs` - Optimized, no debugging overhead
- **Development Build**: `scripts/build-dev.cjs` - Full sourcemaps and debugging support
- **VS Code Integration**: Clean launch configurations using development builds

### Available Methods
- **Debug Server**: `F5` - Builds and launches with debugger
- **Attach to Nodemon**: Connects to running `npm run dev` process
- **Port**: Uses `PORT=3001` to avoid conflicts

### Build Commands
```bash
npm run build:server:dev  # Development build with debugging
npm run build:server      # Production build (optimized)
```

### Troubleshooting
- **Grey breakpoints?** Ensure using dev build: `npm run build:server:dev`
- **Port conflicts?** Debug uses `PORT=3001`, modify in `.vscode/launch.json` if needed
- **Performance issues?** Dev builds are larger; use production builds for performance testing

## Production Observability

This section summarizes the lightweight logging, metrics, and request tracing built into the API, and how to use URL-driven request IDs from the client.

## Correlation vs Request ID

- The server always computes a correlation ID (`corr`) and prefers a client-provided request ID when present.
- Code reference (server): `const requestId = extractRequestId(req, res) || corr`
- `corr` is taken from `x-correlation-id` if provided, otherwise randomly generated.
- Headers set on every response:
	- `x-correlation-id`: correlation value (always present)
	- `x-response-start-ms`: request start timestamp
	- `x-response-time-ms`: total duration (set on finish, best-effort)
	- `x-powered-by`: `sc2cr`

Why two IDs?
- `x-request-id` is the canonical trace key across FE/BE when you explicitly pass one (via URL `rid|reqid|requestId`).
- `x-correlation-id` guarantees an ID exists even when the request ID is missing; use it to trace logs for ad-hoc requests.

Tips:
- For reproducible debugging, open the app with `?rid=<id>`; the FE sends `x-request-id: <id>` on all API calls.
- If `x-request-id` wasn’t set, copy `x-correlation-id` from the response to search logs or to set `?rid=` in a follow-up.

## Request IDs via URL

- Add one of these query params to the app URL: `rid`, `reqid`, or `requestId`.
- The client automatically forwards the value as the `x-request-id` header on every API request.
- No storage is used — control it explicitly via the URL.

Examples:

```
https://sc2cr.vercel.app/?rid=my-debug-123
http://localhost:5173/?requestId=local-test-1
```

Verification:
- Server echoes the ID as `x-request-id` on responses
- Logs include the request ID
- Request snapshot available at `/api/debug?type=req&id=<id>`

## Health Endpoint Logging

- Default (`LOG_LEVEL=info`): minimal `info` log ("health ok")
- Debug (`LOG_LEVEL=debug`): detailed `debug` log with `{ route, ua, ip, id }`

## Metrics (In-Memory)

- Counters: `http_total`, `http_5xx_total`, `pulse_req_total`, `pulse_err_total{kind}`, `cache_hit_total`, `cache_miss_total`
- Latency bins for Pulse with `pulse_p95_ms`, `pulse_p99_ms`

Endpoint: `GET /api/debug?type=metrics`

### Pulse Latency: p95/p99 (Quick Guide)

- `p95` (ms): 95 out of 100 Pulse calls were faster than this. Think “typical worst case.”
- `p99` (ms): 99 out of 100 calls were faster. Think “rare spikes/outliers.”
- Compare to timeout (`PULSE_TIMEOUT_MS`, default 8000):
	- High `p95` → the system is generally slow.
	- Only high `p99` → mostly fine, with occasional slow spikes.
- Values are approximate, reset on server restart, and cover only backend calls to SC2Pulse.
- Example: `p95=450`, `p99=2200` → most calls are fast; a few take ~2.2s.

## Request Store (In-Memory)

- Last ~200 requests tracked: `durationMs`, `pulseCalls`, `pulseErrs`, `cacheHits`, `cacheMisses`
- No background logging — pull data via the debug endpoint

Endpoint: `GET /api/debug?type=req&id=<requestId>`

## Build Info

- Endpoint: `GET /api/debug?type=buildInfo`
- Returns server build metadata (commit, branch, env)

## Tips

- Use `?rid=<id>` on your app URL while reproducing an issue to correlate logs and request snapshots quickly.
- Prefer short, unique IDs (e.g., initials + timestamp) for easy grepping in logs.
