# Community Stats Page - Implementation Plan

## Overview
This document outlines the foundation and structure for the new **Community Stats** page that will consume the `/api/player-analytics` endpoint and visualize aggregated community data using Chart.js. The plan follows SC2CR's established conventions and architectural patterns.

## 1. API Analysis Summary

### Endpoint: `/api/player-analytics`
**URL:** `GET /api/player-analytics`

**Query Parameters:**
- `timeframe`: `current` | `daily` (default: `current`)
- `includeInactive`: `boolean` (default: `false`) 
- `minimumGames`: `integer` (default: `20`)
- `race`: `string` | `null` (optional filter)

**Response Structure:**
```typescript
interface PlayerAnalyticsResponse {
  success: boolean
  data: PlayerAnalyticsData
}

interface PlayerAnalyticsData {
  metadata: {
    totalPlayers: number
    generatedAt: string // ISO date-time
  }
  activityPatterns: Array<{
    hour: number // 0-23
    onlinePlayers: number
  }>
  raceDistribution: {
    Terran: number
    Zerg: number  
    Protoss: number
  }
  rankingMovements: Array<{
    playerId: string
    movement: number // positive = up, negative = down
  }>
  leagueStats: {
    Grandmaster: number
    Master: number
    Diamond: number
    // ... other leagues
  }
}
```

### Endpoint: `/api/player-analytics/activity`
Additional endpoint for detailed activity analysis with `groupBy` parameter (`race` | `league` | `activity`).

## 2. Page Structure & Routing

### Route Definition
- **Path:** `/community-stats`
- **Component:** `CommunityStats.tsx` 
- **Navigation Label:** "Community Stats"

### Navigation Integration
Add to `src/client/constants/navigation.ts`:
```typescript
export const links = [
    { link: '/', label: 'Ranking' },
    { link: '/search', label: 'Search Player' },
    { link: '/replays', label: 'Replays' },
    { link: '/community-stats', label: 'Community Stats' }, // NEW
]
```

### Routing Integration
Add to `src/client/App.tsx`:
```tsx
import { CommunityStats } from './pages/CommunityStats.tsx'

// In Routes:
<Route path="/community-stats" element={<CommunityStats />} />
```

## 3. Component Architecture

### Folder & File Structure
```
src/client/
├── pages/
│   └── CommunityStats.tsx                 # Main page component
├── components/
│   └── CommunityStats/
│       ├── StatsContainer.tsx             # Layout container
│       ├── StatsFilters.tsx               # Filter controls
│       ├── StatsMetadata.tsx              # Data freshness indicator
│       └── Charts/
│           ├── ActivityChart.tsx          # Activity patterns (line chart)
│           ├── RaceDistributionChart.tsx  # Race distribution (pie chart)  
│           ├── LeagueStatsChart.tsx       # League distribution (bar chart)
│           └── RankingMovementChart.tsx   # Movement trends (bar/histogram)
├── hooks/
│   └── useCommunityStats.tsx              # Data fetching hook
├── services/
│   └── communityStatsApi.ts               # API service functions
└── types/
    └── communityStats.ts                  # TypeScript definitions
```

### Layout Regions
The page will use a responsive grid layout with the following regions:

```
┌─────────────────────────────────────────┐
│ Page Header + Filters                   │
├─────────────────────────────────────────┤
│ Metadata Bar (Last Updated, Total)      │
├─────────────┬───────────────────────────┤
│ Activity    │ Race Distribution         │
│ Patterns    │ (Pie Chart)               │
│ (Line Chart)│                           │
├─────────────┼───────────────────────────┤
│ League Stats│ Ranking Movements         │
│ (Bar Chart) │ (Histogram)               │
└─────────────┴───────────────────────────┘
```

## 4. Data Flow Strategy

### Service Layer
Create `src/client/services/communityStatsApi.ts`:
```typescript
// API functions following existing patterns
export const getPlayerAnalytics = async (params?: AnalyticsQueryParams) => {
    const response = await api.get('api/player-analytics', { params })
    return response
}

export const getPlayerActivityAnalysis = async (params?: ActivityQueryParams) => {
    const response = await api.get('api/player-analytics/activity', { params })  
    return response
}
```

