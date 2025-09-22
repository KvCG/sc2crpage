# SC2CR: StarCraft 2 Community Rankings

A full-stack application for tracking StarCraft 2 player statistics, replays, and tournaments.

- **Live Site**: [SC2CR](https://sc2cr.vercel.app/)
- **Tech Stack**: React/TypeScript (client) + Node/Express (server)

## 🚀 Quick Start for Developers

```bash
# Clone and setup
git clone https://github.com/KvCG/sc2crpage.git
cd sc2crpage
npm install

# Get the ladder data file (required)
# Option 1: Request from maintainers (NeO or Kerverus)
# Option 2: Configure Firebase (see Environment Variables below)

# Start development server (client + server)
npm run dev
```

The app will be available at:
- Frontend: http://localhost:5173 (Vite)
- API: http://localhost:3000

## 📚 Project Architecture

### Client (`src/client`)
- React application with TypeScript and Vite
- UI library: [Mantine v7](https://mantine.dev/)
- Routing: React Router v6
- API client: Custom hooks in `hooks/useFetch.tsx`
- Config: Environment-aware API base selection in `services/config.ts`

### Server (`src/server`)
- Express-based API with TypeScript
- Data sources:
  - SC2Pulse API integration via `services/pulseApi.ts`
  - Challonge API for tournaments via `services/challongeApi.ts`
  - Firebase storage for ladder data
- Caching: LRU in-memory cache with 30s TTL

### Key Data Flow
1. Client makes requests to `/api/*` endpoints
2. Server routes requests via `routes/apiRoutes.ts`
3. Services fetch and transform external data
4. Cached results returned to client

## 💻 Development Workflow

### Common Commands

```bash
# Development mode (concurrent FE + BE)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint codebase
npm run lint

# Docker workflow
npm run buildImg     # Build Docker image
npm run localPod     # Run container on http://localhost:3000
```

### Ladder Data

The server requires `ladderCR.csv` to operate correctly:

```bash
# After build, place data file in:
dist/data/ladderCR.csv
```

If Firebase is configured, the server will auto-download the file on first run.

## 🌐 Environments

| Environment | Client                           | API                                   |
|-------------|----------------------------------|---------------------------------------|
| Local       | Vite (localhost:5173)            | Express (localhost:3000)              |
| Dev         | Vercel Preview (from `dev`)      | Fly.io (`sc2cr-dev.fly.dev`)          |
| Production  | Vercel (sc2cr.vercel.app)        | Render (`sc2cr-latest.onrender.com`) |

**Note**: All Vercel previews (including from feature branches) are considered "dev" environments because they connect to the Fly.io dev API.

For detailed environment configuration, see [docs/technical-documentation/environments.md](docs/technical-documentation/environments.md).

## 🔧 Environment Variables

Server requires these environment variables:

```
# Firebase (optional, for ladder data download)
FIREBASE_SERVICE_ACCOUNT_KEY=<JSON string>

# External APIs
CHALLONGE_API_KEY=<key>
CURRENT_TOURNAMENT=<id>
GOOGLE_SERVICE_ACCOUNT_KEY=<JSON string>
REPLAY_ANALYZER_URL=<url>

# Tunables
MMR_RANGE_FOR_PREMIER_MATCH=<number>
MMR_RANGE_FOR_CLOSE_MATCH=<number>
PORT=3000
```

## 🤝 Contributing

We use a streamlined trunk-based workflow with `dev` as the integration branch:

- Day-to-day: work directly on `dev` or create feature branches from `dev`
- Never merge `dev` into `main`
- Releases: curate a subset of `dev` and merge via a `release/*` branch into `main`

```bash
# Start work from dev (optionally branch for isolation)
git checkout dev
git pull origin dev
git checkout -b feature/my-feature

# Prepare a curated release (pick only the changes you want)
git checkout dev
git pull origin dev
git checkout -b temp-release-prep
git rebase -i origin/main   # pick/squash/drop to curate

# Create a release branch from main and merge curated changes
git checkout main
git pull origin main
git checkout -b release/1.x.x
git merge --no-ff temp-release-prep

# Open PR to main; after merge, tag
git tag v1.x.x
git push origin main --tags
```

- Commit messages: follow Conventional Commits (e.g., `feat(api): ... [BL-012]`).
- Details in [docs/development-process/contributing.md](docs/development-process/contributing.md) and
  [docs/development-process/branching-strategy.md](docs/development-process/branching-strategy.md).

## 🔄 CI/CD

Unified workflow in `.github/workflows/Deploy.yml`:

1. **Checks**: Lint, type-check, tests
2. **Docker**: Build and push to Docker Hub + Fly.io registry
3. **Deploy**:
   - On `main`: API to Render via webhook
   - On `dev`: API to Fly.io via prebuilt image
   - Frontend: Automatic via Vercel integration

## 📋 Documentation Index

### Technical Documentation
- **Architecture**: [docs/technical-documentation/architecture.md](docs/technical-documentation/architecture.md)
- **Environments**: [docs/technical-documentation/environments.md](docs/technical-documentation/environments.md)
- **Environment Setup**: [docs/technical-documentation/environment-setup.md](docs/technical-documentation/environment-setup.md)

### Process Documentation
- **Contributing**: [docs/development-process/contributing.md](docs/development-process/contributing.md)
- **Branching Strategy**: [docs/development-process/branching-strategy.md](docs/development-process/branching-strategy.md)
- **Deployment**: [docs/development-process/deployment.md](docs/development-process/deployment.md)
- **Testing**: [docs/development-process/testing.md](docs/development-process/testing.md)

### Project Management
- **Backlog**: [docs/backlog/backlog.md](docs/backlog/backlog.md)
- **Backlog Usage**: [docs/backlog/usage.md](docs/backlog/usage.md)

## 📚 External Resources

- [SC2Pulse API Documentation](https://sc2pulse.nephest.com/sc2/doc/swagger-ui/index.html)
- [Blizzard StarCraft II Community APIs](https://develop.battle.net/documentation/starcraft-2/community-apis)