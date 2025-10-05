# SC2CR Codebase Guide for AI Agents

## Overview
- Full-stack SC2 stats/replays/tournaments app
- **Documentation Hub**: README.md at the repository root serves as the central documentation entry point
- **Stack**: React/TS (client) + Node/Express (server)
- **Deploys**: Vercel (client) + Render prod API + Fly.io dev API

## Architecture & Flow
- **Client** (`src/client`): React/Vite app with Mantine UI library
  - API integration: Custom hooks `hooks/useFetch.tsx`, `hooks/usePost.tsx`; API calls in `services/api.ts`
  - Config: Environment-aware API selection in `services/config.ts` with host-based switch to `src/client/config/{prod,dev,local}.config.json`
  - Routing: React Router v6 with routes in `App.tsx` (mounted via `main.tsx`)
- **Server** (`src/server`): Express API with TypeScript
  - API Routes: Mounted via `routes/apiRoutes.ts` combining routes from `pulse`, `challonge`, `utility`, `google`, `replayAnalyzer`
  - Services: External API integrations in `services/` directory
  - Caching: LRU in-memory cache with 30s TTL in `utils/cache.ts`
- **Flow**: Client → `/api/*` → service fetch/transform → cached results → client

## Dev, Build, Run
- **Development**: `npm run dev` (Vite FE + nodemon BE, concurrent)
- **Build**: `npm run build` (client + server via `scripts/build.cjs`)
- **Production**: `npm start` → `dist/webserver/server.cjs`
- **Docker**: `npm run buildImg` → `npm run localPod` (publishes on `127.0.0.1:3000`)

## Data (ladderCR.csv)
- **Path**: `dist/data/ladderCR.csv` (server reads from this location)
- **Acquisition**:
  - Option 1: If Google Drive configured via `GOOGLE_SERVICE_ACCOUNT_KEY`, auto-downloads from `RankedPlayers_{Env}/ladderCR.csv` folder on first run
  - Option 2: Manually place the file after build
  - Option 3: Request from maintainers (NeO or Kerverus)

## Server Patterns
- **Caching**: `utils/cache.ts` stores snapshots with TTL 30s; prevents request stampedes by sharing in-flight promises
- **Data Sources**:
  - SC2Pulse: `services/pulseApi.ts` implements player search and rankings
  - Challonge: `services/challongeApi.ts` for tournament data
  - Google Drive: `services/googleApi.ts` for replay uploads/listing and analysis JSON retrieval
  - Google Drive Storage: `services/driveFileStorage.ts` for ladder data storage and file operations
- **Middleware**: Server serves static assets, mounts API routes, and falls back to SPA

## Client Patterns
- **Config**: `services/config.ts` selects API endpoint based on hostname:
  - Production: Render API (e.g., `sc2cr-latest.onrender.com`, Vercel domains)
  - Development: Fly.io dev API
  - Local: `http://localhost:3000/`
- **Components**: Organized by feature in `components/` directory
- **Pages**: Main application views in `pages/` directory
- **Hooks**: Custom data fetching in `hooks/` directory
 - **Ranking Snapshot & Position Indicators**:
  - Backend exposes a daily baseline at `GET /api/snapshot` with shape `{ data: RankingRow[], createdAt: ISO, expiry: number }`.
  - FE caches this baseline in `localStorage` under key `dailySnapshot` and uses the server-provided `expiry` for validity checks.
   - Live data comes from `GET /api/top` (via `useFetch('ranking')`).
   - `utils/rankingHelper.addPositionChangeIndicator(current, baseline)` decorates current rows with `positionChangeIndicator` arrows based on `btag` positions; index 0 is correctly handled.
   - Page `pages/Ranking.tsx` loads/refreshes baseline then computes indicators on live data.

## CI/CD
- **Workflow**: `.github/workflows/Deploy.yml` handles checks, Docker builds, and deployments
- **Environments**:
  - Production: Main branch → Vercel + Render
  - Development: Dev branch → Vercel preview + Fly.io
  - Pull Requests: Preview deployments with dev API backend

