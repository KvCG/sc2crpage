# SC2CR Phase 3 API Specification
**Player Analytics & Historical Tracking API**

*Version: 3.0*  
*Last Updated: September 26, 2025*

## Overview

This document provides comprehensive API specifications for the Phase 3 analytics features, including historical tracking, delta computation, and automated data management. All endpoints follow RESTful conventions and return JSON responses with consistent error handling.

## Base Configuration

**Base URL**: `https://your-domain.com/api/analytics`  
**Content-Type**: `application/json`  
**Authentication**: Inherits from existing SC2CR authentication system

## Scheduler Management APIs

### Start Analytics Scheduler

Initiates the automated snapshot collection system.

```http
POST /api/analytics/schedule/start
```

**Request Body** (Optional):
```json
{
  "intervalHours": 24,
  "timezone": "America/Costa_Rica"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Analytics scheduler started successfully",
  "status": {
    "isRunning": true,
    "intervalHours": 24,
    "timezone": "America/Costa_Rica",
    "nextRun": "2025-09-27T12:00:00.000Z"
  }
}
```

**Error Responses**:
- `409 Conflict`: Scheduler already running
- `500 Internal Server Error`: Failed to start scheduler

### Stop Analytics Scheduler

Stops the automated snapshot collection system.

```http
POST /api/analytics/schedule/stop
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Analytics scheduler stopped successfully",
  "status": {
    "isRunning": false,
    "stoppedAt": "2025-09-26T14:30:00.000Z"
  }
}
```

### Get Scheduler Status

Retrieves current scheduler status and configuration.

```http
GET /api/analytics/schedule/status
```

**Response** (200 OK):
```json
{
  "success": true,
  "status": {
    "isRunning": true,
    "intervalHours": 24,
    "timezone": "America/Costa_Rica",
    "nextRun": "2025-09-27T12:00:00.000Z",
    "lastRun": "2025-09-26T12:00:00.000Z",
    "metrics": {
      "totalSnapshots": 15,
      "successfulRuns": 14,
      "failedRuns": 1,
      "lastError": null
    }
  }
}
```

## Backup Management APIs

### List Available Backups

Retrieves list of available historical snapshots.

```http
GET /api/analytics/backups
```

**Query Parameters**:
- `limit` (optional, number): Maximum number of backups to return (default: 30)
- `offset` (optional, number): Number of backups to skip (default: 0)

**Response** (200 OK):
```json
{
  "success": true,
  "backups": [
    {
      "fileId": "1ABC123xyz",
      "fileName": "snapshot-2025-09-26-12-00-00.json",
      "timestamp": "2025-09-26T12:00:00.000Z",
      "metadata": {
        "type": "snapshot",
        "playerCount": 150,
        "dataSize": 12485,
        "createdBy": "scheduler"
      }
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 30,
    "offset": 0,
    "hasMore": false
  }
}
```

### Restore Specific Backup

Retrieves historical snapshot data by file ID.

```http
GET /api/analytics/restore/{fileId}
```

**Path Parameters**:
- `fileId` (string, required): Google Drive file ID of the backup

**Response** (200 OK):
```json
{
  "success": true,
  "snapshot": {
    "createdAt": "2025-09-26T12:00:00.000Z",
    "expiry": 1727363200000,
    "data": [
      {
        "id": 1,
        "btag": "Player1#1234",
        "name": "Player1",
        "ratingLast": 1600,
        "race": "Protoss",
        "leagueTypeLast": 3,
        "daysSinceLastGame": 1,
        "gamesPlayedRecent": 15
      }
    ]
  },
  "metadata": {
    "playerCount": 150,
    "dataSize": 12485,
    "restoredAt": "2025-09-26T14:30:00.000Z"
  }
}
```

**Error Responses**:
- `404 Not Found`: Backup file not found
- `500 Internal Server Error`: Failed to restore backup

### Cleanup Old Backups

Removes backups older than retention policy.

```http
DELETE /api/analytics/cleanup
```

