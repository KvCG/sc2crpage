# Custom Head-to-Head Match System

## 1. Introduction

The Custom Head-to-Head (H2H) Match System is an automated ingestion pipeline that discovers, validates, scores, and stores custom (non-ladder) matches from the SC2Pulse API for community players. This system provides comprehensive match tracking capabilities with confidence-based quality assessment and robust deduplication.

### Key Features

- **Automated Match Discovery**: Continuously polls SC2Pulse API for custom matches involving community players
- **Confidence-Based Quality Scoring**: Table-driven scoring system that evaluates match quality across multiple factors
- **Intelligent Deduplication**: Dual-persistence system (Google Drive + local cache) prevents duplicate match storage
- **Date-Partitioned Storage**: Organizes matches by date for efficient retrieval and management
- **RESTful API Control**: Complete monitoring and control interface for system operations
- **Community Player Integration**: Validates matches against community player database from CSV datasource

### When to Use This System

- **Community Match Tracking**: Automatically collect custom matches for analysis and record-keeping
- **Historical Data Collection**: Build comprehensive match history for community tournaments and events
- **Quality Assurance**: Filter matches based on configurable confidence criteria
- **Analytics Preparation**: Structured data storage ready for future analytics and reporting features

The system operates autonomously once configured, requiring minimal manual intervention while providing comprehensive monitoring and control capabilities.

## 2. Conceptual Overview

### System Purpose

The H2H system addresses the challenge of tracking custom StarCraft 2 matches that occur outside the official ladder system. While ladder matches are automatically tracked by Blizzard, custom matches - including community tournaments, practice games, and organized events - require specialized discovery and validation.

### Core Concepts

#### Custom Matches
Non-ladder matches retrieved from SC2Pulse's `/api/character-matches` endpoint. These include:
- Community tournament matches
- Practice games between tracked players
- Organized events and scrimmages
- Custom game modes and formats

#### Community Players
A curated list of players maintained in a CSV datasource. The system only processes matches where at least one participant is a community player, ensuring relevance and reducing noise.

#### Confidence Scoring
A multi-factor quality assessment system that evaluates matches based on:
- **Player Validation**: Verified character IDs and community status
- **Match Quality**: Reasonable duration and competitive indicators
- **Skill Balance**: Similar skill levels suggest legitimate competitive matches
- **Map Recognition**: Standard vs custom map identification

Confidence levels (LOW/MEDIUM/HIGH) determine whether matches are stored, with configurable thresholds.

#### Deduplication
Prevention of duplicate match storage using:
- **Date-partitioned tracking**: Matches organized by date for efficient lookup
- **Dual persistence**: Google Drive for reliability + local cache for performance
- **Memory cache**: Fast in-memory lookup with configurable size limits

#### Date Partitioning
Matches are organized by date (YYYY-MM-DD) for:
- Efficient retrieval of matches within date ranges
- Manageable file sizes (configurable matches per file)
- Simplified cleanup and maintenance operations

### Data Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  SC2Pulse   │───▶│  Discovery   │───▶│ Confidence  │───▶│ Deduplication│───▶│   Storage   │
│     API     │    │   Service    │    │   Scorer    │    │   Service    │    │  (Drive)    │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘    └─────────────┘
                            │                   │                   │
                            ▼                   ▼                   ▼
                   ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
                   │  Community   │    │  Quality    │    │    Cache     │
                   │     CSV      │    │ Thresholds  │    │  Management  │
                   └──────────────┘    └─────────────┘    └──────────────┘
