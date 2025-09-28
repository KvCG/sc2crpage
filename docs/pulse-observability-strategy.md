# Pulse Integration Observability Strategy

## Overview
This document defines comprehensive observability for SC2CR's Pulse API integration, focusing on request tracing, performance monitoring, and health indicators without disrupting existing functionality.

## Current Observability Infrastructure

### Existing Metrics (`src/server/metrics/lite.ts`)
```typescript
export const metrics = {
    http_total: 0,              // Total HTTP requests
    http_5xx_total: 0,          // HTTP server errors  
    pulse_req_total: 0,         // Pulse API calls
    cache_hit_total: 0,         // Cache hits
    cache_miss_total: 0,        // Cache misses
    pulse_err_total: {          // Pulse errors by type
        timeout: 0,
        http4xx: 0, 
        http5xx: 0,
        network: 0,
        other: 0,
    },
    pulse_latency_bins: [0, 0, 0, 0, 0, 0], // <100, <250, <500, <1000, <2000, >=2000ms
}
```

### Request Context (`src/server/observability/requestContext.ts`)
- **Per-request tracking** via AsyncLocalStorage
- **Request ID injection** for distributed tracing
- **Scoped counters** for pulse calls, errors, cache hits/misses

### Logging (`src/server/logging/logger.ts`)
- **Structured JSON logging** with Pino
- **Route-level metadata** (user-agent, IP, query params)
- **Attribution headers** for external API usage

## Enhanced Observability Strategy

### 1. Request Metadata Enrichment

**Current Request Logging**:
```typescript
// src/server/routes/pulseRoutes.ts
logger.info({ 
    route: '/api/top', 
    details: { referer, device, os, ip } 
}, 'fetch live ranking')
```

**Proposed Enhancements**:
```typescript
// Enhanced request context
type PulseRequestContext = {
    requestId: string
    route: string
    startTime: number
    searchTerm?: string
    resultCount?: number
    cacheHit: boolean
    pulseApiCalls: number
    totalLatency: number
    errors: string[]
}

// Per-request metadata collection
export function enrichPulseRequest(req: Request, context: Partial<PulseRequestContext>) {
    const requestId = getRequestId()
    if (requestId) {
        updateRequestObservability(requestId, context)
    }
}
```

### 2. Additional Performance Counters

**Health Indicators**:
```typescript
export const pulseHealth = {
    // API Availability
    consecutive_failures: 0,
    last_success_timestamp: 0,
    uptime_percentage_24h: 100,
    
    // Rate Limiting
    rate_limit_near_misses: 0,      // Requests delayed by rate limiter
    rate_limit_violations: 0,        // 429 responses received
    
    // Data Quality  
    empty_responses: 0,              // Valid but empty API responses
    malformed_responses: 0,          // Invalid JSON or structure
    incomplete_player_data: 0,       // Missing race/rating/league
    
    // Cache Effectiveness
    cache_efficiency_ratio: 0,       // hit_rate over time window
    cache_evictions_premature: 0,    // TTL expired during high load
    
    // Search Performance
    search_query_length_avg: 0,      // Average search term length
    search_result_count_avg: 0,      // Average results per search
    search_zero_results: 0,          // Searches returning no results
}
```

**Timing Measurements**:
```typescript
export const pulseTiming = {
    // End-to-end latencies
    route_total_duration: new Histogram([50, 100, 250, 500, 1000, 2500, 5000]),
    
    // Service layer timing  
    pulse_api_duration: new Histogram([25, 50, 100, 250, 500, 1000, 2500]),
    format_data_duration: new Histogram([1, 5, 10, 25, 50, 100, 250]),
    snapshot_compute_duration: new Histogram([100, 250, 500, 1000, 2500, 5000]),
    
    // Cache operations
    cache_lookup_duration: new Histogram([0.1, 0.5, 1, 2, 5, 10, 25]),
    cache_write_duration: new Histogram([0.5, 1, 2, 5, 10, 25, 50]),
    
    // External dependencies
    csv_read_duration: new Histogram([5, 10, 25, 50, 100, 250, 500]),
    http_request_duration: new Histogram([50, 100, 250, 500, 1000, 2500, 5000]),
}
```

### 3. Lightweight Instrumentation Points

