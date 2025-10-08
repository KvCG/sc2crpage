# Data Flow Architecture

This document describes how data flows through the SC2CR application, from user interactions to external API responses.

## Overview

```
User Action → Client → API Gateway → Services → External APIs → Cache → Response
     ↑                                                                       ↓
     └─────────────────── Formatted Response ←──────────────────────────────┘
```

## 1. Client-Side Data Flow

### Request Initiation
```typescript
// User triggers action (e.g., search player)
const { data, loading, error } = useFetch('search', { term: 'player#1234' })
```

### Environment-Aware Routing
```typescript
// services/config.ts determines API base URL
const config = {
  // Production: sc2cr-latest.onrender.com
  // Development: sc2cr-dev.fly.dev  
  // Local: localhost:3000
}
```

### API Call Chain
1. **Hook Layer**: `hooks/useFetch.tsx` or `hooks/usePost.tsx`
2. **Service Layer**: `services/api.ts` constructs HTTP requests
3. **Request Identity**: Correlation ID attached via interceptor
4. **Network**: Axios HTTP client with timeout and retry logic

## 2. Server-Side Request Processing

### Request Pipeline
```
HTTP Request → Express Middleware → Route Handler → Service Layer → Response
```

### Middleware Stack
1. **CORS**: Cross-origin request handling
2. **Body Parsing**: JSON/URL-encoded payload processing
3. **HTTP Logging**: Request/response logging with pino
4. **Metrics**: Request counting and performance tracking
5. **Request Context**: Correlation ID extraction and context setup

### Route Resolution
```typescript
// routes/apiRoutes.ts - Main router composition
app.use('/api', [
  pulseRoutes,        // /top, /search, /snapshot, /ranking
  analyticsRoutes,    // /player-analytics, /deltas
  schedulerRoutes,    // /scheduler, /persistence
  challongeRoutes,    // /tournament
  utilityRoutes,      // /health, /refreshCache
  googleRoutes,       // /getReplays, /uploadReplay
  replayAnalyzerRoutes // /analyzeReplay*
])
```

## 3. Service Layer Data Processing

### Pulse Data Flow (Primary Path)
```
Request → pulseService.ts → pulseHttpClient.ts → SC2Pulse API
                    ↓
           Cache Check (LRU, 30s TTL)
                    ↓
           Response Formatting → Client
```

### Analytics Data Flow
```
Request → analyticsService.ts → Multiple Data Sources
    ├── Current Rankings (pulseService.ts)
    ├── Historical Snapshots (snapshotService.ts)
    ├── Delta Computation (deltaComputationEngine.ts)
    └── Persistence Layer (playerAnalyticsPersistence.ts)
                    ↓
           Aggregated Response → Client
```

### Cache Strategy
```typescript
// utils/cache.ts - LRU Cache with TTL
const cache = new LRUCache({
  max: 1000,        // Maximum entries
  ttl: 30000,       // 30 second TTL
  updateAgeOnGet: true
})
```

## 4. External API Integration Patterns

### SC2Pulse API Integration
```typescript
// Rate limiting: 10 RPS across all features
// Base URL: https://sc2pulse.nephest.com/sc2/api/
// Endpoints: character/search, season/list/all, group/team
```

**Flow:**
1. Request validation and rate limit check
2. HTTP client with timeout and retry logic
3. Response validation and DTO mapping
4. Cache storage with appropriate TTL
5. Success/error metrics recording

### Google Drive Integration
```typescript
// Used for: Backup storage, replay management, CSV data
// Authentication: Service account JSON key
// Storage pattern: Hierarchical folders by environment
```

### Challonge API Integration
```typescript
// Tournament bracket data
// Rate limiting: Per Challonge API limits
// Caching: Tournament data cached for extended periods
```

## 5. Caching Architecture

### Multi-Layer Caching Strategy

#### Layer 1: In-Memory (Server)
```typescript
// Primary cache: LRU with 30s TTL
// Use case: Live ranking data, search results
// Eviction: TTL expiration + LRU policy
```

#### Layer 2: Client-Side (Browser)
```typescript
// localStorage for snapshots
// Use case: Daily baseline rankings for position indicators
// Validation: Server-provided expiry timestamps
```

#### Layer 3: Persistent Storage (Google Drive)
```typescript
// Long-term backup storage
// Use case: Historical snapshots, analytics persistence
// Retention: Configurable (default 90 days)
```

### Cache Key Patterns
```typescript
// Hierarchical naming: domain:entity:scope:identifier
'ranking:top:live:20241007'
'analytics:player:24h:2024-01-15' 
'snapshot:daily:baseline:20241007'
```

## 6. Data Transformation Pipeline

### Inbound Data Processing
1. **Validation**: Schema validation against external API responses
2. **Normalization**: Convert to internal DTO format
3. **Enrichment**: Add computed fields (position changes, activity levels)
4. **Filtering**: Apply minimum games, activity filters
5. **Caching**: Store processed results

### Outbound Response Formatting
1. **Success Wrapper**: Standardized `{ success: true, data: ... }` format
2. **Error Handling**: Consistent error structure with codes
3. **Metadata**: Include timestamps, pagination, confidence scores
4. **Headers**: Attribution headers for external API usage

## 7. Real-Time Features

### Position Change Indicators
```typescript
// Daily snapshot baseline vs live ranking comparison
const baseline = await getDailySnapshot()
const current = await pulseService.getRanking()
const withIndicators = addPositionChangeIndicator(current, baseline.data)
```

**Flow:**
1. Load cached daily snapshot (24h TTL)
2. Fetch current live rankings
3. Compare positions by btag/player ID
4. Compute up/down/none indicators
5. Return enhanced ranking data

### Analytics Scheduling
```typescript
// Background operations with configurable intervals
const scheduler = {
  snapshots: '0 6 * * *',    // Daily at 6 AM Costa Rica time
  activity: '*/30 * * * *',  // Every 30 minutes
  cleanup: '0 2 * * 0'       // Weekly cleanup
}
```

## 8. Error Handling & Resilience

### Graceful Degradation
1. **External API Failures**: Return cached data with staleness indicator
2. **Cache Misses**: Fetch from source with loading states
3. **Partial Data**: Continue with available data, log gaps
4. **Rate Limits**: Exponential backoff with jitter

### Error Propagation
```typescript
// Structured error responses
{
  success: false,
  error: {
    code: 'EXTERNAL_API_ERROR',
    message: 'SC2Pulse API unavailable',
    context: { endpoint: '/character/search', retryAfter: 30 }
  }
}
```

## 9. Performance Considerations

### Request Optimization
- **Parallel Fetching**: Independent data sources fetched concurrently
- **Conditional Requests**: ETags and If-Modified-Since headers
- **Compression**: Gzip response compression
- **CDN**: Static asset delivery via Vercel edge network

### Database-Free Architecture
- **In-Memory Storage**: All data cached in application memory
- **External Persistence**: Google Drive for long-term storage
- **CSV Fallback**: Offline capability with local data files
- **Stateless Design**: Horizontal scaling capability

## 10. Security & Data Privacy

### Data Handling
- **No PII Storage**: Only public ladder data and battle tags
- **API Key Management**: Environment variables for external services
- **Rate Limiting**: Protect against abuse and external API limits
- **Request Validation**: Input sanitization and parameter validation

### Attribution & Compliance
- **SC2Pulse Attribution**: Required header for API usage compliance
- **Non-Commercial Use**: Adherence to external API terms of service
- **CORS Policy**: Controlled cross-origin access patterns