## Environment Variables
- **Challonge**: `CHALLONGE_API_KEY`, `CURRENT_TOURNAMENT`
- **Google Drive**: `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON string) - Used for replay storage, analytics persistence, and ladder data storage
- **Replay**: `REPLAY_ANALYZER_URL`
- **Configuration**: `MMR_RANGE_FOR_PREMIER_MATCH`, `MMR_RANGE_FOR_CLOSE_MATCH`, `PORT`

## Contributing Guidelines
- **Branching**: 
  - Trunk-based development with `dev` as the integration branch
  - Feature branches from `dev` for all development work
  - PRs target `dev` for integration
  - Selective promotion from `dev` to `main` for releases using interactive rebase
- **Release Flow**:
  - Use interactive rebase or cherry-pick to select which features to release
  - Create release branch with selected features from `dev`
  - Merge to `main` after testing
- **Conventions**:
  - Components: PascalCase
  - Hooks/Utils: camelCase
  - Errors: `{ error, code, context? }` structure
  - File Organization: Follow existing patterns in each directory

## Code Readability & Best Practices

Readability is mandatory. Generate code that is easy to read, easy to maintain, and consistent with existing project patterns.

  - Prefer clarity over brevity:
  - Do not produce overly clever or compressed one‑liners.
  - Avoid nested ternaries or expressions that obscure intent.
  - Be explicit:
  - Use descriptive names for variables, functions, and files.
  - Keep indentation/formatting consistent; adhere to ESLint/Prettier.
  - Write small, focused functions with single responsibility.
  - Replace magic numbers/strings with constants or configuration.
  - Comments should explain why, not what.
  - Tests must reflect readability: clear assertions, minimal mocking, descriptive names.
  - Favor readability over micro‑performance optimizations unless performance is a measured bottleneck.
  - Treat readability as a first‑class acceptance criterion in all suggested changes and PR reviews.

  ## UX Guidelines (SC2CR)

  ### Responsive Design
  - Mobile-first layouts: Prioritize usability on small screens, then scale up for desktop.
  - Flexible grids and cards: Use CSS grid/flexbox for adaptable layouts.
  - Touch-friendly controls: Large tap targets, swipeable lists, collapsible filters.
  - Test on multiple devices and orientations.

  ### Caching & Data Loading
  - Use client-side caching (localStorage, SWR pattern) for ranking lists, profiles, and analytics.
  - Display cached (stale) data immediately, with a refresh indicator and option to reload.
  - Show loading spinners only if no cached data is available.
  - Clearly indicate data freshness and last update time.
  - Minimize API calls by batching requests and paginating data.

  ### Pagination & Filtering
  - All lists (rankings, search, leaderboards) must support pagination with clear controls.
  - Filters and sorting should be accessible, easy to reset, and persist across navigation.
  - Gracefully handle empty states (no results, end of list) with helpful messaging.

  ### Accessibility
  - Use semantic HTML elements (tables, lists, headings, buttons).
  - Ensure keyboard navigation for all interactive elements (tab order, focus states).
  - Add ARIA attributes for custom controls, charts, and dynamic content.
  - Maintain color contrast and provide alt text for images/icons.
  - Test with screen readers and keyboard-only navigation.

  ### Developer Communication
  - Document API query parameters, pagination, and caching strategies in code and README.
  - Annotate wireframes and journey maps with expected data flows and error states.
  - Use clear naming conventions for components, hooks, and services (see COPILOT_INSTRUCTIONS).
  - Flag accessibility and responsive requirements in PRs and code reviews.

  ### Community & Volunteer Considerations
  - Prioritize features that drive engagement but are feasible for a small team.
  - Use modular, reusable components to minimize maintenance overhead.
  - Provide admin tools for monitoring and troubleshooting without exposing sensitive controls to regular users.

  ---
  These guidelines ensure a consistent, accessible, and maintainable UX for SC2CR, supporting both community needs and volunteer resources.

## API Contract & Fixture Patterns

- **Schema Naming**: Use endpoint-based, agnostic names (e.g., `RankingRow`, `PlayerDelta`, `ActivityAnalysis`).
- **Fixture Naming**: Use scenario-based names (e.g., `deltas_normal.json`, `deltas_no_baseline.json`, `activity_low_confidence.json`).
- **Edge Case Coverage**: Always include fixtures for baseline, partial coverage, missing data, and error responses.
- **Strict Typing**: Use enums and value constraints for fields like `race`, `activityLevel`, `positionChangeIndicator`.
- **Meta Fields**: For null streaks, missing baselines, or degraded confidence, include `meta.limits.reason` or similar context in fixtures.

Document new schema/fixture patterns in `docs/contracts/` and `docs/fixtures/` for all new API endpoints. Update this section when new reusable patterns emerge.

### Separation of Concerns (High Priority)
- Keep build tooling plugins separate from configuration files.
  - Vite plugins live under `plugins/` (e.g., `plugins/clientBuildInfo.ts`).
  - `vite.config.ts` should only assemble plugins and set Vite options.
- Share cross-cutting runtime detection in `src/shared/` only (e.g., `src/shared/runtimeEnv.ts`).
- Server-only helpers (e.g., git process calls) belong in `src/server/utils/` (e.g., `src/server/utils/gitInfo.ts`).
- Do not mix runtime app logic with build-time tooling; prefer small, focused modules.

Avoid:
- Overly clever chaining or compressed syntax.
- Cryptic abbreviations.
- Mixing multiple responsibilities in a single function/file.
- "Write‑once, read‑never" code.

## Testing
  - Runner: Vitest (separate configs per side)
  - Server: `npm run test:server` | coverage: `npm run test:coverage:server`
  - Client: `npm run test:client` (jsdom; `passWithNoTests` true) | coverage: `npm run test:coverage:client`
  - Both in parallel: `npm test` | watch: `npm run test:watch`

## Documentation
- **Main README**: Central hub with links to all documentation
 - **Environment Setup**: `docs/technical-documentation/environment-setup.md`
 - **Architecture**: `docs/technical-documentation/architecture.md`
 - **Environments**: `docs/technical-documentation/environments.md`
 - **Contributing**: `docs/development-process/contributing.md`
 - **Branching**: `docs/development-process/branching-strategy.md`

## Unknowns / Gaps
- Comprehensive test coverage strategy
- Detailed offline development workflow
- Feature roadmap beyond current backlog

## Evolution & Maintenance Policy

Treat this guide as living document, with **single sources of truth**:

## Feature Prioritization Patterns

### Prioritization Tags
Use the following tags for feature prioritization:
  - **Must**: Essential for core user value; implement first.
  - **Should**: Important, but not critical; implement after Musts.
  - **Could**: Nice-to-have; implement if resources allow.
  - **Won’t**: Out of scope for current cycle.

### Feature Table Format
Document features in a table with columns: Feature, Value, Effort, Priority.

| Feature | Value | Effort | Priority |
|---------|-------|--------|----------|
| ...     | ...   | ...    | ...      |
- **Branching/Release:** `docs/development-process/contributing.md` and `docs/development-process/branching-strategy.md`. Keep these authoritative and update others to match.
- **Environments & URLs:** `docs/technical-documentation/environments.md`. Update when API bases or routing change.
- **Testing plan:** `docs/development-process/testing.md`. Keep first-targets and CI notes aligned with reality.
- **Where to find things:** The root `README.md` links the canonical docs set—add new docs there.

## 📦 Service Layer Patterns

The service layer is responsible for business logic and orchestrating data retrieval. To keep this layer maintainable:

1. **Single Responsibility** – Split complex modules into discrete services. For example, instead of a monolithic `pulseApi` that does HTTP calls, data aggregation, race extraction, and online detection, create separate services like `PulseDataFetcher`, `PlayerStatsAggregator`, `RaceExtractor`, and `OnlineStatusCalculator`.
2. **Pure Functions Where Possible** – Write functions that are deterministic and have no side‑effects. Push side‑effects (e.g., API calls, caching) to the edges.
3. **Explicit Dependencies** – Pass dependencies (other services, HTTP clients, cache instances) into constructors rather than importing them globally. This makes it easier to mock and test.
4. **No Circular Dependencies** – Avoid modules importing each other in a loop. If two services need to collaborate, factor out shared logic into a third module that both can consume.
5. **Timezone & Locale Handling** – Never hardcode timezones. Accept a timezone parameter or derive it from configuration to support different deployment regions.

## � Reusable Domain Definitions

### MMR Delta
"MMR delta" is the change in a player's rating (MMR) between two snapshots:

  MMR Delta = Current Rating - Previous Rating

Used for tracking player progression and ranking changes.

### Streak
A "streak" is a sequence of consecutive wins or losses by a player. Detection requires chronological match data and no gaps >72h between games. Null streaks should include a reason (e.g., insufficient data, gaps).

### Activity Window
An "activity window" is a configurable time period (e.g., 24h, 7d, 30d) over which player activity is measured. Used for metrics like games played, rating change, and engagement.

### Confidence Score
A numeric indicator (0–100) of data reliability. Factors include data freshness, sample size, temporal gaps, and source type (1v1: high, team/arcade: medium/low). Minimum confidence for analytics endpoints is configurable (default: 75).

### Composite Key Convention
For joining and scoping data, use composite keys:
  {season, region, queue, teamType}
Player identity: `characterId` (canonical), cross-referenced with `btag` and `name`.
Team identity: `teamLegacyUid` for arranged teams, joined with `teamType` and queue.

These conventions should be used for all analytics, snapshot, and delta computations.

## �📄 DTO Conventions

Data Transfer Objects (DTOs) define the contract between services, routes, and external APIs. To keep them consistent:

1. **Naming** – Use `CamelCase` for interface names and suffix them with `Dto`, e.g., `PlayerRankingDto`, `SeasonDto`. When converting to runtime objects, drop the suffix (e.g., `PlayerRanking`).
2. **Validation** – Validate external API responses immediately upon receipt. Use a schema validation library or manual checks to ensure required fields are present and have the correct types. Throw descriptive errors if validation fails.
3. **Immutability** – Treat DTOs as immutable. Avoid mutating fields after creation; instead, derive new objects with updated values.
4. **Documentation** – Document each DTO in the codebase with comments describing each field, its type, and any constraints. This improves readability and helps future maintainers.

## 🗄️ Cache Strategy

Caching improves performance but can lead to stale data if misused. Adopt these practices:

1. **Layered Caching** – Use short TTLs (e.g., 30 seconds) for live data and long TTLs (e.g., 24 hours) for daily snapshots. Encapsulate cache logic in dedicated modules (`cache.ts`, `snapshotCache.ts`) and expose helper functions like `getOrFetch()` to prevent stampedes.
2. **Centralize Keys** – Define cache key constants in a single file (e.g., `cacheKeys.ts`) to avoid typos and ensure consistency across modules.
3. **Invalidate Carefully** – Provide clear rules on when caches should be invalidated (e.g., at midnight Costa Rica time for snapshots). Expose functions like `invalidateSnapshot()` for explicit refreshes.
4. **No Business Logic in Cache Layer** – Keep caching purely as a storage concern. Business rules (filtering, aggregation) should live in services, not in the cache modules.

## ⚠️ Error Handling

External API calls are unreliable. Handle failures consistently to avoid surprises:

1. **Retry Strategy** – Use exponential backoff with jitter for transient failures. Limit the number of retries to avoid hammering the upstream API.
2. **Graceful Degradation** – When an API is down, respond with a meaningful error or fallback data (e.g., from the last good cache). Never swallow exceptions silently.
3. **Custom Error Types** – Define custom error classes (e.g., `ExternalApiError`, `ValidationError`) to categorize failures. This improves error logging and facilitates better client responses.
4. **Logging** – Log all unexpected errors with enough context (request parameters, user ID, timestamps) to aid debugging. Avoid logging sensitive data (e.g., user credentials).

## 🧪 Testing Patterns

Quality code requires robust tests. Follow these patterns for SC2CR:

1. **Use Fixtures for External Integrations** – When testing code that calls external APIs (like SC2Pulse), record representative responses into fixtures. During tests, load these fixtures instead of making live HTTP calls. This makes tests deterministic and fast.
2. **Separation of Concerns** – Test services in isolation by mocking their dependencies (HTTP client, cache). Only use integration tests at higher layers (e.g., route handlers) to verify end‑to‑end behaviour.
3. **Edge Cases** – Write tests for edge cases like empty API responses, invalid DTO fields, and unexpected HTTP status codes. Ensure the system behaves predictably in each case.
4. **Snapshot Testing** – Use snapshot tests sparingly to verify complex derived data structures (e.g., player rankings). Update snapshots deliberately when business logic changes.

## ✅ Summary

By applying these guidelines, the SC2CR codebase will be easier to understand, test, and maintain. **Always prioritize clarity and single responsibility** when adding new features or refactoring existing code. When in doubt, refer back to these instructions or ask for architectural guidance.

+ ## SC2 Data Cross-Referencing Patterns
+ 
+ ### Identity Resolution Strategy
### Community Data Model Standards
++ - **Entity Design**: Use composite keys for temporal data (character+season+queue), UUIDs for events/metrics
++ - **Snapshot Strategy**: Configurable intervals (6h-7d) stored in `ConfigurableSnapshot` with position delta calculations
++ - **Confidence Levels**: HIGH (real-time), MEDIUM (interpolated), LOW (estimated) based on data freshness and sample size
++ - **Google Drive Integration**: Automatic backup of snapshots/metrics with 90-day retention for disaster recovery
++
++ ### Metrics Computation Patterns
++ - **Activity Windows**: Support configurable time windows (24h, 7d, 30d) with sliding calculations
++ - **Confidence Scoring**: Factor data gaps, sample sizes, and temporal distance into reliability scores
++ - **Team Chemistry**: Compare arranged team performance vs individual ratings using performance ratios
++ - **Clan Metrics**: Aggregate member activity, MMR distributions, and engagement scores with minimum member thresholds
++ - **Streak Detection**: Parse consecutive results with confidence penalties for temporal gaps >72h
++
++ ### Caching Architecture Extensions
++ - **Hierarchical Keys**: `domain:entity:scope:identifier` (e.g., `metrics:activity:24h:2024-01-15`)
++ - **TTL Alignment**: Match cache expiry to data update cadence (30s live, configurable snapshots, 5min metrics)
++ - **Google Drive Backup**: Layer persistent storage over in-memory cache with automatic restoration
++ - **Disaster Recovery**: Rebuild metrics from stored snapshots when primary cache fails
++
++ ### Data Quality & Confidence Management
++ - **Temporal Coherence**: Flag data gaps >2h as reduced confidence, >24h as low confidence
++ - **Sample Size Thresholds**: Require minimum games (10-50) for statistical significance in performance metrics  
++ - **Cross-Validation**: Verify community data against multiple sources (CSV, Pulse, tournaments) where available
++ - **Graceful Degradation**: Serve lower-confidence estimates rather than no data during outages
+ - **Primary Key**: `character.id` from SC2Pulse API as canonical player identifier
+ - **Cross-Reference**: `playerCharacterId` ↔ CSV `btag`/`name` mapping for complete profiles
+ - **External Links**: "Revealed" profiles enable tournament/streaming data correlation
+ - **Validation**: Always verify identity data exists before enrichment attempts
+ 
+ ### Multi-Source Data Integration
+ - **Temporal Alignment**: Use `lastPlayed` timestamps for activity correlation across platforms
+ - **Confidence Levels**: 1v1 data (high), team modes (medium), external APIs (varies by source)
+ - **Fallback Strategy**: Graceful degradation when external enrichments unavailable
+ - **Rate Limiting**: Coordinate API calls across SC2Pulse (10 RPS), Arcade, Twitch, tournament sources
+ 
+ ### Historical Data Patterns
+ - **Season Boundaries**: Use `battlenetId` + `region` for temporal segmentation
+ - **Progression Tracking**: Compare rating/league changes across seasons for skill development
+ - **Meta Analysis**: Correlate race distribution changes with balance patch dates
+ - **Activity Cycles**: Track playing frequency patterns for engagement insights
+ 
+ ### Community Feature Heuristics
+ - **Team Chemistry**: Compare team performance vs individual ratings for synergy metrics
+ - **Regional Trends**: Cross-reference US/EU/KR ladder activity with tournament participation
+ - **Skill Clustering**: Group players by similar MMR trajectories for matchmaking insights
+ - **Professional Pipeline**: Monitor amateur → pro transitions via tournament data integration

## 🚩 Feature Flag Patterns

### Flag Naming Convention
All feature flags follow the `ENABLE_[DOMAIN]_[FEATURE]` pattern using uppercase snake_case:
```env
ENABLE_PLAYER_ANALYTICS=false     # Player analytics and statistics API
ENABLE_DATA_SNAPSHOTS=false       # Background data collection operations
ENABLE_BARCODE_HELPER=false       # Barcode generation helper endpoint
```

### Flag Implementation Pattern
```typescript
// Centralized flag checking (src/server/utils/featureFlags.ts)
export const analyticsFeatures = {
    playerStats: () => String(process.env.ENABLE_PLAYER_ANALYTICS ?? 'false').toLowerCase() === 'true',
    dataSnapshots: () => String(process.env.ENABLE_DATA_SNAPSHOTS ?? 'false').toLowerCase() === 'true',
} as const

