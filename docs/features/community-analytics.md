# Community Analytics Feature

The SC2CR community analytics feature provides comprehensive statistical analysis of player activity, performance trends, and ranking movements across the StarCraft 2 ladder ecosystem.

## Overview

Community analytics extends the core ranking system with advanced data processing, temporal analysis, and automated data collection. The feature enables insights into player behavior patterns, league distributions, race meta analysis, and community engagement metrics.

**Feature Flag**: `ENABLE_PLAYER_ANALYTICS=true`

## Core Features

### Player Analytics Dashboard
- **Activity Statistics**: Online/offline distribution, engagement metrics
- **Race Analytics**: Distribution trends and performance by race
- **League Analysis**: Skill distribution across league tiers
- **Rating Statistics**: MMR trends and progression patterns
- **Temporal Patterns**: Activity by time of day and day of week

### Advanced Activity Analysis
- **Activity Buckets**: High/medium/low/inactive player categorization
- **Engagement Metrics**: Game frequency and session patterns
- **Retention Analysis**: Daily/weekly/monthly activity retention
- **Grouping Options**: Analysis by race, league, or activity level

### Position Delta Tracking
- **Historical Comparison**: Position changes over configurable time windows
- **Rating Deltas**: MMR change tracking with confidence scoring
- **Top Movers**: Biggest position gainers and losers identification
- **Trend Analysis**: Movement patterns and ranking stability

### Scheduled Operations
- **Automated Snapshots**: Daily data collection at 6 AM Costa Rica time
- **Background Analytics**: Periodic activity analysis and metrics updates
- **Data Persistence**: Google Drive backup with 90-day retention
- **Performance Monitoring**: Analytics operation health tracking

## API Endpoints

### GET /api/player-analytics
Comprehensive player analytics and statistics.

**Feature Flag Required**: `ENABLE_PLAYER_ANALYTICS=true`

**Query Parameters:**
- `timeframe` (string, default: "current") - "current" or "daily"
- `includeInactive` (boolean, default: false)
- `minimumGames` (number, default: 20)
- `race` (string, optional) - "Terran", "Protoss", "Zerg", "Random"

**Response Format:**
```json
{
  "success": true,
  "data": {
    "metadata": {
      "totalPlayers": 1000,
      "dataSource": "current",
      "filters": {
        "includeInactive": false,
        "minimumGames": 20
      },
      "generatedAt": "2024-10-07T12:00:00.000Z",
      "cacheTTL": 900
    },
    "playerActivity": {
      "onlinePlayerCount": 120,
      "offlinePlayerCount": 880,
      "onlinePercentage": "12.0",
      "totalActivePlayers": 850
    },
    "raceDistribution": {
      "Terran": 350,
      "Protoss": 300,
      "Zerg": 250,
      "Random": 100
    },
    "leagueDistribution": {
      "Grandmaster": 50,
      "Master": 200,
      "Diamond": 300,
      "Platinum": 250,
      "Gold": 150,
      "Silver": 40,
      "Bronze": 10
    },
    "ratingStatistics": {
      "average": 3245.67,
      "median": 3200,
      "standardDeviation": 845.23,
      "min": 1200,
      "max": 7800
    }
  }
}
```

**Caching**: 15-minute TTL for standard requests

### GET /api/player-analytics/activity
Detailed activity analysis with temporal patterns and engagement metrics.

**Feature Flag Required**: `ENABLE_PLAYER_ANALYTICS=true`

**Query Parameters:**
- `includeInactive` (boolean, default: false)
- `groupBy` (string, default: "activity") - "race", "league", or "activity"
- `timeframe` (string, default: "current")
- `minimumGames` (number, default: 20)

**Response Format:**
```json
{
  "success": true,
  "data": {
    "metadata": {
      "totalPlayers": 1000,
      "groupBy": "activity",
      "generatedAt": "2024-10-07T12:00:00.000Z",
      "cacheTTL": 3600
    },
    "activityBuckets": {
      "high": { "count": 300, "averageGames": 50 },
      "medium": { "count": 400, "averageGames": 25 },
      "low": { "count": 200, "averageGames": 10 },
      "inactive": { "count": 100, "averageGames": 0 }
    },
    "temporalPatterns": {
      "hourlyDistribution": [5, 3, 1, 0, 2, 8, 15, 25, ...],
      "dailyDistribution": [120, 95, 85, 90, 100, 150, 180],
      "peakHour": 18,
      "peakDay": 6
    },
    "engagementMetrics": {
      "averageSessionLength": 2.5,
      "gamesPerSession": 3.2,
      "dailyActiveUsers": 450,
      "weeklyActiveUsers": 850
    },
    "retentionAnalysis": {
      "daily": 300,
      "weekly": 400,
      "monthly": 200,
      "inactive": 100
    }
  }
}
```

