# Custom Match Ingestion System

## Overview

The Custom Match Ingestion System is a comprehensive solution that discovers, validates, scores, deduplicates, and stores custom (non-ladder) matches from the SC2Pulse API for community players. This system provides automated polling capabilities as well as manual trigger endpoints for flexible operation.

## System Architecture

### Core Components

1. **Discovery Service** (`customMatchDiscoveryService.ts`)
   - Fetches matches from SC2Pulse `/api/character-matches` endpoint
   - Validates community player participation
   - Filters for custom match types

2. **Confidence Scorer** (`matchConfidenceScorer.ts`)
   - Table-driven scoring system with configurable rules
   - Evaluates matches based on:
     - Player validation (community status, character IDs)
     - Match duration reasonableness
     - Skill level similarity
     - Map recognition (standard vs custom)

3. **Deduplicator** (`matchDeduplicator.ts`)
   - File-based tracking with in-memory caching
   - Date-partitioned duplicate prevention
   - Handles numeric match IDs converted to strings for storage

4. **Storage Service** (`customMatchStorageService.ts`)
   - Date-partitioned JSON storage on Google Drive
   - Follows existing Drive authentication patterns
   - Stores processed matches with metadata

5. **Orchestrator** (`customMatchIngestionOrchestrator.ts`)
   - Coordinates the entire pipeline
   - Provides polling functionality with start/stop controls
   - Comprehensive error handling and statistics

6. **API Routes** (`customMatchRoutes.ts`)
   - 8 REST endpoints for system control and monitoring
   - Manual triggers, status checks, data retrieval

## Key Features

### Real SC2Pulse API Integration
- **Endpoint**: `/api/character-matches?limit=10&characterId=4581&characterId=8381155&type=CUSTOM`
- **Response Structure**: Nested format with match/map/participants data
- **Character IDs**: Numeric values handled as strings for file operations

### Confidence Scoring System
```typescript
// Configurable factor-based scoring
const factors = {
  hasValidCharacterIds: 2,
  hasCommunityPlayers: 3, 
  hasReasonableDuration: 2,
  hasSimilarSkillLevels: 1,
  isStandardMap: 1
};

// Thresholds: 4+ = LOW, 7+ = MEDIUM, 9+ = HIGH
```

### Environment Configuration
```bash
# Community data
H2H_COMMUNITY_CSV_URL=https://docs.google.com/spreadsheets/...
H2H_COMMUNITY_CSV_CACHE_TTL_HOURS=1

# Match discovery  
H2H_CUSTOM_CHARACTER_IDS=4581,8381155,12345
H2H_CUSTOM_CUTOFF=2024-11-01T00:00:00.000Z
H2H_CUSTOM_LIMIT=50

# Confidence filtering
H2H_CUSTOM_MIN_CONFIDENCE=MEDIUM

# Polling system
H2H_CUSTOM_POLL_INTERVAL_SEC=300
H2H_CUSTOM_AUTO_START=true

# Google Drive storage
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account"...}
```

### Data Flow

1. **Discovery**: Query Pulse API for community player matches
2. **Validation**: Filter custom matches with community participants
3. **Scoring**: Apply confidence scoring algorithm
4. **Filtering**: Remove matches below confidence threshold
5. **Deduplication**: Skip already-processed matches using date-partitioned tracking
6. **Storage**: Save to Google Drive in date-partitioned JSON files

### Storage Format

**File Structure**: `/sc2cr/custom-matches/2024/12/custom-matches-2024-12-07.json`

**Match Object**:
```json
{
  "matchId": "12345",
  "gameMode": "ARCHON", 
  "type": "CUSTOM",
  "decision": "MID_GAME_QUIT",
  "result": "LOSS",
  "date": "2024-12-07T10:30:00.000Z",
  "map": {
    "id": 12345,
    "name": "Goldenaura LE"
  },
  "participants": [...],
  "metadata": {
    "confidenceLevel": "HIGH",
    "confidenceScore": 9,
    "confidenceFactors": {...},
    "processedAt": "2024-12-07T16:45:00.000Z"
  }
}
```

## API Endpoints

### Control Endpoints
- `POST /api/custom-matches/run` - Manual ingestion trigger
- `POST /api/custom-matches/start` - Start automated polling
- `POST /api/custom-matches/stop` - Stop automated polling

### Monitoring Endpoints  
- `GET /api/custom-matches/status` - System status and statistics
- `GET /api/custom-matches/config` - Current configuration
- `GET /api/custom-matches/recent` - Recent processed matches
- `GET /api/custom-matches/stats` - Processing statistics

### Data Endpoints
- `GET /api/custom-matches/matches/:date` - Matches for specific date

## System Status Response
```json
{
  "isRunning": true,
  "uptimeMs": 45000,
  "config": {
    "pollIntervalSeconds": 300,
    "minConfidenceLevel": "MEDIUM",
    "characterIds": ["4581", "8381155"],
    "matchLimit": 50
  },
  "stats": {
    "totalRuns": 15,
    "totalMatches": 42,
    "lastRunAt": "2024-12-07T16:44:15.123Z",
    "errorCount": 0
  }
}
```

## Testing

### Comprehensive Test Coverage
- **Unit Tests**: Individual service testing with mocking
- **Integration Tests**: Full pipeline validation
- **Test Frameworks**: Vitest with proper mocking patterns

### Key Test Scenarios
- Full ingestion cycle with real API structure
- Confidence threshold filtering
- Deduplication across date boundaries
- Error handling and recovery
- Configuration validation
- System lifecycle management

### Test Execution
```bash
# Run all custom match tests
npx vitest run -c vitest.server.config.ts --testNamePattern="custom.*match|Custom.*Match"

# Run specific test suites
npx vitest run -c vitest.server.config.ts matchConfidenceScorer
npx vitest run -c vitest.server.config.ts matchDeduplicator
npx vitest run -c vitest.server.config.ts customMatchIngestion
```

## Deployment

### Environment Setup
1. Configure Google Drive service account credentials
2. Set community CSV URL for player validation
3. Define SC2Pulse character IDs for monitoring
4. Configure confidence thresholds and polling intervals

### Production Considerations
- **Memory Management**: Deduplication cache with reasonable limits
- **Error Resilience**: Comprehensive error handling with logging
- **Rate Limiting**: Respects Pulse API constraints
- **Storage Efficiency**: Date-partitioned files prevent large file growth
- **Monitoring**: Rich statistics and status reporting

## Future Enhancements

### Potential Improvements
- **Advanced Scoring**: Machine learning-based confidence scoring
- **Real-time Processing**: WebSocket integration for live updates
- **Enhanced Filtering**: Additional match quality factors
- **Analytics Integration**: Match trend analysis and reporting
- **Multi-region Support**: Extended character ID management

### Scalability Considerations
- **Horizontal Scaling**: Multiple worker instances with coordination
- **Database Integration**: Migration from file-based to database storage
- **Caching Layer**: Redis integration for improved performance
- **Monitoring**: Enhanced observability with metrics and alerts

## Troubleshooting

### Common Issues
1. **Authentication Errors**: Verify Google service account credentials
2. **API Rate Limits**: Check Pulse API usage and implement backoff
3. **Deduplication Issues**: Ensure proper file system permissions
4. **Missing Matches**: Validate character IDs and community CSV data

### Debugging Tools
- **Status Endpoint**: Real-time system health monitoring
- **Logs**: Comprehensive logging for all operations
- **Manual Triggers**: On-demand ingestion for testing
- **Configuration Validation**: Runtime config verification

This system provides a robust, production-ready solution for custom match ingestion with comprehensive testing, flexible configuration, and thorough documentation.