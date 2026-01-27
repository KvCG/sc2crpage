# SC2CR × Pulse API Review

This document provides a canonical reference for all public API endpoints exposed by the SC2CR × Pulse integration. It is designed to be the single source of truth for engineers extending, consuming, or maintaining the API. All naming, DTO, error, and logging conventions follow `.github/instructions/copilot-instructions.md`.

---

## 1. Endpoint Summary

### Ranking & Snapshot Endpoints
- **GET `/api/top`**
  - Returns current top player rankings (live data).
- **GET `/api/snapshot`**
  - Returns daily baseline ranking snapshot (used for position change indicators).

### Analytics & Historical Endpoints
- **GET `/api/scheduler`**
  - Returns scheduler status and metrics.
- **POST `/api/scheduler/force-run`**
  - Force run a specific scheduled operation (snapshot, activity, movers).
- **GET `/api/persistence`**
  - Returns persistence layer status.
- **GET `/api/persistence/backups`**
  - Lists available historical snapshot backups.
- **GET `/api/deltas`**
  - Computes player ranking changes (deltas) over a time window.
- **GET `/api/player-analytics`**
  - Comprehensive player analytics and statistics.
- **GET `/api/player-analytics/activity`**
  - Detailed activity analysis with temporal patterns and engagement metrics.
- **GET `/api/ranking`**
  - Enhanced ranking with embedded delta information.

---

## 2. Resource Schemas

### `/api/top` & `/api/snapshot`
- **Response:**
  - `data`: Array of `RankingRow` objects
  - `createdAt`: ISO 8601 timestamp (snapshot only)
  - `expiry`: Unix epoch ms (snapshot only)

#### `RankingRow` fields:
- `id` (number): Unique player identifier (SC2Pulse `character.id`)
- `btag` (string): Battle.net tag
- `name` (string): Display name
- `ratingLast` (number): Most recent rating
- `race` (string): Player's race (e.g., "Terran", "Protoss", "Zerg")
- `leagueTypeLast` (number): League tier (integer)
- `daysSinceLastGame` (number): Days since last game played
- `gamesPlayedRecent` (number): Recent games played (window defined by backend)

### `/api/scheduler`
- **Status Response:**
  - `isRunning` (boolean): Scheduler active status
  - `intervalHours` (number): Snapshot interval
  - `timezone` (string): Timezone (IANA format)
  - `nextRun` (ISO timestamp): Next scheduled run
  - `lastRun` (ISO timestamp): Last completed run
  - `metrics`: Object with snapshot counts, error counts, last error

### `/api/scheduler/force-run`
- **Request Body:**
  - `operation` (string): Operation to run ("snapshot", "activity", "movers")
- **Response:**
  - `operation` (string): Operation that was executed
  - `executed` (boolean): Whether operation completed successfully
  - `timestamp` (ISO timestamp): Execution time

### `/api/persistence/backups`
- **Query Parameters:**
  - `maxAge` (number, optional): Maximum age in hours (default: 168)
- **Response:**
  - `backups`: Array of `BackupMetadata` objects
  - `count` (number): Total number of backups
  - `maxAge` (number): Age filter applied

#### `BackupMetadata` fields:
- `fileId` (string): Google Drive file ID
- `fileName` (string): Backup file name
- `timestamp` (ISO string): Creation time
- `metadata`: Object
  - `type` (string): Backup type ("snapshot")
  - `playerCount` (number): Number of players
  - `dataSize` (number): File size in bytes
  - `createdBy` (string): Source (e.g., "scheduler")

### `/api/deltas`
- **Query Parameters:**
  - `timeWindowHours` (number, default: 24): Time window for comparison
  - `includeInactive` (boolean, default: false): Include inactive players
  - `minimumConfidence` (number, default: 50): Minimum confidence score
  - `maxDataAge` (number, default: 48): Maximum baseline age in hours
- **Response:**
  - `success` (boolean): Operation success status
  - `deltas`: Array of `PlayerDelta` objects
  - `metadata`: Object
    - `count` (number): Number of deltas computed
    - `options`: Query parameters used
    - `timestamp` (ISO string): Computation time

#### `PlayerDelta` fields:
- `id` (number): Unique player identifier
- `btag` (string): Battle.net tag
- `name` (string): Display name
- `positionChangeIndicator` ("up" | "down" | "none"): Movement direction
- `positionDelta` (number): Change in position (+/-)
- `previousRank` (number): Previous ranking
- `currentRank` (number): Current ranking
- `ratingChange` (number): Rating difference
- `previousRating` (number): Previous rating
- `currentRating` (number): Current rating
- `activityLevel` ("high" | "medium" | "low" | "inactive"): Activity classification
- `race` (string): Player's race
- `leagueType` (number): League tier
- `confidenceScore` (number): Confidence 0-100

### `/api/player-analytics`
- **Query Parameters:**
  - `timeframe` (string, default: "current"): "current" or "daily"
  - `includeInactive` (boolean, default: false): Include inactive players
  - `minimumGames` (number, default: 20): Minimum games filter
  - `race` (string, optional): Filter by specific race
