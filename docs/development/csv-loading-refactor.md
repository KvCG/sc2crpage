# CSV Loading Refactor Implementation Plan

## Overview

This refactor centralizes CSV data loading for the SC2CR application, eliminating duplicate reads and providing a consistent interface for community player data access.

## Problems Solved

1. **Duplicate CSV Reading**: Previously both `pulseService.ts` and `customMatchDiscoveryService.ts` read the same CSV independently
2. **Inconsistent Data Expectations**: H2H service assumed CSV had fields like `rating` and `lastPlayed` that may not exist
3. **No Centralized CSV Management**: Each service implemented its own CSV loading logic
4. **Cache Inefficiency**: Simple cache in `csvParser.ts` but services reloaded independently

## Changes Made

### 1. New Centralized Service

**File**: `src/server/services/communityDataService.ts`

- **Purpose**: Single source of truth for community player data
- **Features**:
  - Lazy loading with caching
  - Anti-stampede protection (concurrent requests share same promise)
  - Graceful error handling with fallback to empty data
  - Type-safe interfaces
  - Comprehensive validation

**Key Interfaces**:
```typescript
interface CommunityPlayer {
    id: string           // Pulse character ID (primary key)
    btag: string         // Battle tag (e.g., "Player#1234")
    name?: string        // Display name (custom or real name)
    challongeId?: string // Tournament correlation ID
}

interface CommunityData {
    players: CommunityPlayer[]
    playerIds: Set<string>              // Quick membership checks
    displayNames: Map<string, string>   // Battle tag -> display name
    playerById: Map<string, CommunityPlayer>
    loadedAt: Date
}
```

**Key Methods**:
- `getCommunityData()`: Main data accessor with caching
- `isCommunityPlayer(characterId)`: Quick membership check
- `getDisplayName(btag)`: Get custom name for battle tag
- `getCommunityPlayer(characterId)`: Get full player record
- `getCommunityPlayerIds()`: Get array of all player IDs
- `getCommunityStats()`: Get loading statistics

### 2. Updated H2H Discovery Service

**File**: `src/server/services/customMatchDiscoveryService.ts`

**Changes**:
- Removed internal CSV loading logic
- Uses `communityDataService` for all community data access
- Simplified data expectations (no longer assumes `rating` or `lastPlayed`)
- Made methods async where needed for service integration

**Key Updates**:
- `initializeCommunityData()`: Removed (no longer needed)
- `isCommunityPlayer()`: Now async, uses centralized service
- `getCommunityStats()`: Now async, delegates to centralized service
- `validateMatchParticipants()`: Updated to use centralized player lookup

### 3. Updated Pulse Service

**File**: `src/server/services/pulseService.ts`

**Changes**:
- Removed direct `readCsv` import
- Uses `communityDataService` for player IDs and display names
- Maintains same public interface for backward compatibility

**Key Updates**:
- `loadPlayersFromCsv()`: Now delegates to centralized service
- Display name lookup uses shared Map from centralized service

### 4. Updated Routes

**File**: `src/server/routes/customMatchRoutes.ts`

**Changes**:
- Updated to handle async `getCommunityStats()` method

## Migration Steps

### For Development

1. **No Breaking Changes**: All public APIs remain the same
2. **Automatic Migration**: Existing code continues to work
3. **Performance Improvement**: CSV is now read only once per server lifecycle

### For Testing

1. **New Test Coverage**: Added comprehensive tests for `communityDataService`
2. **Mock Updates**: Tests now mock the centralized service instead of direct CSV reads

### For Deployment

1. **Backward Compatible**: No deployment changes required
2. **Improved Performance**: Single CSV read instead of multiple
3. **Better Error Handling**: Graceful degradation on CSV errors

## Expected CSV Format

The system expects CSV with these columns:
- `id`: Pulse character ID (required)
- `btag`: Battle tag (required)
- `name`: Custom display name (optional)
- `challongeId`: Tournament participant ID (optional)

**Example CSV**:
```csv
id,btag,name,challongeId
123,Player#1234,Player One,p1
456,Player#5678,Player Two,
789,Player#9999,,p3
```

**Error Handling**:
- Rows missing `id` or `btag` are skipped with warnings
- Empty CSV or load errors result in empty community data (system continues)
- Invalid rows are logged but don't stop processing

## Performance Benefits

1. **Single CSV Read**: Only one file read per server lifecycle
2. **In-Memory Caching**: Subsequent calls use cached data
3. **Concurrent Request Handling**: Multiple simultaneous requests share same loading promise
4. **Optimized Lookups**: Uses `Set` and `Map` for O(1) operations

## Monitoring & Observability

The service includes comprehensive logging:
- CSV loading start/completion with counts
- Warning logs for invalid rows
- Error logs for load failures (with fallback behavior)
- Statistics on successful load (player count, display names)

**Log Messages to Monitor**:
- `"Community data loaded successfully"` - Normal operation
- `"Skipping CSV row with missing id or btag"` - Data quality issues
- `"Failed to load community data, returning empty fallback"` - CSV errors

## Future Enhancements

1. **Automatic Refresh**: Could add periodic CSV reloading
2. **Configuration**: Environment-based CSV source selection
3. **Validation**: Enhanced CSV schema validation
4. **Metrics**: Performance and usage metrics collection
5. **API Endpoints**: Expose community data via REST API for debugging

## Testing the Changes

1. **Unit Tests**: Run `npm test communityDataService.test.ts`
2. **Integration Tests**: Verify H2H and ranking systems continue to work
3. **Performance Test**: Monitor CSV load time with logging
4. **Error Test**: Test behavior with invalid/missing CSV files

## Rollback Plan

If issues arise, revert these files:
1. `src/server/services/customMatchDiscoveryService.ts`
2. `src/server/services/pulseService.ts`
3. `src/server/routes/customMatchRoutes.ts`

The new `communityDataService.ts` can remain (unused) for future use.