// Route-level protection
const requireFeatureFlag = (flagCheck: () => boolean) => (req: Request, res: Response, next: NextFunction) => {
    if (!flagCheck()) {
        return res.status(404).json({ error: 'Feature not available' })
    }
    next()
}

router.get('/player-analytics', requireFeatureFlag(analyticsFeatures.playerStats), handler)
```

### Configuration Parameters
Use `[DOMAIN]_[FEATURE]_[PARAMETER]` pattern for feature configuration:
```env
DATA_SNAPSHOT_INTERVAL_HOURS=24      # Configurable scheduling
ANALYTICS_CACHE_TTL_MS=30000         # Cache TTL overrides
```

### Flag Lifecycle Rules
1. **Default Off**: New features start with `false` default until tested
2. **Environment Progression**: local → dev → staging → production enablement
3. **Gradual Rollout**: Enable incrementally with monitoring between stages  
4. **Rollback Ready**: Always maintain immediate disable capability via flag toggle
5. **Cleanup Policy**: Remove flags only after 6+ months of stable production usage

## 📊 Player Analytics Monitoring

### Performance SLA Requirements
- **Analytics API Endpoints**: p95 <500ms, p99 <1000ms latency
- **Cache Efficiency**: Target >80% hit rate after warmup period
- **Error Rate**: <1% of analytics feature requests should fail
- **Resource Constraints**: Stay within free-tier limits (no new DB/cron jobs)

### Observability Extensions
Extend existing `metrics/lite.ts` with analytics-specific counters:
```typescript
// Add to existing metrics object
analytics_req_total: 0,                 // Request volume tracking
analytics_latency_bins: [...],          // Latency distribution
analytics_cache_efficiency_ratio: 0,    // Cache performance
analytics_correctness_failures: 0,      // Data quality metrics
```

### Correctness Validation
- **Golden Fixtures**: Validate responses against known-good data structures
- **Range Checks**: Ensure MMR values 1000-8000, player counts >0, etc.
- **Temporal Coherence**: Data freshness validation (max 25 hours staleness)

## 🏗️ Player Analytics Development Guidelines

### Service Layer Extensions
When adding analytics features, follow established service patterns:
```typescript
// Service organization (src/server/services/)
playerAnalyticsService.ts    // Core business logic for player metrics
dataCollectionScheduler.ts   // Background operations (snapshots, deltas)
analyticsMonitoring.ts       // Health checks and SLA validation