- **Response:**
  - `success` (boolean): Operation success status
  - `data`: Object with comprehensive analytics
    - `activityStats`: Player activity statistics
    - `raceDistribution`: Distribution by race
    - `leagueStats`: Distribution by league
    - `metadata`: Analysis metadata

### `/api/player-analytics/activity`
- **Query Parameters:**
  - `includeInactive` (boolean, default: false): Include inactive players
  - `groupBy` (string, default: "activity"): "race", "league", or "activity"
  - `timeframe` (string, default: "current"): "current" or "daily"
  - `minimumGames` (number, default: 20): Minimum games filter
- **Response:**
  - `success` (boolean): Operation success status
  - `data`: Object with detailed activity analysis
    - `activityAnalysis`: Activity level breakdown
    - `temporalPatterns`: Time-based activity patterns
    - `metadata`: Analysis metadata

### `/api/ranking`
- **Query Parameters:**
  - `timeWindowHours` (number, default: 24): Time window for deltas
  - `includeInactive` (boolean, default: false): Include inactive players
  - `minimumConfidence` (number, default: 75): Minimum confidence score
  - `maxDataAge` (number, default: 48): Maximum data age in hours
  - `minimumGames` (number, default: 20): Minimum games filter
- **Response:**
  - `success` (boolean): Operation success status
  - `ranking`: Array of enhanced ranking objects with embedded deltas
  - `metadata`: Response metadata with player counts and options

### Error Response (all endpoints)
- `success` (false)
- `error`: Object
  - `code` (string): Error code (see below)
  - `message` (string): Human-readable error
  - `details` (object): Additional context

---

## 3. Field Semantics & Constraints

- **id**: Canonical player identifier from SC2Pulse (`character.id`).
- **btag**: Battle.net tag, unique per player.
- **name**: Display name, may be missing for some records.
- **ratingLast/currentRating/previousRating**: Integer, range typically 1000–8000 (see DTO rules).
- **race**: One of "Terran", "Protoss", "Zerg", "Random"; string, case-sensitive.
- **leagueType/leagueTypeLast**: Integer, maps to league tiers (see client constants).
- **daysSinceLastGame**: Integer, days since last game played; may be undefined for new players.
- **gamesPlayedRecent**: Integer, recent games played in backend-defined window.
- **positionChangeIndicator**: "up" (improved), "down" (declined), "none" (no change or new player).
- **positionDelta**: Integer, positive for upward movement, negative for downward.
- **activityLevel**: "high", "medium", "low", "inactive"; see metrics computation patterns.
- **confidenceScore**: Integer 0–100; see confidence notes below.
- **createdAt/expiry/timestamp/restoredAt/nextRun/lastRun**: ISO 8601 or Unix ms; all times are in Costa Rica timezone unless otherwise noted.
- **fileId/fileName**: Backup file identifiers; fileId is Google Drive ID, fileName is human-readable.
- **metadata**: Varies by endpoint; always includes type, playerCount, dataSize, and source.

---

## 4. Confidence & Precision Notes

- **Confidence Levels**:
  - `confidenceScore` is computed per record; factors include data freshness, sample size, and temporal gaps.
  - 1v1 data: High confidence (90–100)
  - Team/arcade/external: Medium to low confidence (50–89), depending on source and recency
  - Data gaps >2h: Reduced confidence; >24h: low confidence
  - Minimum confidence for analytics endpoints is configurable (default: 75)
- **Precision**:
  - All ranking and delta calculations use canonical player IDs and btags for cross-referencing.
  - Position indicators are only computed for players present in both baseline and current data.
  - Activity levels are derived from days since last game and games played; thresholds are backend-configurable.

---

## 5. Error Codes

- `VALIDATION_ERROR`: Invalid request parameters
- `NOT_FOUND`: Resource not found
- `SCHEDULER_ERROR`: Scheduler operation failed
- `BACKUP_ERROR`: Backup operation failed
- `COMPUTATION_ERROR`: Delta computation failed
- `INTERNAL_ERROR`: Unexpected server error

---

## 6. Reusable Conventions & Patterns

- **DTO Naming**: All DTOs use CamelCase with `Dto` suffix; runtime objects drop the suffix.
- **Cache Keys**: Hierarchical pattern: `domain:entity:scope:identifier` (e.g., `analytics:player:24h:2024-01-15`).
- **Error Structure**: `{ error, code, context? }` for all error responses.
- **Identity Resolution**: Use canonical `character.id` for player identity; cross-reference with CSV `btag`/`name`.
- **Confidence Scoring**: Multi-factor, 0–100, with explicit thresholds for analytics endpoints.
- **Temporal Alignment**: All time-based operations use Costa Rica timezone for consistency.

---

## 7. Extending the API

- Always update this documentation first when adding or changing endpoints or fields.
- Follow DTO, error, and logging conventions from `.github/instructions/copilot-instructions.md`.
- Document new fields and value ranges unambiguously.
- Ensure all new endpoints support graceful degradation and confidence scoring where applicable.
