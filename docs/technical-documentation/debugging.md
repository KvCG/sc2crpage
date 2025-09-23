# Debugging & Observability

This guide summarizes the lightweight logging, metrics, and request tracing built into the API, and how to use URL-driven request IDs from the client.

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