// Route organization (src/server/routes/)
analyticsRoutes.ts           // Analytics API endpoints with flag protection
```

### Cache Strategy for Analytics Features
- **Hierarchical Keys**: `analytics:player:24h:2024-01-15` pattern for organized caching
- **TTL Alignment**: Match cache expiry to data update cadence (30s live, 2h activity, 24h snapshots)
- **Google Drive Integration**: Automatic backup for disaster recovery following existing patterns
- **Memory Management**: Monitor cache size growth and implement eviction policies

### External API Integration Rules
- **Rate Coordination**: Coordinate with existing SC2Pulse 10 RPS limit across all features
- **Graceful Degradation**: Always provide fallback when external APIs unavailable
- **Adapter Pattern**: Isolate external dependencies in dedicated service modules
- **Configuration Driven**: Make external integrations opt-in via feature flags

### Background Operation Constraints
- **No New Infrastructure**: Use existing patterns (Google Drive, in-memory cache, scheduled functions)
- **Free-Tier Compliance**: Compute on read, minimal persistent storage, configurable intervals
- **Costa Rica Timezone**: Align daily operations with existing snapshot timezone handling
- **Error Recovery**: Implement retry logic and graceful degradation for scheduled operations

### Phase 3 Historical Analytics Patterns
- **Event-Driven Scheduling**: Use pluggable operation handlers with Costa Rica timezone alignment
- **Confidence Scoring**: Multi-factor reliability assessment (data freshness, completeness, activity level)
- **Baseline Selection**: Time window matching with fallback strategies for missing historical data
- **Delta Computation**: Position change tracking with btag-based mapping and confidence thresholds
- **Persistence Abstraction**: Google Drive backend with potential for multi-cloud extension points

### Environment Variable Conventions
- **Feature Gates**: `ENABLE_*` pattern for all new functionality (ENABLE_PLAYER_ANALYTICS, ENABLE_PLAYER_SNAPSHOTS)
- **Timing Controls**: `*_INTERVAL_HOURS` for background operation scheduling
- **Quality Thresholds**: `DEFAULT_MINIMUM_*` and `MAX_*_AGE_HOURS` for data quality control
- **Resource Limits**: `*_RETENTION_DAYS` and `*_RPS` for external service coordination

### Testing Requirements for Analytics Features
- **Feature Flag Testing**: Validate behavior when flags enabled/disabled
- **Golden Fixture Validation**: Test against known-good player analytics data
- **Performance Testing**: Validate SLA compliance under expected load
- **Integration Testing**: Ensure no regression of existing ranking functionality

### Multi-Service Coordination Patterns
- **Service Independence**: Each service operates independently with clear interfaces and error boundaries
- **Shared Infrastructure**: Services coordinate through existing cache, logging, and metrics infrastructure
- **Dependency Injection**: Services receive dependencies (persistence, scheduler) rather than importing globally
- **Anti-Stampede Coordination**: Services share in-flight promises and coordinate expensive operations
- **Configuration Inheritance**: Environment variables follow hierarchical patterns for service-specific overrides

Identity Resolution Strategy
+ - **Primary Key**: `character.id` from SC2Pulse API as canonical player identifier
+ - **Cross-Reference**: `playerCharacterId` ↔ CSV `btag`/`name` mapping for complete profiles
+ - **External Links**: "Revealed" profiles enable tournament/streaming data correlation
+ - **Validation**: Always verify identity data exists before enrichment attempts
+ 
+ ### Multi-Source Data Integration
+ - **Temporal Alignment**: Use `lastPlayed` timestamps for activity correlation across platforms
+ - **Confidence Levels**: 1v1 data (high), team modes (medium), external APIs (varies by source)
+ - **Fallback Strategy**: Graceful degradation when external enrichments unavailable
+ - **Rate Limiting**: Coordinate API calls across SC2Pulse (10 RPS), Arcade, Twitch, tournament sources
+ 
+ ### Historical Data Patterns
+ - **Season Boundaries**: Use `battlenetId` + `region` for temporal segmentation
+ - **Progression Tracking**: Compare rating/league changes across seasons for skill development
+ - **Meta Analysis**: Correlate race distribution changes with balance patch dates
+ - **Activity Cycles**: Track playing frequency patterns for engagement insights
+ 
+ ### Community Feature Heuristics
+ - **Team Chemistry**: Compare team performance vs individual ratings for synergy metrics
+ - **Regional Trends**: Cross-reference US/EU/KR ladder activity with tournament participation
+ - **Skill Clustering**: Group players by similar MMR trajectories for matchmaking insights
+ - **Professional Pipeline**: Monitor amateur → pro transitions via tournament data integration