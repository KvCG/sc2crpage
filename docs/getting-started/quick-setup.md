# Quick Setup Guide

> **Get SC2CR running in 10 minutes** - Fastest path to development

## 🚀 Express Setup

**Prerequisites**: Node.js 18+ and Git installed

```bash
# 1. Clone and install (3 minutes)
git clone https://github.com/KvCG/sc2crpage.git
cd sc2crpage
npm install

# 2. Start development (1 minute)
npm run dev
```

**Done!** Open http://localhost:5173 to see SC2CR running.

---

## 🔍 Verify Setup

### ✅ Check Frontend
- **URL**: http://localhost:5173
- **Expected**: SC2CR homepage loads
- **Browser Console**: No error messages

### ✅ Check Backend API
- **URL**: http://localhost:3000/api/health  
- **Expected**: `{"status": "ok"}`
- **Terminal**: Server logs show "Server running on port 3000"

---

## 📊 Data Setup

**Optional but recommended for full functionality:**

### Auto-Download (If Google Drive Configured)
```bash
# If you have GOOGLE_SERVICE_ACCOUNT_KEY set, 
# the server automatically downloads ladderCR.csv on first run
```

### Manual Setup
```bash
# Request ladderCR.csv from maintainers (NeO or Kerverus)
# Then place in: dist/data/ladderCR.csv (after npm run build)
```

### Development Without Data
The app works with limited functionality - perfect for UI development and basic testing.

---

## 🛠️ Essential Commands

```bash
# Development
npm run dev          # Start frontend + backend
npm run build        # Build for production
npm start           # Run production build

# Code Quality  
npm run lint        # Check code style
npm test           # Run tests
npm run type-check  # TypeScript validation
```

---

## 🚨 Quick Troubleshooting

### Port Already in Use
```bash
# Kill processes on ports 3000 or 5173
npx kill-port 3000 5173
npm run dev
```

### Dependencies Issues
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Build Fails
```bash
# Check TypeScript errors
npm run type-check
# Fix errors and try again
npm run build
```

---

## ➡️ Next Steps

**Setup successful?** Choose your next move:

### 🎯 **Start Contributing**
- Browse [Good First Issues](https://github.com/KvCG/sc2crpage/labels/good%20first%20issue)
- Read [Development Workflow](../development/workflow.md)

### 📚 **Learn the Codebase**  
- [Complete Onboarding Guide](README.md) - Thorough project introduction
- [Architecture Overview](../architecture/README.md) - System design
- [Project Structure](README.md#project-structure) - Code organization

### 🔧 **Advanced Setup**
- [Environment Variables](../reference/environment-variables.md) - Full configuration
- [Development Guide](../development/README.md) - Advanced development setup
- [Testing Guide](../development/testing.md) - Testing strategy

---

**Need help?** → [Troubleshooting Guide](troubleshooting.md) | [Create Issue](https://github.com/KvCG/sc2crpage/issues)

*Last updated: October 2025 | [Improve this guide](https://github.com/KvCG/sc2crpage/edit/dev/docs/getting-started/quick-setup.md)*