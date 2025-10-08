# API Endpoints Reference

This document provides a comprehensive reference for all SC2CR API endpoints.

## Base URL
- **Production**: `https://sc2cr-latest.onrender.com/api`
- **Development**: `https://sc2cr-dev.fly.dev/api`  
- **Local**: `http://localhost:3000/api`

## Configuration & Timeouts
- **Request Timeout**: 8000ms (configurable via `PULSE_TIMEOUT_MS`)
- **Cache TTL**: 30s for live data, 15min for analytics, 60min for expensive operations
- **Rate Limiting**: 10 RPS coordination with SC2Pulse API across all features

## Authentication
No authentication required. All endpoints are publicly accessible.

## Rate Limits & Feature Flags
- **External API Coordination**: 10 RPS to SC2Pulse across all features
- **Analytics Endpoints**: Require `ENABLE_PLAYER_ANALYTICS=true`
- **Background Operations**: Require `ENABLE_DATA_SNAPSHOTS=true`
- **No Public Rate Limiting**: Client requests are not explicitly rate limited

## Response Format
All endpoints return JSON with consistent structure:

### Success Response
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "metadata": { /* optional metadata */ }
}
```

### Error Response  
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "context": { /* optional debugging context */ }
  }
}
```

## Core Endpoints

### GET /top
Returns current top player rankings (live data).

**Query Parameters:**
- `includeInactive` (boolean, default: false) - Include inactive players
- `minimumGames` (number, default: 20) - Minimum games filter

**Response:**
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

**Headers:**
- `x-sc2pulse-attribution`: Attribution for SC2Pulse API usage

### GET /search
Search for players by battle tag or name.

**Query Parameters:**
- `term` (string, required) - Search term

**Response:**
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

### GET /snapshot
Returns daily baseline ranking snapshot for position change indicators.

**Response:**
```json
{
  "data": [/* array of RankingRow objects */],
  "createdAt": "2024-10-07T06:00:00.000Z",
  "expiry": 1728316800000
}
```

### GET /ranking
Enhanced ranking with embedded delta information (analytics feature).

**Query Parameters:**
- `timeWindowHours` (number, default: 24) - Time window for deltas
- `includeInactive` (boolean, default: false) - Include inactive players
- `minimumConfidence` (number, default: 75) - Minimum confidence score
- `maxDataAge` (number, default: 48) - Maximum data age in hours
- `minimumGames` (number, default: 20) - Minimum games filter

**Response:**
```json
{
  "success": true,
  "ranking": [
    {
      "id": 12345,
      "btag": "Player#1234",
      "currentRank": 0,
      "deltaData": {
        "positionChangeIndicator": "up",
        "positionDelta": 5,
        "ratingChange": 150
      }
    }
  ],
  "metadata": {
    "totalPlayers": 100,
    "withDeltas": 95,
    "options": { /* query parameters used */ },
    "timestamp": "2024-10-07T12:00:00.000Z"
  }
}
```

## Analytics Endpoints

### GET /player-analytics
Comprehensive player analytics and statistics.

**Feature Flag:** `ENABLE_PLAYER_ANALYTICS=true`

**Query Parameters:**
- `timeframe` (string, default: "current") - "current" or "daily"
- `includeInactive` (boolean, default: false) - Include inactive players
- `minimumGames` (number, default: 20) - Minimum games filter
- `race` (string, optional) - Filter by race: "Terran", "Protoss", "Zerg", "Random"

**Response:**
```json
{
  "success": true,
  "data": {
    "activityStats": {
      "totalPlayers": 1000,
      "activePlayers": 850,
      "onlineCount": 120,
      "averageDaysSinceLastGame": 2.5
    },
    "raceDistribution": {
      "Terran": 350,
      "Protoss": 300,
      "Zerg": 250,
      "Random": 100
    },
    "leagueStats": {
      "Grandmaster": 50,
      "Master": 200,
      "Diamond": 300
    },
    "metadata": {
      "totalPlayers": 1000,
      "timeframe": "current",
      "timestamp": "2024-10-07T12:00:00.000Z"
    }
  }
}
```

### GET /player-analytics/activity
Detailed activity analysis with temporal patterns.

**Feature Flag:** `ENABLE_PLAYER_ANALYTICS=true`

**Query Parameters:**
- `includeInactive` (boolean, default: false) - Include inactive players
- `groupBy` (string, default: "activity") - "race", "league", or "activity"
- `timeframe` (string, default: "current") - "current" or "daily"
- `minimumGames` (number, default: 20) - Minimum games filter

