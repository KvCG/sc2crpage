# Architecture Overview

SC2CR is a full-stack application for tracking StarCraft 2 player statistics, replays, and tournaments.

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client        │    │   Server        │    │  External APIs  │
│   (React/Vite)  │────│  (Express/Node) │────│   & Services    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
│                      │                      │
│ • React Router v6    │ • Express routes     │ • SC2Pulse API
│ • Mantine UI         │ • Service layer      │ • Challonge API
│ • Custom hooks       │ • LRU cache         │ • Google Drive
│ • Environment config │ • Request logging    │ • Replay Analyzer
└──────────────────────└──────────────────────└─────────────────────
```

## Client Architecture (`src/client`)

### Core Components
- **React Application**: TypeScript-based SPA with Vite build system
- **UI Library**: Mantine v7 for consistent design system
- **Routing**: React Router v6 for client-side navigation
- **State Management**: React hooks and context for state management

### Key Modules
- **API Client**: Custom hooks in `hooks/useFetch.tsx` and `hooks/usePost.tsx`
- **Services**: API calls organized in `services/api.ts`
- **Configuration**: Environment-aware API selection in `services/config.ts`
- **Components**: Feature-based organization in `components/`
- **Pages**: Main application views in `pages/`

### Environment Configuration
The client automatically detects its environment based on hostname:

| Hostname | Environment | API Target |
|----------|-------------|-----------|
| `sc2cr.vercel.app` | Production | Render API |
| `sc2cr-latest.onrender.com` | Production | Render API |
| `sc2cr-dev` or `*.project.*` | Development | Fly.io dev API |
| `localhost` | Local | Local server (port 3000) |

## Server Architecture (`src/server`)

### Core Components
- **Express Server**: RESTful API with TypeScript
- **Route Composition**: Modular routing via `routes/apiRoutes.ts`
- **Service Layer**: Business logic and external API integration
- **Caching**: LRU in-memory cache with 30s TTL for performance

### Route Structure
```
/api
├── /top              # Live ranking data (pulseRoutes.ts)
├── /search           # Player search (pulseRoutes.ts)
├── /snapshot         # Daily baseline snapshots (pulseRoutes.ts)
├── /ranking          # Enhanced ranking with deltas (pulseRoutes.ts)
├── /tournament       # Tournament data (challongeRoutes.ts)
├── /health           # Health check (utilityRoutes.ts)
├── /refreshCache     # Cache management (utilityRoutes.ts)
├── /getReplays       # Replay management (googleRoutes.ts)
├── /uploadReplay     # Replay upload (googleRoutes.ts)
├── /analyzeReplay*   # Replay analysis (replayAnalyzerRoutes.ts)
├── /player-analytics # Player analytics (analyticsRoutes.ts)
├── /deltas          # Position deltas (analyticsRoutes.ts)
├── /scheduler       # Analytics scheduler (schedulerRoutes.ts)
└── /persistence     # Backup management (schedulerRoutes.ts)
```

### Service Layer
- **Pulse Integration**: `pulseApi.ts` + `pulseHttpClient.ts` for SC2Pulse API
- **Analytics**: `analyticsService.ts` for player statistics and trends
- **Data Processing**: `deltaComputationEngine.ts` for ranking changes
- **Persistence**: `playerAnalyticsPersistence.ts` for Google Drive backups
- **Scheduling**: `playerAnalyticsScheduler.ts` for automated operations
- **External APIs**: Dedicated services for Challonge, Google Drive, Replay Analyzer

### Data Flow
1. **Request**: Client makes HTTP request to `/api/*` endpoint
2. **Routing**: Express routes request to appropriate route handler
3. **Middleware**: Authentication, validation, rate limiting, logging
4. **Service Layer**: Business logic and external API calls
5. **Caching**: Check cache for existing data, store results if miss
6. **Response**: JSON response with standardized format and headers

## Data Sources

### Primary Data Source: SC2Pulse API
- **Purpose**: Live ladder rankings and player search
- **Rate Limits**: 10 RPS coordination across all features
- **Caching**: 30s TTL for live data, 24h for snapshots
- **Attribution**: Required header for non-commercial use

### Secondary Data Sources
- **CSV Data**: `ladderCR.csv` in `dist/data/` for offline capabilities
- **Google Drive**: Backup storage, replay management, analytics persistence
- **Challonge API**: Tournament bracket data
- **Replay Analyzer**: External service for replay processing

## Build & Deployment

### Development Workflow
```bash
npm run dev      # Concurrent FE (Vite) + BE (nodemon)
npm run build    # Production build (client + server)
npm start        # Production server (dist/webserver/server.cjs)
```

### Environment Targets
- **Local**: Vite dev server + Express server
- **Development**: Vercel preview + Fly.io API
- **Production**: Vercel + Render API

### Build Artifacts
- **Client**: Static assets in `dist/`
- **Server**: Bundled Express app in `dist/webserver/server.cjs`
- **Docker**: Multi-stage build for containerized deployment

## Security & Observability

### Request Tracking
- **Request IDs**: UUID correlation across client and server logs
- **HTTP Logging**: Structured logging with pino (quiet 2xx, error 4xx/5xx)
- **Metrics**: In-memory counters with debug endpoints

### Performance Features
- **Caching Strategy**: Multi-layer (in-memory + Google Drive persistence)
- **Rate Limiting**: Coordinated across external API integrations
- **Build Info**: Embedded version tracking in client and server

### Feature Flags
Environment-based feature toggling for gradual rollout:
- `ENABLE_PLAYER_ANALYTICS`: Advanced player statistics
- `ENABLE_DATA_SNAPSHOTS`: Background data collection
- `ENABLE_BARCODE_HELPER`: Barcode generation utilities

## Architecture Principles

1. **Separation of Concerns**: Clear boundaries between client, server, and external services
2. **Service Independence**: Each service operates independently with clear interfaces
3. **Graceful Degradation**: Fallback strategies when external services unavailable
4. **Single Source of Truth**: Canonical data models and consistent DTOs
5. **Observability First**: Comprehensive logging, metrics, and debugging capabilities

## Related Documentation

### Feature Implementation Guides
- **[Ranking System](../features/ranking-system.md)**: Core ranking features and position tracking
- **[Community Analytics](../features/community-analytics.md)**: Advanced analytics and delta computation

### Client Architecture
- **[Hooks & API Integration](../client-architecture/hooks.md)**: Client-side data patterns and integration

### API Documentation
- **[Endpoints Reference](../api/endpoints.md)**: Complete API specification
- **[API Review](../api/api-review.md)**: API design patterns and best practices