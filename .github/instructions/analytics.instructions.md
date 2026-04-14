---
description: "Use when working on player analytics features, analyticsMiddleware, analyticsService, analyticsRoutes, or any analytics-related endpoint, test, or service. Covers the middleware stack, service architecture, Zod validation, feature flags, monitoring, and free-tier constraints."
---

# Player Analytics Patterns

## Implemented Files

```
src/server/services/
  analyticsService.ts       AnalyticsService class — core metrics generation
  dataDerivations.ts        OnlineStatusCalculator, DataDerivationsService — pure helpers
  snapshotService.ts        Snapshot lifecycle (CR midnight expiry, auto-refresh)
  communityDataService.ts   Singleton CSV reader with Maps/Sets for O(1) lookups

src/server/middleware/
  analyticsMiddleware.ts    Validation, rate limiting, feature flag, security headers, perf monitoring

src/server/routes/
  analyticsRoutes.ts        Endpoints using standardAnalyticsMiddleware / expensiveAnalyticsMiddleware

src/server/utils/
  cacheKeys.ts              CacheKeyBuilder, CacheDomain, CacheScope, CacheTTL
  rankingFilters.ts         getRankingMinGamesThreshold(), filterRankingForDisplay(), isValidRankingRow()
  requestIdentity.ts        extractRequestId(), resolveOrCreateCorrelationId()
```

## Middleware Stack

Use pre-composed arrays — never inline individual middleware on analytics routes:

```typescript
// Standard analytics endpoints
router.get('/player-analytics', standardAnalyticsMiddleware, handler)

// Expensive operations
router.get('/player-analytics/distributions', expensiveAnalyticsMiddleware, handler)
```

## Zod Request Validation

All query parameters are validated by `validateAnalyticsRequest(schema)` before route handlers run. Results are stored as `req.validatedQuery` (typed via Request augmentation in `analyticsMiddleware.ts`).

```typescript
// Schema example from analyticsMiddleware.ts
const analyticsQuerySchema = z.object({
    race: z.enum(['TERRAN', 'PROTOSS', 'ZERG', 'RANDOM']).optional(),
    timeframe: z.enum(['current', 'daily']).optional().default('current'),
    minimumGames: z.string().optional()
        .transform((val) => val ? parseInt(val, 10) : 20)
        .refine((val) => val >= 0 && val <= 1000),
})

// In handler:
const { race, timeframe, minimumGames } = req.validatedQuery
```

Validation failure → `400` with `{ error, details: [{ field, message, received }] }`.

## Minimum Games — Analytics Contract

The `minimumGames` query param is accepted for API compatibility but **does not re-filter**. `pulseService.getRanking()` already enforces the global threshold. Only `race` filtering may be applied on top of the pre-filtered dataset.

## Feature Flag

Analytics endpoints require `ENABLE_PLAYER_ANALYTICS=true`. The `requireAnalyticsFeature` middleware returns `404` when disabled. New analytics routes must include this middleware (via `standardAnalyticsMiddleware`).

## Caching

- Cache key pattern: `analytics:player:<scope>:<date>` built via `CacheKeyBuilder`
- Standard TTL: 15 min (`AnalyticsService.CACHE_TTL_MINUTES`)
- Expensive operations TTL: 60 min (`AnalyticsService.EXPENSIVE_CACHE_TTL_MINUTES`)
- Snapshot data: CR midnight via `snapshotService`

## Infrastructure Constraints

- No new databases, cron jobs, or external services
- Stay within free-tier limits: compute on read, minimal persistent storage
- SC2Pulse rate limit: 10 RPS — coordinate across all service calls
- All scheduled operations must align to America/Costa_Rica timezone

## Monitoring

Log all analytics requests with `{ feature: 'analytics', endpoint, responseTime }`. Slow responses (> 5 s) trigger a `logger.warn`. Do not add new APM infrastructure — extend `metrics/lite.ts` counters only.

## Testing Requirements

- Test both enabled (`ENABLE_PLAYER_ANALYTICS=true`) and disabled states
- Validate against golden fixtures for known-good data structures
- Range checks: MMR 1000–8000, player counts > 0
- Ensure no regression of existing ranking functionality
