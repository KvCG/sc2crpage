# Troubleshooting Guide

> **Common issues and solutions** for SC2CR development setup

## 🔧 Installation Issues

### Node.js Version Problems

**Error**: `npm install` fails with version warnings
```bash
# Check version
node --version  # Should be 18.x or higher

# Update Node.js
# Option 1: Download from https://nodejs.org/
# Option 2: Use nvm (Linux/Mac)
nvm install 18
nvm use 18

# Option 3: Use nvs (Windows)  
nvs add 18
nvs use 18
```

### npm Install Failures

**Error**: `npm install` fails with permission or network errors
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# If permission issues on Linux/Mac:
sudo chown -R $(whoami) ~/.npm
```

### Git Clone Issues

**Error**: `git clone` fails with authentication errors
```bash
# Use HTTPS instead of SSH
git clone https://github.com/KvCG/sc2crpage.git

# Or configure Git credentials
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## 🚀 Development Server Issues

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`
```bash
# Find and kill process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:3000 | xargs kill -9

# Or use npx tool:
npx kill-port 3000 5173
```

### Frontend Won't Load

**Issue**: http://localhost:5173 shows errors or won't load

**Solution 1**: Check Vite server logs
```bash
# Look for error messages in terminal
npm run dev
# Check for TypeScript errors, missing dependencies
```

**Solution 2**: Clear Vite cache
```bash
# Remove Vite cache and restart
rm -rf node_modules/.vite
npm run dev
```

**Solution 3**: Check browser console
```bash
# Open browser DevTools (F12)
# Look for JavaScript errors in Console tab
# Check Network tab for failed requests
```

### Backend API Issues

**Issue**: http://localhost:3000/api/health returns 404 or error

**Solution 1**: Check server startup logs
```bash
# Look for "Server running on port 3000" message
# Check for startup errors or missing environment variables
```

**Solution 2**: Verify API proxy
```bash
# Check vite.config.ts proxy configuration
# Ensure /api/* requests are proxied to localhost:3000
```

**Solution 3**: Test direct API access  
```bash
# Test API directly (bypassing Vite proxy)
curl http://localhost:3000/api/health
# Should return: {"status":"ok"}
```

---

## 📊 Data File Issues

### Missing ladderCR.csv

**Issue**: Server starts but rankings don't load

**Solution 1**: Check data file location
```bash
# After running npm run build, check:
ls -la dist/data/ladderCR.csv
# File should exist and have content
```

**Solution 2**: Request data file
```bash
# Contact maintainers (NeO or Kerverus) for:
# - ladderCR.csv file
# - Proper placement instructions
```

**Solution 3**: Configure Google Drive auto-download
```bash
# Add to .env file:
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
# Server will auto-download data on startup
```

### Google Drive Configuration

**Issue**: Auto-download fails with authentication errors

**Solution**: Verify service account configuration
```bash
# Check .env file has valid JSON:
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# Verify service account has access to:
# - RankedPlayers_Prod folder (production)
# - RankedPlayers_Dev folder (development)
```

---

## 🧪 Testing Issues

### Tests Fail to Run

**Error**: `npm test` command fails or hangs

**Solution 1**: Update test dependencies
```bash
# Ensure vitest and related packages are installed
npm install --save-dev vitest @vitest/ui jsdom
```

**Solution 2**: Clear test cache
```bash
# Remove test cache and retry
rm -rf node_modules/.cache
npm test
```

**Solution 3**: Check test configuration
```bash
# Verify vitest.client.config.ts and vitest.server.config.ts exist
# Check for TypeScript errors in test files
npm run type-check
```

### Individual Tests Fail

**Issue**: Specific tests fail with import or mock errors

**Solution**: Check test setup
```bash
# Verify test/setup.ts configuration
# Check for missing test utilities or mocks
# Ensure __tests__ folders have proper imports
```

---

## 🔨 Build Issues

### TypeScript Compilation Errors

**Error**: `npm run build` fails with TypeScript errors

**Solution 1**: Fix TypeScript errors
```bash
# Check for type errors
npm run type-check
# Fix reported errors in code files
```

**Solution 2**: Update TypeScript configuration  
```bash
# Ensure tsconfig.json is properly configured
# Check for missing type declarations
npm install --save-dev @types/node @types/react
```

### Vite Build Failures

**Error**: Frontend build fails with Vite errors

**Solution**: Check Vite configuration
```bash
# Verify vite.config.ts settings
# Ensure all imports are properly resolved
# Check for missing dependencies
npm install
```

---

## 🌐 Environment Issues

### Environment Variables Not Loading

**Issue**: `.env` file variables not recognized

**Solution 1**: Check file location and format
```bash
# Ensure .env is in project root (not docs/ or src/)
# Verify format (no spaces around =):
PORT=3000
LOG_LEVEL=info
```

**Solution 2**: Restart development server
```bash
# Environment changes require restart
# Stop npm run dev (Ctrl+C) and restart
npm run dev
```

### Production Environment Issues

**Issue**: App works locally but fails in deployment

**Solution**: Check environment-specific configuration
```bash
# Verify production environment variables are set
# Check deployment logs for startup errors
# Ensure all dependencies are in package.json (not devDependencies)
```

---

## 🔍 Debugging Techniques

### Enable Debug Logging

```bash
# Add to .env for verbose logging:
LOG_LEVEL=debug
LOG_HTTP_SUCCESS=true

# Restart server to see detailed logs
npm run dev
```

### Check Network Requests

```bash
# Use browser DevTools Network tab
# Monitor API calls from frontend to backend
# Check request/response status and timing
```

### Verify File Permissions

```bash
# Ensure all files are readable/writable
# Linux/Mac:
chmod -R 755 .
chmod -R 644 *.json *.ts *.md

# Windows: Check file properties for read/write access
```

---

## 🆘 Getting Additional Help

### Self-Service Resources
1. **Search [GitHub Issues](https://github.com/KvCG/sc2crpage/issues)** - Previous problems and solutions
2. **Check [Copilot Instructions](../../.github/instructions/copilot-instructions.md)** - Development patterns and standards  
3. **Review [Development Guide](../development/README.md)** - Comprehensive development setup

### Community Support
1. **Create [New Issue](https://github.com/KvCG/sc2crpage/issues/new)** - Report bugs or request help
2. **Contact Maintainers**: NeO or Kerverus via project channels

### Information to Include When Asking for Help
```bash
# System information
node --version
npm --version
git --version

# Error messages (copy full terminal output)
# Steps you tried
# Expected vs actual behavior
```

---

## 📋 Pre-Flight Checklist

Before asking for help, verify you've tried:

- [ ] **Prerequisites**: Node.js 18+, Git installed
- [ ] **Clean install**: `rm -rf node_modules && npm install`  
- [ ] **Port availability**: Kill processes on ports 3000, 5173
- [ ] **Environment file**: `.env` in project root with basic config
- [ ] **TypeScript check**: `npm run type-check` passes
- [ ] **Latest code**: `git pull origin dev` for updates
- [ ] **Browser cache**: Hard refresh (Ctrl+Shift+R) or incognito mode

**Still stuck?** Don't hesitate to ask - we're here to help! 🤝

---

*Last updated: October 2025 | [Improve this guide](https://github.com/KvCG/sc2crpage/edit/dev/docs/getting-started/troubleshooting.md)*