**Response:**
```json
{
  "success": true,
  "data": {
    "activityAnalysis": {
      "high": { "count": 300, "averageGames": 50 },
      "medium": { "count": 400, "averageGames": 25 },
      "low": { "count": 200, "averageGames": 10 },
      "inactive": { "count": 100, "averageGames": 0 }
    },
    "temporalPatterns": {
      "averageDaysSinceLastGame": 2.5,
      "mostActivePeriod": "evening",
      "peakActivityHour": 20
    },
    "metadata": {
      "totalPlayers": 1000,
      "groupBy": "activity",
      "timestamp": "2024-10-07T12:00:00.000Z"
    }
  }
}
```

### GET /deltas
Enhanced player deltas with position and rating changes.

**Query Parameters:**
- `timeWindowHours` (number, default: 24) - Time window for comparison
- `includeInactive` (boolean, default: false) - Include inactive players
- `minimumConfidence` (number, default: 50) - Minimum confidence score
- `maxDataAge` (number, default: 48) - Maximum baseline age in hours

**Response:**
```json
{
  "success": true,
  "deltas": [
    {
      "id": 12345,
      "btag": "Player#1234",
      "name": "Player Name",
      "positionChangeIndicator": "up",
      "positionDelta": 5,
      "previousRank": 10,
      "currentRank": 5,
      "ratingChange": 150,
      "previousRating": 4350,
      "currentRating": 4500,
      "activityLevel": "high",
      "race": "Terran",
      "leagueType": 6,
      "confidenceScore": 95
    }
  ],
  "metadata": {
    "count": 500,
    "options": { /* query parameters */ },
    "timestamp": "2024-10-07T12:00:00.000Z"
  }
}
```

## Scheduler Endpoints

### GET /scheduler
Get scheduler status and configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "intervalHours": 24,
    "timezone": "America/Costa_Rica",
    "nextRun": "2024-10-08T06:00:00.000Z",
    "lastRun": "2024-10-07T06:00:00.000Z",
    "metrics": {
      "snapshotCount": 150,
      "errorCount": 2,
      "lastError": null
    }
  }
}
```

### POST /scheduler/force-run
Force run a specific scheduled operation.

**Request Body:**
```json
{
  "operation": "snapshot" // "snapshot", "activity", or "movers"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "operation": "snapshot",
    "executed": true,
    "timestamp": "2024-10-07T12:00:00.000Z"
  }
}
```

## Persistence Endpoints

### GET /persistence
Get persistence layer status.

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "backupCount": 45,
    "lastBackup": "2024-10-07T06:00:00.000Z",
    "storage": {
      "provider": "GoogleDrive",
      "usage": "150MB",
      "quota": "15GB"
    }
  }
}
```

### GET /persistence/backups
List available historical backups.

**Query Parameters:**
- `maxAge` (number, default: 168) - Maximum age in hours (default: 1 week)

**Response:**
```json
{
  "success": true,
  "data": {
    "backups": [
      {
        "fileId": "1a2b3c4d5e6f",
        "fileName": "snapshot_2024-10-07.json",
        "timestamp": "2024-10-07T06:00:00.000Z",
        "metadata": {
          "type": "snapshot",
          "playerCount": 1000,
          "dataSize": 524288,
          "createdBy": "scheduler"
        }
      }
    ],
    "count": 1,
    "maxAge": 168
  }
}
```

## Tournament Endpoints

### GET /tournament
Get current tournament information.

**Response:**
```json
{
  "tournament": {
    "id": 12345,
    "name": "Weekly Tournament",
    "state": "underway",
    "participants_count": 64,
    "url": "https://challonge.com/tournament_url"
  }
}
```

## Replay Management Endpoints

### GET /getReplays
List available replay files.

**Response:**
```json
{
  "replays": [
    {
      "id": "replay_1",
      "name": "Game_2024-10-07.SC2Replay",
      "uploadDate": "2024-10-07T12:00:00.000Z",
      "size": 1048576
    }
  ]
}
```

### POST /uploadReplay
Upload a new replay file.

**Request:** Multipart form data with replay file

**Response:**
```json
{
  "fileId": "1a2b3c4d5e6f",
  "success": true
}
```

### POST /getReplayAnalysis
Get analysis for a specific replay.

**Request Body:**
```json
{
  "replayId": "replay_1"
}
```

**Response:**
```json
{
  "analysis": {
    "duration": "15:22",
    "map": "Ladder Map",
    "players": ["Player1#1234", "Player2#5678"],
    "winner": "Player1#1234",
    "matchup": "TvP"
  }
}
```

