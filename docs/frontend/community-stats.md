# Community Stats - Frontend Implementation

## Overview
The Community Stats page provides visualizations of aggregated player analytics data from the SC2 Costa Rica community. It consumes the `/api/player-analytics` endpoint and displays interactive charts using Chart.js with unified styling that matches the Ranking page.

## Route
- **URL:** `/community-stats`
- **Navigation Label:** "Community Stats" 
- **Component:** `CommunityStats.tsx`

## UI/UX Parity with Ranking Page

### Design Consistency (Updated Oct 2025)
The Community Stats page has been updated to maintain visual parity with the Ranking page:

- **Header Layout:** Uses same centered h1 title and refresh button positioning as Ranking page
- **Spacing:** Consistent padding, margins, and gaps using Mantine theme tokens
- **Typography:** Harmonized font sizes, weights, and text hierarchy
- **Color Scheme:** Unified color mapping between charts and table backgrounds
- **Card Styling:** Similar Paper component styling with consistent border radius and shadows

## Features

### 1. Interactive Charts
- **Game Activity Distribution:** Bar chart showing distribution of players by game activity levels (No Games, Low, Moderate, High Activity)
- **Race Distribution:** Doughnut chart displaying Terran/Protoss/Zerg/Random player distribution with percentages and game counts
- **League Distribution:** Horizontal bar chart of players by league (Grandmaster to Bronze) with percentages
- **Rating Statistics:** Bar chart showing rating statistics (average, median, min, max, standard deviation)

### 2. Data Filtering
- **Timeframe:** Current vs Daily snapshot data
- **Race Filter:** All races or specific race (Terran, Protoss, Zerg)
- **Minimum Games:** Filter by minimum games played threshold
- **Include Inactive:** Toggle to include/exclude inactive players

### 3. Data Management
- **Caching:** 30-minute TTL for analytics data in localStorage
- **Real-time Updates:** Manual refresh button to fetch latest data
- **Error Handling:** Graceful error states with retry options
- **Loading States:** Proper loading indicators during data fetching

## Component Architecture

### Main Components
```
src/client/pages/CommunityStats.tsx           # Main page component
src/client/components/CommunityStats/
├── StatsFilters.tsx                          # Filter controls
├── StatsMetadata.tsx                         # Data freshness indicators
├── constants.ts                              # Extracted constants and options
└── Charts/
    ├── ActivityChart.tsx                     # Activity patterns bar chart
    ├── RaceDistributionChart.tsx             # Race distribution doughnut chart
    ├── LeagueStatsChart.tsx                  # League distribution bar chart
    └── RankingMovementChart.tsx              # Rating statistics bar chart
```

### Styling & Structure (Refactored Oct 2025)

**CSS Modules Structure:**
```
src/client/pages/CommunityStats.module.css    # Main page styles
src/client/components/CommunityStats/
├── StatsFilters.module.css                   # Filter controls styling
├── StatsMetadata.module.css                  # Metadata display styling
└── Charts/Charts.module.css                  # Shared chart component styles

src/client/styles/                            # Shared style system
├── chartConfig.ts                            # Centralized Chart.js configuration
└── partials/
    ├── layout.css                            # Layout utilities (spacing, grids, containers)
    ├── charts.css                            # Chart-specific utilities
    ├── states.css                            # Loading, error, empty state patterns
    └── components.css                        # Filter and metadata patterns
```

**Key Styling Principles:**
- **Modular CSS First:** All components use CSS Modules instead of inline styles
- **Shared Tokens:** Common patterns extracted to reusable CSS partials
- **Theme Compatibility:** All styles use CSS variables for dark/light theme support
- **Responsive Design:** Mobile-first approach with consistent breakpoints

### Centralized Color Scheme
```
src/shared/colors.ts                          # Unified color mapping for races, leagues, and themes
src/client/styles/chartConfig.ts              # Chart-specific color utilities and Chart.js config
```

**Race Colors:**
- TERRAN: #4dabf7 (Blue)
- PROTOSS: #51cf66 (Green) 
- ZERG: #9775fa (Purple)
- RANDOM: #868e96 (Gray)

