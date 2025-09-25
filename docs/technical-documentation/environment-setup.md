# Environment Setup Guide

This guide provides detailed steps for setting up your development environment for the SC2CR project.

## Prerequisites

- Node.js 18+ and npm 9+
- Git
- Docker (optional, for container-based development)

## Local Development Setup

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

Create a `.env` file in the project root with these variables:

```
# Required for tournament functionality
CHALLONGE_API_KEY=<your-key>
CURRENT_TOURNAMENT=<tournament-id>

# Required for Google Sheets integration
GOOGLE_SERVICE_ACCOUNT_KEY=<json-string>

# Optional: Firebase for ladder data download
FIREBASE_SERVICE_ACCOUNT_KEY=<json-string>

# Optional: Replay analyzer integration
REPLAY_ANALYZER_URL=<url>

# Optional: MMR thresholds for match categorization
MMR_RANGE_FOR_PREMIER_MATCH=400
MMR_RANGE_FOR_CLOSE_MATCH=200

# Optional: Minimum games to appear in rankings (default 10)
RANKING_MIN_GAMES=10

# Server port (default 3000)
PORT=3000
```

### 4. Get the Ladder Data

The application requires a `ladderCR.csv` file to function properly. You have two options:

#### Option A: Request the File

Contact the project maintainers (NeO or Kerverus) to get the current `ladderCR.csv` file.

After building the project, place it in:
```
dist/data/ladderCR.csv
```

#### Option B: Configure Firebase Auto-Download

If you've set up the `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable, the server will automatically download the ladder data file on first run.

### 5. Start Development Server

Start the development environment:

```bash
npm run dev
```

This runs:
- Frontend: Vite dev server at http://localhost:5173
- Backend: Express server at http://localhost:3000

## Docker Development

For containerized development:

```bash
# Build the Docker image
npm run buildImg

# Run the container locally
npm run localPod

# Access the application at http://localhost:3000
```

## Configuration Files

The client uses environment-specific configuration files:

- `src/client/config/dev.config.json`: Development API URL
- `src/client/config/prod.config.json`: Production API URL

These are selected automatically based on the deployment environment by `src/client/services/config.ts`.

## Troubleshooting

### Missing Ladder Data

If you see errors related to ladder data:

1. Check if `dist/data/ladderCR.csv` exists
2. Verify Firebase configuration if using auto-download
3. Request the file from maintainers if needed

### API Connection Issues

- Verify API endpoints in the appropriate config file
- Check that the server is running on the expected port
- Confirm environment variables are properly set

### Build Failures

- Clear the `dist` directory and try rebuilding
- Ensure all dependencies are installed: `npm install`
- Check for TypeScript errors: `tsc -b`