```

### Integration Points

- **SC2Pulse API**: Primary data source for match discovery
- **Google Drive**: Persistent storage for matches and deduplication tracking
- **Community CSV**: Player validation datasource (configurable URL)
- **Express Server**: RESTful API endpoints for monitoring and control
- **Local File System**: Performance cache and backup persistence

## 3. Architecture

### System Components

#### Discovery Service (`customMatchDiscoveryService.ts`)
Responsible for finding and initially validating custom matches:
- **SC2Pulse Integration**: Queries `/api/character-matches` endpoint with community player character IDs
- **Match Filtering**: Selects only CUSTOM type matches within configured date range
- **Participant Validation**: Enriches match data with community player information
- **Community Data Management**: Loads and caches community player list from CSV

#### Confidence Scorer (`matchConfidenceScorer.ts`)
Table-driven scoring system for match quality assessment:
- **Configurable Factors**: Six quality factors with adjustable point values
- **Threshold System**: LOW (4+), MEDIUM (7+), HIGH (9+) confidence levels
- **Runtime Updates**: Dynamic configuration changes without restart
- **Scoring Statistics**: Detailed breakdown for monitoring and tuning

**Scoring Factors:**
```typescript
{
  hasValidCharacterIds: 2,    // Essential for tracking
  bothCommunityPlayers: 3,    // Core requirement  
  bothActiveRecently: 1,      // Nice to have
  hasReasonableDuration: 1,   // Basic quality check
  similarSkillLevel: 1,       // Competitive indicator
  recognizedMap: 1            // Map quality indicator
}
```

#### Deduplication Service (`simplifiedMatchDeduplicator.ts`)
Prevents duplicate match storage with dual persistence:
- **Memory Cache**: Fast lookup using Map<string, Set<string>> structure
- **Local Persistence**: JSON file backup for pod restart recovery
- **Drive Persistence**: Authoritative deduplication tracking on Google Drive
- **Date-based Cleanup**: Automatic removal of old tracking data
- **Performance Optimization**: Configurable cache limits and retention periods

#### Storage Service (`customMatchStorageService.ts`)
Google Drive-based storage with date partitioning:
- **Date Organization**: `/sc2cr/custom-matches/YYYY/MM/custom-matches-YYYY-MM-DD.json`
- **Batch Operations**: Efficient bulk storage with configurable file size limits
- **Metadata Tracking**: Processing timestamps and schema versioning
- **Access Control**: Service account authentication with environment suffix support

#### Orchestrator (`customMatchIngestionOrchestrator.ts`)
Central coordinator managing the complete ingestion pipeline:
- **Pipeline Coordination**: Manages discovery → scoring → deduplication → storage flow
- **Scheduling**: Configurable polling intervals with start/stop controls
- **Error Handling**: Comprehensive error capture and statistics tracking
- **Statistics Collection**: Detailed metrics for monitoring and optimization
- **Lifecycle Management**: System startup, shutdown, and cleanup operations

#### Configuration (`h2hConfig.ts`)
Centralized configuration management:
- **Environment Variables**: Single source of truth for all H2H settings
- **Validation**: Type checking and range validation for all parameters
- **Defaults**: Sensible fallback values for development and testing
- **Runtime Access**: Configuration inspection via API endpoints

### Component Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│                      Orchestrator                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │  Discovery  │ │  Confidence │ │Deduplication│ │   Storage   ││
│  │   Service   │ │   Scorer    │ │   Service   │ │   Service   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API Routes                               │
│   /status  /stats  /start  /stop  /run  /dates  /health       │
└─────────────────────────────────────────────────────────────────┘
```

### Key Data Models

#### RawCustomMatch (SC2Pulse API Response)
```typescript
interface RawCustomMatch {
  match: {
    id: number
    date: string
    type: string
    mapId: number
    region: string
    duration?: number | null
  }
  map: {
    id: number
    name: string
  }
  participants: Array<{
    participant: {
      matchId: number
      playerCharacterId: number
      decision: 'WIN' | 'LOSS' | 'TIE' | 'OBSERVER'
      ratingChange?: number | null
    }
  }>
}
```

#### ProcessedCustomMatch (Validated and Enriched)
```typescript
interface ProcessedCustomMatch {
  matchId: number
  matchDate: string
  dateKey: string              // YYYY-MM-DD for partitioning
  map: string
  duration?: number
  participants: ValidatedParticipant[]
  matchResult: MatchResult     // Winner/loser tracking
  confidence: MatchConfidence  // LOW/MEDIUM/HIGH
  confidenceFactors: ConfidenceFactors
  processedAt: string
  schemaVersion: string
}
```

#### ValidatedParticipant
```typescript
interface ValidatedParticipant {
  characterId: number
  battleTag: string
  name: string
  rating?: number
  race?: 'PROTOSS' | 'TERRAN' | 'ZERG' | 'RANDOM'
  isCommunityPlayer: boolean
}
```

### Storage Architecture

#### Google Drive Structure
```
/sc2cr/
├── custom-matches/
│   ├── 2024/
│   │   ├── 10/
│   │   │   ├── custom-matches-2024-10-11.json
│   │   │   ├── custom-matches-2024-10-12.json
│   │   │   └── ...
│   │   ├── 11/
│   │   └── 12/
│   └── 2025/
└── CustomMatchDeduplication/
    └── processed-matches-map.json
```

#### Local Cache Structure
```
dist/
└── data/
    └── dedupe/
        └── processed-matches-local.json
```

#### Storage Optimization
- **File Size Limits**: Configurable maximum matches per file (default: 1000)
- **Date Partitioning**: Automatic file rotation by date
- **Compression**: JSON minification for storage efficiency
- **Retention**: Configurable cleanup of old deduplication data

## 4. Configuration Reference

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `H2H_CUSTOM_CUTOFF` | string | `2025-10-08` | Date cutoff for match discovery (YYYY-MM-DD) |
| `H2H_CUSTOM_MIN_CONFIDENCE` | string | `low` | Minimum confidence level (low/medium/high) |
| `H2H_POLL_INTERVAL_SEC` | number | `900` | Polling interval in seconds (15 minutes) |
| `H2H_BATCH_SIZE` | number | `50` | Maximum matches to process per batch |
| `H2H_LOOKBACK_DAYS` | number | `7` | Days to look back for new matches |
| `H2H_MAX_CONCURRENT` | number | `5` | Maximum concurrent API requests |
| `H2H_MAX_MATCHES_PER_FILE` | number | `1000` | Maximum matches per storage file |
| `H2H_DEDUPE_RETENTION_DAYS` | number | `7` | Days to retain deduplication data |
| `H2H_CACHE_LIMIT` | number | `10000` | Memory cache size limit |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | string | **required** | Google Drive service account JSON key |

### Confidence Scoring Configuration

