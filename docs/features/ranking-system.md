# Ranking System Feature

The SC2CR ranking system provides live ladder rankings, player search, and historical position tracking for StarCraft 2 players.

## Overview

The ranking system is built around SC2Pulse API integration with enhanced features for position change tracking and analytics. It serves as the core feature of the application, providing real-time ladder data with caching optimizations and historical analysis.

## Core Features

### Live Rankings (`/top`)
- **Purpose**: Display current top player rankings with filtering options
- **Data Source**: SC2Pulse API with 30-second LRU cache
- **Filters**: Minimum games, inactive player inclusion
- **Response**: Array of `RankedPlayer` objects with rating, race, league info

### Player Search (`/search`)
- **Purpose**: Search for specific players by battle tag or name
- **Data Source**: SC2Pulse character search API
- **Input**: Search term (battle tag format: `Player#1234`)
- **Response**: Array of matching player profiles with character IDs

### Daily Snapshots (`/snapshot`)
- **Purpose**: Provide baseline ranking data for position change calculations
- **Schedule**: Generated daily at 6 AM Costa Rica time
- **Caching**: 24-hour TTL with localStorage persistence on client
- **Usage**: Powers position change indicators (up/down arrows)

### Enhanced Rankings (`/ranking`)
- **Purpose**: Live rankings with embedded delta information
- **Features**: Position changes, rating deltas, confidence scores
- **Data Sources**: Current rankings + historical snapshots
- **Analytics**: Powered by `DeltaComputationEngine`

## API Endpoints

### GET /api/top
Returns current top player rankings.

**Query Parameters:**
- `includeInactive` (boolean, default: false)
- `minimumGames` (number, default: 20)

**Response Format:**
```json
[
  {
    "id": 12345,
    "btag": "Player#1234",
    "name": "Player Name",
    "ratingLast": 4500,
    "race": "Terran",
    "leagueTypeLast": 6,
    "daysSinceLastGame": 1,
    "gamesPlayedRecent": 25
  }
]
```

**Caching:** 30-second LRU cache via `utils/cache.ts`

### GET /api/search
Search for players by battle tag or name.

**Query Parameters:**
- `term` (string, required) - Search term

**Response Format:**
```json
[
  {
    "character": { "id": 12345 },
    "account": { "battleTag": "Player#1234" },
    "ratingLast": 4500,
    "race": "TERRAN"
  }
]
```

### GET /api/snapshot
Returns daily baseline ranking snapshot.

**Response Format:**
```json
{
  "data": [/* RankingRow array */],
  "createdAt": "2024-10-07T06:00:00.000Z",
  "expiry": 1728316800000
}
```

**Generation:** Automated via `PlayerAnalyticsScheduler` at 6 AM CR time

## Position Change Indicators

The ranking system includes position change tracking between current rankings and daily baselines.

### Implementation Pattern
1. **Baseline Storage**: Daily snapshots cached in `localStorage` with key `dailySnapshot`
2. **Live Data**: Retrieved via `useFetch('ranking')` from `/api/top`
3. **Delta Calculation**: `utils/rankingHelper.addPositionChangeIndicator()` compares positions
4. **Indicators**: Up arrow (↑), down arrow (↓), or no change based on `btag` matching

### Client-Side Caching
```javascript
// localStorage pattern for snapshots
const snapshot = {
  data: [/* ranking array */],
  createdAt: "2024-10-07T06:00:00.000Z",
  expiry: 1728316800000  // Server-provided expiry timestamp
}
```

## Technical Architecture

### Server-Side Components

**Route Handler**: `src/server/routes/pulseRoutes.ts`
- Mounts `/top`, `/search`, `/snapshot`, `/ranking` endpoints
- Implements query parameter validation
- Adds SC2Pulse attribution headers

**Service Layer**: `src/server/services/pulseApi.ts`
- `getRanking()` - Fetches and formats top players
- `searchPlayer()` - Handles player search queries
- Rate limiting coordination (10 RPS to SC2Pulse)

