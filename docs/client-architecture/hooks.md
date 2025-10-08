# Client Hooks & API Integration

The SC2CR client uses a custom hook-based architecture for API integration, state management, and data caching. This document covers the patterns, implementation details, and usage guidelines for client-side data fetching.

## Overview

The client-side data architecture follows these core patterns:
- **Custom Hooks**: `useFetch` and `usePost` for API interactions
- **Service Layer**: Centralized API client functions in `services/api.ts`
- **Environment Config**: Automatic API base URL selection
- **Caching Strategy**: localStorage persistence for snapshots and analytics
- **Error Handling**: Graceful degradation with user-friendly messages

## Core Hooks

### useFetch Hook

**Location**: `src/client/hooks/useFetch.tsx`

**Purpose**: Generic data fetching hook with loading states, error handling, and type safety.

**Signature**:
```typescript
useFetch(type: string) => {
  data: any[] | null,
  loading: boolean,
  error: string | null,
  fetch: (params?: any) => Promise<void>
}
```

**Supported Types**:
- `'ranking'` - Top player rankings via `/api/top`
- `'search'` - Player search via `/api/search`
- `'tournament'` - Tournament data via `/api/tournament`
- `'replays'` - Replay list via `/api/getReplays`
- `'analyzeReplayBase64'` - Base64 replay analysis
- `'analyzeReplayUrl'` - URL replay analysis
- `'replayAnalysis'` - Replay analysis results
- `'player-analytics'` - Player analytics dashboard
- `'player-analytics-activity'` - Activity analysis

**Usage Example**:
```typescript
import { useFetch } from '../hooks/useFetch'

export const Rankings = () => {
  const { data, loading, error, fetch } = useFetch('ranking')
  
  useEffect(() => {
    fetch() // Load initial data
  }, [])
  
  if (loading) return <Loader />
  if (error) return <div>Error: {error}</div>
  
  return (
    <div>
      {data?.map(player => (
        <div key={player.id}>{player.btag}</div>
      ))}
    </div>
  )
}
```

**Error Handling**:
- Network errors display: "Failed to fetch data. Please try again later."
- Data resets to empty array on error
- Maintains previous data during loading to prevent flashing

### usePost Hook

**Location**: `src/client/hooks/usePost.tsx`

**Purpose**: Handles POST operations with loading states and success/error feedback.

**Signature**:
```typescript
usePost(type: string) => {
  success: string,
  loading: boolean,
  error: string | null,
  post: (body: any) => Promise<void>
}
```

**Supported Types**:
- `'uploadReplay'` - Upload replay file to Google Drive
- `'deleteReplay'` - Delete replay file from storage

**Usage Example**:
```typescript
import { usePost } from '../hooks/usePost'

export const UploadForm = () => {
  const { success, loading, error, post } = usePost('uploadReplay')
  
  const handleSubmit = async (formData) => {
    await post({
      fileName: formData.name,
      fileBase64: formData.content,
      // ... other fields
    })
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {loading && <span>Uploading...</span>}
      {success && <span>Upload successful!</span>}
      {error && <span>Error: {error}</span>}
      {/* form fields */}
    </form>
  )
}
```

### Analytics-Specific Hooks

#### useCommunityStats Hook

**Location**: `src/client/hooks/useCommunityStats.tsx`

**Purpose**: Specialized hook for community analytics with advanced caching and error recovery.

**Features**:
- **localStorage Caching**: 30-minute TTL with validity checking
- **Stale-While-Revalidate**: Shows cached data while fetching updates
- **Parameter Serialization**: Cache keys based on query parameters
- **Error Recovery**: Fallback to cached data on network failures

**Usage**:
```typescript
import { useCommunityStats } from '../hooks/useCommunityStats'

export const CommunityDashboard = () => {
  const { data, loading, error, lastUpdated, fetch, refresh } = useCommunityStats({
    timeframe: 'current',
    includeInactive: false,
    minimumGames: 20
  })
  
  return (
    <div>
      <button onClick={refresh}>Refresh Data</button>
      {lastUpdated && <span>Last updated: {lastUpdated}</span>}
      {/* analytics display components */}
    </div>
  )
}
```

#### usePlayerActivity Hook

**Location**: `src/client/hooks/usePlayerActivity.tsx`

**Purpose**: Activity analysis with grouping options and temporal patterns.

**Cache Strategy**: 30-minute TTL in localStorage with parameter-based cache keys

