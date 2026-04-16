# Getting Started with SC2CR

Complete guide to setting up SC2CR for development.

**Need a quick setup?** → [Quick Setup Guide](quick-setup.md)

## Prerequisites

Required software:
```bash
node --version    # 18.x or higher
npm --version     # 9.x or higher  
git --version     # Any recent version
```

Install from:
- **Node.js**: [Download LTS](https://nodejs.org/)
- **Git**: [Download](https://git-scm.com/downloads)
- **VS Code**: [Download](https://code.visualstudio.com/) (recommended)

## Setup

1. **Clone and install**:
```bash
git clone https://github.com/KvCG/sc2crpage.git
cd sc2crpage
npm install
```

2. **Create environment file** (optional):
```bash
cat > .env << 'EOF'
PORT=3000
LOG_LEVEL=info
EOF
```

## Data Setup

Community player data is loaded from **Supabase** at startup — no CSV file or manual download required. Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in your environment (contact **NeO** or **Kerverus** for credentials).

## Running the Application

```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000

Verify at http://localhost:3000/api/health should return `{"status": "ok"}`

**Having issues?** → [Troubleshooting Guide](troubleshooting.md)

---

## Project Structure

```
sc2crpage/
├── 📁 src/
│   ├── 📁 client/          # React frontend application
│   │   ├── components/     # Reusable UI components  
│   │   ├── pages/         # Route-based page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API integration logic
│   │   └── types/         # TypeScript type definitions
│   │
│   ├── 📁 server/          # Express backend API
│   │   ├── routes/        # API route definitions
│   │   ├── services/      # External API integrations
│   │   ├── utils/         # Utility functions
│   │   └── middleware/    # Express middleware
│   │
│   └── 📁 shared/          # Code shared between client/server
│
├── 📁 docs/               # Documentation (you're here!)
├── 📁 scripts/            # Build and utility scripts
├── 📄 package.json        # Dependencies and scripts
└── 📄 README.md          # Project overview
```

**Key files:**
- `src/client/App.tsx` - Main React app
- `src/server/server.ts` - Express server
- `package.json` - Scripts and dependencies

## Architecture Overview

**Stack**: React + TypeScript (frontend) + Node.js + Express (backend)
**Data**: SC2Pulse API, Challonge API, Google Drive  
**Development**: Vite dev server with hot reload + concurrent backend

**Want details?** → [Architecture Overview](../architecture/README.md)

## Development Workflow

**Branching**: Work from `dev` branch, create feature branches for changes
**Quality**: ESLint, TypeScript, Prettier, Vitest testing
**Commits**: Use format `type(scope): description` 

**Details**: [Development Workflow Guide](../development/workflow.md)

## Testing Your Setup

Test your environment:
1. **Edit**: Add your name to title in `src/client/pages/Home.tsx`
2. **View**: Check http://localhost:5173 (should update automatically)
3. **Quality check**: Run `npm run lint` and `npm test`
4. **Revert**: `git checkout src/client/pages/Home.tsx`

## Quality Checks

Before submitting changes:
```bash
npm run lint       # Code style
npm test          # Run tests
npm run build     # Verify production build
```

## Next Steps

- **Architecture**: [Architecture Overview](../architecture/README.md)
- **Development**: [Development Workflow](../development/workflow.md)
- **Contributing**: [Contributing Guidelines](../development-process/contributing.md)  
- **Features**: [Feature Documentation](../features/)

**Need help?** Check [Troubleshooting](troubleshooting.md) or [create an issue](https://github.com/KvCG/sc2crpage/issues)