**Caching Layer**: `src/server/utils/cache.ts`
- LRU cache with 30-second TTL
- Prevents request stampedes with promise sharing
- Configurable size limits (1000 entries default)

**Snapshot Service**: `src/server/services/snapshotService.ts`
- `getDailySnapshot()` - Generates daily baseline data
- Costa Rica timezone alignment for consistent daily boundaries
- Google Drive backup integration for disaster recovery

### Client-Side Components

**Hook Integration**: `src/client/hooks/useFetch.tsx`
- `useFetch('ranking')` - Live rankings data
- `useFetch('search')` - Player search functionality
- Error handling and loading states

**API Client**: `src/client/services/api.ts`
- `getTop()` - Live rankings endpoint
- `search()` - Player search endpoint  
- `getSnapshot()` - Daily snapshot endpoint
- Axios-based with request correlation IDs

**Configuration**: `src/client/services/config.ts`
- Environment-aware API base URL selection
- Production: `sc2cr-latest.onrender.com`
- Development: `sc2cr-dev.fly.dev`
- Local: `localhost:3000`

## Data Flow

1. **Client Request**: User visits rankings page or searches for player
2. **Environment Detection**: `config.ts` selects appropriate API base URL
3. **API Call**: `useFetch` hook calls appropriate `api.ts` function
4. **Server Routing**: Express routes request to `pulseRoutes.ts` handler
5. **Cache Check**: `cache.ts` checks for existing data within TTL
6. **External API**: If cache miss, `pulseApi.ts` fetches from SC2Pulse
7. **Data Transform**: Response formatted via `formatData()` utility
8. **Response**: JSON data returned with attribution headers
9. **Client Update**: Hook updates component state with formatted data

## Error Handling

### Server-Side
- **External API Failures**: Graceful degradation with error logging
- **Rate Limiting**: Coordinated across all Pulse API integrations
- **Timeout Handling**: 8-second timeout with retry logic

### Client-Side
- **Network Errors**: User-friendly error messages
- **Loading States**: Spinner indicators during data fetches
- **Fallback Data**: Cached snapshots when live data unavailable

## Performance Optimizations

### Caching Strategy
- **Server Cache**: 30s TTL for live data, 24h for snapshots
- **Client Cache**: localStorage persistence for baseline snapshots
- **Request Deduplication**: Shared promises prevent duplicate API calls

### Rate Limiting
- **SC2Pulse Coordination**: 10 RPS limit across all features
- **Request Batching**: Efficient bulk operations where possible
- **Graceful Backoff**: Exponential backoff on rate limit errors

## Feature Flags

- **Base Feature**: Always enabled (core application functionality)
- **Enhanced Analytics**: Controlled via `ENABLE_PLAYER_ANALYTICS` flag
- **Background Snapshots**: Controlled via `ENABLE_DATA_SNAPSHOTS` flag

## Dependencies

### External APIs
- **SC2Pulse API**: Primary data source for rankings and search
- **Attribution Required**: Header inclusion for non-commercial use

### Internal Services
- **Cache Service**: `utils/cache.ts` for performance optimization
- **Snapshot Service**: Daily baseline generation and storage
- **Format Service**: `utils/formatData.ts` for response standardization
- **Analytics Integration**: Delta computation for enhanced rankings

## Testing

### Server Tests
- Route handler tests in `__tests__/unit/pulseRoutes.test.ts`
- Service layer tests with mocked SC2Pulse responses
- Cache behavior validation with TTL scenarios

### Client Tests  
- Hook tests in `hooks/useFetch.test.tsx`
- API client tests with mocked responses
- Component integration tests for ranking displays

## Future Enhancements

- **Real-time Updates**: WebSocket integration for live ranking changes
- **Historical Analysis**: Extended position tracking beyond daily snapshots
- **Advanced Filtering**: Race-specific rankings and league filtering
- **Personalized Tracking**: User-specific player following and notifications
