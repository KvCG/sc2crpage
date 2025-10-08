# Onboarding Checklist

> **Verify your SC2CR setup** - Use this checklist to ensure everything is working properly

## ✅ Setup Verification

### Prerequisites ✓
- [ ] **Node.js 18+**: `node --version` shows 18.x or higher
- [ ] **npm 9+**: `npm --version` shows 9.x or higher  
- [ ] **Git**: `git --version` shows version info
- [ ] **VS Code** (recommended): Installed with extensions

### Project Setup ✓
- [ ] **Repository cloned**: `git clone https://github.com/KvCG/sc2crpage.git` 
- [ ] **Dependencies installed**: `npm install` completed successfully
- [ ] **Environment file**: `.env` created in project root (optional but recommended)
- [ ] **No errors**: No red error messages in terminal during setup

### Development Server ✓
- [ ] **Server starts**: `npm run dev` runs without errors
- [ ] **Frontend loads**: http://localhost:5173 shows SC2CR homepage
- [ ] **Backend responds**: http://localhost:3000/api/health returns `{"status":"ok"}`
- [ ] **Hot reload works**: Edit a file and see changes instantly in browser

### Data Configuration ✓
- [ ] **Data file present**: `dist/data/ladderCR.csv` exists OR auto-download configured
- [ ] **Rankings load**: Can navigate to rankings page without errors
- [ ] **API responses**: Network tab shows successful API calls (200 status)

---

## 🔧 Development Tools

### Code Quality ✓
- [ ] **Linting works**: `npm run lint` runs and passes (or shows fixable issues)
- [ ] **Type checking**: `npm run type-check` passes without TypeScript errors
- [ ] **Tests run**: `npm test` executes client and server tests
- [ ] **Build succeeds**: `npm run build` creates production build

### Editor Setup ✓
- [ ] **ESLint extension**: Shows linting errors inline in VS Code  
- [ ] **TypeScript support**: Shows type errors and suggestions
- [ ] **Prettier formatting**: Auto-formats code on save
- [ ] **IntelliSense**: Shows autocomplete for imports and functions

---

## 🧪 Functionality Tests

### Frontend Features ✓
- [ ] **Navigation**: Can click through different pages without errors
- [ ] **UI components**: Buttons, forms, and tables render properly
- [ ] **Responsive design**: Layout adapts to different window sizes
- [ ] **No console errors**: Browser developer console shows no red errors

### Backend API ✓  
- [ ] **Health check**: `/api/health` returns status
- [ ] **Rankings endpoint**: `/api/top` returns player data
- [ ] **CORS handling**: API calls from frontend work without CORS errors
- [ ] **Error handling**: Invalid requests return proper error responses

### Integration ✓
- [ ] **API proxy**: Frontend requests to `/api/*` reach backend server
- [ ] **Data flow**: Changes in backend data appear in frontend
- [ ] **Environment switching**: Understands local vs dev vs production configs
- [ ] **Build assets**: Production build includes all necessary files

---

## 🔄 Workflow Verification

### Git Workflow ✓
- [ ] **Branch creation**: Can create feature branch: `git checkout -b test-branch`
- [ ] **Changes tracked**: `git status` shows modified files  
- [ ] **Commit works**: Can commit changes with proper message format
- [ ] **Branch switching**: Can switch between dev and feature branches

### Development Process ✓
- [ ] **Make changes**: Edit a React component and see updates
- [ ] **Fix linting**: Resolve any ESLint warnings or errors
- [ ] **Run tests**: Verify tests still pass after changes
- [ ] **Create PR**: Know how to submit pull request to dev branch

---

## 📚 Knowledge Check

### Project Understanding ✓
- [ ] **Architecture**: Understand React frontend + Express backend structure
- [ ] **Tech stack**: Know main technologies (React, TypeScript, Vite, Express, Mantine)
- [ ] **Data sources**: Aware of SC2Pulse API, Challonge, and Google Drive integrations
- [ ] **Deployment**: Understand Vercel (frontend) + Render/Fly.io (backend) setup