#### Default Factor Points
```typescript
{
  hasValidCharacterIds: 2,    // Players have valid Pulse character IDs
  bothCommunityPlayers: 3,    // Both players are community members
  bothActiveRecently: 1,      // Players have recent activity (future feature)
  hasReasonableDuration: 1,   // Match duration seems reasonable
  similarSkillLevel: 1,       // Players have similar skill ratings
  recognizedMap: 1            // Map is in standard map pool
}
```

#### Confidence Thresholds
- **LOW**: 4+ points (basic validity)
- **MEDIUM**: 7+ points (good quality)
- **HIGH**: 9+ points (excellent quality)

### Example Configurations

#### Development Setup
```bash
# Minimal configuration for testing
H2H_CUSTOM_CUTOFF=2024-01-01
H2H_CUSTOM_MIN_CONFIDENCE=low
H2H_POLL_INTERVAL_SEC=3600
H2H_BATCH_SIZE=10
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account"...}'
```

#### Production Setup
```bash
# Optimized for production workloads
H2H_CUSTOM_CUTOFF=2024-10-01
H2H_CUSTOM_MIN_CONFIDENCE=medium
H2H_POLL_INTERVAL_SEC=900
H2H_BATCH_SIZE=50
H2H_LOOKBACK_DAYS=3
H2H_MAX_CONCURRENT=5
H2H_DEDUPE_RETENTION_DAYS=30
H2H_CACHE_LIMIT=10000
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account"...}'
```

#### Debugging Configuration
```bash
# Configuration for troubleshooting
H2H_CUSTOM_MIN_CONFIDENCE=low
H2H_POLL_INTERVAL_SEC=300
H2H_BATCH_SIZE=5
H2H_DEDUPE_RETENTION_DAYS=1
H2H_CACHE_LIMIT=100
```

## 5. API Reference

### Base Information
- **Base URL**: `/api/custom-matches`
- **Authentication**: None (internal service)
- **Response Format**: Standard SC2CR success/error structure

### Standard Response Format
```typescript
// Success Response
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "message"?: string
}

// Error Response  
{
  "success": false,
  "error": string
}
```

### Control Endpoints

#### Start Automated Polling
```http
POST /api/custom-matches/start
```

Starts the automated ingestion system with configured polling interval.

**Response:**
```json
{
  "success": true,
  "message": "Ingestion system started successfully"
}
```

#### Stop Automated Polling
```http
POST /api/custom-matches/stop
```

Stops the automated ingestion system. Manual ingestion can still be triggered.

**Response:**
```json
{
  "success": true,
  "message": "Ingestion system stopped successfully"
}
```

#### Manual Ingestion Trigger
```http
POST /api/custom-matches/run
```

Triggers a single ingestion cycle immediately, regardless of polling status.

**Response:**
```json
{
  "success": true,
  "data": {
    "matchesDiscovered": 15,
    "matchesWithValidParticipants": 12,
    "matchesMeetingThreshold": 8,
    "newMatchesStored": 6,
    "duplicatesSkipped": 2,
    "errors": [],
    "timestamp": "2024-10-11T16:45:00.123Z",
    "durationMs": 1250
  },
  "message": "Manual ingestion completed"
}
```

#### System Cleanup
```http
POST /api/custom-matches/cleanup
```

Performs maintenance tasks: removes old deduplication data, clears expired caches.

**Response:**
```json
{
  "success": true,
  "message": "Cleanup completed successfully"
}
```

### Monitoring Endpoints

#### System Status
```http
GET /api/custom-matches/status
```

Comprehensive system status including configuration and community statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "uptimeMs": 3600000,
    "config": {
      "cutoffDate": "2024-10-01",
      "minConfidence": "medium",
      "pollIntervalSeconds": 900,
      "batchSize": 50,
      "lookbackDays": 7
    },
    "lastRun": {
      "timestamp": "2024-10-11T16:30:00.000Z",
      "matchesDiscovered": 20,
      "newMatchesStored": 5,
      "errors": []
    },
    "communityStats": {
      "totalPlayers": 150,
      "playersWithRating": 120,
      "lastUpdated": "2024-10-11T16:00:00.000Z"
    },
    "environment": {
      "hasServiceAccount": true,
      "pollInterval": 900,
      "batchSize": 50
    }
  }
}
```

#### Comprehensive Statistics
```http
GET /api/custom-matches/stats
```

Detailed statistics across all system components.

**Response:**
```json
{
  "success": true,
  "data": {
    "system": {
      "isRunning": true,
      "uptimeMs": 3600000,
      "totalRuns": 48,
      "successfulRuns": 46,
      "errorCount": 2
    },
    "community": {
      "totalPlayers": 150,
      "playersWithRating": 120,
      "lastUpdated": "2024-10-11T16:00:00.000Z"
    },
    "deduplication": {
      "cacheSize": 1250,
      "totalDates": 15,
      "totalMatches": 850,
      "cacheHitRate": 0.92
    },
    "storage": {
      "totalFiles": 15,
      "totalMatches": 850,
      "latestDate": "2024-10-11",
      "earliestDate": "2024-09-26"
    },
    "scoring": {
      "factorPoints": {
        "hasValidCharacterIds": 2,
        "bothCommunityPlayers": 3,
        "hasReasonableDuration": 1
      },
      "thresholds": {
        "low": 4,
        "medium": 7,
        "high": 9
      }
    }
  }
}
```

#### Health Check
```http
GET /api/custom-matches/health
```

Simple health check endpoint for monitoring systems.

**Response (Healthy):**
```json
{
  "success": true,
  "data": {
    "healthy": true,
    "system": {
      "isRunning": true,
      "uptimeMs": 3600000,
      "lastRunErrors": 0,
      "lastRunTimestamp": "2024-10-11T16:30:00.000Z"
    }
  }
}
```

### Data Endpoints

#### Get Matches by Date
```http
GET /api/custom-matches/date/:dateKey
```

Retrieves all matches for a specific date (YYYY-MM-DD format).

**Parameters:**
- `dateKey`: Date in YYYY-MM-DD format

**Example:**
```http
GET /api/custom-matches/date/2024-10-11
```

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2024-10-11",
    "matchCount": 8,
    "matches": [
      {
        "matchId": 12345,
        "matchDate": "2024-10-11T14:30:00.000Z",
        "dateKey": "2024-10-11",
        "map": "Goldenaura LE",
        "duration": 720,
        "participants": [
          {
            "characterId": 4581,
            "battleTag": "Player#1234",
            "name": "PlayerName",
            "rating": 4500,
            "race": "PROTOSS",
            "isCommunityPlayer": true
          }
        ],
        "matchResult": {
          "outcome": "WIN_LOSS",
          "winner": { /* participant */ }
        },
        "confidence": "HIGH",
        "processedAt": "2024-10-11T16:45:00.000Z"
      }
    ]
  }
}
```