**Usage**:
```typescript
import { usePlayerActivity } from '../hooks/usePlayerActivity'

export const ActivityAnalysis = () => {
  const { data, loading, error, fetch } = usePlayerActivity({
    groupBy: 'race',
    includeInactive: false
  })
  
  return (
    <div>
      {data?.activityBuckets && (
        <ActivityChart buckets={data.activityBuckets} />
      )}
    </div>
  )
}
```

## API Service Layer

### Core API Client

**Location**: `src/client/services/api.ts`

**Configuration**: Uses axios with environment-aware base URL selection

**Request Interceptor**: Automatically adds correlation IDs via `x-request-id` header

**Core Functions**:

#### Ranking & Search
```typescript
// Get top rankings with filtering
export const getTop = async () => {
  const response = await api.get('api/top/?includeInactive=false&minimumGames=20')
  return response
}

// Search players by battle tag
export const search = async (searchTerm: string) => {
  const response = await api.get(`api/search/?term=${encodeURIComponent(searchTerm)}`)
  return response
}

// Get daily ranking snapshot
export const getSnapshot = async () => {
  const response = await api.get('api/snapshot')
  return response
}
```

#### Tournament & Replays
```typescript
// Get tournament information
export const getTournament = async () => {
  const response = await api.get('api/tournament/')
  return response
}

// Get replay list
export const getReplays = async () => {
  const response = await api.get('api/getReplays')
  return response
}

// Upload replay file
export const uploadReplay = async (body: any) => {
  const response = await api.post('api/uploadReplay', body)
  return response
}
```

#### Analytics
```typescript
// Get comprehensive player analytics
export const getPlayerAnalytics = async (params?: {
  timeframe?: 'current' | 'daily'
  includeInactive?: boolean
  minimumGames?: number
  race?: string | null
}) => {
  const response = await api.get('api/player-analytics', { params })
  return response
}

// Get detailed activity analysis
export const getPlayerActivityAnalysis = async (params?: {
  timeframe?: 'current' | 'daily'
  includeInactive?: boolean
  minimumGames?: number
  groupBy?: 'race' | 'league' | 'activity'
}) => {
  const response = await api.get('api/player-analytics/activity', { params })
  return response
}
```

### Environment Configuration

**Location**: `src/client/services/config.ts`

**Purpose**: Automatic API base URL detection based on hostname

**Detection Logic**:
```typescript
let hostName = window.location.hostname
if (hostName.includes('sc2cr-dev') || hostName.includes('project')) {
  hostName = 'sc2cr-dev'
}

switch (hostName) {
  case 'sc2cr.vercel.app':
  case 'sc2cr-latest.onrender.com':
    config = prod  // https://sc2cr-latest.onrender.com/
    break
  case 'sc2cr-dev':
    config = dev   // https://sc2cr-dev.fly.dev
    break
  case 'localhost':
    config = local // http://localhost:3000/
    break
  default:
    config = local
}
```

**Config Files**:
- `src/client/config/prod.config.json` - Production Render API
- `src/client/config/dev.config.json` - Development Fly.io API  
- `src/client/config/local.config.json` - Local server

## Caching Strategies

### Ranking Snapshot Caching

**Implementation**: `pages/Ranking.tsx` uses localStorage for daily snapshots

**Cache Key**: `'dailySnapshot'`

**Validation**: Server-provided `expiry` timestamp for cache validity

**Pattern**:
```typescript
// Check cache validity
const cachedSnapshot = localStorage.getItem('dailySnapshot')
if (cachedSnapshot) {
  const parsed = JSON.parse(cachedSnapshot)
  if (Date.now() < parsed.expiry) {
    return parsed // Use cached data
  }
}

// Fetch fresh snapshot
const snapshot = await getSnapshot()
localStorage.setItem('dailySnapshot', JSON.stringify(snapshot.data))
```

### Analytics Data Caching

**Strategy**: Parameter-based cache keys with TTL validation

**Cache Keys**: Generated from query parameters for cache granularity

**Implementation**:
```typescript
const generateCacheKey = (baseKey: string, params: object) => {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((result, key) => {
      result[key] = params[key]
      return result
    }, {})
  return `${baseKey}_${JSON.stringify(sortedParams)}`
}
```

**TTL Management**: 30-minute default with server-provided cache control

## Error Handling Patterns

