# SC2CR Web Application

A web application to track StarCraft 2 player statistics using the Blizzard Community API and other resources.

## Project Info
- **Website**: [SC2CR](https://sc2cr.vercel.app/)
- **Resources**:
  - [Blizzard API Getting Started Guide](https://develop.battle.net/documentation/guides/getting-started)
  - [Blizzard StarCraft II Community APIs](https://develop.battle.net/documentation/starcraft-2/community-apis)
  - [SC2Pulse API Documentation](https://sc2pulse.nephest.com/sc2/doc/swagger-ui/index.html)
  
See `docs/` for details:
- Environments: `docs/environments.md`
- Architecture: `docs/architecture.md`

## UI Library: Mantine
We use [Mantine](https://mantine.dev/getting-started/) as our UI library. Mantine provides a robust set of components and hooks to speed up development.

### Required Packages:
To use Mantine, you'll need to install several dependencies. These are automatically installed during setup (see below).

## Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/KvCG/sc2crpage.git
cd sc2crpage
```

### 2. Install Dependencies
Run the following command to install all necessary packages:
```bash
npm install
```

### 3. Obtain ladderCR.csv File
Request the `ladderCR.csv` file: Contact NeO or Kerverus to get this file.

### 4. Place the Data File
After building the project with `npm run build`, place the `ladderCR.csv` file inside the `dist/data` directory:
```bash
dist/data/ladderCR.csv
```

Note: If Firebase is configured via `FIREBASE_SERVICE_ACCOUNT_KEY`, the server will try to download this file on first run to `dist/data/ladderCR.csv`.

### 5. Start Development Server
Run the following command
```bash
npm run dev
```

## Contributing & CI/CD
- Branching: `main` (prod), `dev` (sandbox), `feature/*` from `main`.
- CI: single workflow `.github/workflows/Deploy.yml` runs checks (lint, type-check, tests) and builds Docker images.
- Deploys:
  - Frontend: Vercel handles per-branch previews; `dev` is a permanent preview.
  - All Vercel previews are considered dev environment (they talk to the Fly.io dev API).
  - API (prod): Render deploy via webhook on `main`.
  - API (dev): Fly.io deploy from prebuilt Docker image on `dev`.
- See `.github/` docs for contribution and deployment details.