#### List Available Dates
```http
GET /api/custom-matches/dates
```

Lists all dates with available match data.

**Response:**
```json
{
  "success": true,
  "data": {
    "availableDates": [
      "2024-09-26",
      "2024-09-27",
      "2024-10-11"
    ],
    "dateCount": 3,
    "dateRange": {
      "earliest": "2024-09-26",
      "latest": "2024-10-11"
    }
  }
}
```

#### Storage Statistics
```http
GET /api/custom-matches/storage/stats
```

Detailed storage system statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalFiles": 15,
    "totalMatches": 850,
    "averageMatchesPerFile": 56.7,
    "latestDate": "2024-10-11",
    "earliestDate": "2024-09-26",
    "storageSizeBytes": 2048576,
    "compressionRatio": 0.75
  }
}
```

### Example API Calls

#### Using curl
```bash
# Start the system
curl -X POST http://localhost:3000/api/custom-matches/start

# Check status
curl http://localhost:3000/api/custom-matches/status

# Manual ingestion
curl -X POST http://localhost:3000/api/custom-matches/run

# Get matches for specific date
curl http://localhost:3000/api/custom-matches/date/2024-10-11
```

#### Using JavaScript/Fetch
```javascript
// Start the system
const startResponse = await fetch('/api/custom-matches/start', {
  method: 'POST'
});
const startResult = await startResponse.json();

// Check status periodically
const statusResponse = await fetch('/api/custom-matches/status');
const status = await statusResponse.json();
console.log('System running:', status.data.isRunning);

// Get recent matches
const matchesResponse = await fetch('/api/custom-matches/date/2024-10-11');
const matchesData = await matchesResponse.json();
console.log(`Found ${matchesData.data.matchCount} matches`);
```

## 6. Usage Guide

### Setup Checklist

#### Prerequisites
- [ ] Node.js environment with SC2CR server running
- [ ] Google Drive API access with service account
- [ ] SC2Pulse API access (no authentication required)
- [ ] Community player CSV accessible via HTTPS

#### Environment Configuration
1. **Create Google Service Account**:
   - Go to Google Cloud Console → IAM & Admin → Service Accounts
   - Create new service account with Drive API access
   - Generate JSON key file
   - Share Drive folder with service account email

2. **Configure Environment Variables**:
   ```bash
   # Required
   GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
   
   # Recommended
   H2H_CUSTOM_CUTOFF=2024-10-01
   H2H_CUSTOM_MIN_CONFIDENCE=medium
   H2H_POLL_INTERVAL_SEC=900
   ```

3. **Verify Community CSV Access**:
   - Ensure community CSV URL is accessible
   - Verify CSV format matches expected structure
   - Test CSV loading in development environment

#### Initial Deployment
1. **Environment Validation**:
   ```bash
   # Check configuration
   curl http://localhost:3000/api/custom-matches/status
   ```

2. **Test Manual Ingestion**:
   ```bash
   # Run single ingestion cycle
   curl -X POST http://localhost:3000/api/custom-matches/run
   ```

3. **Verify Storage**:
   ```bash
   # Check if matches were stored
   curl http://localhost:3000/api/custom-matches/dates
   ```

### Starting the System

#### Automatic Startup
Set environment variable for automatic startup:
```bash
H2H_CUSTOM_AUTO_START=true
```
System will start automatically when server initializes.

#### Manual Startup
```bash
# Start via API
curl -X POST http://localhost:3000/api/custom-matches/start

