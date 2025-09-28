# Pulse Integration Inventory

## Overview
This document catalogs all modules and components that interact with the SC2Pulse API, serving as a baseline for testing and observability improvements.

## Core API Endpoints

### `/api/top` - Live Ranking Data
- **Route**: `src/server/routes/pulseRoutes.ts`
- **Handler**: Calls `getTop()` from `pulseApi.ts`
- **Response**: Filtered and formatted ranking data
- **Caching**: 30s TTL via LRU cache
- **Headers**: Sets `x-sc2pulse-attribution`

### `/api/search` - Player Search
- **Route**: `src/server/routes/pulseRoutes.ts` 
- **Handler**: Calls `searchPlayer(term)` from `pulseApi.ts`
- **Response**: Formatted search results
- **Input**: Query parameter `term`
- **Headers**: Sets `x-sc2pulse-attribution`

### `/api/snapshot` - Daily Baseline
- **Route**: `src/server/routes/pulseRoutes.ts`
- **Handler**: Calls `getDailySnapshot()` from `snapshotService.ts`
- **Response**: Cached 24h baseline with position indicators
- **Caching**: Daily TTL with Costa Rica timezone alignment
- **Headers**: Sets `x-sc2pulse-attribution`

## Service Layer

### `pulseApi.ts` - Core Business Logic
**Key Functions:**
- `getTop()`: Fetches and processes live ranking data
- `searchPlayer(term)`: Character search with encoding handling
- `getPlayersStats(playerIds)`: Batch stats retrieval with chunking
- `extractRace(highestRatingObj)`: Race extraction logic
- `isPlayerLikelyOnline(stats)`: Online status determination
- `getPlayerGamesPerRace(stats)`: Race-specific game counting

**Data Flow:**
1. `getPlayersIds()` → CSV player list
2. `getPlayersStats()` → SC2Pulse team data 
3. Race/league extraction and aggregation
4. Cache storage with anti-stampede protection

### `pulseHttpClient.ts` - HTTP Transport
**Features:**
- Rate limiting (10 RPS configurable)
- Retry logic for 429/5xx errors
- Observability hooks (metrics, request context)
- Centralized endpoint definitions

**Endpoints:**
- `character/search` - Player search
- `season/list/all` - Season enumeration  
- `group/team` - Team statistics

### `snapshotService.ts` - Daily Baseline Management
**Features:**
- 24-hour caching with Costa Rica timezone
- Background refresh on expiry
- Data filtering for integrity
- Expiry calculation for client cache validation

## Utility Layer

### `userDataHelper.ts` - Player Verification
- `verifyPlayer()`: Enriches player data with CSV battleTag/name
- `verifyChallongeParticipant()`: Tournament participant matching
- **Dependency**: Uses `getTop()` for live data correlation

### `rankingHelper.ts` - Position Change Indicators  
- `addPositionChangeIndicator()`: Computes up/down/none indicators
- **Algorithm**: Maps btag → position, calculates deltas
- **Edge Cases**: Handles new players, missing baseline data

## Client Integration

### `services/api.ts` - HTTP Client
**Pulse Endpoints:**
- `getTop()` → `/api/top`
- `getSnapshot()` → `/api/snapshot` 
- `search(term)` → `/api/search`

**Features:**
- Request ID injection via interceptors
- Axios-based with configurable base URL

### `services/config.ts` - Environment Selection
**Logic**: Hostname-based API endpoint selection
- Production: Render API
- Development: Fly.io API  
- Local: localhost:3000

## Data Dependencies

### CSV Data (`ladderCR.csv`)
**Location**: `dist/data/ladderCR.csv`
**Content**: Player ID → battleTag/name mappings
**Usage**: Player identity resolution across all Pulse operations

### External APIs
**SC2Pulse**: `https://sc2pulse.nephest.com/sc2/api/`
- **Rate Limit**: 10 RPS (configurable via `PULSE_RPS`)
- **Authentication**: None required
- **Reliability**: Community-maintained, no SLA

## Caching Strategy

### LRU Cache (`utils/cache.ts`)
- **TTL**: 30 seconds for live data
- **Anti-stampede**: Shared in-flight promises
- **Metrics**: Hit/miss tracking via observability layer

### Snapshot Cache (`utils/snapshotCache.ts`)  
- **TTL**: 24 hours aligned to Costa Rica midnight
- **Background Refresh**: Automatic on expiry
- **Client Cache**: Expiry timestamp provided for validation

## Current Test Coverage

### Unit Tests
- `pulseRoutes.test.ts` - Route handlers
- `pulseSnapshotRoutes.test.ts` - Snapshot endpoint
- `pulseHttpClient.test.ts` - HTTP client
- `snapshotService.test.ts` - Daily snapshot logic
- `rankingHelper.test.ts` - Position indicators

### Integration Tests
- `pulseApi.test.ts` - Core API integration
- `pulseApi.branches.test.ts` - Edge case coverage
- `pulseApi.moreBranches.test.ts` - Additional scenarios
- `pulseApi.rawFixtures.test.ts` - Fixture-based testing

### Existing Fixtures
- `pulse/raw/seasons.json` - Season list responses
- `pulse/raw/groupTeam.array.json` - Multi-team responses
- `pulse/raw/groupTeam.single.json` - Single team responses

## Risk Assessment Areas

### External Dependencies
- **SC2Pulse API availability**: No redundancy or fallback
- **Rate limiting compliance**: Hard 10 RPS limit
- **Schema stability**: No API versioning contract

### Data Consistency  
- **Cache coherence**: 30s TTL vs real-time needs
- **Race extraction**: Fragile to upstream format changes
- **Player identity**: CSV dependency for battleTag resolution

### Performance Bottlenecks
- **Batch processing**: 100-player chunks, 400-team API limit
- **Sequential requests**: No parallelization of chunk processing
- **Memory usage**: Full dataset caching with no size limits