**Caching**: 60-minute TTL for expensive operations

### GET /api/deltas
Enhanced player deltas with position and rating changes.

**Query Parameters:**
- `timeWindowHours` (number, default: 24) - Time window for comparison
- `includeInactive` (boolean, default: false)
- `minimumConfidence` (number, default: 50) - Confidence threshold
- `maxDataAge` (number, default: 48) - Maximum baseline age in hours

**Response Format:**
```json
{
  "success": true,
  "deltas": [
    {
      "btag": "Player#1234",
      "currentPosition": 45,
      "baselinePosition": 52,
      "positionDelta": 7,
      "positionChangeIndicator": "up",
      "ratingChange": 150,
      "activityLevel": "high",
      "confidenceScore": 95,
      "dataAge": 18
    }
  ],
  "metadata": {
    "count": 850,
    "options": { /* query parameters */ },
    "timestamp": "2024-10-07T12:00:00.000Z"
  }
}
```

### GET /api/scheduler
Get scheduler status and configuration for analytics operations.

**Response Format:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "operations": [
      {
        "name": "snapshot",
        "intervalHours": 24,
        "lastRun": "2024-10-07T06:00:00.000Z",
        "nextRun": "2024-10-08T06:00:00.000Z"
      }
    ],
    "status": "running"
  }
}
```

## Technical Architecture

### Service Layer Components

**AnalyticsService**: `src/server/services/analyticsService.ts`
- Core business logic for player analytics generation
- Caching strategy with 15min standard / 60min expensive TTL
- Data aggregation and statistical calculations
- Race, league, and activity pattern analysis

**DeltaComputationEngine**: `src/server/services/deltaComputationEngine.ts`
- Position delta calculations between snapshots
- Confidence scoring based on data freshness and completeness
- Activity level classification (high/medium/low/inactive)
- Historical baseline matching with fallback strategies

**PlayerAnalyticsScheduler**: `src/server/services/playerAnalyticsScheduler.ts`
- Automated scheduled operations (snapshot, activity, movers)
- Costa Rica timezone alignment for daily boundaries
- Configurable intervals via environment variables
- Operation health monitoring and error recovery

**PlayerAnalyticsPersistence**: `src/server/services/playerAnalyticsPersistence.ts`
- Google Drive integration for data backup
- 90-day retention policy with automatic cleanup
- Disaster recovery restore capabilities
- Structured folder organization by environment and date

### Middleware & Validation

**analyticsMiddleware.ts**: Request validation and preprocessing
- Query parameter validation and sanitization
- Feature flag enforcement
- Rate limiting for expensive operations
- Error standardization

### Route Organization
**analyticsRoutes.ts**: Analytics API endpoints
- `/player-analytics` - Comprehensive statistics
- `/player-analytics/activity` - Activity analysis
- `/deltas` - Position change tracking

**schedulerRoutes.ts**: Background operation management
- `/scheduler` - Status and configuration
- `/scheduler/force-run` - Manual operation triggers
- `/persistence` - Backup management

## Data Processing Pipeline

### Analytics Generation Flow
1. **Request Validation**: Middleware validates parameters and feature flags
2. **Cache Check**: Service checks for existing analytics within TTL
3. **Data Fetching**: Retrieves current rankings or daily snapshots
4. **Filtering**: Applies race, activity, and minimum games filters
5. **Statistical Analysis**: Generates distributions, averages, and patterns
6. **Response Assembly**: Formats data with metadata and caching info
7. **Cache Storage**: Stores results for future requests within TTL

### Delta Computation Flow
1. **Current Snapshot**: Gets latest ranking data
2. **Baseline Matching**: Finds appropriate historical snapshot within time window
3. **Position Mapping**: Maps players between snapshots using btag
4. **Change Calculation**: Computes position and rating deltas
5. **Confidence Scoring**: Evaluates data quality and temporal coherence
6. **Activity Classification**: Categorizes players by recent activity level

### Scheduled Operations Flow
1. **Timer Check**: Scheduler checks operation schedules every 30 seconds
2. **Operation Execution**: Runs scheduled tasks (snapshots, analytics, cleanup)
3. **Data Persistence**: Backs up results to Google Drive
4. **Health Monitoring**: Tracks operation success/failure rates
5. **Next Schedule**: Calculates next run time in Costa Rica timezone

## Configuration & Environment Variables

### Feature Flags
- `ENABLE_PLAYER_ANALYTICS=true` - Master switch for analytics features
- `ENABLE_DATA_SNAPSHOTS=true` - Background data collection operations

### Scheduler Configuration
- `PLAYER_SNAPSHOT_INTERVAL_HOURS=24` - Snapshot collection frequency
- `PLAYER_ACTIVITY_INTERVAL_HOURS=2` - Activity analysis frequency  
- `PLAYER_MOVERS_INTERVAL_HOURS=3` - Position change analysis frequency

### Quality Control
- `DEFAULT_MINIMUM_CONFIDENCE=75` - Confidence threshold for analytics
- `MAX_SNAPSHOT_AGE_HOURS=48` - Maximum age for baseline snapshots

### Google Drive Integration
- `GOOGLE_SERVICE_ACCOUNT_KEY` - Service account for backup storage
- Folder structure: `PlayerAnalytics_{Environment}/Snapshots_{Environment}`

## Client Integration

### Custom Hooks
- `useCommunityStats()` - Analytics dashboard data with caching
- `usePlayerActivity()` - Activity analysis with localStorage persistence

### API Client Functions
- `getPlayerAnalytics()` - Comprehensive statistics endpoint
- `getPlayerActivityAnalysis()` - Activity analysis endpoint

### Caching Strategy
- **Client Cache**: 30-minute localStorage TTL for analytics data
- **Stale-While-Revalidate**: Display cached data while fetching updates
- **Error Recovery**: Fallback to cached data on network failures

## Performance Considerations

### Caching Architecture
- **Multi-Layer**: In-memory server cache + client localStorage
- **TTL Alignment**: Match cache expiry to data update cadence
- **Request Deduplication**: Prevent duplicate expensive operations

### Resource Optimization
- **Lazy Loading**: Analytics data fetched on-demand
- **Batch Operations**: Efficient bulk data processing
- **Memory Management**: LRU eviction for large datasets

### Rate Limiting
- **External APIs**: Coordinate with existing SC2Pulse 10 RPS limit
- **Internal Operations**: Prevent concurrent expensive analytics generation
- **Graceful Degradation**: Serve lower-confidence data during high load

## Error Handling & Monitoring

### Data Quality Management
- **Confidence Scoring**: Multi-factor reliability assessment
- **Temporal Coherence**: Flag data gaps and inconsistencies
- **Sample Size Validation**: Require minimum thresholds for statistics

### Operation Health
- **Scheduled Operation Monitoring**: Track success/failure rates
- **Performance SLA**: p95 <500ms, p99 <1000ms for analytics endpoints
- **Alert Thresholds**: Monitor cache hit rates and error percentages

### Recovery Strategies
- **Fallback Data**: Use cached analytics when generation fails
- **Baseline Recovery**: Restore from Google Drive backups
- **Graceful Degradation**: Partial results with confidence indicators

## Testing Strategy

### Unit Testing
- **Service Logic**: Analytics generation with golden fixtures
- **Delta Computation**: Position change calculations with known datasets
- **Scheduler Operations**: Timing and configuration validation

### Integration Testing
- **End-to-End Flows**: Full analytics pipeline validation
- **External Dependencies**: Mocked SC2Pulse and Google Drive responses
- **Performance Testing**: Load testing for analytics endpoints

### Data Quality Testing
- **Fixture Validation**: Known-good analytics responses
- **Edge Case Handling**: Empty data, missing baselines, API failures
- **Confidence Scoring**: Reliability metrics validation

## Future Enhancements

### Phase 4 Extensions
- **Advanced Metrics**: Win/loss ratios, ladder progression tracking
- **Predictive Analytics**: Rating change forecasting
- **Community Insights**: Clan and team performance analysis
- **Real-time Streams**: Live analytics updates via WebSocket

### Scalability Improvements
- **Database Integration**: Persistent storage for historical analysis
- **Distributed Caching**: Redis or similar for multi-instance deployments
- **API Rate Optimization**: Batch SC2Pulse requests and intelligent scheduling

## Related Documentation

- **[API Endpoints](../api/endpoints.md)** - Complete API reference for analytics endpoints
- **[Environment Variables](../reference/environment-variables.md)** - Configuration for analytics features
- **[Architecture Overview](../architecture/README.md)** - System design and data flow
- **[Ranking System](ranking-system.md)** - Core ranking calculations and algorithms

---

*Community Analytics Feature Documentation | Updated October 2025*