# Verify startup
curl http://localhost:3000/api/custom-matches/status
```

#### Verification Steps
1. **Check System Status**:
   ```json
   {
     "isRunning": true,
     "uptimeMs": 5000,
     "config": { "pollIntervalSeconds": 900 }
   }
   ```

2. **Monitor First Run**:
   - Wait for first polling cycle (up to `pollIntervalSeconds`)
   - Check `/status` endpoint for `lastRun` data
   - Verify matches were discovered and processed

3. **Validate Storage**:
   - Check `/dates` endpoint for new date entries
   - Query specific dates for match data
   - Verify Google Drive folder structure

### Basic Monitoring

#### Daily Health Checks
```bash
# Quick health check
curl http://localhost:3000/api/custom-matches/health

# Detailed status
curl http://localhost:3000/api/custom-matches/status
```

#### Key Metrics to Monitor
- **System Running**: `isRunning: true`
- **Recent Activity**: `lastRun.timestamp` within expected interval
- **Error Count**: `lastRun.errors.length === 0`
- **Match Discovery**: `lastRun.matchesDiscovered > 0` (when matches expected)
- **Storage Growth**: Increasing `newMatchesStored` over time

#### Weekly Statistics Review
```bash
# Comprehensive statistics
curl http://localhost:3000/api/custom-matches/stats
```

Monitor trends in:
- **Discovery Rate**: Matches discovered per run
- **Confidence Distribution**: Ratio of low/medium/high confidence matches
- **Deduplication Efficiency**: Cache hit rate and duplicate detection
- **Storage Growth**: Files and matches over time

### Retrieving Match Data

#### Query by Date
```bash
# Get matches for specific date
curl http://localhost:3000/api/custom-matches/date/2024-10-11

# List all available dates
curl http://localhost:3000/api/custom-matches/dates
```

#### Data Processing Example
```javascript
// Get matches for date range
async function getMatchesForDateRange(startDate, endDate) {
  const dates = await fetch('/api/custom-matches/dates')
    .then(r => r.json())
    .then(data => data.data.availableDates);
  
  const filteredDates = dates.filter(date => 
    date >= startDate && date <= endDate
  );
  
  const allMatches = [];
  for (const date of filteredDates) {
    const response = await fetch(`/api/custom-matches/date/${date}`);
    const data = await response.json();
    allMatches.push(...data.data.matches);
  }
  
  return allMatches;
}

// Usage
const recentMatches = await getMatchesForDateRange('2024-10-01', '2024-10-11');
console.log(`Found ${recentMatches.length} matches`);
```

#### Understanding Match Data Structure
```javascript
// Example match object
const match = {
  matchId: 12345,
  matchDate: "2024-10-11T14:30:00.000Z",
  dateKey: "2024-10-11",  // Used for partitioning
  map: "Goldenaura LE",
  duration: 720,          // Seconds, may be null
  participants: [
    {
      characterId: 4581,
      battleTag: "Player#1234",
      name: "PlayerName",
      rating: 4500,
      race: "PROTOSS",
      isCommunityPlayer: true
    }
  ],
  matchResult: {
    outcome: "WIN_LOSS",   // WIN_LOSS, TIE, or UNKNOWN
    winner: { /* participant object */ },
    loser: { /* participant object */ }
  },
  confidence: "HIGH",      // LOW, MEDIUM, HIGH
  confidenceFactors: {
    hasValidCharacterIds: true,
    bothCommunityPlayers: true,
    hasReasonableDuration: true,
    // ... other factors
  },
  processedAt: "2024-10-11T16:45:00.000Z",
  schemaVersion: "1.0"
};
```

### Advanced Operations

#### Manual Cleanup
```bash
# Clean up old deduplication data and caches
curl -X POST http://localhost:3000/api/custom-matches/cleanup
```

#### Cache Management
```bash
# Clear deduplication cache (debugging)
curl -X POST http://localhost:3000/api/custom-matches/clear-cache
```

#### System Restart
```bash
# Stop system
curl -X POST http://localhost:3000/api/custom-matches/stop

# Start system
curl -X POST http://localhost:3000/api/custom-matches/start
```

## 7. Examples

### Common Workflows

#### Initial System Setup
```bash
# 1. Configure environment
export GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
export H2H_CUSTOM_MIN_CONFIDENCE=medium

# 2. Start server and verify configuration
curl http://localhost:3000/api/custom-matches/status

# 3. Test manual ingestion
curl -X POST http://localhost:3000/api/custom-matches/run

# 4. Start automated polling
curl -X POST http://localhost:3000/api/custom-matches/start

# 5. Verify first results
sleep 900  # Wait for first poll
curl http://localhost:3000/api/custom-matches/dates
```

#### Daily Monitoring Routine
```bash
#!/bin/bash
# daily-h2h-check.sh

echo "=== H2H System Health Check ==="