### Network Error Recovery
```typescript
const handleNetworkError = (error: AxiosError) => {
  // Check for cached fallback data
  const cached = loadFromCache(cacheKey)
  if (cached && isValid(cached)) {
    return cached.data
  }
  
  // Display user-friendly error message
  setError('Failed to fetch data. Please try again later.')
  return []
}
```

### Loading State Management
```typescript
const [loading, setLoading] = useState(false)
const [data, setData] = useState(null)

const fetchData = async () => {
  setLoading(true)
  try {
    const result = await apiCall()
    setData(result.data)
    setError(null)
  } catch (error) {
    handleError(error)
  } finally {
    setLoading(false)
  }
}
```

### Graceful Degradation
- **Cached Data**: Display stale data with refresh indicators
- **Partial Results**: Show available data with missing data indicators
- **Retry Logic**: Provide manual retry options for failed requests

## Request Correlation & Debugging

### Request Identity
**Implementation**: `src/client/utils/requestIdentity.ts`

**Purpose**: Correlation ID generation for request tracing across client/server

**Usage**: Automatically attached to all API requests via axios interceptor

```typescript
// Automatic correlation ID attachment
api.interceptors.request.use((req) => {
  const requestId = resolveRequestId()
  if (requestId && !req.headers['x-request-id']) {
    req.headers['x-request-id'] = requestId
  }
  return req
})
```

### Debug Support
- **Request Tracing**: Correlation IDs for cross-service debugging
- **Error Context**: Detailed error information in development
- **Performance Metrics**: Request timing and cache hit rates

## Component Integration Patterns

### Page-Level Integration
```typescript
// Typical page component pattern
export const RankingPage = () => {
  const { data: rankings, loading, error, fetch } = useFetch('ranking')
  const { data: snapshot } = useSnapshot()
  
  useEffect(() => {
    fetch()
  }, [])
  
  const enhancedData = useMemo(() => {
    return addPositionChangeIndicators(rankings, snapshot)
  }, [rankings, snapshot])
  
  return (
    <Container>
      <RankingTable data={enhancedData} loading={loading} />
      {error && <ErrorAlert message={error} />}
    </Container>
  )
}
```

### Component-Level Integration
```typescript
// Component with local data fetching
export const PlayerSearch = ({ onPlayerSelect }) => {
  const { data, loading, error, fetch } = useFetch('search')
  const [searchTerm, setSearchTerm] = useState('')
  
  const handleSearch = () => {
    if (searchTerm.trim()) {
      fetch(searchTerm)
    }
  }
  
  return (
    <div>
      <TextInput 
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <Button onClick={handleSearch} loading={loading}>
        Search
      </Button>
      {data?.map(player => (
        <PlayerResult 
          key={player.character.id}
          player={player}
          onClick={onPlayerSelect}
        />
      ))}
    </div>
  )
}
```

## Testing Patterns

### Hook Testing
```typescript
import { renderHook, act } from '@testing-library/react'
import { useFetch } from './useFetch'

describe('useFetch', () => {
  it('handles success path for ranking', async () => {
    const { result } = renderHook(() => useFetch('ranking'))
    
    await act(async () => {
      await result.current.fetch()
    })
    
    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual(mockRankingData)
    expect(result.current.loading).toBe(false)
  })
})
```

### API Client Testing
```typescript
import * as api from './api'

describe('api client', () => {
  it('builds search request with encoded term', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({ data: [] })
    
    await api.search('Player#1234')
    
    expect(axiosInstance.get).toHaveBeenCalledWith(
      'api/search/?term=Player%231234'
    )
  })
})
```

## Performance Optimizations

### Request Deduplication
- **Promise Sharing**: Multiple components using same hook share requests
- **Cache Coordination**: Prevent duplicate API calls for cached data
- **Debounced Search**: Delay search requests to reduce API load

### Memory Management
- **Hook Cleanup**: Automatic cleanup of pending requests on unmount
- **Cache Limits**: LRU eviction for localStorage data
- **Component Optimization**: Memoization for expensive operations

## Future Enhancements

### Real-time Updates
- **WebSocket Integration**: Live data updates for rankings and analytics
- **Optimistic Updates**: Immediate UI updates with server confirmation
- **Conflict Resolution**: Handle concurrent data modifications

### Advanced Caching
- **Service Worker**: Offline data access and background sync
- **Cache Invalidation**: Smart cache updates based on data changes
- **Compression**: Efficient storage for large analytics datasets