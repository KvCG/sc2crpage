---
description: "Use when working on server-side code: services, routes, middleware, caching, or any file under src/server/. Covers caching architecture, service patterns, data sources, middleware stack, logging, error handling, and feature flags."
applyTo: "src/server/**"
---

# Server-Side Patterns

## Caching

Two-tier LRU strategy (`utils/cache.ts`):

| Cache | Export | TTL | Purpose |
|-------|--------|-----|---------|
| Live | default `cache` | 30 s | Short-lived per-request data |
| Snapshot | `snapshotCache` | CR midnight | Daily baseline; auto-refreshes via `registerOnExpire` |

- `snapshotService.ts` owns the snapshot lifecycle — use `retrieveInitialRankingData()` and `clearDailySnapshot()`
- Cache keys: `CacheKeyBuilder` from `utils/cacheKeys.ts`; pattern `{domain}:{entity}:{scope}:{identifier}` using `CacheDomain`, `CacheScope`, `CacheTTL` enums
- No business logic in the cache layer — filtering and aggregation belong in services

## Data Sources

| Source | Module |
|--------|--------|
| SC2Pulse rankings/search | `pulseService.ts` + `pulseHttpClient.ts` |
| Challonge tournaments | `challongeApi.ts` |
| Google Drive (replays, JSON) | `googleApi.ts` |
| Google Drive (ladder storage) | `driveFileStorage.ts` |
| Player analytics | `analyticsService.ts` |
| Daily snapshot | `snapshotService.ts` |
| Community CSV (singleton) | `communityDataService.ts` |
| Pure data transforms | `dataDerivations.ts` |

## Service Patterns

- **Single Responsibility**: split complex modules into discrete services
- **Pure Functions**: push side-effects (API calls, caching) to the edges; `dataDerivations.ts` exports only static pure methods (`OnlineStatusCalculator`, `DataDerivationsService`)
- **Dependency Injection**: services receive dependencies via constructors rather than global imports
- **No Circular Dependencies**: factor shared logic into a third module
- **CommunityDataService**: singleton (`CommunityDataService.getInstance()`); anti-stampede via single `loadingPromise`; exposes `players[]`, `playerIds Set`, `displayNames Map`, `playerById Map`

## Middleware

All analytics endpoints use composed stacks from `middleware/analyticsMiddleware.ts`:

| Export | Role |
|--------|------|
| `requireAnalyticsFeature` | Returns 404 when `ENABLE_PLAYER_ANALYTICS !== 'true'` |
| `analyticsRateLimit` | 100 req / 15 min per IP (skipped in `NODE_ENV=test`) |
| `expensiveAnalyticsRateLimit` | 20 req / 1 hr per IP |
| `validateAnalyticsRequest(schema)` | Zod parse of `req.query` → stores result as `req.validatedQuery`; returns 400 on failure |
| `analyticsSecurityHeaders` | Sets `X-Content-Type-Options`, `X-Frame-Options`, `Cache-Control: private, no-store` |
| `analyticsBodyLimit` | Rejects payloads > 1 KB with 413 |
| `analyticsPerformanceMonitoring` | Wraps `res.json` to log response time; warns when > 5 s |
| `standardAnalyticsMiddleware` | Pre-composed array for standard endpoints |
| `expensiveAnalyticsMiddleware` | Pre-composed array for heavier operations |

```typescript
router.get('/player-analytics', standardAnalyticsMiddleware, async (req, res) => {
    const { timeframe, race, minimumGames } = req.validatedQuery
})
```

## Logging

Pino (`logging/logger.ts`). Pretty-printed in dev; JSON in prod. Redacts `authorization`, `cookie`, `password`. Always include a `feature` context field:

```typescript
logger.info({ feature: 'analytics', endpoint: req.path }, 'Processing request')
```

Log level controlled by `LOG_LEVEL` env var (default `info`).

## Request Identity

`utils/requestIdentity.ts`:
- `extractRequestId(req, res)` — reads `x-request-id` → `x-correlation-id` → `req.id`
- `resolveOrCreateCorrelationId(req)` — returns existing header or generates a new UUID

## Feature Flags

Feature flag guards live as named middleware, not a standalone utility file:

```typescript
// Pattern used in analyticsMiddleware.ts
const enabled = String(process.env.ENABLE_PLAYER_ANALYTICS ?? 'false').toLowerCase() === 'true'
if (!enabled) return res.status(404).json({ error: 'Feature not available' })
```

Naming convention: `ENABLE_[DOMAIN]_[FEATURE]` — default `false` until tested.

## Error Handling

- Custom error types: `ExternalApiError`, `ValidationError`
- Retry with exponential backoff + jitter; cap retry count
- Fallback to last good cache; never silently swallow exceptions
- Log all unexpected errors with request params and timestamps; never log sensitive data
- Zod validation failures → `400` with `{ error, details: [{ field, message, received }] }`

## SC2 Domain Definitions

- **MMR Delta**: `Current Rating − Previous Rating` between two snapshots
- **Streak**: consecutive wins/losses; requires chronological data with no gaps > 72 h; null streaks must include a reason
- **Activity Window**: configurable period (24 h, 7 d, 30 d) measuring games played, rating change, engagement
- **Composite Key**: `{season, region, queue, teamType}` for data scoping; player identity canonical key is `characterId`
- **Online threshold**: `ONLINE_THRESHOLD_MINUTES` env var (default 30); used by `OnlineStatusCalculator.isPlayerOnline()`
- **Snapshot expiry**: aligns to CR midnight; `POSITION_INDICATOR_CACHE` hours (default 24); controlled by `snapshotService.ts`

## Observability

Lightweight counters in `metrics/lite.ts` (`http_total`, `cache_hit_total`, `pulse_latency_bins`, etc.). Extend new counters there when adding features; do not add external monitoring infrastructure.

Performance SLA: analytics endpoints p95 < 500 ms, p99 < 1000 ms, error rate < 1%, cache hit > 80% after warmup.