**League Colors (Bronze to Grandmaster):**
- Bronze (#d0743c) → Silver (#868e96) → Gold (#ffd43b) → Platinum (#51cf66) → Diamond (#4dabf7) → Master (#e64980) → Grandmaster (#fd7e14)

**Color Usage:**
- Import centralized colors: `import { raceColors, leagueColors } from '../../shared/colors'`
- Import chart utilities: `import { getChartColors, baseChartOptions } from '../../styles/chartConfig'`
- Chart datasets: `backgroundColor: getChartColors.forRaces(['TERRAN', 'PROTOSS'])`
- CSS color variables: Use `var(--mantine-color-*)` for theme compatibility
- Ranking page consistency: Same color tokens used across all components

## Styling Migration (Oct 2025)

### Before: Inline Styles & CSS-in-JS
```tsx
// OLD: Inline styling (removed)
<div style={{ textAlign: 'center', marginBottom: '20px' }}>
    <Paper p="sm" mb="md" withBorder h={350} pos="relative">
        <LoadingOverlay zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />
    </Paper>
</div>
```

### After: CSS Modules & Shared Partials
```tsx
// NEW: Modular CSS approach
<div className={classes.header}>
    <Paper className={classes.chartPaper} withBorder>
        <LoadingOverlay className={classes.loadingOverlay} />
    </Paper>
</div>
```

**Benefits:**
- **<10% CSS-in-JS:** Only dynamic data-driven styles remain in JavaScript
- **Shared Patterns:** Common layouts reused across components
- **Better Performance:** Styles loaded once, cached by browser
- **Theme Support:** CSS variables enable automatic dark/light theme switching
- **Maintainability:** Centralized style tokens prevent inconsistencies

### Constants & Options Extraction
```tsx
// NEW: Extracted to constants.ts
export const RACE_OPTIONS = [
    { value: 'all', label: 'All Races' },
    { value: 'TERRAN', label: 'Terran' },
    // ...
] as const

export const DEFAULT_FILTERS = {
    timeframe: 'current' as const,
    includeInactive: false,
    minimumGames: 20,
    selectedRace: null
}
```

**Usage in Components:**
```tsx
import { RACE_OPTIONS, DEFAULT_FILTERS } from './constants'
const [filters, setFilters] = useState(DEFAULT_FILTERS)
```

### Chart Improvements (Oct 2025)
**Legend Optimization:**
- Custom legends with icons replace Chart.js default legends
- Race Distribution: Compact horizontal layout with race icons and truncated text
- League Distribution: Abbreviated league names (e.g., "Grandmaster" → "Gra") with tooltips
- Responsive legend sizing that adapts to container width

**Container Management:**
- Fixed chart heights (320px) prevent infinite expansion
- Chart containers use `overflow: hidden` to contain content within cards
- Flexible layout accommodates both horizontal and vertical bar charts based on data size
- League charts automatically switch orientation based on category count

**Accessibility:**
- Consistent focus states and keyboard navigation
- Tooltips provide full information when text is truncated
- High contrast colors meet WCAG standards
- Screen reader friendly alt text and ARIA labels

### Data Flow
```
CommunityStats Page 
    ↓ 
useCommunityStats Hook 
    ↓ 
API Service (getPlayerAnalytics) 
    ↓ 
/api/player-analytics Endpoint
```

## Data Types

### Key Interfaces
Located in `src/client/types/communityStats.ts`:

- `PlayerAnalyticsData` - Main analytics data structure
- `PlayerAnalyticsMetadata` - Data freshness and generation info
- `GameActivity` - Activity distribution and totals
- `RaceDistribution` - Race distribution with percentages and game counts
- `LeagueDistribution` - League distribution with percentages
- `RatingStatistics` - Statistical measures of player ratings
- `CommunityStatsFilters` - UI filter state

### API Response Structure
The `/api/player-analytics` endpoint returns:
```json
{
  "metadata": {
    "generatedAt": "2024-01-15T14:30:00Z",
    "totalPlayersAnalyzed": 150,
    "dataFreshness": "2024-01-15T12:00:00Z"
  },
  "gameActivity": {
    "totalGames": 1250,
    "averageGames": 8.33,
    "activityDistribution": {
      "noGames": 20,
      "lowActivity": 45,
      "moderateActivity": 60,
      "highActivity": 25
    }
  },
  "raceDistribution": {
    "distribution": { "TERRAN": 50, "PROTOSS": 48, "ZERG": 47, "RANDOM": 5 },
    "percentages": { "TERRAN": "33.3", "PROTOSS": "32.0", "ZERG": "31.3", "RANDOM": "3.3" },
    "totalGamesPlayed": 1250,
    "gamesByRace": { "TERRAN": 420, "PROTOSS": 400, "ZERG": 385, "RANDOM": 45 }
  },
  "leagueDistribution": {
    "distribution": { "BRONZE": 25, "SILVER": 35, "GOLD": 40, "PLATINUM": 30, "DIAMOND": 15, "MASTER": 4, "GRANDMASTER": 1 },
    "percentages": { "BRONZE": "16.7", "SILVER": "23.3", "GOLD": "26.7", "PLATINUM": "20.0", "DIAMOND": "10.0", "MASTER": "2.7", "GRANDMASTER": "0.7" }
  },
  "ratingStatistics": {
    "average": 2156.78,
    "median": 2040.0,
    "min": 1200.0,
    "max": 4500.0,
    "standardDeviation": 567.89
  }
}
```

## Styling & Theme

### Chart Theming
- **Dark Mode Compatible:** All charts use Mantine dark theme colors
- **Consistent Colors:** Race colors (Terran: blue, Protoss: gold, Zerg: purple)
- **Accessibility:** High contrast ratios and proper ARIA labels
- **Responsive:** Charts adapt to container size and mobile viewports

### Color Palette
```typescript
// Race colors (with RANDOM added)
TERRAN: '#4dabf7'    // Blue
PROTOSS: '#ffd43b'   // Gold
ZERG: '#9775fa'      // Purple
RANDOM: '#868e96'    // Gray

// League colors  
GRANDMASTER: '#fd7e14'  // Orange
MASTER: '#e64980'       // Pink
DIAMOND: '#4dabf7'      // Blue
PLATINUM: '#51cf66'     // Green
GOLD: '#ffd43b'         // Gold
SILVER: '#868e96'       // Gray
BRONZE: '#d0743c'       // Brown

// Activity levels
HIGH_ACTIVITY: '#51cf66'      // Green
MODERATE_ACTIVITY: '#ffd43b'  // Yellow
LOW_ACTIVITY: '#ff8787'       // Light Red
NO_GAMES: '#868e96'           // Gray
```

## Caching Strategy

### Local Storage Caching
- **Key:** `communityStatsCache`
- **TTL:** 30 minutes (1,800,000 ms)
- **Structure:** 
  ```typescript
  {
    data: PlayerAnalyticsData,
    createdAt: string,
    expiry: number
  }
  ```

### Cache Behavior
1. Check localStorage for valid cached data
2. If valid, display cached data immediately
3. If invalid/missing, fetch from API
4. Store new data with expiry timestamp
5. Manual refresh clears cache and fetches fresh data

## Performance Optimizations

### Chart Rendering
- **Lazy Loading:** Charts only render when data is available
- **Memoization:** React.memo used where appropriate
- **Debounced Filters:** Filter changes debounced to prevent excessive API calls
- **Loading Overlays:** Progressive loading states for better UX

### Bundle Size
- **Tree Shaking:** Chart.js components imported individually
- **Code Splitting:** Community stats page can be lazy-loaded
- **Optimized Imports:** Only necessary Chart.js modules registered

## Error Handling

### Error States
- **API Errors:** Network/server errors with retry options
- **Data Validation:** Malformed API response handling
- **Empty States:** No data available messaging
- **Chart Errors:** Individual chart error boundaries

### Fallback Behavior
- Display cached data during API errors when available
- Graceful degradation with helpful error messages
- Retry mechanisms for transient failures
- Clear error messaging with context

## Testing

### Test Coverage
- **API Services:** Unit tests for analytics service functions
- **Hook Logic:** useCommunityStats hook behavior and caching
- **Component Rendering:** Basic chart component render tests
- **Error Scenarios:** Error handling and edge cases

### Test Files
```
src/client/__tests__/
├── communityStatsApi.test.ts     # API service tests
├── useCommunityStats.test.ts     # Hook tests  
└── CommunityStats.test.tsx       # Component tests (future)
```

## Accessibility

### ARIA Support
- **Chart Descriptions:** Each chart has descriptive titles and labels
- **Keyboard Navigation:** All interactive elements keyboard accessible
- **Screen Reader:** Proper semantic markup and ARIA attributes
- **Focus Management:** Clear focus indicators and logical tab order

### Alternative Access
- **High Contrast:** Charts work with high contrast themes
- **Text Alternatives:** Chart data available in tooltips and labels
- **Responsive Text:** Text scales appropriately with zoom levels

## Usage Examples

### Basic Usage
Navigate to `/community-stats` to view community analytics dashboard.

### Filter Application
1. Select timeframe (Current vs Daily)
2. Choose race filter (All or specific race)
3. Adjust minimum games threshold
4. Toggle inactive player inclusion
5. Charts update automatically

### Data Refresh
- Click "Refresh" button to fetch latest data
- Cache is cleared and fresh data retrieved
- Loading states shown during fetch

## Future Enhancements

### Planned Features
- **Export Functionality:** Download charts as images/CSV
- **Time Range Selection:** Custom date range filtering
- **Trend Analysis:** Multi-period comparison views
- **Real-time Updates:** WebSocket integration for live data

### Performance Improvements
- **Virtual Scrolling:** For large datasets
- **Progressive Loading:** Staged chart rendering
- **Background Updates:** Automatic cache refreshing

## Troubleshooting

### Common Issues
1. **Charts Not Loading:** Check network connectivity and API availability
2. **Stale Data:** Use manual refresh to clear cache
3. **Performance Issues:** Reduce minimum games filter for smaller datasets
4. **Mobile Display:** Ensure responsive breakpoints are working

### Debug Information
- Check browser network tab for API calls
- Inspect localStorage for cached data
- Monitor console for Chart.js warnings
- Verify filter parameters in API requests

## Dependencies

### Required Packages
- `chart.js` - Chart rendering engine
- `react-chartjs-2` - React wrapper for Chart.js
- `@mantine/core` - UI components
- `luxon` - Date/time formatting

### Version Compatibility
- Chart.js v4.x.x for latest features
- React Chart.js 2 v5.x.x for React 18 compatibility
- Mantine v7.x.x for consistent theming