### Development Standards ✓
- [ ] **Code style**: Familiar with ESLint rules and TypeScript conventions
- [ ] **Commit format**: Know Conventional Commits format (`feat:`, `fix:`, etc.)
- [ ] **Testing approach**: Understand Vitest for unit/integration tests
- [ ] **Documentation**: Know where to find architecture docs and API references

---

## 🎯 Ready for Contribution

### Contribution Readiness ✓
- [ ] **Good first issues**: Browsed [good first issue](https://github.com/KvCG/sc2crpage/labels/good%20first%20issue) labels
- [ ] **Development workflow**: Read [development workflow guide](../development/workflow.md)  
- [ ] **Contributing guidelines**: Familiar with project contributing standards
- [ ] **Community channels**: Know where to ask questions (GitHub Issues)

### Next Steps ✓
- [ ] **Pick first task**: Selected specific issue or improvement to work on
- [ ] **Create branch**: Started feature branch for first contribution
- [ ] **Setup tracking**: Added project to personal development workflow
- [ ] **Join community**: Introduced yourself through GitHub issues or project channels

---

## 🚨 Common Issues Resolved

If you encountered any of these during setup, check them off once resolved:

### Setup Issues ✓
- [ ] **Port conflicts**: Resolved "port already in use" errors
- [ ] **Permission issues**: Fixed npm install permission problems  
- [ ] **Node version**: Updated to Node.js 18+ from older version
- [ ] **Git configuration**: Set up Git credentials and SSH keys

### Development Issues ✓
- [ ] **TypeScript errors**: Resolved type checking issues
- [ ] **Import problems**: Fixed module resolution errors
- [ ] **Build failures**: Debugged and fixed build compilation issues  
- [ ] **Test failures**: Fixed failing tests or understood expected failures

### Data/API Issues ✓
- [ ] **Missing data file**: Obtained and properly placed ladderCR.csv
- [ ] **API configuration**: Set up environment variables for external APIs
- [ ] **Google Drive setup**: Configured service account for auto-download
- [ ] **CORS problems**: Resolved cross-origin request issues

---

## 📋 Completion Status

### Setup Complete ✓
- [ ] **All prerequisites met**: ✅ Software installed and configured  
- [ ] **Project running locally**: ✅ Frontend and backend operational
- [ ] **Development tools working**: ✅ Linting, testing, building successful
- [ ] **Ready to contribute**: ✅ Familiar with workflow and standards

### Knowledge Areas ✓
- [ ] **Project structure**: ✅ Understand codebase organization
- [ ] **Development process**: ✅ Know Git workflow and coding standards  
- [ ] **Testing strategy**: ✅ Can run and write tests
- [ ] **Deployment process**: ✅ Understand CI/CD and environment management

---

## 🎉 Onboarding Complete!

**Congratulations!** If you've checked all the boxes above, you're ready to contribute effectively to SC2CR.

### Your Next Actions:
1. **Find Your First Contribution**: Browse [issues](https://github.com/KvCG/sc2crpage/issues)
2. **Join the Community**: Introduce yourself and ask questions  
3. **Start Small**: Pick a small issue to get familiar with the contribution process
4. **Share Your Experience**: Help improve this onboarding process for future contributors

### Quick References:
- 📖 **[Development Guide](../development/README.md)** - Comprehensive development setup  
- 🏗️ **[Architecture Overview](../architecture/README.md)** - System design and data flow
- 🔌 **[API Documentation](../api/README.md)** - Backend API reference
- 🚀 **[Feature Guides](../features/README.md)** - Current and planned features

**Need help?** → [Troubleshooting](troubleshooting.md) | [GitHub Issues](https://github.com/KvCG/sc2crpage/issues)

---

*Last updated: October 2025 | [Improve this checklist](https://github.com/KvCG/sc2crpage/edit/dev/docs/getting-started/onboarding-checklist.md)*