### POST /deleteReplay
Delete a replay file.

**Request Body:**
```json
{
  "replayId": "replay_1"
}
```

**Response:**
```json
{
  "success": true
}
```

## Replay Analysis Endpoints

### POST /analyzeReplayBase64
Analyze replay from base64 encoded data.

**Request Body:**
```json
{
  "fileBase64": "base64_encoded_replay_data"
}
```

### POST /analyzeReplayUrl
Analyze replay from URL.

**Request Body:**
```json
{
  "fileUrl": "https://example.com/replay.SC2Replay"
}
```

**Response (both endpoints):**
```json
{
  "status": "success",
  "analysis": {
    "duration": "12:45",
    "map": "Ladder Map Name",
    "players": ["Player1#1234", "Player2#5678"],
    "winner": "Player1#1234"
  }
}
```

## Utility Endpoints

### GET /health
Health check endpoint.

**Query Parameters:**
- `verbose` (boolean, default: false) - Include detailed health info

**Response:**
```json
{
  "status": "ok"
}
```

### GET /refreshCache
Manually refresh the data cache.

**Response:**
```json
"Done!"
```

## Debug Endpoints

### GET /debug
Get debug information based on type parameter.

**Query Parameters:**
- `type` (string, required) - "metrics", "buildInfo", or "req"
- `id` (string) - Request ID (for type="req")

**Examples:**
```bash
# Get metrics
GET /debug?type=metrics

# Get build info  
GET /debug?type=buildInfo

# Get request info
GET /debug?type=req&id=abc123
```

## Common Headers

### Request Headers
- `x-request-id` (optional) - Request correlation ID
- `User-Agent` - Client identification

### Response Headers  
- `x-sc2pulse-attribution` - Required attribution for SC2Pulse data
- `Cache-Control` - Caching directives for analytics endpoints
- `Content-Type` - Always `application/json`

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid request parameters |
| `NOT_FOUND` | Resource not found |
| `FEATURE_DISABLED` | Feature flag disabled |
| `SCHEDULER_ERROR` | Scheduler operation failed |
| `BACKUP_ERROR` | Backup/restore operation failed |
| `COMPUTATION_ERROR` | Delta computation failed |
| `EXTERNAL_API_ERROR` | External API unavailable |
| `INTERNAL_ERROR` | Unexpected server error |

## Data Types

### RankingRow
```typescript
interface RankingRow {
  id: number                    // SC2Pulse character ID
  btag: string                 // Battle.net tag
  name?: string                // Display name (optional)
  ratingLast: number           // Current MMR rating
  race: string                 // "Terran" | "Protoss" | "Zerg" | "Random"
  leagueTypeLast: number       // League tier (integer)
  daysSinceLastGame: number    // Days since last game
  gamesPlayedRecent: number    // Recent games played
}
```

### PlayerDelta
```typescript
interface PlayerDelta {
  id: number
  btag: string
  name?: string
  positionChangeIndicator: "up" | "down" | "none"
  positionDelta: number        // +/- position change
  previousRank: number
  currentRank: number
  ratingChange: number         // +/- rating change
  previousRating: number
  currentRating: number
  activityLevel: "high" | "medium" | "low" | "inactive"
  race: string
  leagueType: number
  confidenceScore: number      // 0-100
}
```

## SDK / Client Usage

### JavaScript/TypeScript
```typescript
const client = new SC2CRClient('https://sc2cr-latest.onrender.com')

// Get top rankings
const rankings = await client.getTop({ minimumGames: 20 })

// Search players
const results = await client.search('Player#1234')

// Get analytics (requires feature flag)
const analytics = await client.getPlayerAnalytics({ 
  timeframe: 'current',
  race: 'Terran' 
})
```

### cURL Examples
```bash
# Get top rankings
curl "https://sc2cr-latest.onrender.com/api/top?minimumGames=20"

# Search for player
curl "https://sc2cr-latest.onrender.com/api/search?term=Player%231234"

# Get daily snapshot
curl "https://sc2cr-latest.onrender.com/api/snapshot"
```

---

## Related Documentation

For comprehensive implementation details, see:
- **[Architecture Overview](../architecture/overview.md)** - System architecture and data flow
- **[Ranking System](../features/ranking-system.md)** - Core ranking features and endpoints
- **[Community Analytics](../features/community-analytics.md)** - Advanced analytics endpoints and implementation
- **[Client Integration](../client-architecture/hooks.md)** - Client-side API usage patterns and hooks