### Custom Hook
Create `src/client/hooks/useCommunityStats.tsx`:
```typescript
// Extends existing useFetch pattern
export const useCommunityStats = (queryParams?: AnalyticsQueryParams) => {
    // State management for analytics data
    // Caching with localStorage (similar to ranking snapshot pattern)
    // Loading, error, and refresh functionality
    // Return { data, loading, error, refresh, lastUpdated }
}
```

### Caching Strategy
- **Key:** `communityStatsCache`
- **TTL:** 30 minutes (similar to existing patterns)
- **Pattern:** Follow `dailySnapshot` pattern from Ranking page
- **Invalidation:** Manual refresh button + automatic expiry

### Integration with Existing Patterns
- Extend `useFetch` hook to support 'community-analytics' type
- Add new API functions to `services/api.ts` 
- Follow existing error handling patterns
- Use same `localStorage` utilities for caching

## 5. Chart Integration Strategy

### Chart.js Setup
- **Library:** Chart.js with React wrapper (`react-chartjs-2`)
- **Theme Integration:** Use Mantine theme colors for consistency
- **Responsive:** All charts responsive by default
- **Accessibility:** Proper ARIA labels and keyboard navigation

### Chart Type Mapping

#### 1. Activity Patterns → Line Chart
- **Data:** `activityPatterns` array (hour vs onlinePlayers)
- **X-Axis:** Hours (0-23, formatted as "12 AM", "1 PM", etc.)
- **Y-Axis:** Number of online players
- **Features:** Smooth curves, hover tooltips, peak highlighting

#### 2. Race Distribution → Pie/Doughnut Chart  
- **Data:** `raceDistribution` object
- **Segments:** Terran (blue), Protoss (gold), Zerg (purple)
- **Features:** Percentage labels, legend, animated transitions

#### 3. League Statistics → Horizontal Bar Chart
- **Data:** `leagueStats` object
- **X-Axis:** Player count
- **Y-Axis:** League names (Grandmaster → Bronze)
- **Features:** Color-coded by league, value labels

#### 4. Ranking Movements → Histogram/Bar Chart
- **Data:** `rankingMovements` array (aggregated into bins)
- **X-Axis:** Movement ranges (-10 to -5, -4 to -1, 0, +1 to +4, +5 to +10, etc.)
- **Y-Axis:** Number of players
- **Features:** Color coding (red for down, green for up, gray for stable)

### Chart Component Pattern
```typescript
// Reusable chart wrapper component
interface ChartProps {
  data: any
  loading?: boolean
  error?: string
  title: string
  height?: number
}

// Each chart implements this interface
// Handles loading states, error states, empty data states
```

## 6. Type Definitions

### New Types Needed
Create `src/client/types/communityStats.ts`:
```typescript
// Query parameter types
export interface AnalyticsQueryParams {
  timeframe?: 'current' | 'daily'
  includeInactive?: boolean
  minimumGames?: number  
  race?: string | null
}

export interface ActivityQueryParams extends AnalyticsQueryParams {
  groupBy?: 'race' | 'league' | 'activity'
}

// Response types (matching OpenAPI schema)
export interface PlayerAnalyticsMetadata {
  totalPlayers: number
  generatedAt: string
}

export interface ActivityPattern {
  hour: number
  onlinePlayers: number  
}

export interface RaceDistribution {
  Terran: number
  Zerg: number
  Protoss: number
}

export interface RankingMovement {
  playerId: string
  movement: number
}

export interface LeagueStats {
  [leagueName: string]: number
}

export interface PlayerAnalyticsData {
  metadata: PlayerAnalyticsMetadata
  activityPatterns: ActivityPattern[]
  raceDistribution: RaceDistribution
  rankingMovements: RankingMovement[]
  leagueStats: LeagueStats
}

export interface PlayerAnalyticsResponse {
  success: boolean
  data: PlayerAnalyticsData
}

// UI State types
export interface CommunityStatsFilters {
  timeframe: 'current' | 'daily'
  includeInactive: boolean
  minimumGames: number
  selectedRace: string | null
}
```

## 7. Implementation Phases

### Phase 1: Foundation (Basic Structure)
1. Create page route and navigation
2. Build basic layout with placeholder regions
3. Implement data fetching hook and API service
4. Add loading/error states
5. Basic metadata display