# Check system health
HEALTH=$(curl -s http://localhost:3000/api/custom-matches/health)
echo "Health: $(echo $HEALTH | jq -r '.data.healthy')"

# Check recent activity
STATUS=$(curl -s http://localhost:3000/api/custom-matches/status)
LAST_RUN=$(echo $STATUS | jq -r '.data.lastRun.timestamp')
echo "Last run: $LAST_RUN"

# Check match counts
STATS=$(curl -s http://localhost:3000/api/custom-matches/stats)
TOTAL_MATCHES=$(echo $STATS | jq -r '.data.storage.totalMatches')
echo "Total matches stored: $TOTAL_MATCHES"

# Check for errors
ERROR_COUNT=$(echo $STATUS | jq -r '.data.lastRun.errors | length')
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "⚠️  Warning: $ERROR_COUNT errors in last run"
  echo $STATUS | jq '.data.lastRun.errors'
fi
```

#### Investigating Low Match Discovery
```bash
# 1. Check system configuration
curl http://localhost:3000/api/custom-matches/status | jq '.data.config'

# 2. Check community stats
curl http://localhost:3000/api/custom-matches/status | jq '.data.communityStats'

# 3. Run manual ingestion with monitoring
curl -X POST http://localhost:3000/api/custom-matches/run | jq '.data'

# 4. Review confidence distribution
curl http://localhost:3000/api/custom-matches/stats | jq '.data.scoring'
```

### Code Examples

#### Integration with External Dashboard
```javascript
// dashboard-integration.js
class H2HMonitor {
  constructor(baseUrl = 'http://localhost:3000/api/custom-matches') {
    this.baseUrl = baseUrl;
  }

  async getSystemStatus() {
    const response = await fetch(`${this.baseUrl}/status`);
    return response.json();
  }

  async getRecentMatches(days = 7) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    
    const datesResponse = await fetch(`${this.baseUrl}/dates`);
    const datesData = await datesResponse.json();
    
    const relevantDates = datesData.data.availableDates
      .filter(date => date >= startDate && date <= endDate);
    
    const matches = [];
    for (const date of relevantDates) {
      const response = await fetch(`${this.baseUrl}/date/${date}`);
      const data = await response.json();
      matches.push(...data.data.matches);
    }
    
    return matches;
  }

  async getHealthMetrics() {
    const [status, stats, health] = await Promise.all([
      fetch(`${this.baseUrl}/status`).then(r => r.json()),
      fetch(`${this.baseUrl}/stats`).then(r => r.json()),
      fetch(`${this.baseUrl}/health`).then(r => r.json())
    ]);

    return {
      isHealthy: health.data.healthy,
      isRunning: status.data.isRunning,
      uptimeHours: Math.round(status.data.uptimeMs / (1000 * 60 * 60)),
      totalMatches: stats.data.storage.totalMatches,
      recentErrors: status.data.lastRun?.errors.length || 0,
      cacheHitRate: stats.data.deduplication.cacheHitRate
    };
  }
}

// Usage
const monitor = new H2HMonitor();

// Dashboard update function
async function updateDashboard() {
  try {
    const metrics = await monitor.getHealthMetrics();
    const recentMatches = await monitor.getRecentMatches(7);
    
    document.getElementById('h2h-status').textContent = 
      metrics.isHealthy ? '✅ Healthy' : '❌ Issues Detected';
    
    document.getElementById('h2h-matches').textContent = 
      `${recentMatches.length} matches (7 days)`;
    
    document.getElementById('h2h-uptime').textContent = 
      `${metrics.uptimeHours}h uptime`;
      
  } catch (error) {
    console.error('Dashboard update failed:', error);
    document.getElementById('h2h-status').textContent = '❌ API Error';
  }
}

// Update every 5 minutes  
setInterval(updateDashboard, 5 * 60 * 1000);
updateDashboard(); // Initial load
```

#### Match Analysis Script
```javascript
// match-analysis.js
async function analyzeMatches(dateRange) {
  const h2h = new H2HMonitor();
  const matches = await h2h.getRecentMatches(dateRange);
  
  // Confidence distribution
  const confidenceStats = matches.reduce((acc, match) => {
    acc[match.confidence] = (acc[match.confidence] || 0) + 1;
    return acc;
  }, {});
  
  // Player participation
  const playerStats = matches.reduce((acc, match) => {
    match.participants.forEach(player => {
      if (!acc[player.battleTag]) {
        acc[player.battleTag] = { matches: 0, wins: 0, races: new Set() };
      }
      acc[player.battleTag].matches++;
      acc[player.battleTag].races.add(player.race);
      
      if (match.matchResult.winner?.characterId === player.characterId) {
        acc[player.battleTag].wins++;
      }
    });
    return acc;
  }, {});
  
  // Map popularity
  const mapStats = matches.reduce((acc, match) => {
    acc[match.map] = (acc[match.map] || 0) + 1;
    return acc;
  }, {});
  
  return {
    totalMatches: matches.length,
    confidenceDistribution: confidenceStats,
    topPlayers: Object.entries(playerStats)
      .sort(([,a], [,b]) => b.matches - a.matches)
      .slice(0, 10),
    popularMaps: Object.entries(mapStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
  };
}

// Usage
analyzeMatches(30).then(analysis => {
  console.log('=== H2H Match Analysis (30 days) ===');
  console.log(`Total matches: ${analysis.totalMatches}`);
  console.log('Confidence distribution:', analysis.confidenceDistribution);
  console.log('Top players:', analysis.topPlayers.slice(0, 5));
  console.log('Popular maps:', analysis.popularMaps);
});
```

### Query Patterns

#### Finding High-Quality Matches
```javascript
// Get high-confidence matches from last week
async function getHighQualityMatches() {
  const monitor = new H2HMonitor();
  const recentMatches = await monitor.getRecentMatches(7);
  
  return recentMatches
    .filter(match => match.confidence === 'HIGH')
    .filter(match => match.matchResult.outcome === 'WIN_LOSS')
    .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate));
}
```

#### Analyzing Player Head-to-Head Records
```javascript
// Get head-to-head record between two players
async function getH2HRecord(player1BattleTag, player2BattleTag, days = 90) {
  const monitor = new H2HMonitor();
  const matches = await monitor.getRecentMatches(days);
  
  const h2hMatches = matches.filter(match => {
    const playerTags = match.participants.map(p => p.battleTag);
    return playerTags.includes(player1BattleTag) && 
           playerTags.includes(player2BattleTag);
  });
  
  let player1Wins = 0;
  let player2Wins = 0;
  
  h2hMatches.forEach(match => {
    if (match.matchResult.outcome === 'WIN_LOSS') {
      if (match.matchResult.winner.battleTag === player1BattleTag) {
        player1Wins++;
      } else if (match.matchResult.winner.battleTag === player2BattleTag) {
        player2Wins++;
      }
    }
  });
  
  return {
    totalMatches: h2hMatches.length,
    player1: { name: player1BattleTag, wins: player1Wins },
    player2: { name: player2BattleTag, wins: player2Wins },
    matches: h2hMatches.sort((a, b) => 
      new Date(b.matchDate) - new Date(a.matchDate)
    )
  };
}
```

## 8. Troubleshooting

### Common Issues Quick Reference

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **No matches discovered** | `matchesDiscovered: 0` in status | Check SC2Pulse connectivity, verify community CSV accessibility, confirm character IDs in environment |
| **Low confidence scores** | All matches have `confidence: "LOW"` | Review confidence factors in `/stats`, verify community player data, check match duration patterns |
| **Deduplication not working** | High `duplicatesSkipped` count | Check Google Drive connectivity, verify service account permissions, review cache statistics |
| **Storage failures** | Errors in `lastRun.errors` | Verify Google Drive authentication, check service account permissions, ensure folder structure exists |
| **System not polling** | `isRunning: false` despite start command | Check for startup errors in logs, verify environment configuration, ensure no conflicting processes |
| **High memory usage** | Server performance issues | Reduce `H2H_CACHE_LIMIT`, increase `H2H_DEDUPE_RETENTION_DAYS` for more frequent cleanup |

### Debugging Commands

```bash
# Check system health and recent errors
curl http://localhost:3000/api/custom-matches/health | jq '.data'

# Get detailed error information
curl http://localhost:3000/api/custom-matches/status | jq '.data.lastRun.errors'

# Review confidence scoring breakdown
curl http://localhost:3000/api/custom-matches/stats | jq '.data.scoring'

# Check deduplication performance  
curl http://localhost:3000/api/custom-matches/stats | jq '.data.deduplication'

# Verify storage statistics
curl http://localhost:3000/api/custom-matches/storage/stats | jq '.'
```

### Performance Optimization Tips

- **Reduce polling frequency** during low-activity periods: increase `H2H_POLL_INTERVAL_SEC`
- **Optimize batch size** for your environment: adjust `H2H_BATCH_SIZE` based on memory and processing capacity
- **Tune cache limits** to balance memory usage and performance: modify `H2H_CACHE_LIMIT`
- **Manage retention periods** to prevent excessive storage growth: configure `H2H_DEDUPE_RETENTION_DAYS`

## 9. Deployment Notes

### Production Checklist

#### Environment Configuration
- [ ] **Google Service Account**: Configured with Drive API access and proper folder permissions
- [ ] **Environment Variables**: All required variables set with production-appropriate values
- [ ] **Community CSV**: Accessible URL with current player data
- [ ] **Resource Limits**: Adequate memory allocation for cache and processing
- [ ] **Monitoring**: Health check endpoints integrated with monitoring system

#### Recommended Production Settings
```bash
# Optimized for production stability
H2H_CUSTOM_MIN_CONFIDENCE=medium
H2H_POLL_INTERVAL_SEC=900        # 15 minutes
H2H_BATCH_SIZE=50                # Balanced throughput
H2H_LOOKBACK_DAYS=3              # Reduce API load
H2H_MAX_CONCURRENT=5             # Respect rate limits
H2H_DEDUPE_RETENTION_DAYS=30     # Monthly cleanup
H2H_CACHE_LIMIT=10000           # ~10MB memory
```

#### Security Considerations
- **Service Account Keys**: Store as encrypted environment variables, never in code
- **API Access**: Monitor for unusual access patterns or rate limit issues
- **Data Retention**: Implement appropriate retention policies for match data
- **Access Controls**: Restrict API endpoint access to internal services only

### Scaling Considerations

#### Memory Management
- **Base Memory**: ~50MB for application code
- **Cache Memory**: `H2H_CACHE_LIMIT * 0.001MB` (approximate)
- **Processing Memory**: `H2H_BATCH_SIZE * 0.01MB` per batch
- **Recommended Total**: 128MB minimum, 256MB recommended for production

#### Storage Growth Projections
- **Match Size**: ~2KB per processed match (JSON)
- **Daily Growth**: Depends on community size and activity
- **Monthly Cleanup**: Automated via retention policies
- **Drive Quotas**: Monitor Google Drive usage regularly

#### Performance Monitoring
- **Response Times**: Monitor API endpoint response times
- **Cache Hit Rates**: Target >90% cache hit rate for deduplication
- **Error Rates**: Alert on error rates >1% of total operations
- **Resource Usage**: Monitor memory and CPU usage patterns

### Integration Points

#### Monitoring System Integration
```bash
# Health check endpoint for monitoring
curl -f http://localhost:3000/api/custom-matches/health || exit 1

# Metrics collection for dashboards
curl http://localhost:3000/api/custom-matches/stats | \
  jq '.data | {matches: .storage.totalMatches, healthy: .system.isRunning}'
```

#### Log Management
The system logs to standard output with structured JSON logging. Key log events:
- **Ingestion cycles**: Start/completion with statistics
- **Errors**: Detailed error context for troubleshooting  
- **Configuration changes**: Runtime configuration updates
- **Performance metrics**: Cache hits, processing times

#### Backup Strategy
- **Primary Storage**: Google Drive provides built-in redundancy
- **Configuration Backup**: Export environment variables and configuration
- **Disaster Recovery**: Deduplication data can be rebuilt from stored matches
- **Testing**: Regular backup/restore testing recommended

## 10. Reference

### Quick Reference Tables

#### Environment Variables Summary
| Variable | Default | Purpose |
|----------|--------:|---------|
| `H2H_CUSTOM_CUTOFF` | `2025-10-08` | Match discovery cutoff date |
| `H2H_CUSTOM_MIN_CONFIDENCE` | `low` | Minimum quality threshold |
| `H2H_POLL_INTERVAL_SEC` | `900` | Automated polling interval |
| `H2H_BATCH_SIZE` | `50` | Matches per processing batch |
| `H2H_CACHE_LIMIT` | `10000` | Deduplication cache size |

#### API Endpoints Summary
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/start` | Start automated polling |
| `POST` | `/stop` | Stop automated polling |
| `POST` | `/run` | Manual ingestion trigger |
| `GET` | `/status` | System status and config |
| `GET` | `/stats` | Comprehensive statistics |
| `GET` | `/date/:dateKey` | Matches for specific date |
| `GET` | `/health` | Health check |

#### Confidence Factors Reference
| Factor | Points | Description |
|--------|-------:|-------------|
| `hasValidCharacterIds` | 2 | Players have valid Pulse IDs |
| `bothCommunityPlayers` | 3 | Both players are community members |
| `bothActiveRecently` | 1 | Recent activity (future feature) |
| `hasReasonableDuration` | 1 | Match duration seems valid |
| `similarSkillLevel` | 1 | Similar player ratings |
| `recognizedMap` | 1 | Standard map pool |

**Thresholds:** LOW (4+), MEDIUM (7+), HIGH (9+)

### External Links

#### SC2Pulse API Documentation
- **Base URL**: `https://sc2pulse.nephest.com/sc2/api`
- **Character Matches**: `/character-matches?characterId={id}&type=CUSTOM`
- **Rate Limits**: Coordinated 10 RPS across all SC2CR features
- **Attribution**: Required for non-commercial use

#### Google Drive API References
- **Service Account Setup**: [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts)
- **Drive API Documentation**: [Google Drive API v3](https://developers.google.com/drive/api/v3/reference)
- **Authentication**: JSON key-based service account authentication

#### Community CSV Format
Expected CSV structure for community player validation:
```csv
BattleTag,CharacterId,Name,Race,Rating
Player#1234,4581,PlayerName,Protoss,4500
Player#5678,8381155,OtherPlayer,Terran,4200
```

### Related SC2CR Documentation

- **[Architecture Overview](../architecture/overview.md)**: System architecture and component relationships
- **[API Endpoints](../api/endpoints.md)**: Complete API reference for all SC2CR endpoints  
- **[Environment Variables](../reference/environment-variables.md)**: All SC2CR environment configuration
- **[Custom Match Ingestion System](./custom-match-ingestion-system.md)**: Detailed technical implementation guide
- **[Development Setup](../development/setup.md)**: Local development environment configuration

### Schema and Types

#### Match Schema Version
Current schema version: `1.0`

Future schema changes will be backward compatible and versioned incrementally.

#### TypeScript Interfaces
Key interfaces are defined in `src/shared/customMatchTypes.ts`:
- `ProcessedCustomMatch`: Complete match with metadata
- `ValidatedParticipant`: Player information with community status
- `MatchResult`: Winner/loser tracking
- `ConfidenceFactors`: Quality assessment breakdown
- `IngestionResult`: Processing cycle results

### Support and Troubleshooting

#### Log Analysis
Enable detailed logging by setting log level in your Node.js environment:
```bash
LOG_LEVEL=debug
```

#### Community Support
- **Issues**: Report bugs via GitHub issues
- **Documentation**: This documentation covers most common scenarios
- **Code Review**: Implementation details available in source code with comprehensive comments

---

**Last Updated**: October 11, 2025  
**Schema Version**: 1.0  
**Document Version**: 1.0