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
- **POST `/api/analytics/schedule/start`**
  - Starts the automated analytics snapshot scheduler.
- **POST `/api/analytics/schedule/stop`**
  - Stops the analytics snapshot scheduler.
- **GET `/api/analytics/schedule/status`**
  - Returns scheduler status and metrics.
- **GET `/api/analytics/backups`**
  - Lists available historical snapshot backups.
- **GET `/api/analytics/restore/{fileId}`**
  - Restores a specific historical snapshot by file ID.
- **DELETE `/api/analytics/cleanup`**
  - Cleans up old backups (retention policy).
- **GET `/api/analytics/deltas`**
  - Computes player ranking changes (deltas) over a time window.
- **GET `/api/analytics/activity`**
  - Returns population-level activity and movement analysis.
- **GET `/api/analytics/movers`**
  - Returns top movers (players with significant ranking changes).

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

### `/api/analytics/schedule/*`
- **Status Response:**
  - `isRunning` (boolean): Scheduler active status
  - `intervalHours` (number): Snapshot interval
  - `timezone` (string): Timezone (IANA format)
  - `nextRun` (ISO timestamp): Next scheduled run
  - `lastRun` (ISO timestamp): Last completed run
  - `metrics`: Object with snapshot counts, error counts, last error

### `/api/analytics/backups`
- **Response:**
  - `backups`: Array of `BackupMetadata` objects
  - `pagination`: Object with `total`, `limit`, `offset`, `hasMore`

#### `BackupMetadata` fields:
- `fileId` (string): Google Drive file ID
- `fileName` (string): Backup file name
- `timestamp` (ISO string): Creation time
- `metadata`: Object
  - `type` (string): Backup type ("snapshot")
  - `playerCount` (number): Number of players
  - `dataSize` (number): File size in bytes
  - `createdBy` (string): Source (e.g., "scheduler")

### `/api/analytics/restore/{fileId}`
- **Response:**
  - `snapshot`: Object
    - `createdAt` (ISO timestamp)
    - `expiry` (Unix ms)
    - `data`: Array of `RankingRow` objects
  - `metadata`: As above, with `restoredAt` (ISO timestamp)

### `/api/analytics/deltas`
- **Response:**
  - `deltas`: Array of `PlayerDelta` objects
  - `metadata`: Object
    - `timeWindow`: `{ hours, baseline, current }`
    - `totalPlayers`, `filteredCount`, `averageConfidence`

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

### `/api/analytics/activity`
- **Response:**
  - `analysis`: Object
    - `totalPlayers`, `activePlayers`
    - `movers`: `{ promotions, demotions, significantRises, significantFalls }`
    - `activityLevels`: `{ high, medium, low, inactive }`
    - `averageRatingChange` (number)
    - `timestamp` (ISO)
  - `metadata`: `{ timeWindow, confidence }`

### `/api/analytics/movers`
- **Response:**
  - `movers`: Array of `PlayerDelta` (see above)
  - `metadata`: `{ direction, limit, totalFound, timeWindow }`

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