**HTTP Client Instrumentation** (`pulseHttpClient.ts`):
```typescript
export async function get<T>(path: string, params?: Record<string, any>): Promise<T> {
    const startTime = Date.now()
    const requestId = getRequestId()
    
    try {
        bumpPulseReq() // Existing counter
        
        // Enhanced: track request details
        observePulseRequestStart(requestId, path, params)
        
        const response = await axios.get(/* ... */)
        const duration = Date.now() - startTime
        
        // Enhanced: success metrics
        observePulseLatency(duration) // Existing
        observePulseSuccess(requestId, path, response.data?.length || 0)
        
        return response.data
    } catch (error) {
        const duration = Date.now() - startTime
        
        // Enhanced: error classification
        const errorType = classifyPulseError(error)
        bumpPulseErr(errorType) // Existing
        observePulseFailure(requestId, path, errorType, duration)
        
        throw error
    }
}
```

**Service Layer Hooks**:
```typescript
// In pulseApi.ts getTop()
export const getTop = async (): Promise<any[]> => {
    const timer = startTimer('pulse_ranking_fetch')
    const requestId = getRequestId()
    
    try {
        const cachedData = cache.get(cacheKey)
        if (cachedData) {
            observeCacheHit(requestId, 'ranking', cachedData.length)
            return cachedData
        }
        
        observeCacheMiss(requestId, 'ranking')
        
        // Existing logic...
        const result = await fetchAndProcessRanking()
        
        observeRankingResult(requestId, result.length, extractDataQuality(result))
        
        return result
    } finally {
        timer.end()
    }
}
```

**Route-Level Observability**:
```typescript
// In pulseRoutes.ts
router.get('/top', async (req: Request, res: Response) => {
    const routeTimer = startTimer('route_top_duration')
    const requestId = getRequestId()
    
    try {
        // Existing logic...
        const rankingData = await getTop()
        
        // Enhanced: response metadata
        observeRouteSuccess(requestId, {
            route: '/api/top',
            resultCount: rankingData.length,
            filtered: filteredCount < originalCount,
            clientInfo: getClientInfo(req.headers['user-agent'])
        })
        
        res.json(formattedData)
    } catch (error) {
        observeRouteError(requestId, '/api/top', error)
        throw error
    } finally {
        routeTimer.end()
    }
})
```

### 4. Health Check Endpoints

**Pulse Integration Health**:
```typescript
// New route: GET /api/health/pulse
router.get('/health/pulse', (req: Request, res: Response) => {
    const health = {
        status: calculatePulseHealth(),
        metrics: {
            uptime_24h: pulseHealth.uptime_percentage_24h,
            cache_hit_ratio: calculateCacheHitRatio(),
            avg_response_time: calculateAverageResponseTime(),
            error_rate_1h: calculateErrorRate(3600),
        },
        dependencies: {
            sc2pulse_api: checkUpstreamHealth(),
            csv_data: checkCsvDataFreshness(),
            cache: checkCacheHealth(),
        },
        last_updated: new Date().toISOString()
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 503
    res.status(statusCode).json(health)
})
```

### 5. Alerting Thresholds

**Performance Degradation**:
- Route response time p95 > 2000ms
- Pulse API response time p95 > 1000ms  
- Cache hit ratio < 60% over 10 minutes
- Error rate > 5% over 5 minutes

**Availability Issues**:
- Consecutive failures > 3
- Uptime < 95% over 1 hour
- Rate limit violations > 10 per hour
- Empty responses > 20% over 10 minutes

**Data Quality Problems**:
- Malformed responses > 1% over 1 hour
- Incomplete player data > 5% over 10 minutes
- Search zero results > 80% over 5 minutes

### 6. Implementation Phases

**Phase 1: Enhanced Request Context (Non-intrusive)**
- Add timing measurements to existing functions
- Enrich request logging with performance metadata
- Implement health counters

**Phase 2: Health Endpoints**  
- Add `/api/health/pulse` endpoint
- Implement alerting thresholds
- Create operational dashboards

**Phase 3: Advanced Analytics**
- Search pattern analysis
- User behavior correlation  
- Predictive cache warming

### 7. Operational Benefits

**Debugging Support**:
- Request tracing across service boundaries
- Performance bottleneck identification
- Error pattern analysis

**Capacity Planning**:
- Load pattern understanding
- Cache effectiveness measurement
- Rate limit headroom monitoring

**Quality Assurance**:
- Data integrity validation
- API compatibility monitoring  
- User experience impact assessment

## Implementation Guidelines

1. **Non-intrusive**: All observability hooks should be lightweight and not affect core business logic
2. **Opt-in**: New metrics collection should be configurable via environment variables
3. **Backward compatible**: Existing logging and metrics must continue to work unchanged
4. **Performance conscious**: Observability overhead should be <1% of request latency
5. **Privacy aware**: Do not log sensitive user data or search terms in production