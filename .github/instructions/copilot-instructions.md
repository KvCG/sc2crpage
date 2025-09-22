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
  - Option 1: If Firebase configured via `FIREBASE_SERVICE_ACCOUNT_KEY`, auto-downloads on first run
  - Option 2: Manually place the file after build
  - Option 3: Request from maintainers (NeO or Kerverus)

## Server Patterns
- **Caching**: `utils/cache.ts` stores snapshots with TTL 30s; prevents request stampedes by sharing in-flight promises
- **Data Sources**:
  - SC2Pulse: `services/pulseApi.ts` implements player search and rankings
  - Challonge: `services/challongeApi.ts` for tournament data
  - Firebase: `services/firebase.ts` for ladder data storage
  - Google Drive: `services/googleApi.ts` for replay uploads/listing and analysis JSON retrieval
- **Middleware**: Server serves static assets, mounts API routes, and falls back to SPA

## Client Patterns
- **Config**: `services/config.ts` selects API endpoint based on hostname:
  - Production: Render API (e.g., `sc2cr-latest.onrender.com`, Vercel domains)
  - Development: Fly.io dev API
  - Local: `http://localhost:3000/`
- **Components**: Organized by feature in `components/` directory
- **Pages**: Main application views in `pages/` directory
- **Hooks**: Custom data fetching in `hooks/` directory

## CI/CD
- **Workflow**: `.github/workflows/Deploy.yml` handles checks, Docker builds, and deployments
- **Environments**:
  - Production: Main branch → Vercel + Render
  - Development: Dev branch → Vercel preview + Fly.io
  - Pull Requests: Preview deployments with dev API backend

## Environment Variables
- **Firebase**: `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string)
- **Challonge**: `CHALLONGE_API_KEY`, `CURRENT_TOURNAMENT`
- **Google**: `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON string)
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

Treat this guide as living, with **single sources of truth**:
- **Branching/Release:** `docs/development-process/contributing.md` and `docs/development-process/branching-strategy.md`. Keep these authoritative and update others to match.
- **Environments & URLs:** `docs/technical-documentation/environments.md`. Update when API bases or routing change.
- **Testing plan:** `docs/development-process/testing.md`. Keep first-targets and CI notes aligned with reality.
- **Where to find things:** The root `README.md` links the canonical docs set—add new docs there.