### Phase 2: Core Charts
1. Activity Patterns line chart
2. Race Distribution pie chart  
3. League Statistics bar chart
4. Basic responsive layout

### Phase 3: Enhanced Features
1. Ranking Movements histogram
2. Advanced filtering controls
3. Data refresh functionality
4. Performance optimization
5. Accessibility improvements

### Phase 4: Polish
1. Animations and transitions
2. Advanced tooltips and interactions
3. Export/sharing capabilities
4. Mobile optimization
5. Documentation completion

## 8. Integration Points

### Dependencies to Add
```json
{
  "chart.js": "^4.x.x",
  "react-chartjs-2": "^5.x.x"
}
```

### Existing Code Reuse
- **Layout:** Mantine `Container`, `Grid`, `Paper` components
- **Loading States:** Existing loading spinner patterns  
- **Error Handling:** Current error boundary and display patterns
- **Theming:** Mantine dark theme integration
- **Caching:** `localStorage` utilities from `utils/localStorage.ts`
- **API:** Base axios instance from `services/api.ts`

### Configuration Updates
- Add Chart.js theme integration with Mantine colors
- Ensure responsive breakpoints align with existing patterns
- Maintain consistent spacing and typography

## 9. Testing Strategy

### Unit Tests
- Hook functionality (`useCommunityStats`)
- Chart data transformation functions
- API service functions
- Cache utility functions

### Integration Tests  
- Page rendering with different data states
- Filter functionality
- Chart interactions
- Error boundary behavior

### E2E Tests
- Navigation to Community Stats page
- Data loading and display
- Filter applications
- Responsive behavior

## 10. Documentation Requirements

### User Documentation
- Feature description in main README
- Usage guide for filters and interactions
- Data interpretation guide

### Developer Documentation
- Component API documentation
- Hook usage examples  
- Chart customization guide
- Performance considerations

### API Documentation
- Update existing API docs with community stats usage
- Add examples for different query parameters
- Document caching behavior

## 11. Performance Considerations

### Data Loading
- Implement proper caching with expiration
- Lazy load charts on scroll/tab activation
- Debounce filter changes
- Show stale data while refreshing

### Chart Rendering
- Use Chart.js animation only when necessary  
- Implement virtualization for large datasets
- Optimize re-renders with React.memo
- Consider chart lazy loading

### Bundle Size
- Import Chart.js components individually
- Use code splitting for the community stats page
- Optimize chart.js bundle with tree shaking

## 12. Accessibility Requirements

### Screen Reader Support
- Proper heading hierarchy
- Chart descriptions and data tables
- ARIA labels for interactive elements
- Focus management

### Keyboard Navigation
- Tab order through filters and charts
- Keyboard shortcuts for common actions
- Skip links for chart regions

### Visual Accessibility  
- High contrast color schemes
- Scalable text and elements
- Alternative data representations (tables)
- Motion reduction respect

## 13. Next Steps

### Immediate Actions
1. **Approval Review:** Get stakeholder approval for this plan
2. **Dependency Setup:** Add Chart.js packages to project
3. **Route Creation:** Implement basic routing and navigation
4. **API Integration:** Create service functions and types

### Development Order
1. Basic page structure and navigation (1-2 days)
2. Data fetching and caching implementation (2-3 days)  
3. First chart implementation (Activity Patterns) (2-3 days)
4. Remaining charts implementation (3-4 days)
5. Filter controls and interactions (2-3 days)
6. Polish, testing, and documentation (2-3 days)

**Total Estimated Time:** 12-18 development days

### Success Criteria
- ✅ Page loads with proper navigation integration
- ✅ Data fetches from `/api/player-analytics` endpoint  
- ✅ Four main charts render with proper data visualization
- ✅ Responsive design works on mobile/desktop
- ✅ Loading and error states handled gracefully
- ✅ Caching works with appropriate TTL
- ✅ Follows existing code conventions and patterns
- ✅ Accessible to screen readers and keyboard users

---

**Document Status:** ✅ Ready for Review and Implementation  
**Last Updated:** October 5, 2025  
**Next Review:** After Phase 1 completion