**Query Parameters**:
- `dryRun` (optional, boolean): Preview deletions without executing (default: false)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Backup cleanup completed successfully",
  "results": {
    "backupsDeleted": 5,
    "spaceSaved": "45.2MB",
    "oldestRetained": "2025-07-28T12:00:00.000Z"
  }
}
```

## Delta Analysis APIs

### Get Player Deltas

Computes and retrieves player ranking changes over specified time period.

```http
GET /api/analytics/deltas
```

**Query Parameters**:
- `timeWindowHours` (optional, number): Time window for comparison (default: 24)
- `includeInactive` (optional, boolean): Include inactive players (default: false)
- `minimumConfidence` (optional, number): Minimum confidence score 0-100 (default: 75)

**Response** (200 OK):
```json
{
  "success": true,
  "deltas": [
    {
      "id": 1,
      "btag": "Player1#1234",
      "name": "Player1",
      "positionChangeIndicator": "up",
      "positionDelta": 3,
      "previousRank": 5,
      "currentRank": 2,
      "ratingChange": 150,
      "previousRating": 1450,
      "currentRating": 1600,
      "activityLevel": "high",
      "race": "Protoss",
      "leagueType": 3,
      "confidenceScore": 95
    }
  ],
  "metadata": {
    "timeWindow": {
      "hours": 24,
      "baseline": "2025-09-25T12:00:00.000Z",
      "current": "2025-09-26T12:00:00.000Z"
    },
    "totalPlayers": 150,
    "filteredCount": 120,
    "averageConfidence": 88
  }
}
```

### Get Activity Analysis

Provides population-level activity and movement analysis.

```http
GET /api/analytics/activity
```

**Query Parameters**: Same as `/deltas` endpoint

**Response** (200 OK):
```json
{
  "success": true,
  "analysis": {
    "totalPlayers": 150,
    "activePlayers": 120,
    "movers": {
      "promotions": 15,
      "demotions": 8,
      "significantRises": 3,
      "significantFalls": 2
    },
    "activityLevels": {
      "high": 45,
      "medium": 60,
      "low": 15,
      "inactive": 30
    },
    "averageRatingChange": 25.5,
    "timestamp": "2025-09-26T14:30:00.000Z"
  },
  "metadata": {
    "timeWindow": {
      "hours": 24,
      "baseline": "2025-09-25T12:00:00.000Z"
    },
    "confidence": {
      "averageScore": 88,
      "minimumApplied": 75
    }
  }
}
```

### Get Top Movers

Identifies players with the most significant ranking changes.

```http
GET /api/analytics/movers
```

**Query Parameters**:
- `direction` (optional, string): Filter by direction - "up", "down", or "both" (default: "both")
- `limit` (optional, number): Maximum number of movers to return (default: 10)
- `timeWindowHours` (optional, number): Time window for comparison (default: 24)
- `minimumConfidence` (optional, number): Minimum confidence score (default: 75)

**Response** (200 OK):
```json
{
  "success": true,
  "movers": [
    {
      "id": 5,
      "btag": "RisingPlayer#5678",
      "name": "RisingPlayer",
      "positionChangeIndicator": "up",
      "positionDelta": 15,
      "previousRank": 25,
      "currentRank": 10,
      "ratingChange": 300,
      "activityLevel": "high",
      "confidenceScore": 92
    }
  ],
  "metadata": {
    "direction": "both",
    "limit": 10,
    "totalFound": 23,
    "timeWindow": {
      "hours": 24,
      "baseline": "2025-09-25T12:00:00.000Z"
    }
  }
}
```

## Data Type Definitions

### Player Delta Object
```typescript
interface PlayerDelta {
  id: number                                    // Player unique identifier
  btag: string                                  // Battle.net tag
  name?: string                                 // Display name
  positionChangeIndicator: 'up' | 'down' | 'none'  // Movement direction
  positionDelta?: number                        // Position change (-/+ values)
  previousRank?: number                         // Previous ranking position
  currentRank: number                           // Current ranking position
  ratingChange?: number                         // Rating point difference
  previousRating?: number                       // Previous rating value
  currentRating: number                         // Current rating value
  activityLevel: 'high' | 'medium' | 'low' | 'inactive'  // Activity classification
  race?: string                                 // StarCraft race
  leagueType?: number                           // League tier number
  confidenceScore: number                       // Confidence 0-100
}
```

### Activity Analysis Object
```typescript
interface ActivityAnalysis {
  totalPlayers: number                          // Total player count
  activePlayers: number                         // Players with recent activity
  movers: {
    promotions: number                          // Players with rating gains
    demotions: number                           // Players with rating losses
    significantRises: number                    // Position gains >= 5
    significantFalls: number                    // Position drops >= 5
  }
  activityLevels: {
    high: number                                // Highly active players
    medium: number                              // Moderately active players
    low: number                                 // Less active players
    inactive: number                            // Inactive players
  }
  averageRatingChange: number                   // Mean rating change
  timestamp: string                             // Analysis timestamp (ISO)
}
```

### Backup Metadata Object
```typescript
interface BackupMetadata {
  fileId: string                                // Google Drive file ID
  fileName: string                              // Backup file name
  timestamp: string                             // Creation timestamp (ISO)
  metadata: {
    type: 'snapshot'                            // Backup type
    playerCount: number                         // Number of players
    dataSize: number                            // File size in bytes
    createdBy: string                           // Creation source
  }
}
```

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description",
    "details": {
      // Additional error context
    }
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Invalid request parameters
- `NOT_FOUND`: Requested resource not found
- `SCHEDULER_ERROR`: Scheduler operation failed
- `BACKUP_ERROR`: Backup operation failed
- `COMPUTATION_ERROR`: Delta computation failed
- `INTERNAL_ERROR`: Unexpected server error

## Rate Limiting

- **Standard Endpoints**: 100 requests per minute per IP
- **Computation Endpoints**: 20 requests per minute per IP (due to processing complexity)
- **Backup Operations**: 10 requests per minute per IP (due to external API limits)

## Response Headers

All successful responses include:
- `X-Response-Time`: Processing time in milliseconds
- `X-Request-Id`: Unique request identifier for tracking
- `Cache-Control`: Caching policy for the response

## Client Implementation Examples

### JavaScript/TypeScript
```typescript
// Get player deltas with custom options
const getPlayerDeltas = async (options = {}) => {
  const params = new URLSearchParams({
    timeWindowHours: '24',
    includeInactive: 'false',
    minimumConfidence: '80',
    ...options
  });
  
  const response = await fetch(`/api/analytics/deltas?${params}`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error.message);
  }
  
  return data.deltas;
};

// Get top movers
const getTopMovers = async (direction = 'both', limit = 10) => {
  const response = await fetch(
    `/api/analytics/movers?direction=${direction}&limit=${limit}`
  );
  return response.json();
};
```

### React Hook Example
```typescript
import { useState, useEffect } from 'react';

export const usePlayerDeltas = (options = {}) => {
  const [deltas, setDeltas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDeltas = async () => {
      try {
        setLoading(true);
        const data = await getPlayerDeltas(options);
        setDeltas(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDeltas();
  }, [JSON.stringify(options)]);

  return { deltas, loading, error };
};
```

## WebSocket Integration (Future)

Phase 4 will include WebSocket endpoints for real-time delta updates:

```typescript
// Proposed WebSocket API
const socket = io('/analytics');

socket.on('delta-update', (delta) => {
  // Real-time delta updates
});

socket.on('activity-change', (analysis) => {
  // Population activity changes
});
```

## Testing Endpoints

All endpoints can be tested using the provided test data and mock configurations. Refer to the test files in `src/server/__tests__/unit/` for comprehensive examples and expected responses.

---

*This API specification covers all Phase 3 analytics endpoints. For client implementation support, refer to the business-level feature documentation and integration examples.*