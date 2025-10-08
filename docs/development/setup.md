# Development Environment Setup

This guide covers setting up a local development environment for the SC2CR project.

## Prerequisites

### Required Software
- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher (comes with Node.js)
- **Git**: For version control
- **Code Editor**: VS Code recommended with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features

### System Requirements
- **OS**: Windows, macOS, or Linux
- **RAM**: Minimum 8GB (16GB recommended for optimal performance)
- **Storage**: At least 2GB free space for dependencies and build artifacts

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/KvCG/sc2crpage.git
cd sc2crpage
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env` file in the project root:

```bash
# Required for basic functionality
PORT=3000

# Optional - External API keys (for full functionality)
CHALLONGE_API_KEY=your_challonge_key_here
CURRENT_TOURNAMENT=your_tournament_id
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
REPLAY_ANALYZER_URL=https://your-replay-analyzer.com

# Optional - Configuration
MMR_RANGE_FOR_PREMIER_MATCH=200
MMR_RANGE_FOR_CLOSE_MATCH=100
RANKING_MIN_GAMES=10

# Optional - Feature Flags (default: false)
ENABLE_PLAYER_ANALYTICS=true
ENABLE_DATA_SNAPSHOTS=true
ENABLE_BARCODE_HELPER=false

# Optional - Logging
LOG_LEVEL=info
LOG_HTTP_SUCCESS=false
```

### 4. Get Ladder Data File
The server requires `ladderCR.csv` to operate. You have three options:

#### Option A: Request from Maintainers (Recommended)
Contact NeO or Kerverus for the latest ladder data file.

#### Option B: Auto-download (If Google Drive configured)
If you have `GOOGLE_SERVICE_ACCOUNT_KEY` configured, the server will automatically download the file on first run.

#### Option C: Manual Placement
Place the CSV file at `dist/data/ladderCR.csv` after running the build command.

### 5. Start Development Server
```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:3000 (Express server with nodemon)

## Development Workflow

### Common Commands
```bash
# Development (concurrent frontend + backend)
npm run dev

# Frontend only (useful for UI work with mock data)
npm run fedev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check
npm run type-check:watch

# Linting
npm run lint

# Testing
npm test                    # Run all tests
npm run test:client         # Client tests only  
npm run test:server         # Server tests only
npm run test:watch          # Watch mode
npm run coverage            # Coverage reports
```

### Project Structure
```
sc2crpage/
├── src/
│   ├── client/           # React frontend
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Application pages/views
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # API client code
│   │   └── config/       # Environment configs
│   ├── server/           # Express backend
│   │   ├── routes/       # API route handlers
│   │   ├── services/     # Business logic layer
│   │   ├── utils/        # Utility functions
│   │   └── __tests__/    # Server tests
│   ├── shared/           # Code shared between client/server
│   └── test/             # Test utilities and setup
├── docs/                 # Documentation
├── scripts/              # Build scripts
└── dist/                 # Build output
```

## Configuration Details

### Environment Detection
The application automatically detects its environment:

| Environment | Client URL | API URL |
|-------------|------------|---------|
| Local | http://localhost:5173 | http://localhost:3000 |
| Development | Vercel preview | sc2cr-dev.fly.dev |
| Production | sc2cr.vercel.app | sc2cr-latest.onrender.com |

### API Integration
- **SC2Pulse API**: No key required, but rate limited to 10 RPS
- **Challonge API**: Requires API key for tournament data
- **Google Drive**: Requires service account for file storage
- **Replay Analyzer**: Requires endpoint URL for replay processing

### Feature Flags
Control feature availability via environment variables:
- `ENABLE_PLAYER_ANALYTICS=true`: Advanced player statistics
- `ENABLE_DATA_SNAPSHOTS=true`: Background data collection
- `ENABLE_BARCODE_HELPER=true`: Barcode generation utilities

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3000
lsof -ti:3000

# Kill process (macOS/Linux)
kill -9 $(lsof -ti:3000)

# Or change port in .env file
PORT=3001
```

#### Missing Ladder Data
```
Error: ENOENT: no such file or directory, open 'dist/data/ladderCR.csv'
```
**Solution**: Follow step 4 above to obtain the ladder data file.

#### Build Failures
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear build cache
rm -rf dist/
npm run build
```

#### Type Check Errors
```bash
# Run type check to see specific errors
npm run type-check

# Common fixes:
# - Update import paths
# - Add missing type definitions
# - Check TypeScript configuration
```

### Performance Tips
- **Memory**: Close unnecessary applications during development
- **CPU**: Use `npm run fedev` for frontend-only development
- **Network**: Cache external API responses locally during development
- **Storage**: Regularly clean `node_modules` and `dist/` directories

## Docker Development

### Local Container
```bash
# Build Docker image
npm run buildImg

# Run container locally
npm run localPod

# Access at http://127.0.0.1:3000
```

### Container Development Workflow
```bash
# Build and test locally
npm run buildImg
npm run localPod

# Push to registry (maintainers only)
npm run pushImg
```

## IDE Configuration

### VS Code Settings
Create `.vscode/settings.json`:
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true
  }
}
```

### Recommended Extensions
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **TypeScript Hero**: Import organization
- **GitLens**: Git integration
- **Thunder Client**: API testing (alternative to Postman)

## Testing Setup

### Test Environment
- **Client**: Vitest with jsdom environment
- **Server**: Vitest with Node.js environment  
- **Mocking**: MSW (Mock Service Worker) for API calls
- **Coverage**: V8 provider with HTML reports

### Running Tests
```bash
# All tests with coverage
npm run coverage

# Watch mode during development
npm run test:watch

# Test specific files
npx vitest src/client/components/PlayerCard.test.tsx
```

## Next Steps
- Review [Contributing Guidelines](contributing.md) for development workflow
- Check [Testing Guide](testing.md) for test writing patterns
- See [Architecture Overview](../architecture/overview.md) for system design
- Read [API Documentation](../api/api-review.md) for endpoint details