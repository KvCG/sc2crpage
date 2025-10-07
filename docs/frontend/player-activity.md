# Player Activity Analytics - Frontend Implementation

## Overview
The Player Activity Analytics page provides specialized visualizations for player activity patterns, temporal engagement, and community dynamics within the SC2 Costa Rica community. It consumes the `/api/player-analytics/activity` endpoint and displays interactive charts focused on activity recency, temporal patterns, and engagement metrics.

## Route
- **URL:** `/player-activity`
- **Navigation Label:** "Player Activity" 
- **Component:** `PlayerActivity.tsx`

## UI/UX Consistency
The Player Activity page maintains design consistency with existing analytics modules:

- **Header Layout:** Matches CommunityStats with centered title and refresh button
- **Filter Integration:** Reuses existing `StatsFilters` component for consistency
- **Chart Styling:** Uses shared chart configuration and color tokens
- **Grid Layout:** Responsive grid system matching established patterns
- **Error/Loading States:** Consistent state management across all charts

## Features

### 1. Temporal Pattern Analysis
- **Hourly Activity Chart:** Line chart showing player activity distribution across 24 hours (Costa Rica timezone)
- **Daily Activity Chart:** Bar chart showing activity patterns across days of the week with peak day highlighting
- **Peak Time Identification:** Visual representation of community activity peaks and valleys with peak hour/day indicators

### 2. Activity Recency Buckets
- **Activity Buckets Chart:** Bar chart showing player distribution by recency (very recent, recent, today, yesterday, this week, older)
- **Color-Coded Recency:** Gradient from bright green (very recent) to gray (older activity)
- **Distribution Insights:** Understanding community engagement patterns and player retention

### 3. Community Engagement Overview
- **Engagement Metrics Cards:** Top-level display of key community statistics as individual value cards
- **Community Health Indicators:** Total games, active players, average games per player, and engagement rate
- **Visual Prominence:** Displayed at the top for immediate community health assessment

### 4. Data Management
- **Activity-Specific Caching:** 30-minute TTL with activity-focused cache keys
- **Parameter Support:** Group by activity/race/league with proper query parameter handling
- **Real-time Refresh:** Manual refresh preserves filter state
- **Graceful Fallbacks:** Safe handling of incomplete or missing activity data

## Component Architecture

### Main Components
```
src/client/pages/PlayerActivity.tsx                    # Main page component
src/client/hooks/usePlayerActivity.tsx                 # Activity data management hook
src/client/components/CommunityStats/
├── HourlyActivityChart.tsx                           # 24-hour activity pattern visualization
├── DailyActivityChart.tsx                            # Weekly activity pattern with peak day highlighting
├── ActivityBucketsChart.tsx                          # Player activity recency distribution
├── EngagementMetricsChart.tsx                        # Community engagement metrics as value cards
└── (reused) StatsFilters.tsx                        # Shared filter controls
└── (reused) StatsMetadata.tsx                       # Shared metadata display
```

### Type Definitions
```typescript
// Extended types in src/client/types/communityStats.ts
interface ActivityQueryParams extends AnalyticsQueryParams {
    groupBy?: 'race' | 'league' | 'activity'  // Activity-specific grouping
}

interface ActivityBuckets {
    veryRecent: number    // Most recent activity
    recent: number        // Recently active
    today: number         // Active today
    yesterday: number     // Active yesterday  
    thisWeek: number      // Active this week
    older: number         // Older activity
}

interface TemporalPatterns {
    hourlyDistribution: number[]  // 24-hour activity array
    dailyDistribution: number[]   // 7-day activity array (Sun=0, Sat=6) 
    peakHour: number             // Hour with most activity (0-23)
    peakDay: number              // Day with most activity (0-6)
}

interface EngagementMetrics {
    totalGames: number                      // Total games played
    activePlayers: number                   // Number of active players
    averageGamesPerActivePlayer: number     // Average games per player
    engagementRate: string                  // Engagement percentage
}

interface PlayerActivityData {
    metadata: ActivityMetadata
    activityBuckets: ActivityBuckets
    temporalPatterns: TemporalPatterns 
    engagementMetrics: EngagementMetrics
    retentionAnalysis: RetentionAnalysis
}
```

