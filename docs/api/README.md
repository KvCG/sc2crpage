# API Documentation 🔌

> **Complete guide to SC2CR API endpoints** - REST API for StarCraft 2 community rankings and analytics

## 📋 Overview

The SC2CR API provides access to StarCraft 2 player rankings, tournament data, analytics, and replay information. All endpoints return JSON responses and are publicly accessible without authentication.

### Base URLs
- **Production**: `https://sc2cr-latest.onrender.com/api`
- **Development**: `https://sc2cr-dev.fly.dev/api`  
- **Local**: `http://localhost:3000/api`

### Response Format
All endpoints follow a consistent JSON response structure:

```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "metadata": { /* optional metadata */ }
}
```

## ⚡ Quick Reference

### Core Endpoints
- **`GET /top`** - Top ranked players with position indicators
- **`GET /snapshot`** - Daily ranking baseline for position tracking
- **`GET /search`** - Player search with filtering and pagination
- **`GET /player/:btag`** - Individual player profile and statistics

### Analytics Endpoints
- **`GET /player-analytics`** - Community statistics and player analysis
- **`GET /activity-analysis`** - Player activity patterns and trends
- **`GET /position-deltas`** - Ranking position changes over time

### Tournament & Replay Endpoints
- **`GET /tournament`** - Current tournament information
- **`GET /tournament/matches`** - Tournament match results
- **`GET /replays`** - Replay file listings and metadata

### Utility Endpoints
- **`GET /health`** - API health status
- **`GET /debug`** - Configuration and debug information (development only)

## 📚 Detailed Documentation

### 📋 Endpoint Reference
**[Complete Endpoint Documentation](endpoints.md)** - Detailed specifications for all API endpoints including parameters, responses, and examples.

### 🔍 API Review
**[API Review & Architecture](api-review.md)** - Technical review of API design, performance considerations, and implementation details.

### 📊 OpenAPI Specification
**[OpenAPI Schema](openapi.yaml)** - Machine-readable API specification for tools and integrations.

## ⚙️ Configuration & Limits

### Rate Limiting
- **External API Coordination**: 10 RPS to SC2Pulse API across all features
- **No Public Rate Limits**: Client requests are not explicitly throttled
- **Request Timeout**: 8000ms (configurable via `PULSE_TIMEOUT_MS`)

### Caching Strategy
- **Live Data**: 30s TTL for rankings and player data
- **Analytics**: 15min TTL for statistical computations
- **Expensive Operations**: 60min TTL for complex data processing

### Feature Flags
Some endpoints require specific environment configuration:
- **Analytics Endpoints**: Require `ENABLE_PLAYER_ANALYTICS=true`
- **Background Operations**: Require `ENABLE_DATA_SNAPSHOTS=true`
- **Player Snapshots**: Require `ENABLE_PLAYER_SNAPSHOTS=true`

## ⚠️ Error Handling

### Standard Error Response
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
```

### Common Error Codes
- **`PLAYER_NOT_FOUND`** - Player with specified btag not found
- **`INVALID_PARAMETERS`** - Request parameters are invalid or missing
- **`EXTERNAL_API_ERROR`** - Upstream API (SC2Pulse, Challonge) error
- **`RATE_LIMIT_EXCEEDED`** - Too many requests to external APIs
- **`FEATURE_DISABLED`** - Requested feature not enabled via configuration

## 🔧 Integration Examples

### Basic Player Search
```javascript
// Search for players
const response = await fetch('/api/search?q=player&race=Protoss&limit=10');
const { data } = await response.json();
console.log(data.players);
```

### Get Player Statistics
```javascript
// Get detailed player profile
const response = await fetch('/api/player/PlayerName%231234');
const { data } = await response.json();
console.log(data.profile, data.statistics);
```

### Community Analytics
```javascript
// Get community analytics (requires feature flag)
const response = await fetch('/api/player-analytics?timeframe=daily');
const { data } = await response.json();
console.log(data.activityStats, data.raceDistribution);
```

## 🔗 Related Documentation

- **[Environment Variables](../reference/environment-variables.md)** - API configuration and feature flags
- **[Architecture Overview](../architecture/README.md)** - System design and data flow
- **[Development Setup](../development/README.md)** - Local API development guide

---

*API Documentation | Updated October 2025*