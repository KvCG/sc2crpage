# SC2CR: StarCraft 2 Community Rankings 🏆

Full-stack application for tracking StarCraft 2 player statistics, replays, and tournaments.

**Live Site**: [sc2cr.vercel.app](https://sc2cr.vercel.app/)

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/KvCG/sc2crpage.git
cd sc2crpage
npm install

# Start development
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000

**New to the project?** → [Getting Started Guide](getting-started/README.md)

## ⚡ Tech Stack

**Frontend**: React + TypeScript + Vite + Mantine UI  
**Backend**: Node.js + Express + TypeScript  
**Data**: SC2Pulse API, Challonge API, Google Drive  
**Deploy**: Vercel (frontend) + Render/Fly.io (backend)

## 📋 Commands

```bash
# Development
npm run dev          # Start full-stack dev server
npm run build        # Build for production
npm start           # Start production server

# Quality
npm run lint        # Check code style
npm test           # Run tests
```

## 🌍 Environments

| Environment | Frontend | Backend |
|-------------|----------|---------|
| **Local** | localhost:5173 | localhost:3000 |
| **Production** | sc2cr.vercel.app | Render |
| **Development** | Vercel Preview | Fly.io |

## 🤝 Contributing

1. **Setup**: [Development Setup](development/README.md)
2. **Workflow**: [Contributing Guidelines](development-process/contributing.md)  
3. **Standards**: [Code Style Guide](../.github/instructions/copilot-instructions.md)

### Quick Flow
```bash
git checkout dev
git checkout -b feature/your-feature
# Make changes, test, lint
# Submit PR to dev branch
```

## 📚 Documentation

**Getting Started**
- [Getting Started Guide](getting-started/README.md) - Complete setup guide
- [Quick Setup](getting-started/quick-setup.md) - Fast development setup
- [Troubleshooting](getting-started/troubleshooting.md) - Common issues

**Development**
- [Architecture Overview](architecture/README.md) - System design
- [Development Workflow](development/workflow.md) - Git flow and standards
- [Testing Guide](development/testing.md) - Testing strategy

**API & Features**
- [API Documentation](api/README.md) - Endpoints and usage
- [Community Analytics](features/community-analytics.md) - Player statistics
- [Ranking System](features/ranking-system.md) - Ranking calculations

**Reference**
- [Environment Variables](reference/environment-variables.md) - Configuration

## 🔗 Links

- **Issues**: [GitHub Issues](https://github.com/KvCG/sc2crpage/issues)