## Data Flow

### 1. Data Fetching
```typescript
// usePlayerActivity hook pattern
const { data, loading, error, lastUpdated, fetch, refresh } = usePlayerActivity()

// Activity-specific parameters
const activityParams: ActivityQueryParams = {
    timeframe: 'current',
    includeInactive: false,
    minimumGames: 20,
    groupBy: 'activity',  // Focus on activity grouping
}
```

### 2. Chart Data Processing

#### Hourly Activity Chart
- Ensures 24-hour completeness (fills missing hours with 0)
- Sorts data by hour for proper temporal display
- Uses smooth line curves with area fill for visual appeal

#### Ranking Movement Chart  
- Bins movements into ranges (-50+, -20 to -50, -10 to -20, etc.)
- Color codes by direction and magnitude
- Calculates percentage distributions for tooltip context

#### Activity Demographics
- Filters active players based on current filters
- Maintains consistent race/league color schemes
- Provides percentage breakdowns for all demographics

### 3. Caching Strategy
```typescript
// Activity-specific caching
const CACHE_KEY = 'playerActivityCache'  // Separate from community stats
const CACHE_TTL_MS = 30 * 60 * 1000    // 30 minutes consistent with other analytics

// Cache includes activity-specific metadata
interface CachedActivityData {
    data: PlayerActivityData
    createdAt: string
    expiry: number
}
```

## Integration Points

### Shared Dependencies
- **Chart Configuration:** Reuses `baseChartConfig` and `barChartConfig` from existing charts
- **Color System:** Leverages `RACE_COLORS`, `LEAGUE_COLORS`, and `CHART_THEME` tokens
- **API Integration:** Extends existing `getPlayerActivityAnalysis` function in `services/api.ts`
- **Navigation:** Added to `constants/navigation.ts` for header integration

### Reusable Components
- **StatsFilters:** Shared filter component works with activity parameters
- **StatsMetadata:** Shared metadata display for data freshness and player counts
- **Chart Containers:** Consistent error/loading states across all chart components

### Type Extensions
- Extended `communityStats.ts` types to support activity-specific interfaces
- Maintained backward compatibility with existing community stats types
- Added proper TypeScript support for activity query parameters

## Performance Considerations

### Optimization Strategies
- **Component Splitting:** Individual chart components for targeted re-rendering
- **Data Memoization:** Activity patterns cached and only recalculated on data change
- **Responsive Loading:** Charts render progressively as data becomes available
- **Error Boundaries:** Isolated error handling prevents single chart failures from breaking page

### Free-Tier Compliance
- **Client-Side Processing:** All data transformation handled in browser
- **Efficient Caching:** Minimizes API calls through intelligent cache management
- **Controlled Refresh:** Manual refresh prevents excessive API requests
- **Parameter Optimization:** Batches multiple metrics in single API call

## Testing Strategy

### Component Testing
```typescript
// Basic hook export validation
describe('usePlayerActivity Hook', () => {
    it('should export usePlayerActivity function', async () => {
        const module = await import('../hooks/usePlayerActivity.tsx')
        expect(typeof module.usePlayerActivity).toBe('function')
    })
})
```

### Integration Testing
- API contract validation against OpenAPI schema
- Chart rendering with mock activity data
- Filter state management across page refreshes
- Error handling for missing/malformed activity data

## Future Enhancements

### Potential Extensions
1. **Real-time Activity:** WebSocket integration for live activity updates
2. **Historical Trends:** Multi-day activity pattern comparisons  
3. **Activity Heatmaps:** Calendar-style activity visualization
4. **Player Journey Tracking:** Individual player activity timeline analysis
5. **Correlation Analysis:** Activity patterns vs ranking performance metrics

### Reusable Patterns Identified
1. **Activity Data Hooks:** Pattern for time-series analytics data management
2. **Temporal Chart Components:** Reusable hourly/daily visualization patterns
3. **Movement Analysis:** Histogram binning strategy for delta visualizations
4. **Activity Filtering:** Parameter patterns for activity-based data filtering

This implementation strengthens the analytics module architecture by providing focused activity insights while maintaining consistency with existing community analytics infrastructure.