# Pulse API Test Fixtures

This directory contains comprehensive JSON fixtures for testing SC2Pulse API integration.

## Structure

### Raw API Responses (`pulse/raw/`)
These fixtures represent actual responses from the SC2Pulse API endpoints.

#### Seasons
- `seasons.json` - Single season response (existing)
- `seasons-multiple.json` - Multiple seasons response
- `seasons-empty.json` - Empty seasons array

#### Team Data  
- `groupTeam.array.json` - Multiple teams response (existing)
- `groupTeam.single.json` - Single team response (existing)
- `groupTeam.multirace.json` - Teams with multiple races using raceGames format
- `groupTeam.legacy.json` - Teams using legacy numeric fields (randomGamesPlayed, etc.)
- `groupTeam.empty.json` - Empty teams array
- `groupTeam.malformed.json` - Malformed/incomplete data for error testing

#### Character Search
- `characterSearch.multiple.json` - Multiple search results
- `characterSearch.single.json` - Single exact match
- `characterSearch.empty.json` - No search results

### Formatted Data (`pulse/formatted/`)
These fixtures represent data after processing through `formatData()` and other transformations.

#### Ranking Data
- `ranking.standard.json` - Standard formatted ranking with modern raceGames
- `ranking.legacy.json` - Ranking data from legacy numeric fields

#### Search Results
- `search.multiple.json` - Formatted search results

#### Snapshots
- `snapshot.daily.json` - Complete daily snapshot with metadata

### Error Responses (`pulse/errors/`)
Common error scenarios for testing error handling.

- `rateLimitError.json` - HTTP 429 rate limit exceeded
- `serverError.json` - HTTP 500 internal server error  
- `serviceUnavailable.json` - HTTP 503 service unavailable

## Usage

```typescript
import { loadJsonFixture } from '../loadJson'

// Load raw API response
const teams = loadJsonFixture('pulse/raw/groupTeam.multirace.json')

// Load formatted data
const ranking = loadJsonFixture('pulse/formatted/ranking.standard.json')

// Load error response
const error = loadJsonFixture('pulse/errors/rateLimitError.json')
```

## Coverage

These fixtures cover:

- ✅ Multiple race formats (raceGames vs numeric fields)
- ✅ All league types (Bronze through Grandmaster)
- ✅ Online/offline status scenarios
- ✅ Empty and malformed data handling
- ✅ Search result variations
- ✅ Snapshot data with position indicators
- ✅ Common HTTP error responses
- ✅ Edge cases (null values, missing fields)

## Versioning

Fixtures are aligned with SC2Pulse API as of January 2024. When the upstream API changes, update fixtures and document version differences.